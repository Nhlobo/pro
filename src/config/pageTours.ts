import { ADMIN_MODULES } from '@/config/adminModules';
import type { RouteTourEntry } from '@/components/tour/RouteFirstVisitTour';

/**
 * Per-page first-visit tours for the Admin Portal.
 * Auto-generated from ADMIN_MODULES so every admin function gets a pop-up
 * the first time a user opens it.
 */
export const ADMIN_PAGE_TOURS: RouteTourEntry[] = ADMIN_MODULES.map((m) => ({
  path: m.href,
  title: m.title,
  description: m.description,
}));

export const ATTORNEY_PAGE_TOURS: RouteTourEntry[] = [
  { path: '/attorney-portal', title: 'Attorney Dashboard', description: 'Your home base — see active cases, upcoming appointments, recent reports and outstanding payments at a glance.' },
  { path: '/attorney-portal/cases', title: 'My Cases', description: 'View every case you have referred, track its current phase, and open the case file for documents and progress notes.' },
  { path: '/attorney-portal/case-status', title: 'Case Status', description: 'Live timeline of where each case sits in our 7-phase workflow — from intake through trial readiness.' },
  { path: '/attorney-portal/appointments', title: 'Appointments', description: 'Upcoming and past assessment bookings with confirmations, location and reschedule options.' },
  { path: '/attorney-portal/reports', title: 'Reports', description: 'Download finalised medico-legal reports and follow up on reports that are still in progress.' },
  { path: '/attorney-portal/payments', title: 'AOD & Payments', description: 'Acknowledgements of Debt, payment history and any outstanding balance against your firm.' },
  { path: '/attorney-portal/agreements', title: 'Agreements', description: 'Signed short-term agreements and consolidated AODs available for your records.' },
  { path: '/attorney-portal/notifications', title: 'Notifications', description: 'Real-time alerts about appointment changes, report releases and payment events.' },
  { path: '/attorney-portal/support', title: 'Support', description: 'Open a support ticket, browse FAQs and get help from the medico-legal team.' },
];

export const EXPERT_PAGE_TOURS: RouteTourEntry[] = [
  { path: '/expert-portal', title: 'Expert Dashboard', description: 'Your overview — pending cases, upcoming assessments, report deadlines and performance score.' },
  { path: '/expert-portal/cases', title: 'My Cases', description: 'All cases assigned to you. Open a case to review claimant details, instructions and uploaded documents.' },
  { path: '/expert-portal/schedule', title: 'Schedule', description: 'Your upcoming assessment appointments with claimant info, location and contact details.' },
  { path: '/expert-portal/reports', title: 'Reports', description: 'Track the status of every report you have authored and submit completed reports for review.' },
  { path: '/expert-portal/performance', title: 'Performance', description: 'Your 0-100 performance score, turnaround stats and quality indicators tracked over time.' },
  { path: '/expert-portal/profile', title: 'Profile', description: 'Update your bio, fees, availability and qualifications shown to attorneys and admins.' },
];
