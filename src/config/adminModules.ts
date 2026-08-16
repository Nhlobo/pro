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
    permissions: [{ category: 'Analytics & Reporting', functionName: 'CRM Analytics' }],
  },
  {
    key: 'attorney-crm',
    title: 'Attorney CRM',
    href: '/admin/attorney-crm',
    group: 'Core',
    icon: Users,
    description: 'Referring attorney directory & pipeline',
    roles: ['admin', 'employee', 'sales_consultant'],
    permissions: [{ category: 'Analytics & Reporting', functionName: 'CRM Analytics' }],
  },
  {
    key: 'sales-dashboard',
    title: 'Sales Dashboard',
    href: '/admin/sales-dashboard',
    group: 'Core',
    icon: BarChart3,
    description: 'Personal targets, incentives & deal tracking for sales consultants',
    roles: ['admin', 'employee', 'sales_consultant'],
    permissions: [{ category: 'Analytics & Reporting', functionName: 'CRM Analytics' }],
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
    roles: ['admin', 'employee', 'sales_consultant', 'finance', 'director'],
    permissions: [{ category: 'Case Management', functionName: 'AOD Management' }],
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
    roles: ['admin', 'employee', 'sales_consultant'],
    permissions: [{ category: 'Appointment Management' }],
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
    roles: ['admin'],
    permissions: [{ category: 'User Management', functionName: 'Manage Users' }],
  },
  {
    key: 'weekly-operations-report',
    title: 'Weekly Operations Report',
    href: '/admin/weekly-operations-report',
    group: 'System',
    icon: Mail,
    description: 'Weekly expert payments & assessments booked summary',
    roles: ['admin'],
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
    roles: ['admin', 'employee', 'sales_consultant'],
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

/** Sidebar-shaped grouping (excludes Account modules with no permissions if desired). */
export const getNavigationGroups = () =>
  ADMIN_MODULE_GROUP_ORDER.map(group => ({
    label: group,
    items: ADMIN_MODULES.filter(m => m.group === group).map(m => ({
      title: m.title,
      href: m.href,
      icon: m.icon,
      roles: m.roles,
    })),
  })).filter(g => g.items.length > 0);
