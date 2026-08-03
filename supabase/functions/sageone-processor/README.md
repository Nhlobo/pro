# sageone-processor

Processes `public.sageone_invoice_queue` and creates SageOne tax invoices for appointments.

## SQL migration

Apply this migration in the Supabase SQL editor:

- `/home/runner/work/pro/pro/supabase/migrations/20260803_add_sageone_invoice_queue.sql`

## Required environment variables

Create function secrets (see `.env.example`):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE` (service-role key used server-side only)
- `SAGEONE_API_URL`
- `SAGEONE_API_KEY`
- Optional: `SAGEONE_TAX_CODE`

## Deploy

```bash
supabase functions deploy sageone-processor
supabase secrets set --env-file supabase/functions/sageone-processor/.env.example
```

## Local run

```bash
supabase start
supabase functions serve sageone-processor --env-file supabase/functions/sageone-processor/.env.example
```

## Invoke examples

Process one appointment queue item:

```bash
curl -i -X POST \
  "$SUPABASE_URL/functions/v1/sageone-processor" \
  -H "Authorization: ******" \
  -H "Content-Type: application/json" \
  -d '{"appointmentId":"<appointment-uuid>"}'
```

Process next pending batch (default limit 20):

```bash
curl -i -X POST \
  "$SUPABASE_URL/functions/v1/sageone-processor" \
  -H "Authorization: ******" \
  -H "Content-Type: application/json" \
  -d '{}'
```
