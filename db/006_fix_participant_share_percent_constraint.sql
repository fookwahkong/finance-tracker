-- Fix claim_participants.share_percent constraint: it capped every
-- participant's share below 100%, but only the owner's share should be
-- capped. A named participant legitimately owes 100% when the owner's
-- custom share is 0% and there's exactly one other person on the claim.
-- Apply in the Supabase SQL editor after db/003_claim_participants.sql.

begin;

alter table claim_participants drop constraint if exists claim_participants_share_percent_check;
alter table claim_participants
  add constraint claim_participants_share_percent_check
  check (share_percent >= 0 and (is_owner = false or share_percent < 100));

commit;
