import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ExternalPortalManagementLayout from './ExternalPortalManagementLayout';
import { supabase } from '@/integrations/supabase/client';
import { AdminCard, AdminCardHeader, AdminCardBody, AdminLoadingState } from '@/components/admin/ui/AdminUI';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { ExternalPortalSettings as SettingsType } from '@/types/externalPortal';

function useSettings() {
  return useQuery({
    queryKey: ['external-portal', 'settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('external_portal_settings' as any).select('*').eq('id', 1).single();
      if (error) throw error;
      return data as unknown as SettingsType;
    },
  });
}

const ExternalPortalSettings: React.FC = () => {
  const { data: settings, isLoading } = useSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<SettingsType>>({});

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('external_portal_settings' as any)
        .update({
          access_link_expiry_hours: form.access_link_expiry_hours,
          otp_length: form.otp_length,
          otp_expiry_minutes: form.otp_expiry_minutes,
          otp_max_attempts: form.otp_max_attempts,
          session_expiry_hours: form.session_expiry_hours,
          auto_expire_on_all_cases_closed: form.auto_expire_on_all_cases_closed,
          updated_by: userData?.user?.id || null,
        })
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'settings'] });
      toast.success('Settings saved');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to save settings'),
  });

  return (
    <ExternalPortalManagementLayout>
      <Helmet><title>External Portal Management — Settings</title></Helmet>

      <AdminCard className="mt-4 max-w-2xl">
        <AdminCardHeader
          title="Settings"
          description="Link expiry, OTP behaviour and session lifetime for both portal types."
          icon={SettingsIcon}
        />
        <AdminCardBody>
          {isLoading || form.access_link_expiry_hours === undefined ? (
            <AdminLoadingState label="Loading settings…" />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Access link expiry (hours)</Label>
                  <Input
                    type="number"
                    className="rounded-none border-black/15"
                    value={form.access_link_expiry_hours ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, access_link_expiry_hours: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Session expiry (hours)</Label>
                  <Input
                    type="number"
                    className="rounded-none border-black/15"
                    value={form.session_expiry_hours ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, session_expiry_hours: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>OTP length</Label>
                  <Input
                    type="number"
                    className="rounded-none border-black/15"
                    value={form.otp_length ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, otp_length: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>OTP expiry (minutes)</Label>
                  <Input
                    type="number"
                    className="rounded-none border-black/15"
                    value={form.otp_expiry_minutes ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, otp_expiry_minutes: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Max OTP attempts</Label>
                  <Input
                    type="number"
                    className="rounded-none border-black/15"
                    value={form.otp_max_attempts ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, otp_max_attempts: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-black/10 pt-4">
                <div>
                  <Label>Auto-expire when all linked cases are closed</Label>
                  <p className="text-xs text-slate-500">
                    When on, an account's access expires automatically once every case linked to it is no longer
                    scheduled/open.
                  </p>
                </div>
                <Switch
                  checked={!!form.auto_expire_on_all_cases_closed}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, auto_expire_on_all_cases_closed: v }))}
                />
              </div>

              <Button
                className="rounded-none bg-black text-white hover:bg-black/85"
                disabled={save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? 'Saving…' : 'Save Settings'}
              </Button>
            </div>
          )}
        </AdminCardBody>
      </AdminCard>
    </ExternalPortalManagementLayout>
  );
};

export default ExternalPortalSettings;
