# External Portal Module — Phase 5

Phase 5 adds the case engagement surface shared by the **Referring Attorney Portal**
and the **Medical Expert Portal**. Nothing existing was modified: no changes to the
staff portal, existing RLS, auth, or any existing table/function.

## What shipped (live now, no database change required)

| Area | Where it comes from |
| --- | --- |
| Documents | `public.documents`, filtered by the existing `is_visible_to_attorney` / `is_visible_to_expert` flags and scoped to `external_portal_case_links`. Short-lived (5 min) signed URLs are minted server-side; every download is written to `external_portal_audit_logs`. |
| Case progress | `public.case_timelines` — the same 7-phase litigation timeline staff maintain. |
| Notifications | Derived server-side from live case data (report status changes, newly shared documents, completed timeline phases). Read state is stored per account in the browser, because external users have no `auth.users` row and this module never writes case data. |

New files:

- `supabase/functions/external-portal-engagement/index.ts` (public, session-token authorized)
- `src/services/externalPortal/externalPortalEngagementClient.ts`
- `src/hooks/externalPortal/useExternalPortalEngagement.ts`
- `src/components/external-portal/PortalCaseDocuments.tsx`
- `src/components/external-portal/PortalCaseProgress.tsx`
- `src/components/external-portal/PortalNotificationBell.tsx`

Wired into both portal shells (notification bell) and both case detail pages
(progress + documents). `supabase/config.toml` registers the new function with
`verify_jwt = false`, matching the other portal data functions.

## Outstanding: two-way case messaging

The database migration tool is currently disabled for this project, so the one
remaining Phase 5 item — staff ⇄ external-user messaging — could not be applied.
It needs two new isolated tables. Run the SQL below in the Cloud SQL editor (or
re-enable the migration tool and tell me to apply it), and I will wire the
messaging UI on both sides.

```sql
-- EXTERNAL PORTAL MODULE — PHASE 5 (messaging). Fully additive.
CREATE TABLE IF NOT EXISTS public.external_portal_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.external_portal_accounts(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('external', 'staff')),
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 5000),
  read_by_external_at TIMESTAMPTZ,
  read_by_staff_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS external_portal_messages_account_idx
  ON public.external_portal_messages (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS external_portal_messages_appointment_idx
  ON public.external_portal_messages (appointment_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.external_portal_messages TO authenticated;
GRANT ALL ON public.external_portal_messages TO service_role;
ALTER TABLE public.external_portal_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage external portal messages"
  ON public.external_portal_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.external_portal_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.external_portal_accounts(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS external_portal_notifications_account_idx
  ON public.external_portal_notifications (account_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.external_portal_notifications TO authenticated;
GRANT ALL ON public.external_portal_notifications TO service_role;
ALTER TABLE public.external_portal_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage external portal notifications"
  ON public.external_portal_notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Staff-side send helper: writes the message and raises the portal notification.
CREATE OR REPLACE FUNCTION public.external_portal_staff_send_message(
  _account_id UUID, _appointment_id UUID, _body TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_name TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can message external portal users';
  END IF;

  SELECT btrim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
  INTO v_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.external_portal_messages (
    account_id, appointment_id, sender_type, sender_user_id, sender_name, body, read_by_staff_at
  ) VALUES (
    _account_id, _appointment_id, 'staff', auth.uid(),
    COALESCE(NULLIF(v_name, ''), 'Medico-Legal Pro'), _body, now()
  ) RETURNING id INTO v_id;

  INSERT INTO public.external_portal_notifications (account_id, appointment_id, category, title, message)
  VALUES (_account_id, _appointment_id, 'message', 'New message from Medico-Legal Pro', left(_body, 240));

  PERFORM public.external_portal_log_audit(
    'admin', auth.uid(), _account_id, 'staff_message_sent',
    jsonb_build_object('appointment_id', _appointment_id, 'message_id', v_id)
  );

  RETURN v_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.external_portal_staff_send_message(UUID, UUID, TEXT) TO authenticated;
```
