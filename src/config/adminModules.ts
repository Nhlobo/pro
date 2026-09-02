/**
 * Single source of truth for Admin Portal modules.
 * Used by:
 *  - AdminPortalLayout sidebar (rendering nav)
 *  - FunctionPermissionsManager (role/user permission allocation)
 *
 * To add/remove a module from the system, edit this file. The IAM
 * Manage panel will automatically pick up changes for both new and
 * existing users.
 */
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Search,
  MapPin,
  HeadsetIcon,
  FileText,
  FileSignature,
  BarChart3,
  FolderLock,
  Calendar,
  Mail,
  ShieldCheck,
  Settings,
  User,
  KeyRound
} from "lucide-react";

import { RandSign } from "@/components/icons/RandSign";
export type AdminModuleGroup = 'Core' | 'Intelligence' | 'Workflow' | 'System' | 'Account';

export interface AdminModule {
  key: string;
  title: string;
  href: string;
  group: AdminModuleGroup;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  /** Roles allowed to *see* this nav item. undefined = admin/employee only. */
  roles?: string[];
  /** Backing function-permission categories used by IAM. */
  permissions: Array<{ category: string; functionName?: string }>;
  /**
   * Roles for which this module is a guaranteed default/core page — always
   * accessible even if the admin hasn't (or has un-)granted its backing
   * permissions. Every role in `roles` still needs *some* core page so it
   * always has somewhere to land; everything else for that role is gated
   * by the permissions above. Has no effect for admin/employee, who bypass
   * module gating entirely.
   */
  core?: string[];
  /**
   * Extra paths that should be treated as part of this module for nav
   * highlighting and route-guard purposes, beyond `href` and its
   * sub-routes (e.g. a paired screen that doesn't nest under href).
   */
  aliasPaths?: string[];
}

export const ADMIN_MODULES: AdminModule[] = [
  // Core
  {
    key: 'operations',
    title: 'Operations Dashboard',
    href: '/admin',
    group: 'Core',
    icon: LayoutDashboard,
    description: 'Main admin overview & KPIs',
    // Director is also granted this live in role_module_defaults (confirmed
    // 2026-08-30 audit) — documented here so this file stays the accurate
    // source of truth instead of silently drifting from the DB.
    roles: ['admin', 'employee', 'director'],
    permissions: [{ category: 'Analytics & Reporting', functionName: 'CRM Analytics' }],
  },
  {
    key: 'attorney-crm',
    title: 'Attorney CRM',
    href: '/admin/attorney-crm',
    group: 'Core',
    icon: Users,
    description: 'Referring attorney directory & pipeline (includes the Sales Dashboard tab)',
    roles: ['admin', 'employee', 'sales_consultant'],
    permissions: [{ category: 'Analytics & Reporting', functionName: 'CRM Analytics' }],
    // A sales consultant's home base — always reachable so they're never
    // locked out of the portal entirely, even with every other module
    // revoked. This used to belong to a standalone 'sales-dashboard'
    // module/route, but that page was a full duplicate of the "Sales
    // Dashboard" tab that already lives inside this same page (see
    // AdminAttorneyCRM.tsx) — removed 2026-08-31 so there is exactly one
    // page, matching every other module here.
    core: ['sales_consultant'],
  },
  {
    key: 'experts',
    title: 'Expert Network',
    href: '/admin/experts',
    group: 'Core',
    icon: Stethoscope,
    description: 'Medical experts directory & performance',
    permissions: [{ category: 'Medical Expert Management' }],
  },
  {
    key: 'find-experts',
    title: 'Find Experts',
    href: '/admin/find-experts',
    group: 'Intelligence',
    icon: Search,
    description: 'Search medico-legal experts by province, district & profession',
    roles: ['admin', 'employee', 'sales_consultant'],
    permissions: [{ category: 'Medical Expert Management' }],
  },
  // Intelligence
  {
    key: 'heatmap',
    title: 'Availability Heatmap',
    href: '/admin/heatmap',
    group: 'Intelligence',
    icon: MapPin,
    description: 'National expert availability view',
    roles: ['admin', 'employee', 'sales_consultant'],
    permissions: [{ category: 'Analytics & Reporting', functionName: 'System Reports' }],
  },
  {
    key: 'support',
    title: 'Support Hub',
    href: '/admin/support',
    group: 'Intelligence',
    icon: HeadsetIcon,
    description: 'Tickets and support workflow',
    permissions: [{ category: 'Analytics & Reporting', functionName: 'System Reports' }],
  },
  // Workflow
  {
    key: 'reports',
    title: 'Report Management',
    href: '/admin/reports',
    group: 'Workflow',
    icon: FileText,
    description: 'Case stage tracking, trial readiness, and expert/assessment reports (merged with the former Case Management module)',
    // Internal staff (employees) get visibility into this dashboard alongside
    // admins — sales consultants and other external-facing roles are left out
    // since this surfaces claimant-level case and report detail.
    roles: ['admin', 'employee'],
    permissions: [
      { category: 'Report Management' },
      { category: 'Case Management' },
      { category: 'Claimant Management' },
    ],
  },
  {
    key: 'reporting',
    title: 'Reporting System',
    href: '/admin/reporting',
    group: 'Workflow',
    icon: BarChart3,
    description: 'Operational reporting dashboards',
    // Director is also granted this live in role_module_defaults (confirmed
    // 2026-08-30 audit) — documented here so this file stays the accurate
    // source of truth instead of silently drifting from the DB.
    roles: ['admin', 'employee', 'director'],
    permissions: [{ category: 'Analytics & Reporting', functionName: 'System Reports' }],
  },
  {
    key: 'documents',
    title: 'Document Vault',
    href: '/admin/documents',
    group: 'Workflow',
    icon: FolderLock,
    description: 'Secure document storage & uploads',
    permissions: [{ category: 'Document Management' }],
  },
  {
    key: 'finance',
    title: 'Finance & Payments',
    href: '/admin/finance',
    group: 'Workflow',
    icon: RandSign,
    description: 'AOD, debtors, payments, agreements, internal invoices',
    // sales_consultant deliberately excluded: RLS on every table this
    // page reads (aod_documents, short_term_agreements) already only
    // bypasses for admin/employee — a sales consultant has never
    // actually been able to see anything here, just empty tables and
    // non-functional payment/sync buttons. Removing the nav entry
    // matches what the database already enforces.
    roles: ['admin', 'employee', 'finance', 'director'],
    permissions: [{ category: 'Case Management', functionName: 'AOD Management' }],
    // Home base for finance/director — mirrors the sales-dashboard 'core'
    // carve-out above so those roles always have somewhere to land.
    core: ['finance', 'director'],
  },
  {
    key: 'expert-payment-planner',
    title: 'Expert Payment Planner',
    href: '/admin/expert-payment-planner',
    group: 'Workflow',
    icon: RandSign,
    description: 'Plan monthly expert payments & outstanding invoices',
    roles: ['admin', 'finance', 'director', 'employee'],
    permissions: [{ category: 'Case Management', functionName: 'AOD Management' }],
  },
  {
    key: 'appointments',
    title: 'Appointment Engine',
    href: '/admin/appointments',
    group: 'Workflow',
    icon: Calendar,
    description: 'Scheduling, requests, confirmations',
    // sales_consultant deliberately excluded, same reasoning as the finance
    // module above: every RLS policy on the appointments table (SELECT,
    // INSERT, UPDATE) only bypasses for admin/employee or a matching
    // referring_attorney_id/expert_id — a sales consultant has neither, so
    // this page has always resolved to an empty schedule with non-functional
    // New Appointment / checklist / communications controls for that role.
    // Their real appointment data (their own generated deals, incentive
    // calculations) comes through the separately-scoped get_consultant_*
    // RPCs on the Sales Dashboard, not this operational admin page.
    roles: ['admin', 'employee'],
    permissions: [{ category: 'Appointment Management' }],
  },
  {
    key: 'litigation-requests',
    title: 'Litigation Service Requests',
    href: '/admin/litigation-requests',
    group: 'Workflow',
    icon: FileSignature,
    description: 'Addendum, Affidavit, Joint Minute and related litigation service requests from referring attorneys',
    // Mirrors the 'appointments' module's role grants above — same staff
    // who action appointment requests action these.
    roles: ['admin', 'employee'],
    permissions: [{ category: 'Appointment Management' }],
  },
  {
    key: 'assessment-reports',
    title: 'Assessment Reports & Statistics',
    href: '/admin/assessment-reports-statistics',
    group: 'Workflow',
    icon: BarChart3,
    description: 'Assessment performance, completion rates & expert analytics',
    // Same bucket as Reporting System below — one "System Reports" grant
    // covers both, since this is effectively that module's assessment-
    // focused view. Director gets it per their reporting needs; it isn't
    // their 'core' page since Finance & Payments already is.
    roles: ['admin', 'employee', 'director'],
    permissions: [{ category: 'Analytics & Reporting', functionName: 'System Reports' }],
  },
  {
    key: 'email',
    title: 'Email History',
    href: '/email-queue',
    group: 'Workflow',
    icon: Mail,
    description: 'Outbound email queue & status',
    permissions: [{ category: 'Analytics & Reporting', functionName: 'System Reports' }],
  },
  // System — admin only (company employees are excluded)
  {
    key: 'analytics',
    title: 'Analytics',
    href: '/admin/analytics',
    group: 'System',
    icon: BarChart3,
    description: 'System-wide analytics & exports',
    roles: ['admin'],
    permissions: [{ category: 'Analytics & Reporting' }],
  },
  {
    key: 'iam',
    title: 'Access & IAM',
    href: '/admin/iam',
    group: 'System',
    icon: ShieldCheck,
    description: 'Users, roles, and permissions',
    roles: ['admin'],
    permissions: [{ category: 'User Management' }],
  },
  {
    key: 'external-portal',
    title: 'External Portal Management',
    href: '/admin/external-portal',
    group: 'System',
    icon: KeyRound,
    description: 'Referring Attorney & Medical Expert external portal accounts, access links, sessions & OTP',
    // Isolated from Access & IAM by design — own module, own table below.
    roles: ['admin'],
    permissions: [{ category: 'User Management' }],
  },
  {
    key: 'external-portal-access',
    title: 'Attorney & Expert Portal Access',
    href: '/admin/external-portal/accounts',
    group: 'System',
    icon: KeyRound,
    description: 'Create portal accounts and send access links to referring attorneys and medical experts',
    // Deliberately narrower than 'external-portal' above: employees and
    // consultants get exactly the two screens that replace what the old
    // Attorney CRM "Portal Links" tab used to do (create access, send the
    // link) — not sessions, OTP internals, login history, audit logs,
    // the recycle bin, or settings, which stay admin-only. Admins keep
    // using the 'external-portal' entry above for the full module; this
    // is additive, not a replacement, so admin's nav is unchanged.
    roles: ['employee', 'sales_consultant'],
    permissions: [{ category: 'User Management' }],
    // The old Attorney CRM "Portal Links" tab this replaces was really two
    // screens (create account, send link) that live at two different
    // routes — both belong to the same grant.
    aliasPaths: ['/admin/external-portal/links'],
  },
  {
    key: 'system-control',
    title: 'System Control',
    href: '/admin/system-control',
    group: 'System',
    icon: Settings,
    description: 'Visibility, workflow & data controls',
    roles: ['admin'],
    permissions: [{ category: 'User Management', functionName: 'Manage Users' }],
  },
  {
    key: 'sales-performance',
    title: 'Sales Performance Reports',
    href: '/admin/sales-performance',
    group: 'System',
    icon: Mail,
    description: 'Weekly & monthly consultant performance emails',
    // Director is also granted this live in role_module_defaults (confirmed
    // 2026-08-30 audit) — documented here so this file stays the accurate
    // source of truth instead of silently drifting from the DB.
    roles: ['admin', 'director'],
    permissions: [{ category: 'User Management', functionName: 'Manage Users' }],
  },
  {
    key: 'weekly-operations-report',
    title: 'Weekly Operations Report',
    href: '/admin/weekly-operations-report',
    group: 'System',
    icon: Mail,
    description: 'Weekly expert payments & assessments booked summary',
    // Director is also granted this live in role_module_defaults (confirmed
    // 2026-08-30 audit) — documented here so this file stays the accurate
    // source of truth instead of silently drifting from the DB.
    roles: ['admin', 'director'],
    permissions: [{ category: 'User Management', functionName: 'Manage Users' }],
  },
  // Account
  {
    key: 'my-profile',
    title: 'My Profile',
    href: '/admin/my-profile',
    group: 'Account',
    icon: User,
    description: 'Personal profile & preferences',
    // finance/director are also granted this live in role_module_defaults
    // (confirmed 2026-08-30 audit) — every role needs a profile page, so
    // this brings the documented intent in line with reality rather than
    // leaving it looking unintentional.
    roles: ['admin', 'employee', 'sales_consultant', 'finance', 'director'],
    permissions: [],
  },
];

export const ADMIN_MODULE_GROUP_ORDER: AdminModuleGroup[] = [
  'Core',
  'Intelligence',
  'Workflow',
  'System',
  'Account',
];

// Note: sidebar grouping is now built from ADMIN_MODULES directly by
// useModuleAccess + AdminPortalLayout, filtered through each user's actual
// granted permissions (see @/lib/moduleAccess). There is deliberately no
// role-only "getNavigationGroups" helper here anymore — a nav list built
// from `roles` alone, without the permission check, is exactly the kind of
// second, drifting source of truth this file exists to prevent.
