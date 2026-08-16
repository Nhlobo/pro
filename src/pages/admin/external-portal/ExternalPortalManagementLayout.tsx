import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs } from '@/components/ui/tabs';
import {
  AdminPage,
  AdminHeader,
  AdminTabList,
  AdminTabTrigger,
} from '@/components/admin/ui/AdminUI';
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
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '' },
  { value: 'accounts', label: 'Portal Accounts', icon: Users, path: '/accounts' },
  { value: 'links', label: 'Access Links', icon: Link2, path: '/links' },
  { value: 'sessions', label: 'Active Sessions', icon: Radio, path: '/sessions' },
  { value: 'otp', label: 'OTP Management', icon: KeyRound, path: '/otp' },
  { value: 'login-history', label: 'Login History', icon: History, path: '/login-history' },
  { value: 'audit-logs', label: 'Audit Logs', icon: ScrollText, path: '/audit-logs' },
  { value: 'recycle-bin', label: 'Recycle Bin', icon: Trash2, path: '/recycle-bin' },
  { value: 'settings', label: 'Settings', icon: SettingsIcon, path: '/settings' },
] as const;

const BASE = '/admin/external-portal';

interface Props {
  children: React.ReactNode;
  description?: string;
}

const ExternalPortalManagementLayout: React.FC<Props> = ({ children, description }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab =
    TABS.find((t) => (t.path ? location.pathname === BASE + t.path : location.pathname === BASE))?.value ||
    'dashboard';

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
          const tab = TABS.find((t) => t.value === v);
          if (tab) navigate(BASE + tab.path);
        }}>
          <AdminTabList sticky columns={TABS.length}>
            {TABS.map((t) => (
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
