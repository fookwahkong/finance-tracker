# Claims Participants — Backend Learning Guide

The frontend now understands participant-aware claims, but the current Python API and database still store one combined counterparty. Use this guide to complete the persistence layer yourself. It intentionally describes the structure and logic as pseudocode rather than giving you a copy-pasteable backend solution.

## 1. Database migration

Create a `claim_participants` relation with:

- a UUID primary key;
- a foreign key to `claims` with cascade deletion;
- `name` text;
- `is_owner` boolean;
- `share_amount` and `share_percent` decimal values; and
- a creation timestamp.

Add an optional `participant_id` foreign key to `claim_credits`. During migration it must initially be nullable, because existing allocations do not yet have a participant.

Useful constraints to reason about:

- `share_amount >= 0`;
- `0 <= share_percent < 100` for the owner;
- participant names should be unique per claim after case folding;
- a repayment participant must belong to the same claim as its allocation; and
- only non-owner participants receive repayment allocations.

“Exactly one owner per claim” is easiest to enforce with a filtered unique index on `claim_id` where `is_owner` is true.

## 2. Backfill order

Perform the migration inside a transaction:

```text
for each existing claim:
    insert owner participant named "You"
        share amount = claim.my_share
        percentage = my_share / total * 100

    insert non-owner participant
        name = counterparty, or "Someone" when empty
        share amount = claim.expected
        percentage = expected / total * 100

    update every existing claim_credit for this claim
        participant_id = new non-owner participant id

verify participant amounts sum to claim.total
verify no claim_credit still has a null participant_id
then make participant_id required
```

Keep the existing `my_share`, `expected`, and `counterparty` columns during the transition. They let older frontend versions keep working while participant rows become authoritative.

## 3. Decimal split calculation

Do not use Python `float` for stored money. Convert the debit total to `Decimal`, quantize currency to two decimal places, and use integer cents or explicit rounding.

Equal-mode pseudocode:

```text
base cents = total cents // participant count
each named person receives base cents
You receive total cents - sum(named person cents)
nominal percentage = 100 / participant count
```

Custom-owner pseudocode:

```text
validate 0 <= owner percentage < 100
requested owner cents = rounded(total cents * owner percentage / 100)
named base cents = (total cents - requested owner cents) // named count
each named person receives named base cents
You receive total cents - sum(named person cents)
named nominal percentage = (100 - owner percentage) / named count
```

This final subtraction is what assigns leftover cents to You and guarantees the exact total.

## 4. Request and response models

Extend claim creation to accept:

```text
debit_tx_id
participant_names: ordered list of strings
split_mode: "equal" or "custom"
my_share_percent: required only for custom mode
```

Server validation should trim names, reject blanks, and reject duplicates using `casefold()`. Recalculate every share on the server; never accept browser-calculated amounts as authoritative.

Return nested participants from claim reads. Each participant response should contain its stored share, repayment links, received total, remaining amount, and overpaid amount. Claim-level expected/received/remaining values should be sums of its non-owner participants.

## 5. Atomic claim creation

The intended transaction is:

```text
load and validate debit transaction
reject an existing claim for the debit
calculate participant shares
insert claim aggregate
insert owner participant
insert every named participant
commit all rows together
```

If your Supabase client cannot express this as one transaction from FastAPI, move this operation into a Postgres function and invoke it through RPC. Avoid a sequence where a claim can remain saved without all participants.

## 6. Participant repayment route

The frontend calls:

```text
POST /api/claims/{claim_id}/participants/{participant_id}/credits
```

The handler’s validation sequence should be:

```text
load claim
load participant
confirm participant.claim_id equals claim_id
reject the owner participant
load the selected credit transaction
confirm it is a positive transaction
sum every existing allocation for that credit
reject when existing sum + requested amount exceeds the credit amount
insert allocation with claim_id, participant_id, credit_tx_id, allocated_amount
```

Overpayment relative to a participant’s owed amount is allowed. Only over-allocation relative to the real bank credit is rejected.

## 7. Tests to write

Start with failing tests for:

1. Equal `$100 / 3` produces `$33.34`, `$33.33`, `$33.33`.
2. Custom `40%` with two named people produces `$40`, `$30`, `$30`.
3. Blank and case-insensitive duplicate names return validation errors.
4. Claim plus all participants are created together.
5. A repayment can target a non-owner participant in the same claim.
6. Cross-claim and owner allocations are rejected.
7. A real overpayment is allowed while credit over-allocation is rejected.
8. Legacy backfill preserves claim totals and existing allocations.
9. Spending aggregation uses the owner participant’s share and remains net-preserving.

Run the focused test after each small implementation step, then the complete Python suite before applying the migration to real data.
