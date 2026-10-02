-- modelWrecker cloud control plane - billing (issues #12, #42) and entitlement inputs (#11).
--
-- Apply after 0003. Adds:
--   * prepaid plan state on subscriptions: paid-until date, interval, account credit, admin bonus
--   * payments: one row per Razorpay order (or per credit-only purchase), with an invoice number
--   * billing_events: Razorpay webhook event ids, so a repeated delivery is applied once
--   * credit_ledger: every change to an account's credit balance, and why
--   * fulfil_payment / refund_payment / adjust_credit: the only code that changes a paid period or a
--     credit balance. Each runs in one transaction with row locks, so two deliveries of the same payment
--     (browser confirmation and webhook) cannot both extend the plan.
--
-- Payment success is decided on the server only (docs/billing/razorpay.md). Card data never reaches this
-- database. RLS stays on. Users may READ their own payments and credit history; only the API's server key
-- writes. The functions are revoked from every client role, so they cannot be called through the public
-- REST endpoint with an anon or user token.

-- ---------------------------------------------------------------------------
-- Subscriptions: prepaid period, credit, bonus.
-- ---------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists period_start     timestamptz,
  add column if not exists billing_interval text check (billing_interval in ('month', 'year')),
  add column if not exists source           text not null default 'free'
                                              check (source in ('free', 'payment', 'admin')),
  add column if not exists credit_paise     integer not null default 0 check (credit_paise >= 0),
  add column if not exists bonus            jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Payments.
-- ---------------------------------------------------------------------------
create sequence if not exists public.invoice_seq;

create table if not exists public.payments (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references public.profiles (id) on delete cascade,
  razorpay_order_id     text not null unique,      -- 'credit_<uuid>' for a purchase paid fully by credit
  razorpay_payment_id   text unique,
  plan                  text not null,
  billing_interval      text not null check (billing_interval in ('month', 'year')),
  months                integer not null check (months > 0),
  list_price_paise      integer not null check (list_price_paise > 0),
  credit_applied_paise  integer not null default 0 check (credit_applied_paise >= 0),
  amount_paise          integer not null check (amount_paise >= 0),  -- charged through Razorpay
  amount_refunded_paise integer not null default 0,
  currency              text not null default 'INR',
  status                text not null default 'created'
                        check (status in ('created', 'paid', 'failed', 'refunded', 'partially_refunded')),
  method                text,
  invoice_number        text unique,
  period_start          timestamptz,
  period_end            timestamptz,
  paid_at               timestamptz,
  created_at            timestamptz not null default now()
);
create index if not exists payments_owner_idx on public.payments (owner_id, created_at desc);
create index if not exists payments_status_idx on public.payments (status, created_at);

alter table public.payments enable row level security;
drop policy if exists payments_read_self on public.payments;
create policy payments_read_self on public.payments for select using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Webhook idempotency. Server key only (no policies).
-- ---------------------------------------------------------------------------
create table if not exists public.billing_events (
  event_id    text primary key,
  event       text not null,
  received_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;

-- ---------------------------------------------------------------------------
-- Credit ledger. Readable by the owner; written only by the functions below.
-- ---------------------------------------------------------------------------
create table if not exists public.credit_ledger (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  delta_paise integer not null,
  balance_paise integer not null,
  reason      text not null,
  actor       text not null,              -- 'checkout', 'refund', or 'admin:<email>'
  created_at  timestamptz not null default now()
);
create index if not exists credit_ledger_owner_idx on public.credit_ledger (owner_id, created_at desc);
alter table public.credit_ledger enable row level security;
drop policy if exists credit_ledger_read_self on public.credit_ledger;
create policy credit_ledger_read_self on public.credit_ledger for select using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- fulfil_payment: mark one order paid and extend the plan, exactly once.
-- A renewal of the same plan before it ends adds time to the end date; otherwise the new period starts now.
-- ---------------------------------------------------------------------------
create or replace function public.fulfil_payment(
  p_order_id text, p_payment_id text, p_method text, p_now timestamptz
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pay   public.payments;
  sub   public.subscriptions;
  base  timestamptz;
  fin   timestamptz;
  inv   text;
begin
  select * into pay from public.payments where razorpay_order_id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_order');
  end if;
  if pay.status = 'paid' then
    return jsonb_build_object('ok', true, 'already', true, 'payment', pay.id, 'owner', pay.owner_id);
  end if;
  if pay.status not in ('created', 'failed') then
    return jsonb_build_object('ok', false, 'reason', 'status_' || pay.status);
  end if;

  insert into public.subscriptions (owner_id) values (pay.owner_id) on conflict (owner_id) do nothing;
  select * into sub from public.subscriptions where owner_id = pay.owner_id for update;

  if sub.plan = pay.plan and sub.status <> 'canceled' and sub.current_period_end is not null
     and sub.current_period_end > p_now then
    base := sub.current_period_end;
  else
    base := p_now;
  end if;
  fin := base + make_interval(months => pay.months);
  inv := 'AEV-' || to_char(p_now at time zone 'UTC', 'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 6, '0');

  update public.payments
     set status = 'paid', razorpay_payment_id = coalesce(p_payment_id, razorpay_payment_id), method = p_method,
         paid_at = p_now, period_start = base, period_end = fin, invoice_number = inv
   where id = pay.id;

  update public.subscriptions
     set plan = pay.plan, status = 'active', source = 'payment', billing_interval = pay.billing_interval,
         period_start = case when base = p_now then p_now else coalesce(period_start, p_now) end,
         current_period_end = fin,
         credit_paise = greatest(0, credit_paise - pay.credit_applied_paise),
         updated_at = p_now
   where owner_id = pay.owner_id
   returning * into sub;

  if pay.credit_applied_paise > 0 then
    insert into public.credit_ledger (owner_id, delta_paise, balance_paise, reason, actor)
    values (pay.owner_id, -pay.credit_applied_paise, sub.credit_paise, 'Applied to invoice ' || inv, 'checkout');
  end if;

  return jsonb_build_object('ok', true, 'already', false, 'payment', pay.id, 'owner', pay.owner_id,
                            'period_end', fin, 'invoice_number', inv);
end;
$$;

-- ---------------------------------------------------------------------------
-- refund_payment: record a refund. A full refund takes back the time it bought and returns any credit
-- that was applied to it. A partial refund is recorded only.
-- ---------------------------------------------------------------------------
create or replace function public.refund_payment(
  p_payment_id text, p_amount_refunded integer, p_now timestamptz
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pay  public.payments;
  sub  public.subscriptions;
  is_full boolean;
begin
  select * into pay from public.payments where razorpay_payment_id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown_payment');
  end if;
  if pay.status = 'refunded' then
    return jsonb_build_object('ok', true, 'already', true, 'owner', pay.owner_id);
  end if;
  if pay.status not in ('paid', 'partially_refunded') then
    return jsonb_build_object('ok', false, 'reason', 'status_' || pay.status);
  end if;

  is_full := p_amount_refunded >= pay.amount_paise;
  update public.payments
     set amount_refunded_paise = greatest(amount_refunded_paise, p_amount_refunded),
         status = case when is_full then 'refunded' else 'partially_refunded' end
   where id = pay.id;

  if is_full then
    select * into sub from public.subscriptions where owner_id = pay.owner_id for update;
    if found and sub.plan = pay.plan and sub.current_period_end is not null then
      update public.subscriptions
         set current_period_end = greatest(p_now, sub.current_period_end - make_interval(months => pay.months)),
             credit_paise = credit_paise + pay.credit_applied_paise,
             updated_at = p_now
       where owner_id = pay.owner_id
       returning * into sub;
      if pay.credit_applied_paise > 0 then
        insert into public.credit_ledger (owner_id, delta_paise, balance_paise, reason, actor)
        values (pay.owner_id, pay.credit_applied_paise, sub.credit_paise,
                'Returned with refund of invoice ' || coalesce(pay.invoice_number, pay.razorpay_order_id), 'refund');
      end if;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'already', false, 'owner', pay.owner_id, 'full', is_full);
end;
$$;

-- ---------------------------------------------------------------------------
-- adjust_credit: add (positive) or remove (negative) account credit with a reason. Never below zero.
-- ---------------------------------------------------------------------------
create or replace function public.adjust_credit(
  p_owner uuid, p_delta integer, p_reason text, p_actor text
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  bal integer;
  applied integer;
begin
  insert into public.subscriptions (owner_id) values (p_owner) on conflict (owner_id) do nothing;
  select credit_paise into bal from public.subscriptions where owner_id = p_owner for update;
  applied := greatest(p_delta, -bal);
  update public.subscriptions set credit_paise = bal + applied, updated_at = now() where owner_id = p_owner;
  insert into public.credit_ledger (owner_id, delta_paise, balance_paise, reason, actor)
  values (p_owner, applied, bal + applied, p_reason, p_actor);
  return bal + applied;
end;
$$;

-- Server key only. Postgres grants EXECUTE to PUBLIC by default, which would expose these through the
-- REST endpoint to any signed-in user.
revoke all on function public.fulfil_payment(text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.refund_payment(text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.adjust_credit(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.fulfil_payment(text, text, text, timestamptz) to service_role;
grant execute on function public.refund_payment(text, integer, timestamptz) to service_role;
grant execute on function public.adjust_credit(uuid, integer, text, text) to service_role;
revoke all on sequence public.invoice_seq from public, anon, authenticated;
grant usage on sequence public.invoice_seq to service_role;

-- Clients must not change their own plan: the 0001 policy is read-only; make sure no older write policy
-- exists on subscriptions.
drop policy if exists subscriptions_owner on public.subscriptions;
