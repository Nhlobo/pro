import type { RouteTourEntry } from '@/components/tour/RouteFirstVisitTour';

/**
 * Per-page first-visit tours.
 * Every entry is a multi-step guided walkthrough: an intro that explains
 * what the page does, then steps describing the main actions a user can
 * take. Steps without a selector render centered, so they work on any
 * layout without brittle DOM hooks.
 */

const step = (title: string, content: string, selector?: string) => ({
  title,
  content,
  ...(selector ? { selector, placement: 'bottom' as const } : { placement: 'center' as const }),
});

export const ADMIN_PAGE_TOURS: RouteTourEntry[] = [
  {
    path: '/admin',
    title: 'Operations Dashboard',
    description:
      'Your daily command centre — live KPIs across cases, appointments, reports, finance and experts.',
    extraSteps: [
      step('KPI cards', 'The cards at the top show today’s key numbers: open cases, upcoming appointments, reports due, and outstanding balances. Click any card to drill into that module.'),
      step('Activity feed', 'The activity feed lists recent system events — new appointment requests, report submissions and payments. Use it to spot anything that needs your attention right now.'),
      step('Quick navigation', 'Use the sidebar on the left to jump between modules. The Help button (top right) replays this tour any time.'),
    ],
  },
  {
    path: '/admin/attorney-crm',
    title: 'Attorney CRM',
    description: 'Manage every referring attorney and law firm.',
    extraSteps: [
      step('Search & filter', 'Use the search bar and filters to narrow attorneys by name, firm, province or CRM tier (Platinum / Gold / Silver / Bronze).'),
      step('Open a profile', 'Click any attorney row to open their full profile — case history, debt position, contact log and assigned sales consultant.'),
      step('Log outreach', 'Use the Pitchlog tab to record calls, emails and meetings. Outreach drives the CRM tier classification automatically.'),
      step('Add an attorney', 'Hit the “Add Attorney” button (top right) to capture a new referring partner. Duplicates are detected automatically and can be merged.'),
    ],
  },
  {
    path: '/admin/cases',
    title: 'Case Management',
    description: 'The master list of every claimant case.',
    extraSteps: [
      step('Filter the list', 'Filter by attorney, status, matter type or date to find a specific case quickly. The search bar matches claimant name, ID or case reference.'),
      step('Open a case', 'Click a row to open the case file: claimant details, attached documents, expert assigned, AOD links and the 7-phase litigation timeline.'),
      step('Update status', 'Inside a case, use the Status dropdown to move it through the workflow (e.g. Assessed, Report Submitted, Merit Report, Court Preparation).'),
      step('Add a new case', 'Use “New Case” to capture a claimant and matter. The form includes built-in deduplication so you don’t double-up on existing claimants.'),
    ],
  },
  {
    path: '/admin/experts',
    title: 'Expert Network',
    description: 'Your medical expert directory.',
    extraSteps: [
      step('Search & filter', 'Filter experts by specialty, province, fee range or availability. The search bar matches name, qualification or HPCSA number.'),
      step('Open an expert', 'Click any expert to view their profile — fees, performance score (0-100), case history and credit-control balance.'),
      step('Manage fees & availability', 'Inside an expert profile, update fees, slots and availability. Changes flow through to the Availability Heatmap and booking engine.'),
      step('Add a new expert', 'Use “Add Expert” to onboard a medical practitioner. Province is normalised automatically and duplicates are flagged for merging.'),
    ],
  },
  {
    path: '/admin/heatmap',
    title: 'Availability Heatmap',
    description: 'A national map of expert availability by province and specialty.',
    extraSteps: [
      step('Pick a specialty', 'Use the specialty filter to focus the map on one type of expert (e.g. Orthopaedic, Neurology, Industrial Psychology).'),
      step('Read the colours', 'Darker shading means higher density of available experts in that province. Lighter areas highlight coverage gaps for recruitment.'),
      step('Drill into a province', 'Click a province to list every expert there with their next available slot and average turnaround time.'),
    ],
  },
  {
    path: '/admin/support',
    title: 'Support Hub',
    description: 'Manage every support ticket raised by attorneys, experts and staff.',
    extraSteps: [
      step('Triage tickets', 'Tickets follow the TKT-00001 format. Filter by status (Open, In Progress, Resolved) or assignee to see what’s on your plate.'),
      step('Reply on a ticket', 'Open a ticket to read the full thread and post a reply. Messages email the requester and stay logged for audit.'),
      step('Change status & assign', 'Use the status dropdown and assignee picker on the right to route tickets, escalate them, or close them when resolved.'),
    ],
  },
  {
    path: '/admin/reports',
    title: 'Report Management',
    description: 'Track every medico-legal report through its lifecycle.',
    extraSteps: [
      step('Filter the queue', 'Filter by stage: Requested, In Progress, Submitted, Under Review, Finalised, Delivered. The Document Vault auto-syncs uploaded reports here.'),
      step('Review & approve', 'Open a report to view the draft, leave review notes, and either request a revision or mark it Finalised.'),
      step('Release to attorney', 'Once finalised and any required payment is received, hit “Release” to send the report to the referring attorney with an email link.'),
    ],
  },
  {
    path: '/admin/reporting',
    title: 'Reporting System',
    description: 'Operational dashboards covering case throughput, expert utilisation and revenue.',
    extraSteps: [
      step('Pick a date range', 'Use the date picker to scope every dashboard to the period you care about — this week, month, quarter or custom.'),
      step('Switch dashboards', 'The tabs at the top switch between Cases, Experts, Attorneys and Finance dashboards. Each one shows trend charts and totals.'),
      step('Export', 'Use the Export button on any dashboard to download the underlying data as CSV or a PDF report for management.'),
    ],
  },
  {
    path: '/admin/documents',
    title: 'Document Vault',
    description: 'Secure, POPIA-compliant storage for every document.',
    extraSteps: [
      step('Browse by category', 'Documents are organised by type (Reports, AODs, Agreements, Medical Records, Proof of Payment) and linked to a case or attorney.'),
      step('Upload a document', 'Use the Upload button to add files (up to 50MB). Tag the document type and link it to a case so it appears in the right places.'),
      step('Audit & access', 'Every view, download and edit is logged for POPIA compliance. Role-based permissions decide who sees what.'),
    ],
  },
  {
    path: '/admin/finance',
    title: 'Finance & Payments',
    description: 'Manage AODs, payments, debtors and short-term agreements.',
    extraSteps: [
      step('AODs & balances', 'The AOD tab consolidates contracts per attorney. Balances clamp at R0.00 and all fees are 15% VAT inclusive.'),
      step('Capture a payment', 'Use “Add Payment” to record a Payment Received. Allocate it to a specific report — the report status auto-progresses on full payment.'),
      step('Statements & reminders', 'Send statements to attorneys directly from this page. Outstanding balances drive the debtor reminders queue.'),
    ],
  },
  {
    path: '/admin/appointments',
    title: 'Appointment Engine',
    description: 'Schedule, confirm and reschedule assessments.',
    extraSteps: [
      step('Triage requests', 'New requests from attorneys land in the Requests tab. Approve, reschedule or decline — approval generates an appointment.'),
      step('Schedule an assessment', 'Use “New Appointment” to book directly. Default time is 09:00 SAST and the matching expert’s availability is shown live.'),
      step('Confirmations & reminders', 'On confirmation, the system emails the attorney and claimant with a calendar invite. 48-hour reminders are sent automatically.'),
    ],
  },
  {
    path: '/email-queue',
    title: 'Email History',
    description: 'Every outbound email sent by the system.',
    extraSteps: [
      step('Filter by status', 'Filter by Sent, Queued, Failed or Bounced to find a specific message. Search by recipient or subject.'),
      step('Inspect & resend', 'Open any email to view the full body, attachments and delivery log. Use “Resend” for failed messages.'),
    ],
  },
  {
    path: '/admin/analytics',
    title: 'Analytics',
    description: 'System-wide analytics across cases, finance, experts and attorneys.',
    extraSteps: [
      step('Build a view', 'Pick the metric, dimension and date range to build a comparison view. Save common views for quick access later.'),
      step('Export raw data', 'Use Export to pull the underlying rows as CSV — useful for board packs and ad-hoc analysis.'),
    ],
  },
  {
    path: '/admin/iam',
    title: 'Access & IAM',
    description: 'Manage users, roles and per-function permissions.',
    extraSteps: [
      step('Find a user', 'Use the search and role filter to find a user. The list shows their role, type and last activity.'),
      step('Assign a role', 'Open a user to assign a role: Admin, Employee, Sales Consultant, Referring Attorney or Medical Expert. Manager roles inherit Admin access.'),
      step('Function permissions', 'On the right, toggle access to specific functions (e.g. Manage Users, AOD Management). Granular control sits on top of the role.'),
      step('Invite a user', 'Use “Add User” to invite someone by email. They’ll receive a confirmation email and land on the right portal for their role.'),
    ],
  },
  {
    path: '/admin/system-control',
    title: 'System Control',
    description: 'Configure system-wide settings — use with care.',
    extraSteps: [
      step('Feature visibility', 'Toggle which modules are visible to which roles. Hidden modules disappear from the sidebar instantly.'),
      step('Workflow rules', 'Adjust workflow defaults — case phase order, status transitions, and reminder cadences.'),
      step('Record locks', 'Use record locks to freeze specific cases, AODs or reports against further edits during disputes.'),
    ],
  },
  {
    path: '/admin/my-profile',
    title: 'My Profile',
    description: 'Update your personal details and preferences.',
    extraSteps: [
      step('Profile details', 'Update your name, contact info and avatar. Changes are reflected across the platform immediately.'),
      step('Security', 'Change your password and enable Multi-Factor Authentication (MFA). MFA is required for sensitive roles.'),
      step('Notifications', 'Choose which alerts you receive by email and in-app — appointment changes, report releases and payment events.'),
    ],
  },
];

export const ATTORNEY_PAGE_TOURS: RouteTourEntry[] = [
  {
    path: '/attorney-portal',
    title: 'Attorney Dashboard',
    description: 'Your home base in the attorney portal.',
    extraSteps: [
      step('Quick stats', 'The cards summarise active cases, upcoming assessments, recent reports and your outstanding balance.'),
      step('Open a section', 'Click any card or use the sidebar to jump straight into Cases, Appointments, Reports or Payments.'),
      step('Need help?', 'The Help button (top right) replays this tour. The Support page lets you raise a ticket any time.'),
    ],
  },
  {
    path: '/attorney-portal/cases',
    title: 'My Cases',
    description: 'Every case you have referred to us.',
    extraSteps: [
      step('Search', 'Search by claimant name or case reference. Filter by status to focus on cases that need attention.'),
      step('Open a case', 'Click a row to view the full case file — claimant details, expert assigned, attached documents and progress notes.'),
      step('Submit a new case', 'Use “Refer New Case” to send us a new claimant. Attach intake documents (up to 20MB) directly in the form.'),
    ],
  },
  {
    path: '/attorney-portal/case-status',
    title: 'View Case Status',
    description: 'Live timeline of where each case sits in our 7-phase workflow.',
    extraSteps: [
      step('Read the timeline', 'Phases run from Intake → Assessment → Report Drafting → Review → Finalised → Delivered → Trial Readiness. Hover a phase for the date it was reached.'),
      step('Filter cases', 'Use the filters to view only active, finalised or trial-ready cases.'),
    ],
  },
  {
    path: '/attorney-portal/appointments',
    title: 'Appointments',
    description: 'Upcoming and past assessment bookings for your claimants.',
    extraSteps: [
      step('See what’s coming up', 'The Upcoming tab lists confirmed assessments with date, expert, venue and the claimant.'),
      step('Request a reschedule', 'Use the Reschedule action on any future appointment. Our team will confirm the new slot by email.'),
      step('Request a new appointment', 'Use “Request Appointment” to ask us to book an assessment for a claimant.'),
    ],
  },
  {
    path: '/attorney-portal/reports',
    title: 'Reports',
    description: 'Download finalised reports and follow up on those still in progress.',
    extraSteps: [
      step('Filter by status', 'Filter by In Progress, Submitted, Finalised or Delivered to find the report you need.'),
      step('Download', 'Click Download on any finalised report. If payment is required first, the button shows the outstanding amount.'),
    ],
  },
  {
    path: '/attorney-portal/payments',
    title: 'AOD & Payments',
    description: 'Acknowledgements of Debt, payment history and current balance.',
    extraSteps: [
      step('Your balance', 'The headline figure shows your current outstanding balance — clamped at R0.00 and inclusive of 15% VAT.'),
      step('Submit proof of payment', 'Use “Upload POP” to send proof of an EFT. We’ll allocate it to outstanding reports automatically.'),
      step('Download statements', 'Use Statements to download a PDF of your account history for any period.'),
    ],
  },
  {
    path: '/attorney-portal/agreements',
    title: 'Agreements',
    description: 'Signed short-term agreements and consolidated AODs.',
    extraSteps: [
      step('Browse agreements', 'Each row shows the agreement type, date signed and total value.'),
      step('Download a copy', 'Use Download to grab a PDF of any agreement for your records.'),
    ],
  },
  {
    path: '/attorney-portal/notifications',
    title: 'Notifications',
    description: 'Real-time alerts about appointments, reports, payments and messages.',
    extraSteps: [
      step('Read & action', 'Click any notification to jump to the related record. Read alerts are purged automatically each midnight.'),
      step('Mark all as read', 'Use “Mark all as read” when you’ve caught up — this clears the badge on the bell icon.'),
    ],
  },
  {
    path: '/attorney-portal/support',
    title: 'Support',
    description: 'Raise a ticket or browse FAQs.',
    extraSteps: [
      step('Search the FAQ', 'Most common questions are answered in the FAQ. Search before opening a ticket to get an instant answer.'),
      step('Open a ticket', 'Use “New Ticket” to describe your issue. You’ll get a TKT-00001 reference and updates by email.'),
    ],
  },
];

export const EXPERT_PAGE_TOURS: RouteTourEntry[] = [
  {
    path: '/expert-portal',
    title: 'Expert Dashboard',
    description: 'Your overview as a medical expert.',
    extraSteps: [
      step('Today’s priorities', 'The cards show pending cases, upcoming assessments and reports due — your day at a glance.'),
      step('Performance score', 'Your 0-100 performance score reflects turnaround, quality, attendance and attorney feedback. Click through to see the breakdown.'),
    ],
  },
  {
    path: '/expert-portal/cases',
    title: 'My Cases',
    description: 'Every case assigned to you.',
    extraSteps: [
      step('Open a case', 'Click any case to view claimant details, attorney instructions and uploaded medical records.'),
      step('Filter', 'Filter by status to focus on cases awaiting assessment, report drafting or sign-off.'),
    ],
  },
  {
    path: '/expert-portal/schedule',
    title: 'Schedule',
    description: 'Your upcoming assessment appointments.',
    extraSteps: [
      step('See your day', 'Each appointment shows date, time, claimant and venue. Default time is 09:00 SAST.'),
      step('Confirm or request changes', 'Use the actions on each appointment to confirm attendance or request a change. We’ll handle the rest.'),
    ],
  },
  {
    path: '/expert-portal/reports',
    title: 'Reports',
    description: 'Track every report you have authored.',
    extraSteps: [
      step('Track status', 'Reports flow from Draft → Submitted → Under Review → Finalised. The status column shows where each one sits.'),
      step('Submit a report', 'Use “Upload Report” on a case to submit a completed report. Our team reviews it before release to the attorney.'),
    ],
  },
  {
    path: '/expert-portal/performance',
    title: 'Performance',
    description: 'Your weighted performance score and trends.',
    extraSteps: [
      step('Score breakdown', 'See how the 0-100 score splits across turnaround time, report quality, attendance and feedback.'),
      step('Trends over time', 'The chart shows your monthly trend — use it to track improvements and spot dips early.'),
    ],
  },
  {
    path: '/expert-portal/profile',
    title: 'Profile',
    description: 'Update your bio, fees, availability and qualifications.',
    extraSteps: [
      step('Fees & availability', 'Keep your consultation fees and weekly availability up to date — this drives bookings and the national heatmap.'),
      step('Qualifications', 'Add your qualifications and HPCSA number. These are visible to attorneys when they pick an expert.'),
    ],
  },
];
