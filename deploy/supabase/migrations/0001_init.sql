-- modelWrecker cloud control plane - initial schema (DRAFT, Phase 10).
--
-- Apply this in the Supabase project "modelWrecker" (SQL editor or `supabase db push`).
-- This is the CONTROL PLANE only: identity, projects, devices, and SYNCED METADATA.
-- Heavy red-team computation and sensitive evidence stay on the user's machine.
-- Detailed evidence/transcripts are never stored here unless the user opts in.
--
-- Security model: Row-Level Security (RLS) is ON for every table. Every row is
-- scoped to an owner, and the Supabase auth identity (Google sign-in -> auth.uid())
-- decides what is visible. The service role (server-side API only) bypasses RLS.
--
-- NOTE: draft to be reconciled with docs/architecture/cloud-control-plane.md and
-- docs/architecture/DATA-MODEL.md before it is treated as final.

-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated user, linked to Supabase auth.users.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  display_name text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- projects: organizational containers owned by a user.
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  description text,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists projects_owner_idx on public.projects (owner_id);

-- ---------------------------------------------------------------------------
-- devices: each local engine install registers as a device. It holds only a
-- HASH of its scoped credential, never the raw token, and never the user's
-- Google token. No sensitive machine details beyond what is needed.
-- ---------------------------------------------------------------------------
create table if not exists public.devices (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  project_id       uuid references public.projects (id) on delete set null,
  name             text not null,
  os               text,
  engine_version   text,
  credential_hash  text not null,
  last_seen_at     timestamptz,
  revoked          boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists devices_owner_idx on public.devices (owner_id);

-- ---------------------------------------------------------------------------
-- targets: metadata only (name, type, provider, endpoint host). No secrets.
-- ---------------------------------------------------------------------------
create table if not exists public.targets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  project_id   uuid not null references public.projects (id) on delete cascade,
  name         text not null,
  type         text not null,            -- chat | agent | rag | mcp
  provider     text,
  endpoint     text,
  model        text,
  authorized   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists targets_project_idx on public.targets (project_id);

-- ---------------------------------------------------------------------------
-- campaigns + runs + findings: SYNCED METADATA from local runs.
-- ---------------------------------------------------------------------------
create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  target_id     uuid references public.targets (id) on delete set null,
  device_id     uuid references public.devices (id) on delete set null,
  name          text not null,
  status        text not null default 'draft', -- draft|ready|running|completed|failed|stopped|syncing
  strategy      text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists campaigns_project_idx on public.campaigns (project_id);

create table if not exists public.runs (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.profiles (id) on delete cascade,
  campaign_id        uuid not null references public.campaigns (id) on delete cascade,
  model              text,
  provider           text,
  attempts           integer not null default 0,
  successful_attacks integer not null default 0,
  success_rate       double precision,
  started_at         timestamptz,
  completed_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists runs_campaign_idx on public.runs (campaign_id);

create table if not exists public.findings (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references public.profiles (id) on delete cascade,
  project_id         uuid not null references public.projects (id) on delete cascade,
  campaign_id        uuid references public.campaigns (id) on delete set null,
  target_id          uuid references public.targets (id) on delete set null,
  title              text not null,
  severity           text not null,          -- info|low|medium|high|critical
  technique          text,                   -- attack strategy / technique
  taxonomy           text,                   -- e.g. OWASP LLM01
  status             text not null default 'open', -- open|acknowledged|resolved|ignored|reopened
  success_rate       double precision,       -- verified replay rate
  confidence_low     double precision,       -- Wilson CI lower bound
  confidence_high    double precision,
  evidence_synced    boolean not null default false, -- true only if user uploaded detail
  evidence_ref       text,                   -- pointer only; detail stays local by default
  discovered_at      timestamptz,
  last_seen_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists findings_project_idx on public.findings (project_id);
create index if not exists findings_severity_idx on public.findings (severity);

-- ---------------------------------------------------------------------------
-- subscriptions + entitlements: plan state (billing lives in the control plane).
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null unique references public.profiles (id) on delete cascade,
  plan               text not null default 'free',  -- free|pro|enterprise
  status             text not null default 'active',
  provider           text not null default 'razorpay',
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.entitlements (
  owner_id    uuid primary key references public.profiles (id) on delete cascade,
  limits      jsonb not null default '{}'::jsonb, -- configuration-driven caps
  features    jsonb not null default '{}'::jsonb, -- feature flags (mcp, advanced strategies, ...)
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: enable on all tables and scope every row to its owner.
-- The server API uses the service role (bypasses RLS) and enforces scope itself.
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.projects       enable row level security;
alter table public.devices        enable row level security;
alter table public.targets        enable row level security;
alter table public.campaigns      enable row level security;
alter table public.runs           enable row level security;
alter table public.findings       enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.entitlements   enable row level security;

-- profiles: a user sees and edits only their own profile row.
create policy profiles_self on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- owner-scoped tables: a user sees and edits only rows they own.
create policy projects_owner on public.projects
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy devices_owner on public.devices
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy targets_owner on public.targets
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy campaigns_owner on public.campaigns
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy runs_owner on public.runs
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy findings_owner on public.findings
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- subscriptions + entitlements: readable by the owner, written only by the
-- server (service role). Clients must not self-upgrade their plan.
create policy subscriptions_read_self on public.subscriptions
  for select using (owner_id = auth.uid());
create policy entitlements_read_self on public.entitlements
  for select using (owner_id = auth.uid());
