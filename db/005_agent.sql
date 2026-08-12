create table if not exists agent_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  tool_name text not null,
  proposed_input jsonb not null,
  status text not null check (status in ('approved', 'rejected')),
  result jsonb,
  created_at timestamptz not null default now()
);

alter table agent_actions enable row level security;

create policy agent_actions_owner on agent_actions
  using (user_id = auth.uid()) with check (user_id = auth.uid());
