import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Shield, Calendar, Ban, CheckCircle2, Mail, Briefcase } from "lucide-react";

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
    <div className="space-y-4 md:space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground">Your role, access scope and restrictions.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl">{loading ? '…' : fullName}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Mail className="h-3.5 w-3.5" />
                {profile?.email || user?.email}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm">{roleLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider">Position</p>
              <p className="font-medium">{profile?.position || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider">User Type</p>
              <p className="font-medium capitalize">{profile?.user_type || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Modules You Can Access
          </CardTitle>
          <CardDescription>
            {isSalesConsultant()
              ? 'As a Sales Consultant your access is limited to the modules below.'
              : isAdmin()
                ? 'You have full administrator access to all modules.'
                : 'Your access scope is shown below.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(isSalesConsultant() ? SALES_CONSULTANT_ACCESS : SALES_CONSULTANT_ACCESS).map((item) => (
            <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <item.icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">Granted</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {isSalesConsultant() && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <Ban className="h-4 w-4" />
              Restrictions
            </CardTitle>
            <CardDescription>Actions you are not permitted to perform.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {RESTRICTIONS.map((r) => (
                <li key={r} className="flex items-start gap-2">
                  <Ban className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            <Separator className="my-4" />
            <p className="text-xs text-muted-foreground">
              If you need expanded access, contact your Medico-Legal Manager or Administrator.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MyProfile;
