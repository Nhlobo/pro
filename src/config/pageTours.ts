import type { RouteTourEntry } from '@/components/tour/RouteFirstVisitTour';

/**
 * Per-page first-visit tours.
 * Each entry explains what the function does, who uses it, and the key
 * actions a new user can take. Shown automatically the first time a user
 * opens that route — once dismissed it does not pop up again.
 */

export const ADMIN_PAGE_TOURS: RouteTourEntry[] = [
  {
    path: '/admin',
    title: 'Operations Dashboard',
    description:
      'Your daily command centre. See live KPIs across cases, appointments, reports, finance and experts. Use the cards to drill into any module and the activity feed to spot anything that needs attention today.',
  },
  {
    path: '/admin/attorney-crm',
    title: 'Attorney CRM',
    description:
      'Manage every referring attorney and law firm. View the full directory, classify partners by tier, log outreach activity, and track which firms are sending the most work. Click any attorney to open their profile, debt position and case history.',
  },
  {
    path: '/admin/cases',
    title: 'Case Management',
    description:
      'The master list of every claimant case. From here you can open a case file, update its phase in the 7-step litigation timeline, link AODs, attach documents and assign experts. Use filters to narrow by attorney, status or matter type.',
  },
  {
    path: '/admin/experts',
    title: 'Expert Network',
    description:
      'Your medical expert directory. Add new experts, update their fees and availability, monitor performance scores, and review credit-control balances. Use the search and province filters to find the right expert for an assessment.',
  },
  {
    path: '/admin/heatmap',
    title: 'Availability Heatmap',
    description:
      'A national map of expert availability by province and specialty. Use it to spot coverage gaps, plan recruitment, and quickly find an expert near a claimant. Hover any region to see active experts and average turnaround.',
  },
  {
    path: '/admin/support',
    title: 'Support Hub',
    description:
      'Manage every support ticket raised by attorneys, experts and internal staff. Tickets follow the TKT-00001 format with threaded messaging. Assign tickets, reply, change status and close them when resolved.',
  },
  {
    path: '/admin/reports',
    title: 'Report Management',
    description:
      'Track every medico-legal report through its lifecycle: requested, in progress, submitted, under review, finalised and delivered. Assign reviewers, attach proof of payment, and release reports to attorneys once finalised.',
  },
  {
    path: '/admin/reporting',
    title: 'Reporting System',
    description:
      'Operational dashboards covering case throughput, expert utilisation, attorney referrals and revenue. Export any view to CSV/PDF for management reporting.',
  },
  {
    path: '/admin/documents',
    title: 'Document Vault',
    description:
      'Secure, POPIA-compliant storage for every claimant document, expert report, AOD and agreement. Upload, tag, version and search files. Access is governed by role-based permissions and every view is logged.',
  },
  {
    path: '/admin/finance',
    title: 'Finance & Payments',
    description:
      'Manage AODs, payments received, debtors and short-term agreements. Allocate payments to specific reports, send statements, and track outstanding balances per attorney. All fees are 15% VAT inclusive and balances clamp at R0.00.',
  },
  {
    path: '/admin/appointments',
    title: 'Appointment Engine',
    description:
      'Schedule, confirm and reschedule assessments. Triage incoming appointment requests from attorneys, send confirmations with calendar invites, and track 48-hour reminders. Default appointment time is 09:00 (SAST).',
  },
  {
    path: '/email-queue',
    title: 'Email History',
    description:
      'Every outbound email sent by the system: confirmations, reminders, statements and notifications. Check delivery status, resend failed emails, and inspect attachments and recipients.',
  },
  {
    path: '/admin/analytics',
    title: 'Analytics',
    description:
      'System-wide analytics across cases, finance, experts and attorneys. Build comparison views, export raw data, and identify trends over custom date ranges.',
  },
  {
    path: '/admin/iam',
    title: 'Access & IAM',
    description:
      'Manage users, roles and per-function permissions. Invite new staff, assign Admin / Employee / Sales Consultant / Attorney / Expert roles, and toggle granular access to specific functions per user.',
  },
  {
    path: '/admin/system-control',
    title: 'System Control',
    description:
      'Configure system-wide settings: feature visibility, workflow rules, data controls, record locks and JSONB settings. Use with care — changes here affect every user.',
  },
  {
    path: '/admin/my-profile',
    title: 'My Profile',
    description:
      'Update your personal details, password, MFA and notification preferences. Sales consultants can also view their personal targets and incentive history here.',
  },
];

export const ATTORNEY_PAGE_TOURS: RouteTourEntry[] = [
  {
    path: '/attorney-portal',
    title: 'Attorney Dashboard',
    description:
      'Your home base. At a glance see active cases, upcoming assessments, recent reports released to you, and any outstanding balance with our firm. Click any card to drill in.',
  },
  {
    path: '/attorney-portal/cases',
    title: 'My Cases',
    description:
      'Every case you have referred to us. Open a case to view the claimant file, attached documents, expert assigned, and progress notes. Use the search bar to find a case by claimant name or reference.',
  },
  {
    path: '/attorney-portal/case-status',
    title: 'View Case Status',
    description:
      'A live timeline showing where each of your cases sits in our 7-phase workflow — from intake through assessment, report drafting, finalisation and trial readiness. Hover a phase for the date it was reached.',
  },
  {
    path: '/attorney-portal/appointments',
    title: 'Appointments',
    description:
      'All upcoming and past assessment bookings for your claimants. View confirmation details, the expert and venue, and request a reschedule if needed.',
  },
  {
    path: '/attorney-portal/reports',
    title: 'Reports',
    description:
      'Download finalised medico-legal reports and follow up on reports still in progress. Each report shows status, expert, and any payment required before release.',
  },
  {
    path: '/attorney-portal/payments',
    title: 'AOD & Payments',
    description:
      'Your Acknowledgements of Debt, payment history and current balance. Submit proof of payment, view receipts, and download statements.',
  },
  {
    path: '/attorney-portal/agreements',
    title: 'Agreements',
    description:
      'Signed short-term agreements and consolidated AODs available for your records. Download a PDF copy of any agreement at any time.',
  },
  {
    path: '/attorney-portal/notifications',
    title: 'Notifications',
    description:
      'Real-time alerts about appointment changes, report releases, payment events and messages from our team. Mark items as read or click through to the source record.',
  },
  {
    path: '/attorney-portal/support',
    title: 'Support',
    description:
      'Raise a support ticket, browse FAQs, or chat with the medico-legal team. Tickets are tracked end-to-end so nothing falls through the cracks.',
  },
];

export const EXPERT_PAGE_TOURS: RouteTourEntry[] = [
  {
    path: '/expert-portal',
    title: 'Expert Dashboard',
    description:
      'Your overview as a medical expert. See pending cases, upcoming assessments, report deadlines and your current performance score (0-100). Use the quick links to jump to today’s priorities.',
  },
  {
    path: '/expert-portal/cases',
    title: 'My Cases',
    description:
      'Every case assigned to you. Open a case to review claimant details, instructions from the attorney, uploaded medical records and any prior reports.',
  },
  {
    path: '/expert-portal/schedule',
    title: 'Schedule',
    description:
      'Your upcoming assessment appointments with claimant info, location, time and contact details. Confirm attendance and request changes if needed.',
  },
  {
    path: '/expert-portal/reports',
    title: 'Reports',
    description:
      'Track every report you have authored — draft, submitted, under review and finalised. Upload completed reports here for our team to review and release to the attorney.',
  },
  {
    path: '/expert-portal/performance',
    title: 'Performance',
    description:
      'Your 0-100 weighted performance score covering turnaround time, report quality, attendance and attorney feedback — tracked over time so you can see your trend.',
  },
  {
    path: '/expert-portal/profile',
    title: 'Profile',
    description:
      'Update your bio, fees, availability, qualifications and contact details. This is the information attorneys and admins see when matching you to cases.',
  },
];
