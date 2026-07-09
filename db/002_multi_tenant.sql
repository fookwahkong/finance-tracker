-- 002_multi_tenant.sql
-- Adds per-user ownership + RLS to all financial tables, the AI-usage
-- counter, and its increment RPC. Apply in the Supabase SQL editor AFTER
-- creating the two auth users. Replace __PERSONAL_USER_ID__ first.

begin;

-- 1. Add user_id (nullable first so we can backfill existing rows) --------
alter table transactions       add column if not exists user_id uuid references auth.users(id);
alter table budgets            add column if not exists user_id uuid references auth.users(id);
alter table subscriptions      add column if not exists user_id uuid references auth.users(id);
alter table net_worth          add column if not exists user_id uuid references auth.users(id);
alter table claims             add column if not exists user_id uuid references auth.users(id);
alter table claim_credits      add column if not exists user_id uuid references auth.users(id);
alter table invest_transactions add column if not exists user_id uuid references auth.users(id);
alter table watchlist          add column if not exists user_id uuid references auth.users(id);
alter table categories         add column if not exists user_id uuid references auth.users(id);

-- 2. Backfill every existing row to the personal account -----------------
update transactions        set user_id = '5b71d84c-6fa3-4b2b-9b43-edb1813e53ed' where user_id is null;
update budgets             set user_id = '5b71d84c-6fa3-4b2b-9b43-edb1813e53ed' where user_id is null;
update subscriptions       set user_id = '5b71d84c-6fa3-4b2b-9b43-edb1813e53ed' where user_id is null;
update net_worth           set user_id = '5b71d84c-6fa3-4b2b-9b43-edb1813e53ed' where user_id is null;
update claims              set user_id = '5b71d84c-6fa3-4b2b-9b43-edb1813e53ed' where user_id is null;
update claim_credits       set user_id = '5b71d84c-6fa3-4b2b-9b43-edb1813e53ed' where user_id is null;
update invest_transactions set user_id = '5b71d84c-6fa3-4b2b-9b43-edb1813e53ed' where user_id is null;
update watchlist           set user_id = '5b71d84c-6fa3-4b2b-9b43-edb1813e53ed' where user_id is null;
update categories          set user_id = '5b71d84c-6fa3-4b2b-9b43-edb1813e53ed' where user_id is null;

-- 3. Enforce NOT NULL + auto-populate on authed inserts ------------------
do $$
declare t text;
begin
  foreach t in array array[
    'transactions','budgets','subscriptions','net_worth','claims',
    'claim_credits','invest_transactions','watchlist','categories'
  ] loop
    execute format('alter table %I alter column user_id set not null', t);
    execute format('alter table %I alter column user_id set default auth.uid()', t);
  end loop;
end $$;

-- 4. Make single-column unique constraints per-user ----------------------
alter table categories drop constraint if exists categories_name_key;
alter table categories add constraint categories_user_name_key unique (user_id, name);

alter table budgets drop constraint if exists budgets_category_key;
alter table budgets add constraint budgets_user_category_key unique (user_id, category);

alter table net_worth drop constraint if exists net_worth_month_key;
alter table net_worth add constraint net_worth_user_month_key unique (user_id, month);

alter table watchlist drop constraint if exists watchlist_ticker_key;
alter table watchlist add constraint watchlist_user_ticker_key unique (user_id, ticker);

-- 5. Enable RLS + one owner policy per table (FOR ALL) -------------------
do $$
declare t text;
begin
  foreach t in array array[
    'transactions','budgets','subscriptions','net_worth','claims',
    'claim_credits','invest_transactions','watchlist','categories'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_owner on %I', t, t);
    execute format(
      'create policy %I_owner on %I using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t, t
    );
  end loop;
end $$;

-- 6. AI usage counter ----------------------------------------------------
create table if not exists ai_usage (
  user_id uuid not null references auth.users(id),
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

alter table ai_usage enable row level security;
drop policy if exists ai_usage_owner on ai_usage;
create policy ai_usage_owner on ai_usage
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Atomic increment scoped to the caller; returns the new count.
create or replace function increment_ai_usage() returns int
language plpgsql security definer set search_path = public as $$
declare new_count int;
begin
  insert into ai_usage (user_id, day, count)
    values (auth.uid(), current_date, 1)
  on conflict (user_id, day)
    do update set count = ai_usage.count + 1
  returning count into new_count;
  return new_count;
end $$;

grant execute on function increment_ai_usage() to authenticated, anon;

commit;
