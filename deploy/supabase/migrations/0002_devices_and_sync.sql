-- modelWrecker cloud control plane - device sign-in and result sync (Phase 10.7 to 10.9).
--
-- Apply after 0001_init.sql. Adds:
--   * automatic profile + free subscription for every new Google sign-in
--   * per-user workspace settings (sync privacy defaults: metadata only)
--   * device sign-in requests for the OAuth 2.0 device authorization grant (RFC 8628)
--   * stable engine keys so re-sending a run updates rows instead of duplicating them
--   * the summary columns the dashboard reads from synced runs
--
-- The device token is minted only when the engine polls after approval, returned once, and only its
-- SHA-256 hash is stored (devices.credential_hash). No plaintext token is ever written to the database.
--
-- RLS stays on for every table. device_auth_requests has no policies at all: only the API's server
-- key touches it, so no signed-in user can read another user's pending codes.
-- See docs/architecture/control-plane-api.md.

-- ---------------------------------------------------------------------------
-- Profiles: settings, and auto-create on first Google sign-in.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists settings jsonb not null default
    '{"sync": {"metadata": true, "detailedEvidence": false, "transcripts": false}, "notifications": {}}'::jsonb;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email)
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (owner_id) values (new.id)
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Devices: one hash per token, looked up on every device request.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'devices_credential_hash_key') then
    alter table public.devices add constraint devices_credential_hash_key unique (credential_hash);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Device sign-in requests (RFC 8628). Codes are stored hashed where they are secrets.
-- ---------------------------------------------------------------------------
create table if not exists public.device_auth_requests (
  id               uuid primary key default gen_random_uuid(),
  device_code_hash text not null unique,                 -- SHA-256 of the secret device_code
  user_code        text not null unique,                 -- short code the user types, e.g. WDJB-MJHT
  name             text not null,
  os               text,
  engine_version   text,
  status           text not null default 'pending'
                   check (status in ('pending', 'approved', 'denied', 'consumed')),
  owner_id         uuid references public.profiles (id) on delete cascade,
  project_id       uuid references public.projects (id) on delete set null,
  device_id        uuid references public.devices (id) on delete set null,
  last_polled_at   timestamptz,
  expires_at       timestamptz not null,
  created_at       timestamptz not null default now()
);
alter table public.device_auth_requests enable row level security;
-- No policies on purpose: server key only.

-- ---------------------------------------------------------------------------
-- Stable engine keys for idempotent sync, and summary columns.
-- ---------------------------------------------------------------------------
alter table public.campaigns
  add column if not exists external_id     text,
  add column if not exists objective_count integer not null default 0,
  add column if not exists strategies      text[] not null default '{}',
  add column if not exists stop_condition  text not null default 'complete',
  add column if not exists concurrency     integer not null default 1,
  add column if not exists max_attempts    integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'campaigns_owner_project_external_key') then
    alter table public.campaigns
      add constraint campaigns_owner_project_external_key unique (owner_id, project_id, external_id);
  end if;
end $$;

alter table public.runs
  add column if not exists external_id  text,
  add column if not exists device_id    uuid references public.devices (id) on delete set null,
  add column if not exists partials     integer not null default 0,
  add column if not exists refusals     integer not null default 0,
  add column if not exists errors       integer not null default 0,
  add column if not exists asr_ci_low   double precision,
  add column if not exists asr_ci_high  double precision,
  add column if not exists by_strategy  jsonb not null default '[]'::jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'runs_owner_external_key') then
    alter table public.runs add constraint runs_owner_external_key unique (owner_id, external_id);
  end if;
end $$;

alter table public.findings
  add column if not exists external_id text,
  add column if not exists run_id      uuid references public.runs (id) on delete set null,
  add column if not exists replays     integer,
  add column if not exists successes   integer,
  add column if not exists confidence  text,
  add column if not exists score       integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'findings_owner_external_key') then
    alter table public.findings add constraint findings_owner_external_key unique (owner_id, external_id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'targets_owner_project_name_key') then
    alter table public.targets add constraint targets_owner_project_name_key unique (owner_id, project_id, name);
  end if;
end $$;

create index if not exists runs_owner_idx on public.runs (owner_id);
create index if not exists findings_owner_idx on public.findings (owner_id);
create index if not exists campaigns_owner_idx on public.campaigns (owner_id);
