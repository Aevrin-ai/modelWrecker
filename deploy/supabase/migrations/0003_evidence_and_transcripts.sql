-- 0003: opt-in detail sync (issue #28, ROADMAP 10.9).
--
-- Summary metadata always syncs. Two kinds of detail sync only when the account turns them on in
-- Settings (profiles.settings.sync.detailedEvidence / .transcripts):
--   * finding_evidence: per finding, the prompt sent, the model reply, the judge verdict.
--   * run_transcripts:  per run, every attempt (prompt, reply, outcome).
-- The engine redacts secrets before sending; the API stores detail only when the setting is on and
-- deletes it when the setting is turned off. Rows are written by the server (service role) only.

create table if not exists public.finding_evidence (
  finding_id  uuid primary key references public.findings (id) on delete cascade,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  detail      jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.run_transcripts (
  run_id      uuid primary key references public.runs (id) on delete cascade,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  attempts    jsonb not null default '[]'::jsonb,
  truncated   boolean not null default false,
  updated_at  timestamptz not null default now()
);

create index if not exists finding_evidence_owner_idx on public.finding_evidence (owner_id);
create index if not exists run_transcripts_owner_idx on public.run_transcripts (owner_id);

alter table public.finding_evidence enable row level security;
alter table public.run_transcripts  enable row level security;

-- The owner can read and delete their detail. No insert or update policy: only the server writes it,
-- so a browser can not plant fake evidence.
drop policy if exists finding_evidence_read_self on public.finding_evidence;
create policy finding_evidence_read_self on public.finding_evidence
  for select using (owner_id = auth.uid());
drop policy if exists finding_evidence_delete_self on public.finding_evidence;
create policy finding_evidence_delete_self on public.finding_evidence
  for delete using (owner_id = auth.uid());

drop policy if exists run_transcripts_read_self on public.run_transcripts;
create policy run_transcripts_read_self on public.run_transcripts
  for select using (owner_id = auth.uid());
drop policy if exists run_transcripts_delete_self on public.run_transcripts;
create policy run_transcripts_delete_self on public.run_transcripts
  for delete using (owner_id = auth.uid());
