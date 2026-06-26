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
