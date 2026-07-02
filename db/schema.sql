-- Defense-in-depth constraints for the transactions table.
-- Apply in the Supabase SQL editor. Adjust the table name if different.

alter table transactions
  alter column item set not null,
  alter column date set not null,
  alter column amount set not null;

alter table transactions
  add constraint transactions_amount_nonzero check (amount <> 0);

-- Drop the unused remarks column and add an optional time-of-day column.
-- (Postgres has no "add column after X"; column order is cosmetic — the UI
-- renders time directly after date regardless of physical column order.)
alter table transactions
  drop column if exists remarks;

alter table transactions
  add column if not exists time time;

-- ── Budgets ──────────────────────────────────────────────────────────
-- One recurring monthly budget amount per category.
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  category text not null unique,
  amount numeric not null check (amount >= 0)
);

-- ── Canonical category seed ──────────────────────────────────────────
-- Replace the editable category set with the 16 canonical categories.
-- Existing transactions keep their old category strings (not migrated).
delete from categories;
insert into categories (name) values
  ('Groceries'), ('Food & Drink'), ('Transport'), ('Personal'),
  ('Pets'), ('Gym'), ('Shopping'), ('Education'),
  ('Car'), ('Housing'), ('Gifts'), ('Work'),
  ('Sports & Hobby'), ('Beauty'), ('Others'), ('Travel')
on conflict (name) do nothing;

-- ── Subscriptions ────────────────────────────────────────────────────
-- Recurring monthly bills and income shown on the dashboard.
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('bill', 'income')),
  item text not null,
  amount numeric not null check (amount >= 0),
  category text not null,
  source text not null default 'card' check (source in ('card', 'giro')),
  day_of_month int not null check (day_of_month between 1 and 31)
);

-- ── Net worth (cash anchors) ─────────────────────────────────────────
-- One user-entered cash balance per month; later months are traced
-- client-side from the nearest preceding anchor + cumulative net flow.
create table if not exists net_worth (
  id uuid primary key default gen_random_uuid(),
  month text not null unique,
  cash numeric not null
);

-- Shared-expense claims -------------------------------------------------------
-- A claim sits between a shared-expense debit and its later reimbursement
-- credits. Effects on spending/income are computed at read time (no rows
-- are written to `transactions`); only at status='settled' do they apply.
create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  debit_tx_id uuid not null references transactions(id) on delete cascade,
  total numeric not null check (total > 0),
  my_share numeric not null check (my_share >= 0),
  expected numeric not null check (expected >= 0),
  category text,
  counterparty text,
  status text not null default 'open' check (status in ('open', 'settled')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint claims_share_below_total check (my_share < total)
);

-- One claim per debit.
create unique index if not exists claims_debit_tx_id_key on claims (debit_tx_id);

-- Many-to-many link between a claim and the reimbursement credits applied to it.
create table if not exists claim_credits (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references claims(id) on delete cascade,
  credit_tx_id uuid not null references transactions(id) on delete cascade,
  allocated_amount numeric not null check (allocated_amount > 0)
);

create index if not exists claim_credits_claim_id_idx on claim_credits (claim_id);
create index if not exists claim_credits_credit_tx_id_idx on claim_credits (credit_tx_id);

-- ── Investment transactions ─────────────────────────────────────────
-- Single source of holdings; shares owned and average cost basis are
-- derived from it client-side. Never written to the cash `transactions`.
create table if not exists invest_transactions (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  type text not null check (type in ('BUY', 'SELL')),
  quantity numeric not null check (quantity > 0),
  price_per_share numeric not null check (price_per_share > 0),
  purchase_date date not null,
  created_at timestamptz not null default now()
);
