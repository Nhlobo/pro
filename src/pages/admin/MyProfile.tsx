import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Shield, Calendar, Ban, CheckCircle2, Mail, Briefcase, IdCard, LockKeyhole } from "lucide-react";

import { RandSign } from "@/components/icons/RandSign";
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

const MyProfile: React.FC = () => {
  const { user } = useAuth();
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

  return (
    <div className="mx-auto max-w-6xl space-y-5 md:space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-white p-5 shadow-[0_22px_70px_-52px_rgba(0,0,0,0.65)] md:p-7">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#00BAAD]/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-black/10 bg-black text-white shadow-lg">
              <User className="h-9 w-9" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00BAAD]">Identity & Access</div>
              <h1 className="mt-2 break-words text-3xl font-black tracking-tight text-black md:text-4xl">{loading ? 'Loading profile…' : fullName}</h1>
              <p className="mt-2 flex min-w-0 items-center gap-2 text-sm text-neutral-600">
                <Mail className="h-4 w-4 shrink-0 text-[#00BAAD]" />
                <span className="truncate">{profile?.email || user?.email}</span>
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-black/10 bg-neutral-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Current Role</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="font-bold text-black">{roleLabel}</p>
                <Badge className="bg-black text-white hover:bg-black">Active</Badge>
              </div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Position</p>
              <p className="mt-2 font-bold text-black">{profile?.position || 'Not specified'}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="rounded-3xl border-black/10 bg-white shadow-[0_18px_60px_-48px_rgba(0,0,0,0.65)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-black">
              <IdCard className="h-5 w-5 text-[#00BAAD]" />
              Profile Details
            </CardTitle>
            <CardDescription>Core staff information connected to this account.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {[
              ['First name', profile?.first_name || '—'],
              ['Last name', profile?.last_name || '—'],
              ['User type', profile?.user_type || '—'],
              ['Account email', profile?.email || user?.email || '—'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-black/10 bg-neutral-50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">{label}</p>
                <p className="mt-1 break-words text-sm font-semibold text-black">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-black/10 bg-white shadow-[0_18px_60px_-48px_rgba(0,0,0,0.65)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-black">
              <CheckCircle2 className="h-5 w-5 text-[#00BAAD]" />
              Modules You Can Access
            </CardTitle>
            <CardDescription>
              {isSalesConsultant()
                ? 'Your sales consultant workspace is intentionally focused on operational modules.'
                : isAdmin()
                  ? 'You have full administrator access to the Admin Portal modules.'
                  : 'Your staff access scope is shown below.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {(isSalesConsultant() ? SALES_CONSULTANT_ACCESS : SALES_CONSULTANT_ACCESS).map((item) => (
              <div key={item.label} className="flex min-w-0 items-start gap-3 rounded-2xl border border-black/10 bg-white p-4 transition-colors hover:border-[#00BAAD]/40">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#00BAAD]/10 text-[#00BAAD]">
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-black">{item.label}</p>
                    <Badge variant="outline" className="border-[#00BAAD]/30 bg-[#00BAAD]/10 text-[#007f76]">Granted</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-neutral-600">{item.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {isSalesConsultant() && (
        <Card className="rounded-3xl border-black/10 bg-black text-white shadow-[0_22px_70px_-52px_rgba(0,0,0,0.75)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <LockKeyhole className="h-5 w-5 text-[#00BAAD]" />
              Guardrails & Restrictions
            </CardTitle>
            <CardDescription className="text-white/65">Actions unavailable for your current role.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 md:grid-cols-3">
              {RESTRICTIONS.map((r) => (
                <li key={r} className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/85">
                  <Ban className="mt-0.5 h-4 w-4 shrink-0 text-[#00BAAD]" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            <Separator className="my-5 bg-white/10" />
            <p className="text-xs text-white/60">
              If you need expanded access, contact your Medico-Legal Manager or Administrator.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MyProfile;
