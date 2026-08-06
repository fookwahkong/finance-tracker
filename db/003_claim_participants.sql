-- Replace legacy combined-counterparty claims with participant-aware claims.
-- Apply in the Supabase SQL editor after db/002_multi_tenant.sql.
-- This intentionally deletes all existing claims and their allocations.

begin;

delete from claim_credits;
delete from claims;

create table if not exists claim_participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  claim_id uuid not null references claims(id) on delete cascade,
  name text not null,
  is_owner boolean not null default false,
  share_amount numeric not null check (share_amount >= 0),
  share_percent numeric not null check (share_percent >= 0 and share_percent < 100),
  created_at timestamptz not null default now()
);

create unique index if not exists claim_participants_one_owner_idx
  on claim_participants (claim_id) where is_owner;
create unique index if not exists claim_participants_name_idx
  on claim_participants (claim_id, lower(name));

alter table claim_credits add column if not exists participant_id uuid;
alter table claim_credits
  add constraint claim_credits_participant_id_fkey
  foreign key (participant_id) references claim_participants(id) on delete cascade;
alter table claim_credits alter column participant_id set not null;

create index if not exists claim_credits_participant_id_idx
  on claim_credits (participant_id);

alter table claim_participants enable row level security;
drop policy if exists claim_participants_owner on claim_participants;
create policy claim_participants_owner on claim_participants
  using (user_id = auth.uid()) with check (user_id = auth.uid());

commit;
