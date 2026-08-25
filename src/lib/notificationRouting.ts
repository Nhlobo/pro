// src/lib/notificationRouting.ts
//
// Single, shared source of truth for "where does clicking this
// notification take you" — used by every bell/notifications-page
// implementation (staff, attorney, expert) so this logic exists in
// exactly one place instead of being duplicated and drifting out of
// sync, which is exactly how the underlying bug happened: the bell
// had its own routing switch, the notifications page had none at all,
// and the bell's own switch prioritized `related_table` over
// `category` — so a report_ready notification (related_table =
// 'documents', because the underlying row genuinely lives in the
// documents table) fell into the generic "documents → Agreements
// page" branch instead of the report-specific one, sending "Asanda
// report is ready" to the AOD/Agreements page instead of Reports.
//
// FIX: category is checked FIRST, since it's the precise signal this
// module's own triggers (Phase 28/29/30) set deliberately for exactly
// this purpose. related_table is only used as a fallback for older/
// generic notification types that predate those categories and don't
// have one.

export type NotificationPortal = 'admin' | 'attorney' | 'expert';

export const getPortalFromPath = (pathname: string): NotificationPortal => {
  if (pathname.startsWith('/attorney-portal')) return 'attorney';
  if (pathname.startsWith('/expert-portal')) return 'expert';
  return 'admin';
};

/**
 * Only the fields routing actually needs — deliberately narrower than
 * the full Notification interface so any page with its own local
 * notification shape (e.g. AttorneyNotifications.tsx) can pass its
 * data straight in without having to adopt the shared type.
 */
export interface RoutableNotification {
  category?: string | null;
  related_table?: string | null;
  related_record_id?: string | null;
}

/**
 * Resolves a notification to the page it should open, plus an
 * optional `?open=<id>` deep-link so the destination page can
 * highlight/auto-open the exact item, not just land on the general
 * page. Returns null when there's no sensible destination in the
 * current portal — the caller should still mark the notification
 * read, just not navigate.
 */
export const getNotificationRoute = (n: RoutableNotification, portal: NotificationPortal): string | null => {
  const id = n.related_record_id;

  // ---- Category-specific routing (checked first — see module comment) ----
  switch (n.category) {
    case 'report_ready':
      if (portal === 'attorney') return id ? `/attorney-portal/reports?open=${id}` : '/attorney-portal/reports';
      if (portal === 'expert') return '/expert-portal/report-tracking';
      if (portal === 'admin') return '/admin/reports';
      return null;
    case 'invoice':
    case 'payment':
      if (portal === 'attorney') return id ? `/attorney-portal/agreements?open=${id}` : '/attorney-portal/agreements';
      if (portal === 'admin') return '/admin/finance';
      return null;
    case 'appointment_reminder':
      if (portal === 'attorney') return id ? `/attorney-portal/appointments?open=${id}` : '/attorney-portal/appointments';
      if (portal === 'expert') return '/expert-portal/schedule';
      if (portal === 'admin') return '/admin/appointments';
      return null;
    case 'missing_document':
      if (portal === 'attorney') return id ? `/attorney-portal/cases?open=${id}` : '/attorney-portal/cases';
      if (portal === 'admin') return '/admin/documents';
      return null;
    default:
      break;
  }

  // ---- Generic fallback for older notification types with no category ----
  const key = n.related_table;
  switch (key) {
    case 'appointments':
    case 'appointment':
      if (portal === 'admin') return '/admin/appointments';
      if (portal === 'attorney') return '/attorney-portal/appointments';
      if (portal === 'expert') return '/expert-portal/schedule';
      return null;
    case 'appointment_requests':
    case 'appointment_request':
      if (portal === 'admin') return '/appointment-request-dashboard';
      if (portal === 'attorney') return '/attorney-portal/appointments';
      if (portal === 'expert') return '/expert-portal/schedule';
      return null;
    case 'referring_attorneys':
    case 'attorney':
      if (portal === 'admin') return id ? `/referring-attorney/${id}` : '/admin/attorney-crm';
      if (portal === 'attorney') return '/attorney-portal';
      return null;
    case 'claimants':
      if (portal === 'admin') return '/claimant-list';
      if (portal === 'attorney') return '/attorney-portal/cases';
      if (portal === 'expert') return '/expert-portal/cases';
      return null;
    case 'expert_reports':
    case 'reports':
    case 'report':
      if (portal === 'admin') return '/admin/reports';
      if (portal === 'attorney') return '/attorney-portal/reports';
      if (portal === 'expert') return '/expert-portal/reports';
      return null;
    case 'documents':
    case 'aod_documents':
    case 'document':
      if (portal === 'admin') return '/admin/documents';
      if (portal === 'attorney') return '/attorney-portal/agreements';
      return null;
    case 'payments':
    case 'aod_payments':
    case 'payment':
      if (portal === 'admin') return '/admin/finance';
      if (portal === 'attorney') return '/attorney-portal/payments';
      return null;
    case 'support_tickets':
      if (portal === 'admin') return '/admin/support';
      if (portal === 'attorney') return '/attorney-portal/support';
      if (portal === 'expert') return '/expert-portal/support';
      return null;
    case 'litigation_service_requests':
      return portal === 'admin' ? '/admin/litigation-requests' : null;
    case 'pitchlog_followup':
      return portal === 'admin' ? '/attorney-pitchlog' : null;
    case 'email_queue':
      return portal === 'admin' ? '/email-queue' : null;
    default:
      return null;
  }
};
