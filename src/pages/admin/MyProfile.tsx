// src/pages/admin/MyProfile.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import {
  User,
  Shield,
  Calendar,
  Ban,
  CheckCircle2,
  Mail,
  Briefcase,
  LogOut,
  IdCard,
  Clock,
} from 'lucide-react';
import { RandSign } from '@/components/icons/RandSign';
import { Button } from '@/components/ui/button';
import { BiometricTrustedDeviceCard } from '@/components/BiometricTrustedDeviceCard';
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminPill,
  AdminLoadingState,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

interface ProfileRow {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  position: string | null;
  user_type: string | null;
}

const SALES_CONSULTANT_ACCESS: { label: string; description: string; icon: React.ComponentType<any> }[] = [
  { label: 'Appointment Engine', description: 'View and manage scheduled assessments, daily schedule, checklists and communications.', icon: Calendar },
  { label: 'Finance & Payments', description: 'View AOD records, track payments and reconcile balances.', icon: RandSign },
  { label: 'Attorney CRM (Pitchlog)', description: 'Manage referring attorney pitches, follow-ups and outreach.', icon: Briefcase },
  { label: 'Availability Heatmap', description: 'View provincial expert availability density.', icon: Shield },
];

const RESTRICTIONS = [
  'Cannot delete any record (appointments, payments, claimants, attorneys, documents).',
  'Cannot access User Management, IAM, System Control or other admin-only modules.',
  'Sales analytics is limited to your own performance data.',
];

/** Small labeled row used inside the "Account Details" sidebar card. */
const DetailRow: React.FC<{ icon: React.ComponentType<any>; label: string; value: React.ReactNode }> = ({
  icon: Icon,
  label,
  value,
}) => (
  <div className="flex items-start gap-3 border-b border-black/10 px-4 py-3 last:border-b-0">
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-black">{value}</p>
    </div>
  </div>
);

const MyProfile: React.FC = () => {
  const { user, signOut } = useAuth();
  const { userRole, isSalesConsultant, isAdmin } = usePermissions();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, position, user_type')
        .eq('id', user.id)
        .maybeSingle();
      setProfile(data as ProfileRow | null);
      setLoading(false);
    };
    load();
  }, [user]);

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || 'My Profile';
  const roleLabel =
    userRole === 'sales_consultant' ? 'Sales Consultant'
    : userRole === 'admin' ? 'Administrator'
    : userRole === 'employee' ? 'Company Employee'
    : userRole || 'User';

  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'U';

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';
  const lastSignIn = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString()
    : '—';

  return (
    <AdminPage className="max-w-6xl">
      <AdminHeader
        eyebrow="Account"
        title="My Profile"
        description="Your identity, access scope and security settings"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="rounded-none border-black/15 text-black hover:bg-black/5"
            onClick={() => signOut()}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Sign Out
          </Button>
        }
      />

      {/* Identity — a single, scannable hero strip instead of a buried card */}
      <AdminCard>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 md:p-5">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ backgroundColor: BRAND_TEAL }}
          >
            {loading ? <User className="h-7 w-7" /> : initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-black">{loading ? '…' : fullName}</p>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-slate-500">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{profile?.email || user?.email}</span>
            </div>
          </div>
          <AdminPill tone="teal" className="shrink-0">{roleLabel}</AdminPill>
        </div>
      </AdminCard>

      {/* Body — primary content on the left, account + security context on the right.
          Mirrors the layout every "settings" screen in Stripe/Linear/GitHub uses:
          one clear column of decisions, one narrow column of reference info. */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
        <div className="space-y-4 md:space-y-6 lg:col-span-2">
          {/* Access */}
          <AdminCard>
            <AdminCardHeader
              icon={CheckCircle2}
              title="Modules You Can Access"
              description={
                isSalesConsultant()
                  ? 'As a Sales Consultant your access is limited to the modules below.'
                  : isAdmin()
                    ? 'You have full administrator access to all modules.'
                    : 'Your access scope is shown below.'
              }
            />
            <AdminCardBody className="space-y-2">
              {(isSalesConsultant() ? SALES_CONSULTANT_ACCESS : SALES_CONSULTANT_ACCESS).map((item) => (
                <div
                  key={item.label}
                  className="flex flex-wrap items-start gap-3 border border-black/10 p-3 sm:flex-nowrap"
                >
                  <item.icon className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: BRAND_TEAL }} />
                  <div className="min-w-[140px] flex-1">
                    <p className="text-sm font-medium text-black">{item.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                  </div>
                  <AdminPill tone="success" className="shrink-0">
                    <CheckCircle2 className="h-3 w-3" /> Granted
                  </AdminPill>
                </div>
              ))}
            </AdminCardBody>
          </AdminCard>

          {isSalesConsultant() && (
            <AdminCard className="border-destructive/30">
              <AdminCardHeader
                icon={Ban}
                title={<span className="text-destructive">Restrictions</span>}
                description="Actions you are not permitted to perform."
              />
              <AdminCardBody>
                <ul className="space-y-2 text-sm">
                  {RESTRICTIONS.map((r) => (
                    <li key={r} className="flex items-start gap-2">
                      <Ban className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                      <span className="text-black">{r}</span>
                    </li>
                  ))}
                </ul>
                <div className="my-4 h-px bg-black/10" />
                <p className="text-xs text-slate-500">
                  If you need expanded access, contact your Medico-Legal Manager or Administrator.
                </p>
              </AdminCardBody>
            </AdminCard>
          )}
        </div>

        <div className="space-y-4 md:space-y-6 lg:col-span-1">
          {/* Account details */}
          <AdminCard>
            <AdminCardHeader icon={IdCard} title="Account Details" />
            {loading ? (
              <AdminLoadingState label="Loading account details…" />
            ) : (
              <div>
                <DetailRow icon={Briefcase} label="Position" value={profile?.position || '—'} />
                <DetailRow
                  icon={User}
                  label="User Type"
                  value={<span className="capitalize">{profile?.user_type || '—'}</span>}
                />
                <DetailRow icon={Calendar} label="Member Since" value={memberSince} />
                <DetailRow icon={Clock} label="Last Sign-In" value={lastSignIn} />
              </div>
            )}
          </AdminCard>

          {/* Security */}
          <BiometricTrustedDeviceCard />
        </div>
      </div>
    </AdminPage>
  );
};

export default MyProfile;
