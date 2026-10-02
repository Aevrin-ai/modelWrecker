-- modelWrecker cloud control plane - admin console (issues #43, #44, #45).
--
-- Apply after 0004. Adds:
--   * admin_mfa: one authenticator (TOTP) per staff account. The secret is stored ENCRYPTED by the API
--     (AES-GCM, key in the Worker secret ADMIN_TOTP_KEY); recovery codes only as SHA-256 hashes.
--   * admin_sessions: short admin sessions, stored only as a hash of the session token.
--   * admin_audit: every admin action, who did it, to whom, and why. Kept when the user is deleted.
--   * page_views: first-party, cookie-free page analytics. No raw IP, no cookie; the visitor column is a
--     daily-rotating salted hash that cannot be reversed without a server secret.
--   * profiles.suspended_at: a suspended account cannot use the API or its devices.
--   * admin_user_list / admin_metrics / admin_traffic / admin_maintenance: aggregates for the console.
--
-- Every new table has RLS on and NO policies: only the API's server key reads or writes them, and the
-- API checks staff email, authenticator, and admin session on every admin request. The functions are
-- revoked from every client role.

alter table public.profiles
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text;

-- Payments are financial records and outlive a deleted account: the link to the account is cleared and
-- the email the purchase was for is kept (the API copies it in before deleting the user).
alter table public.payments add column if not exists customer_email text;
alter table public.payments alter column owner_id drop not null;
do $$
declare fk text;
begin
  select conname into fk from pg_constraint
   where conrelid = 'public.payments'::regclass and contype = 'f'
     and conkey = array[(select attnum from pg_attribute where attrelid = 'public.payments'::regclass and attname = 'owner_id')];
  if fk is not null then
    execute format('alter table public.payments drop constraint %I', fk);
  end if;
  alter table public.payments
    add constraint payments_owner_id_fkey foreign key (owner_id) references public.profiles (id) on delete set null;
end $$;

create table if not exists public.admin_mfa (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  secret_enc      text not null,
  enrolled_at     timestamptz,               -- null until the first code is confirmed
  last_step       bigint not null default 0, -- last accepted 30-second step, so a code is used once
  failed_count    integer not null default 0,
  locked_until    timestamptz,
  recovery_hashes text[] not null default '{}',
  created_at      timestamptz not null default now()
);
alter table public.admin_mfa enable row level security;

create table if not exists public.admin_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  token_hash   text not null unique,
  ip           text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at   timestamptz
);
create index if not exists admin_sessions_user_idx on public.admin_sessions (user_id);
alter table public.admin_sessions enable row level security;

create table if not exists public.admin_audit (
  id             uuid primary key default gen_random_uuid(),
  admin_id       uuid,
  admin_email    text not null,
  action         text not null,
  target_user_id uuid,                       -- no foreign key: the record outlives a deleted user
  target_email   text,
  reason         text,
  detail         jsonb not null default '{}'::jsonb,
  ip             text,
  created_at     timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on public.admin_audit (created_at desc);
create index if not exists admin_audit_target_idx on public.admin_audit (target_user_id, created_at desc);
alter table public.admin_audit enable row level security;

create table if not exists public.page_views (
  id        bigint generated always as identity primary key,
  day       date not null,
  ts        timestamptz not null default now(),
  site      text not null check (site in ('landing', 'dashboard')),
  path      text not null,
  referrer  text,                            -- host only, never a full URL
  country   text,
  device    text check (device in ('desktop', 'mobile', 'tablet')),
  visitor   text not null                    -- salted daily hash, not reversible without the server secret
);
create index if not exists page_views_day_idx on public.page_views (day, site);
alter table public.page_views enable row level security;

-- ---------------------------------------------------------------------------
-- admin_user_list: one page of users with plan, usage, and activity.
-- ---------------------------------------------------------------------------
create or replace function public.admin_user_list(
  p_query text, p_plan text, p_limit integer, p_offset integer
) returns jsonb
language sql stable security definer set search_path = public as $$
  with month_start as (select date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' as t),
  base as (
    select p.id, p.email, p.display_name, p.created_at, p.suspended_at,
           coalesce(s.plan, 'free') as plan, s.status, s.current_period_end, coalesce(s.credit_paise, 0) as credit_paise,
           s.source, u.last_sign_in_at,
           (select count(*) from devices d where d.owner_id = p.id and not d.revoked) as devices,
           (select count(*) from projects pr where pr.owner_id = p.id and not pr.archived) as projects,
           (select count(*) from runs r, month_start m where r.owner_id = p.id and r.created_at >= m.t) as runs_month,
           (select count(*) from findings f where f.owner_id = p.id) as findings,
           greatest(u.last_sign_in_at,
                    (select max(d.last_seen_at) from devices d where d.owner_id = p.id),
                    (select max(r.created_at) from runs r where r.owner_id = p.id)) as last_active
      from profiles p
      left join subscriptions s on s.owner_id = p.id
      left join auth.users u on u.id = p.id
     where (coalesce(p_query, '') = ''
            or p.email ilike '%' || p_query || '%'
            or p.display_name ilike '%' || p_query || '%'
            or p.id::text = p_query)
  ),
  effective as (
    select b.*,
           case when b.plan <> 'free' and b.current_period_end is not null and b.current_period_end <= now() then 'free'
                when b.plan <> 'free' and b.status = 'canceled' then 'free'
                else b.plan end as effective_plan
      from base b
  ),
  filtered as (
    select * from effective
     where coalesce(p_plan, '') = '' or effective_plan = p_plan
                                     or (p_plan = 'suspended' and suspended_at is not null)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'users', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc)
                         from (select * from filtered order by created_at desc
                               limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset)) x), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- admin_metrics: platform numbers over the last p_days days.
-- ---------------------------------------------------------------------------
create or replace function public.admin_metrics(p_days integer) returns jsonb
language sql stable security definer set search_path = public as $$
  with win as (select (now() - make_interval(days => greatest(1, least(p_days, 366)))) as since),
  days as (select generate_series((select since from win)::date, now()::date, interval '1 day')::date as day),
  active_paid as (
    select s.owner_id, s.plan, s.billing_interval, s.source from subscriptions s
     where s.plan <> 'free' and s.status <> 'canceled'
       and (s.current_period_end is null or s.current_period_end > now())
  ),
  last_paid as (
    select distinct on (owner_id) owner_id, list_price_paise, months
      from payments where status = 'paid' order by owner_id, paid_at desc
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'users', (select count(*) from profiles),
      'newUsers', (select count(*) from profiles, win where created_at >= win.since),
      'activeUsers', (select count(distinct owner_id) from (
          select owner_id from runs, win where runs.created_at >= win.since
          union select owner_id from devices, win where devices.last_seen_at >= win.since) a),
      'suspended', (select count(*) from profiles where suspended_at is not null),
      'paying', (select count(*) from active_paid where source = 'payment'),
      'granted', (select count(*) from active_paid where source <> 'payment'),
      'mrrPaise', coalesce((select sum(lp.list_price_paise / lp.months) from active_paid ap
                              join last_paid lp on lp.owner_id = ap.owner_id where ap.source = 'payment'), 0),
      'revenuePaise', coalesce((select sum(amount_paise - amount_refunded_paise) from payments, win
                                 where status in ('paid', 'partially_refunded', 'refunded') and paid_at >= win.since), 0),
      'refundedPaise', coalesce((select sum(amount_refunded_paise) from payments, win where paid_at >= win.since), 0),
      'devices', (select count(*) from devices where not revoked),
      'campaigns', (select count(*) from campaigns),
      'runs', (select count(*) from runs, win where runs.created_at >= win.since),
      'findings', (select count(*) from findings, win where findings.created_at >= win.since)
    ),
    'planMix', (select jsonb_build_object(
        'free', (select count(*) from profiles) - (select count(*) from active_paid),
        'pro', (select count(*) from active_paid where plan = 'pro'),
        'enterprise', (select count(*) from active_paid where plan = 'enterprise'))),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
        'date', d.day,
        'signups', (select count(*) from profiles p where p.created_at::date = d.day),
        'runs', (select count(*) from runs r where r.created_at::date = d.day),
        'revenuePaise', coalesce((select sum(amount_paise - amount_refunded_paise) from payments y
                                   where y.paid_at::date = d.day and y.status <> 'created' and y.status <> 'failed'), 0)
      ) order by d.day), '[]'::jsonb) from days d)
  );
$$;

-- ---------------------------------------------------------------------------
-- admin_traffic: page analytics over the last p_days days, optionally for one site.
-- ---------------------------------------------------------------------------
create or replace function public.admin_traffic(p_days integer, p_site text) returns jsonb
language sql stable security definer set search_path = public as $$
  with v as (
    select * from page_views
     where day >= (now() - make_interval(days => greatest(1, least(p_days, 366))))::date
       and (coalesce(p_site, '') = '' or site = p_site)
  ),
  days as (select generate_series((now() - make_interval(days => greatest(1, least(p_days, 366))))::date,
                                  now()::date, interval '1 day')::date as day)
  select jsonb_build_object(
    'views', (select count(*) from v),
    'visitors', (select count(distinct (day, visitor)) from v),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
        'date', d.day,
        'views', (select count(*) from v where v.day = d.day),
        'visitors', (select count(distinct visitor) from v where v.day = d.day)) order by d.day), '[]'::jsonb) from days d),
    'pages', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select site, path, count(*) as views, count(distinct (day, visitor)) as visitors
          from v group by site, path order by count(*) desc limit 20) x),
    'referrers', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select coalesce(referrer, '(direct)') as referrer, count(*) as views
          from v group by 1 order by 2 desc limit 15) x),
    'countries', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select coalesce(country, '??') as country, count(*) as views
          from v group by 1 order by 2 desc limit 15) x),
    'devices', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select coalesce(device, 'desktop') as device, count(*) as views from v group by 1 order by 2 desc) x)
  );
$$;

-- ---------------------------------------------------------------------------
-- admin_maintenance: retention, run daily by the Worker's scheduled trigger.
-- ---------------------------------------------------------------------------
create or replace function public.admin_maintenance() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  views_deleted integer; sessions_deleted integer; events_deleted integer;
begin
  delete from page_views where day < (now() - interval '400 days')::date;
  get diagnostics views_deleted = row_count;
  delete from admin_sessions where expires_at < now() - interval '7 days';
  get diagnostics sessions_deleted = row_count;
  delete from billing_events where received_at < now() - interval '90 days';
  get diagnostics events_deleted = row_count;
  return jsonb_build_object('page_views', views_deleted, 'admin_sessions', sessions_deleted,
                            'billing_events', events_deleted);
end;
$$;

revoke all on function public.admin_user_list(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_metrics(integer) from public, anon, authenticated;
revoke all on function public.admin_traffic(integer, text) from public, anon, authenticated;
revoke all on function public.admin_maintenance() from public, anon, authenticated;
grant execute on function public.admin_user_list(text, text, integer, integer) to service_role;
grant execute on function public.admin_metrics(integer) to service_role;
grant execute on function public.admin_traffic(integer, text) to service_role;
grant execute on function public.admin_maintenance() to service_role;
