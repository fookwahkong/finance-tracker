create table if not exists saving_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  salary numeric not null check (salary >= 0),
  payday int not null check (payday between 1 and 31),
  unique (user_id)
);

create table if not exists saving_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  name text not null check (char_length(trim(name)) > 0),
  target_amount numeric not null check (target_amount > 0),
  allocation_percentage numeric not null check (allocation_percentage between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists saving_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  goal_id uuid not null references saving_goals(id) on delete cascade,
  amount numeric not null check (amount > 0),
  kind text not null check (kind in ('automatic', 'manual')),
  contribution_month text not null check (contribution_month ~ '^\\d{4}-\\d{2}$'),
  created_at timestamptz not null default now(),
  unique nulls not distinct (goal_id, contribution_month, kind)
);

alter table saving_profiles enable row level security;
alter table saving_goals enable row level security;
alter table saving_contributions enable row level security;

create policy saving_profiles_owner on saving_profiles
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saving_goals_owner on saving_goals
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saving_contributions_owner on saving_contributions
  using (user_id = auth.uid()) with check (user_id = auth.uid());
