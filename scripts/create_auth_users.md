# Setting up the two auth accounts (one-time, per deploy)

This app has exactly two Supabase Auth users: **personal** (private) and
**demo** (public). Do this once per Supabase project, before applying the
multi-tenant migration.

## 1. Create the two users

In the Supabase dashboard: **Authentication → Users → Add user** (email/password).

- **Personal**: your real email + a strong password.
- **Demo**: e.g. `demo@finance-tracker.app` + a memorable password. This
  password ships publicly in the frontend bundle (`VITE_DEMO_PASSWORD`) —
  that's intentional, the demo account only ever holds re-seeded fake data.

## 2. Copy the UUIDs and keys

- Copy each user's **UUID** (the `id` column in Authentication → Users).
- In **Project Settings → API**, copy the **anon** key and the
  **service_role** key.

## 3. Apply the migration

Open `db/002_multi_tenant.sql`, replace `__PERSONAL_USER_ID__` with the
personal UUID from step 2, then paste the whole file into the Supabase
**SQL Editor** and run it. Expect `Success. No rows returned`.

Verify it worked:

```sql
select tablename, rowsecurity from pg_tables
  where tablename in ('transactions','categories','ai_usage') order by 1;
select count(*) as unassigned from transactions where user_id is null;
```

`rowsecurity` should be `true` for all three tables, and `unassigned`
should be `0`.

## 4. Set environment variables

Fill in `.env` (backend) and `frontend/.env` (Vite) using `.env.example`
as a template:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- `PERSONAL_USER_ID`, `DEMO_USER_ID` — the two UUIDs from step 2
- `DEMO_EMAIL`, `DEMO_PASSWORD` — must match the demo user created in step 1
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DEMO_EMAIL`, `VITE_DEMO_PASSWORD`

On Vercel, set the same backend vars (plus `VITE_*` ones, which Vercel
exposes to the client build) in the project's Environment Variables, and
set `CRON_SECRET` so the daily `/api/demo/reset` cron is authenticated.
