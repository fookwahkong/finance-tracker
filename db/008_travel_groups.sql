-- Travel groups: a named date range that gathers the transactions falling
-- inside it. Membership is NOT stored — it is derived at read time from the
-- range, so editing a transaction's date in Spending re-buckets it for free
-- (the same read-time approach `claims` takes to spend/income adjustments).
--
-- `travel_group_transactions` holds the two exceptions pure date derivation
-- gets wrong: flights and hotels bought before departure ('include'), and
-- rent or GIRO subscriptions that auto-debit mid-trip ('exclude').
--
-- Apply in the Supabase SQL editor.

begin;

-- Required for the non-overlap exclusion constraint below (gist indexing on
-- the scalar user_id alongside the daterange).
create extension if not exists btree_gist;

create table if not exists travel_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  name text not null check (char_length(trim(name)) > 0),
  destination text,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  constraint travel_groups_range_ordered check (end_date >= start_date),
  -- You cannot be on two trips at once. Overlapping ranges would count the
  -- same transaction toward two trips with no defensible reconciliation.
  -- '[]' makes both ends inclusive, matching how a user reads "18 to 26 Aug".
  constraint travel_groups_no_overlap exclude using gist (
    user_id with =,
    daterange(start_date, end_date, '[]') with &&
  )
);

create index if not exists travel_groups_user_start_idx
  on travel_groups (user_id, start_date desc);

create table if not exists travel_group_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  group_id uuid not null references travel_groups(id) on delete cascade,
  transaction_id uuid not null references transactions(id) on delete cascade,
  mode text not null check (mode in ('include', 'exclude')),
  created_at timestamptz not null default now(),
  -- A transaction is either force-included or force-excluded from a given
  -- trip, never both.
  unique (group_id, transaction_id)
);

create index if not exists travel_group_transactions_group_idx
  on travel_group_transactions (group_id);

alter table travel_groups enable row level security;
alter table travel_group_transactions enable row level security;

drop policy if exists travel_groups_owner on travel_groups;
create policy travel_groups_owner on travel_groups
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists travel_group_transactions_owner on travel_group_transactions;
create policy travel_group_transactions_owner on travel_group_transactions
  using (user_id = auth.uid()) with check (user_id = auth.uid());

commit;
