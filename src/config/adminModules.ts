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
  Briefcase,
  Stethoscope,
  Search,
  MapPin,
  HeadsetIcon,
  FileText,
  BarChart3,
  FolderLock,
  DollarSign,
  Calendar,
  Mail,
  ShieldCheck,
  Settings,
  User,
} from 'lucide-react';

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
    key: 'cases',
    title: 'Case Management',
    href: '/admin/cases',
    group: 'Core',
    icon: Briefcase,
    description: 'Claimant cases, AOD, progress tracking',
    permissions: [
      { category: 'Case Management' },
      { category: 'Claimant Management' },
    ],
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
    description: 'Expert and assessment reports',
    permissions: [{ category: 'Report Management' }],
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
    icon: DollarSign,
    description: 'AOD, debtors, payments, agreements',
    roles: ['admin', 'employee', 'sales_consultant'],
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
  // System
  {
    key: 'analytics',
    title: 'Analytics',
    href: '/admin/analytics',
    group: 'System',
    icon: BarChart3,
    description: 'System-wide analytics & exports',
    permissions: [{ category: 'Analytics & Reporting' }],
  },
  {
    key: 'iam',
    title: 'Access & IAM',
    href: '/admin/iam',
    group: 'System',
    icon: ShieldCheck,
    description: 'Users, roles, and permissions',
    permissions: [{ category: 'User Management' }],
  },
  {
    key: 'system-control',
    title: 'System Control',
    href: '/admin/system-control',
    group: 'System',
    icon: Settings,
    description: 'Visibility, workflow & data controls',
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
