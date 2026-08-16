import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs } from '@/components/ui/tabs';
import {
  AdminPage,
  AdminHeader,
  AdminTabList,
  AdminTabTrigger,
} from '@/components/admin/ui/AdminUI';
import { usePermissions } from '@/hooks/usePermissions';
import {
  LayoutDashboard,
  Users,
  Link2,
  Radio,
  KeyRound,
  History,
  ScrollText,
  Trash2,
  Settings as SettingsIcon,
  ShieldCheck,
} from 'lucide-react';

/**
 * External Portal Module — admin shell.
 *
 * Deliberately its own layout component (not a reuse of UserManagement's
 * internal tab shell) so this module stays fully isolated from Access &
 * IAM per the architecture requirement, even though it borrows the same
 * AdminUI building blocks for a matching look and feel.
 */

const TABS = [
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '', adminOnly: true },
  { value: 'accounts', label: 'Portal Accounts', icon: Users, path: '/accounts', adminOnly: false },
  { value: 'links', label: 'Access Links', icon: Link2, path: '/links', adminOnly: false },
  { value: 'sessions', label: 'Active Sessions', icon: Radio, path: '/sessions', adminOnly: true },
  { value: 'otp', label: 'OTP Management', icon: KeyRound, path: '/otp', adminOnly: true },
  { value: 'login-history', label: 'Login History', icon: History, path: '/login-history', adminOnly: true },
  { value: 'audit-logs', label: 'Audit Logs', icon: ScrollText, path: '/audit-logs', adminOnly: true },
  { value: 'recycle-bin', label: 'Recycle Bin', icon: Trash2, path: '/recycle-bin', adminOnly: true },
  { value: 'settings', label: 'Settings', icon: SettingsIcon, path: '/settings', adminOnly: true },
] as const;

const BASE = '/admin/external-portal';

interface Props {
  children: React.ReactNode;
  description?: string;
}

const ExternalPortalManagementLayout: React.FC<Props> = ({ children, description }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole } = usePermissions();

  // Employees and sales consultants can only ever land on Portal
  // Accounts or Access Links (AdminPortalLayout's route guard sends
  // them elsewhere for anything else) — so for them the strip only
  // shows those two tabs, instead of all nine with seven of them
  // silently bouncing back out if clicked.
  const visibleTabs = userRole === 'admin' ? TABS : TABS.filter((t) => !t.adminOnly);

  const activeTab =
    visibleTabs.find((t) => (t.path ? location.pathname === BASE + t.path : location.pathname === BASE))?.value ||
    visibleTabs[0]?.value;

  return (
    <div className="brand-legal-theme">
      <AdminPage>
        <AdminHeader
          eyebrow="External Portal Management"
          title="Referring Attorney & Medical Expert Portals"
          description={
            description ||
            'Manage external portal access, links, sessions and OTP verification — fully isolated from Access & IAM.'
          }
          icon={ShieldCheck}
        />

        <Tabs value={activeTab} onValueChange={(v) => {
          const tab = visibleTabs.find((t) => t.value === v);
          if (tab) navigate(BASE + tab.path);
        }}>
          <AdminTabList>
            {visibleTabs.map((t) => (
              <AdminTabTrigger key={t.value} value={t.value} label={t.label} icon={t.icon} />
            ))}
          </AdminTabList>
        </Tabs>

        <div>{children}</div>
      </AdminPage>
    </div>
  );
};

export default ExternalPortalManagementLayout;
