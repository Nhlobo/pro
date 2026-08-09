# Controlled Sage sandbox test — manual procedure

Status: documentation only. Nothing in this file was executed. No SQL
was run, no Sage request was made, Sage remains disabled
(`SAGEONE_ENABLED` is not set to `true` anywhere in the repo), no cron
job exists, and the 458 existing `internal_sage_queue` records were not
touched.

This procedure lets you submit **exactly one** invoice to a Sage
sandbox/test company and verify the result, without going anywhere near
the rest of the queue. It relies on the new `single_test` mode added to
`internal-sage-processor/index.ts` in this change (see "What changed in
the processor" below).

---

## 1. Which Edge Function to deploy

Only **`internal-sage-processor`** needs to be deployed. It already
contains everything needed — the normal batch path (unchanged) and the
new single-record test path.

```bash
supabase functions deploy internal-sage-processor
```

Do not deploy/touch `sageone-processor` (legacy) — leave it exactly as
it is.

## 2. Edge Function secrets to configure (names only — never put values in files)

Set these as Supabase secrets, not in any committed file:

```bash
supabase secrets set SAGEONE_ENABLED=true
supabase secrets set SAGEONE_API_URL=https://accounting.sageone.co.za
supabase secrets set SAGEONE_API_KEY=<real sandbox api key>
supabase secrets set SAGEONE_USERNAME=<dedicated sandbox Sage user email>
supabase secrets set SAGEONE_PASSWORD=<that user's password>
supabase secrets set SAGEONE_COMPANY_ID=<sandbox company id — see step 3>
supabase secrets set SAGEONE_TAX_TYPE_ID=<standard VAT TaxType id — see step 5>
```

Notes:
- `SAGEONE_ENABLED=true` here is a **secret you set in your own Supabase
  project**, not a change to the repository's committed default (which
  stays `false` in `.env.example` and in code). This is consistent with
  constraint 5 in the task ("do not enable SAGEONE_ENABLED in the
  repository").
- Use a **dedicated, sandbox-only** Sage user for `SAGEONE_USERNAME`/
  `SAGEONE_PASSWORD` — never a real accountant's personal login, and
  never your production company's credentials for this first test.
- You will not know the real values for `SAGEONE_COMPANY_ID` or
  `SAGEONE_TAX_TYPE_ID` until you complete steps 3–5 below — set those
  two last.

## 3. How to obtain/verify the real `SAGEONE_COMPANY_ID`

Sage doesn't publish a lookup endpoint for "list my companies" in the
part of the API we verified (see `SAGE_API_RESEARCH.md`). The company id
is something Sage/your Sage partner assigns when the API access and
company are provisioned. Confirm it directly:

1. Log into the target Sage Business Cloud Accounting (SA) **sandbox/test
   company** in the normal Sage web UI as the dedicated API user.
2. Sage's developer registration/API-access process (via your Sage
   partner or Sage's developer portal for South Africa) is where the
   `apikey` and the associated `companyid` are issued together — they
   come from the same place. If you don't already have both, request
   API access for the sandbox company through that channel; do not
   guess or reuse a production company id.
3. Once you have a candidate `companyid`, verify it (rather than trust
   it blindly) using the read-only call in step 4 — a wrong company id
   will simply fail there with a 401/404, which is a safe, side-effect-
   free way to confirm it's correct before touching anything else.

## 4. How to call `TaxType/Get` against the intended Sage company

Once you have `apikey`, `username`, `password`, and a candidate
`companyid`, verify them with a single read-only call — no invoice or
customer data is touched by this call:

```bash
curl -u "<username>:<password>" \
  "https://accounting.sageone.co.za/api/2.0.0/TaxType/Get?apikey=<apikey>&companyid=<companyid>"
```

- `-u "<username>:<password>"` sends the confirmed `Authorization: Basic
  base64(username:password)` header.
- A `200` with a JSON body containing `Results: [...]` confirms all four
  values (username, password, apikey, companyid) are correct together.
- A `401` means the username/password/apikey combination is wrong.
- A `404`/empty result set for a `companyid` that otherwise authenticates
  suggests the company id itself is wrong.

You can run the same check without leaving Deno, using the client's own
`getTaxTypes()` method from a local scratch script (still entirely
read-only, still no invoice/customer data touched) — see appendix A.

## 5. How to identify the real TaxType ID for standard 15% VAT

From the `TaxType/Get` response in step 4, each entry looks like:

```json
{ "ID": 7, "Name": "Standard VAT", "Percentage": 15, "IsDefault": true, "Active": true }
```

Find the entry where `Percentage` is `15` (South Africa's standard VAT
rate) — cross-check with `IsDefault: true` and an obviously-matching
`Name` (e.g. "Standard VAT", "Standard Rate", "VAT 15%" — the exact
label is company-configurable in Sage, so confirm by percentage, not by
name alone). Its `ID` is the value for `SAGEONE_TAX_TYPE_ID`. Do not
assume `ID` values are consistent across different Sage companies.

## 6. How to select ONE specific test `internal_invoice` without touching the other 457+ records

Run these **manually yourself** (read-only `SELECT`s — I have not run
any of these):

```sql
-- Find a small number of candidate pending queue rows and their invoices,
-- newest first, so you can hand-pick one real, low-stakes record to test:
select
  q.id as queue_id,
  q.status as queue_status,
  q.attempts,
  q.sage_reference,
  i.id as internal_invoice_id,
  i.invoice_number,
  i.status as invoice_status,
  i.amount,
  i.vat_amount,
  i.total_amount,
  i.invoice_date,
  i.due_date,
  i.referring_attorney_id
from internal_sage_queue q
join internal_invoices i on i.id = q.internal_invoice_id
where q.status = 'pending'
order by q.created_at asc
limit 10;
```

Pick **one** `queue_id` from the result. Before using it, also confirm
it has everything the processor needs (a referring attorney with a
name, and a non-null `due_date` — both are hard requirements in the
current code, see `SAGE_API_RESEARCH.md` items 6–7):

```sql
select ra.id, ra.name, ra.contact_person, ra.email, ra.phone, ra.address
from referring_attorneys ra
join internal_invoices i on i.referring_attorney_id = ra.id
where i.id = '<internal_invoice_id from above>';
```

If `due_date` is null for every candidate row, `createInvoice` will
correctly refuse (VALIDATION_ERROR) rather than guess a date — pick a
different candidate row that has a `due_date`, or treat that as a
finding to resolve before a production run (see `SAGE_API_RESEARCH.md`
item 7).

**Do not** run any `UPDATE`, `INSERT`, or the DRAFT
`claim_internal_sage_queue_batch` function. The `SELECT`s above are the
only manual SQL this procedure needs, and they don't modify anything.

## 7. How to invoke the processor for exactly that one record

The current processor's batch path claims via
`claim_internal_sage_queue_batch`, an RPC that only exists once the
DRAFT migration is applied — which this task explicitly says not to do.
So batch mode is not a safe option for this test. **This is why the
processor needed a minimal change**: it now supports an explicit
single-record test mode that claims exactly one row via a plain,
id-scoped `UPDATE ... WHERE id = $1 AND status = 'pending'` — no RPC, no
migration required, and structurally incapable of touching more than
the one row you name.

Call it like this:

```bash
curl -X POST "https://<project-ref>.functions.supabase.co/internal-sage-processor" \
  -H "Authorization: Bearer <a valid Supabase auth/service token>" \
  -H "Content-Type: application/json" \
  -d '{
        "mode": "single_test",
        "queueId": "<queue_id from step 6>",
        "confirm": true
      }'
```

All three of `mode`, `queueId`, and `confirm: true` are required
together — this is deliberate (`parseSingleTestRequest` in
`index.ts`, unit-tested in `index.test.ts`). A normal call with no body,
or with just `{ "batchSize": ... }`, is completely unaffected and still
runs the ordinary (unchanged) batch path — so there is no way to
"accidentally" land in test mode.

Expected response shapes:

- Row not found / not pending:
  `{ "mode": "single_test", "queueId": "...", "claimed": 0, "message": "No internal_sage_queue row with id=... and status='pending' was found. Nothing was claimed or modified." }`
  (HTTP 404 — nothing touched.)
- Success:
  `{ "mode": "single_test", "queueId": "...", "sageConfigured": true, "claimed": 1, "outcome": { "itemId": "...", "outcome": "processed" } }`
- Validation/Sage error:
  `{ "mode": "single_test", ..., "outcome": { "itemId": "...", "outcome": "validation_failed", "reason": "..." } }`
  (the row is marked `failed` or released back to `pending` depending on
  retryability — same logic as the normal path, see `recordFailure` in
  `index.ts`.)

### What changed in the processor (for your review)

- Added `claimSingleTestRow(queueId)` — claims one row via
  `.eq("id", queueId).eq("status","pending")`, no RPC.
- Added `parseSingleTestRequest(body)` — pure validation (confirm +
  queueId + UUID format), unit-tested.
- Added a `mode === "single_test"` branch in the HTTP handler, entered
  only when all three fields are present; it calls the *same*
  `processQueueItem` function the batch path already used — no new
  business logic, no duplicated Sage-mapping code.
- The normal/default batch path is untouched — same code, same
  behavior, same `claimPendingBatch`/RPC dependency as before.

## 8. How to verify the resulting Sage Tax Invoice

```bash
curl -u "<username>:<password>" \
  "https://accounting.sageone.co.za/api/2.0.0/TaxInvoice/Get/<sage_reference>?apikey=<apikey>&companyid=<companyid>"
```

`<sage_reference>` is the `outcome` payload's implied Sage invoice id —
read it back from the queue row (step 9) if you didn't capture it from
the HTTP response. Confirm:
- `CustomerId` matches the Sage customer created for the referring
  attorney.
- `Lines[].UnitPriceExclusive` and `Lines[].TaxTypeId` match what you
  expect (excl.-VAT amount, and the `SAGEONE_TAX_TYPE_ID` you set).
- `Date`/`DueDate` match `internal_invoices.invoice_date`/`due_date`.
- Also check inside the Sage web UI itself that exactly **one** new tax
  invoice and, if it's a new attorney, exactly **one** new customer
  appeared — not two.

## 9. How to verify the local queue record

```sql
select id, status, attempts, last_error, sage_reference, claimed_at, processed_at
from internal_sage_queue
where id = '<queue_id from step 6>';
```
(Manual `SELECT` only — not run by me.)

Expect: `status = 'processed'`, `sage_reference` populated with the
value returned by Sage, `processed_at` set, `claimed_at` null,
`last_error` null.

## 10. How to verify no other queue records were claimed or modified

```sql
select count(*) as still_pending_and_untouched
from internal_sage_queue
where status = 'pending';
```
(Manual `SELECT` only — not run by me.) This should be exactly 457 if it
was 458 before the test (i.e. down by exactly the one row you tested).

```sql
select id, status, attempts, claimed_at, processed_at
from internal_sage_queue
where updated_at > now() - interval '1 hour'  -- adjust to your test window
  and id <> '<queue_id from step 6>';
```
If your schema has no `updated_at` column, use `processed_at is not
null or claimed_at is not null` instead, scoped to the same time
window, and confirm the result set is empty. This, combined with
`claimSingleTestRow`'s `.eq("id", queueId)` scoping (which makes it
structurally impossible to touch a second row even under concurrent
access), is the proof that only the one record was affected.

## 11. Disabling again after the test

```bash
supabase secrets unset SAGEONE_ENABLED
```
(or set it back to `false`). This returns the deployed function to the
same disabled state as the repository default.

---

## Appendix A — optional: verify credentials with the actual client code (still read-only)

If you'd rather use the verified client than raw `curl`, you can run
`getTaxTypes()` locally against real credentials without going through
the deployed function at all (still zero writes to Sage):

```ts
// scratch.ts — run locally with your own real credentials, never commit this file
import { LiveSageOneClient } from "./supabase/functions/_shared/sageone-client.ts";

const client = new LiveSageOneClient({
  enabled: true,
  apiUrl: "https://accounting.sageone.co.za",
  apiKey: "<real sandbox api key>",
  username: "<sandbox username>",
  password: "<sandbox password>",
  companyId: "<candidate company id>",
  taxTypeId: 1, // placeholder — not used by getTaxTypes()
});

console.log(await client.getTaxTypes());
```

```bash
deno run --allow-net --allow-env scratch.ts
```

Delete `scratch.ts` afterwards — never commit it (it would need real
credentials inline to run standalone like this).
