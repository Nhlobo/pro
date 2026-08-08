# Sage Business Cloud Accounting (South Africa) — verified API research

Status: **research only**. No code in this repository was changed to call
these endpoints. `sageone-client.ts` remains the disabled stub. This file
exists so the next implementation attempt starts from confirmed facts
instead of guesses.

Verified against Sage's own hosted documentation on 2026-08-08:
- https://www.sage.com/en-za/sage-business-cloud/accounting/developer-api/ (Sage's official South Africa developer page)
- https://accounting.sageone.co.za/api/2.0.0/Help (Sage's own live, auto-generated API help/spec site — same host as the production API)
- https://resellers.accounting.sageone.co.za/api/2.0.0/ (mirrors the same spec)

## Important: this is a different product/API from "developer.sage.com"

`developer.sage.com` documents the global **Sage Business Cloud Accounting
API** (OAuth2, `api.accounting.sage.com`). That API does **not** cover the
South African edition (Sage's own developer-community article confirms
SA is a separate product with a separate API — see
`developer-community.sage.com/.../does-the-sage-business-cloud-accounting-api-work-for-south-africa-r6`).

South Africa uses the legacy **Sage One / Sage Business Cloud Accounting SA**
API described below. The repo's old `sageone-processor/.env.example`
(`SAGEONE_API_URL=https://api.sageone.example.com/invoices`,
`SAGEONE_TAX_CODE=STANDARD`) and its request body shape
(`invoice.appointmentId`, `taxCode` string, `Authorization: apiKey`) match
**neither** of the real Sage APIs. It was fictional, exactly as the task
brief warned. Do not reuse it.

## Confirmed facts

**Base URL / versioning**
- Production API URL: `https://accounting.sageone.co.za`
- Current version: `2.00` → paths look like `/api/2.0.0/{Service}/{Method}/{id?}`
- Format: JSON only (no XML)

**Authentication (confirmed, and it is NOT what the old scaffold assumed)**
- HTTP Basic auth: `Authorization: Basic base64(username:password)` — a
  real Sage user's email + password, not a bearer token.
- **In addition**, every call requires `apikey` as a query-string
  parameter (issued separately by Sage per developer registration).
- Company-scoped calls also require a `companyid` query-string parameter.
- So a real call needs **four** pieces of secret/config, not two:
  Sage username, Sage password, API key, company id. The current
  `sageone-client.ts` / `.env.example` precedent only models
  `SAGEONE_API_URL` + `SAGEONE_API_KEY`. That shape is insufficient and
  would need to change before a live client could authenticate at all.

**Customer endpoints (confirmed)**
- `POST Customer/Save` — create/update. Verified field set includes
  `Name`, `TaxReference`, `ContactName`, `Email`, `Telephone`,
  `PostalAddress01..05`, `DefaultTaxTypeId`, `Active`, `ID`, etc.
  (Full schema seen at `Help/Api/POST-Customer-Save` and embedded in the
  `TaxInvoice` model — see below.)
- `GET Customer/Get` (list), `GET Customer/Get/{id}`, `DELETE Customer/Delete/{id}`.
- List responses are wrapped: `{ "TotalResults": n, "ReturnedResults": n, "Results": [...] }`.

**Invoice endpoint (confirmed to exist; schema confirmed via a sibling method)**
- Service: **Tax Invoice** — "provides methods that allow for the
  retrieval and creation of Tax Invoices."
- `POST TaxInvoice/Save` is the create/update method (same CRUD pattern
  as every other entity in this API: `Get`, `Get/{id}`, `Save`,
  `Delete/{id}`). I could not directly load the `Save` help page itself
  (fetch tool blocked the URL because it hadn't appeared in a search
  result), but `POST TaxInvoice/Calculate` — confirmed live at
  `https://accounting.sageone.co.za/api/2.0.0/Help/Api/POST-TaxInvoice-Calculate`
  — documents the exact same `TaxInvoice` request/response model
  (linked via `Help/ResourceModel?modelName=TaxInvoice`), so the field
  list below is real, current Sage schema, not inferred.

**TaxInvoice model (key fields, confirmed)**
```
Date            date, Required
DueDate         date, Required
CustomerId      integer, Required   (must already exist in Sage — see Customer/Save)
CustomerName    string
TaxReference    string (0-30 chars)
DocumentNumber  string (0-100 chars)   — behavior on Save (auto vs caller-supplied) not confirmed
Reference       string (0-100 chars)
ExternalReference string (0-100 chars) — free text, NOT documented as unique/dedupe key
Message         string (0-8000 chars)
Inclusive       bool                — whether line prices are tax-inclusive
DiscountPercentage decimal
Exclusive / Tax / Total / AmountDue   decimal, computed
Lines           Collection of CommercialDocumentLine
ID              integer (system-assigned on create)
UID             GUID (system-assigned)
```

**CommercialDocumentLine (line item) model (confirmed)**
```
SelectionId          integer  — an Item or Account id (LineType decides which)
LineType              int     — 0 = Item, 1 = Account
TaxTypeId             integer — REQUIRED, company-specific FK (see Tax Types below)
Description            string
Quantity                decimal
UnitPriceExclusive      decimal
UnitPriceInclusive      decimal
TaxPercentage           decimal (computed/echoed from TaxTypeId)
```

**VAT / tax handling (confirmed mechanism, NOT a static code)**
- There is no "STANDARD"/"ZERO" string tax code. Every company has its
  own `TaxType` records, each with an integer `ID`, a `Name`, and a
  `Percentage` (confirmed via `Account` model's embedded
  `DefaultTaxType`: `{ ID, Name, Percentage, IsDefault, Active, ... }`).
  A South African company's 15% VAT tax type has a **different numeric
  ID in every Sage company** — it must be looked up via `TaxType/Get`
  for the specific company this integration will post into. It cannot
  be hardcoded, and the old `SAGEONE_TAX_CODE=STANDARD` precedent is
  simply wrong for this API.

**Response codes (confirmed, official table)**
`200` OK · `201` Created · `202` Accepted · `204` No Content ·
`400` Bad Request (validation errors in body) · `401` Unauthorised ·
`404` Not Found · `405` Method Not Allowed · `409` Conflict (delete of
in-use item) · `415` missing/invalid Content-Type · `429` Rate Limited ·
`500` Internal Server Error · `503` Service Unavailable.

**Rate limits (confirmed)**
- 5000 requests/day per company.
- 100 requests/minute per company; exceeding it triggers a 1-hour IP
  block with a specific documented message.
- 20 failed logins/hour triggers a 24-hour username block.
- Sage's own guidance: stay under ~1 request/second and do not retry
  immediately into a block — "queue requests until the block is lifted."
  A future live client's retry/backoff design must respect this
  explicitly (naive exponential backoff starting at 1s could still
  breach the per-minute limit under batch processing).

## Confirmed blockers — why a live client is NOT implemented in this change

Per the task's explicit rule ("do not proceed with an API implementation
if any of these are uncertain — identify the exact blocker instead"),
these remain open and are not guessable from documentation:

1. **No confirmed idempotency / duplicate-prevention mechanism.**
   `ExternalReference` exists as a free-text field but nothing in Sage's
   docs describes it as unique or queryable for dedupe purposes. Worse,
   Sage's own documentation states: *"Filter and Order by will not work
   for string values of any kind"* for `Get` list methods — so a
   "does an invoice with our internal id already exist in Sage?"
   pre-check via OData string filtering is **not supported**. The task
   requires "never create duplicate Sage invoices if the queue is
   retried" (rule 10) — with this API, that guarantee can only come from
   *our own* database state (the existing `sage_reference` check in
   `processQueueItem`), not from anything Sage enforces. That's an
   acceptable design (and the current scaffold already does the
   right-shaped check), but it means a crash between "Sage accepted the
   POST" and "we recorded `sage_reference`" is a real, currently
   unmitigated duplicate-invoice risk that needs an explicit decision
   (e.g. write `sage_reference` speculatively before the call, or accept
   the risk and reconcile manually) — not something to guess in this
   change.

2. **Company ID is required and unmodeled.** Every call needs `companyid`.
   Nothing in the current scaffold (`SageOneClient` interface,
   `SageInvoiceInput`, env var names) carries a company id. Which Sage
   company this integration should post into is a business decision, not
   something inferable from this codebase.

3. **Tax Type ID is company-specific and unmodeled.** As above — the
   correct `TaxTypeId` for 15% VAT in *this specific* Sage company must
   either be looked up live (an extra `TaxType/Get` call and caching
   strategy not yet designed) or supplied as verified configuration. It
   cannot be hardcoded without confirming it against the real company.

4. **Auth model requires new secrets not yet in any `.env.example`.**
   Sage username + password (Basic auth) + API key + company id — four
   values, not the two (`SAGEONE_API_URL`, `SAGEONE_API_KEY`) the
   existing disabled client models. Introducing real credential handling
   is itself a decision that should be reviewed, not silently expanded.

5. **`DocumentNumber` behavior on `Save` is unconfirmed** — whether
   supplying our own `invoice_number` is honoured or whether Sage always
   assigns its own sequential number. This affects whether our
   `internal_invoices.invoice_number` can be reflected in Sage at all,
   and needs either a documentation citation I could not retrieve
   (the `Save` help page itself was not reachable) or a controlled test
   call against a sandbox company.

6. **Exact `400` validation error body shape unconfirmed** — status
   codes are documented, but I did not find a captured sample of a
   validation failure response body, which the error-classification
   logic in `internal-sage-processor` would need to parse reliably.

None of these are answerable from public documentation alone — they need
either a real (sandbox) Sage company to test against, or explicit
business input (which company, whose Sage login, how to treat the
duplicate-risk window). Implementing `sageone-client.ts` against guesses
for any of these would risk posting VAT at the wrong rate or against the
wrong company, which is exactly what the task's safety rules prohibit.

## What a future implementation would need before it can proceed

- A **sandbox** Sage Business Cloud Accounting SA company + a dedicated
  API-only user (never reuse a real accountant's login), plus that
  company's real `apikey` and `companyid`.
- One read-only exploratory call to `TaxType/Get` on that sandbox company
  to record the real `TaxTypeId` for standard VAT — and a decision on
  whether that id is pinned via config or looked up per run.
- A decision on the idempotency question in blocker #1 above.
- A decision on new env var names for the four auth values (this repo
  has no existing convention for Basic-auth-based Edge Function secrets
  to follow).
