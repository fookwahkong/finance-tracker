-- The investment_cache table backs core/investments/cache.py: one row per
-- cache key holding a provider payload and when it was fetched. It has been
-- in use since the investments feature shipped, but was only ever created by
-- hand in the Supabase SQL editor — no migration defined it, so a rebuilt or
-- restored project comes up without it and every cached call fails.
--
-- It is not just investments data: core/fx.py caches the CNY->SGD rate here,
-- which sits on the write path for creating a foreign-currency transaction.
--
-- Written and read exclusively by the service-role client (server-side jobs
-- and request handlers), never by a browser, so there is no per-user column
-- and no RLS policy. RLS is enabled with no policy so that a leaked anon key
-- cannot read it: the service role bypasses RLS, everyone else sees nothing.
--
-- Apply in the Supabase SQL editor. Safe to re-run.

begin;

create table if not exists investment_cache (
  key text primary key,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table investment_cache enable row level security;

commit;
