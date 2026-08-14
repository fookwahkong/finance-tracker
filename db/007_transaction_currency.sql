-- Add CNY currency support to transactions. `amount` stays the canonical
-- SGD-denominated value used by every existing reader (dashboard, reports,
-- budgets, claims); `foreign_amount` holds the raw entered value when the
-- transaction was recorded in a currency other than SGD.
-- Apply in the Supabase SQL editor.

begin;

alter table transactions
  add column if not exists currency text not null default 'SGD'
  check (currency in ('SGD', 'CNY'));

alter table transactions
  add column if not exists foreign_amount numeric;

commit;
