import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, Unlock, Search, Archive, Clock, Eye } from 'lucide-react';
import { useSystemSettings, useRecordLocks } from '@/hooks/useSystemSettings';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminPill,
  AdminEmptyState,
  AdminLoadingState,
} from '@/components/admin/ui/AdminUI';

const flatInput = 'rounded-none border-black/15';

type PillTone = 'neutral' | 'teal' | 'success' | 'warning' | 'destructive';
const ACTION_TONE: Record<string, PillTone> = {
  DELETE: 'destructive',
  INSERT: 'success',
  UPDATE: 'teal',
};

const DataControlTab: React.FC = () => {
  const { settings, isLoading: settingsLoading, updateSetting } = useSystemSettings('data');
  const { locks, isLoading: locksLoading, lockRecord, unlockRecord } = useRecordLocks();

  const getVal = (key: string) => settings.find(s => s.setting_key === key)?.setting_value || {};

  // Lock form state
  const [lockTable, setLockTable] = useState('appointments');
  const [lockRecordId, setLockRecordId] = useState('');
  const [lockReason, setLockReason] = useState('');

  // Audit log query
  const [auditSearch, setAuditSearch] = useState('');
  const { data: auditLogs = [], isLoading: auditLoading } = useQuery({
    queryKey: ['audit-logs-control', auditSearch],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (auditSearch) {
        query = query.or(`user_email.ilike.%${auditSearch}%,table_name.ilike.%${auditSearch}%,action_type.ilike.%${auditSearch}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const handleLock = () => {
    if (!lockRecordId || !lockReason) {
      toast.error('Please provide record ID and reason');
      return;
    }
    lockRecord.mutate({ table_name: lockTable, record_id: lockRecordId, lock_reason: lockReason });
    setLockRecordId('');
    setLockReason('');
  };

  const retentionPolicy = getVal('data_retention_days');
  const archivePolicy = getVal('data_archive_policy');

  const isLoading = settingsLoading || locksLoading;

  if (isLoading) {
    return (
      <AdminCard className="mt-4">
        <AdminLoadingState label="Loading data controls…" />
      </AdminCard>
    );
  }

  return (
    <div className="mt-4 space-y-4 md:space-y-6">
      {/* Record Locks */}
      <AdminCard>
        <AdminCardHeader
          icon={Lock}
          title="Record Locks"
          description="Prevent edits to specific records"
          actions={<AdminPill tone={locks.length ? 'destructive' : 'neutral'}>{locks.length} active</AdminPill>}
        />
        <AdminCardBody className="space-y-4">
          {/* Lock Form */}
          <div className="flex flex-wrap items-end gap-3 border border-black/10 bg-black/[0.02] p-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Table</Label>
              <Select value={lockTable} onValueChange={setLockTable}>
                <SelectTrigger className={`h-9 w-40 ${flatInput}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="appointments">Appointments</SelectItem>
                  <SelectItem value="claimants">Claimants</SelectItem>
                  <SelectItem value="referring_attorneys">Attorneys</SelectItem>
                  <SelectItem value="medical_experts">Experts</SelectItem>
                  <SelectItem value="aod_documents">AOD Documents</SelectItem>
                  <SelectItem value="expert_reports">Expert Reports</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Record ID</Label>
              <Input className={`h-9 w-64 ${flatInput}`} placeholder="Paste record UUID" value={lockRecordId} onChange={e => setLockRecordId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reason</Label>
              <Input className={`h-9 w-48 ${flatInput}`} placeholder="Lock reason" value={lockReason} onChange={e => setLockReason(e.target.value)} />
            </div>
            <Button size="sm" variant="destructive" className="rounded-none" onClick={handleLock}>
              <Lock className="mr-1 h-3.5 w-3.5" /> Lock
            </Button>
          </div>

          {/* Active Locks — card rows, not a table, so this reads fine on any width */}
          {locks.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {locks.map(lock => (
                <div key={lock.id} className="flex items-center justify-between gap-3 border border-black/10 p-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Lock className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-black">
                        {lock.table_name} / {lock.record_id.substring(0, 8)}…
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {lock.lock_reason} · {format(new Date(lock.locked_at), 'dd MMM yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 rounded-none hover:bg-black/5"
                    onClick={() => unlockRecord.mutate(lock.id)}
                  >
                    <Unlock className="mr-1 h-3.5 w-3.5" /> Unlock
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState icon={Lock} title="No active record locks" />
          )}
        </AdminCardBody>
      </AdminCard>

      {/* Data Access Audit */}
      <AdminCard>
        <AdminCardHeader
          icon={Eye}
          title="Data Access Audit"
          description="Recent data access and modification trail"
        />
        <AdminCardBody>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by email, table, or action…"
              className={`h-9 pl-8 ${flatInput}`}
              value={auditSearch}
              onChange={e => setAuditSearch(e.target.value)}
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {auditLoading ? (
              <AdminLoadingState label="Loading audit logs…" />
            ) : auditLogs.length > 0 ? (
              <div className="divide-y divide-black/10">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <AdminPill tone={ACTION_TONE[log.action_type] || 'neutral'} className="shrink-0">
                        {log.action_type}
                      </AdminPill>
                      <span className="truncate font-medium text-black">{log.table_name}</span>
                      <span className="truncate text-slate-500">{log.user_email || 'system'}</span>
                    </div>
                    <span className="shrink-0 text-slate-400">
                      {format(new Date(log.created_at), 'dd MMM HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <AdminEmptyState icon={Eye} title="No audit logs found" />
            )}
          </div>
        </AdminCardBody>
      </AdminCard>

      {/* Data Retention & Archive */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AdminCard>
          <AdminCardHeader icon={Clock} title="Data Retention" />
          <AdminCardBody className="space-y-2">
            {[
              { key: 'audit_logs', label: 'Audit Logs' },
              { key: 'proofreading', label: 'Proofreading History' },
              { key: 'expired_tokens', label: 'Expired Tokens' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between border border-black/10 p-2.5">
                <span className="text-sm text-black">{label}</span>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    className={`h-8 w-20 text-right ${flatInput}`}
                    value={retentionPolicy?.[key] || 0}
                    onChange={e => updateSetting.mutate({ key: 'data_retention_days', value: { ...retentionPolicy, [key]: parseInt(e.target.value) || 0 } })}
                  />
                  <span className="text-xs text-slate-500">days</span>
                </div>
              </div>
            ))}
          </AdminCardBody>
        </AdminCard>

        <AdminCard>
          <AdminCardHeader icon={Archive} title="Archive Policy" />
          <AdminCardBody className="space-y-2">
            <div className="flex items-center justify-between border border-black/10 p-3">
              <span className="text-sm text-black">Auto-archive old records</span>
              <Switch
                checked={archivePolicy?.auto_archive === true}
                onCheckedChange={(v) => updateSetting.mutate({ key: 'data_archive_policy', value: { ...archivePolicy, auto_archive: v } })}
              />
            </div>
            <div className="flex items-center justify-between border border-black/10 p-3">
              <span className="text-sm text-black">Archive after</span>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  className={`h-8 w-20 text-right ${flatInput}`}
                  value={archivePolicy?.archive_after_months || 12}
                  onChange={(e) => updateSetting.mutate({ key: 'data_archive_policy', value: { ...archivePolicy, archive_after_months: parseInt(e.target.value) || 12 } })}
                />
                <span className="text-xs text-slate-500">months</span>
              </div>
            </div>
          </AdminCardBody>
        </AdminCard>
      </div>
    </div>
  );
};

export default DataControlTab;
