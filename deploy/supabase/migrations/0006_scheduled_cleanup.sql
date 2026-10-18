-- 0006: run the daily data cleanup inside the database (issue #83).
--
-- admin_maintenance() (0005_admin.sql) deletes page views older than 400 days, expired admin sessions,
-- and webhook event ids older than 90 days. It used to be called by the API Worker's Cloudflare cron.
-- That cron is removed (the Cloudflare account has a small cron trigger limit), so Supabase Cron
-- (pg_cron) calls the function instead, every day at 03:17 UTC, the same time as before.
--
-- Confirming unpaid Razorpay orders is no longer scheduled: the webhook applies payments, and opening
-- the Billing page reconciles that account's recent orders (src/api/src/services/billing/reconcile.ts).
--
-- Safe to re-run: the extension is created only if missing, and cron.schedule overwrites a job that
-- has the same name.

create extension if not exists pg_cron;

select cron.schedule(
  'aevrin-daily-cleanup',
  '17 3 * * *',
  $$select public.admin_maintenance()$$
);
