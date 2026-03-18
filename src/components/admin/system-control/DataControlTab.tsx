import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, Lock, Unlock, Search, Archive, Trash2, FileDown, Clock, Shield, Eye } from 'lucide-react';
import { useSystemSettings, useRecordLocks } from '@/hooks/useSystemSettings';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

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
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Record Locks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-destructive" />
            Record Locks
          </CardTitle>
          <CardDescription className="text-xs">Prevent edits to specific records</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Lock Form */}
          <div className="flex flex-wrap gap-3 items-end p-3 rounded-lg bg-muted/30 border border-border">
            <div className="space-y-1">
              <Label className="text-xs">Table</Label>
              <Select value={lockTable} onValueChange={setLockTable}>
                <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
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
              <Label className="text-xs">Record ID</Label>
              <Input className="w-64 h-9" placeholder="Paste record UUID" value={lockRecordId} onChange={e => setLockRecordId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reason</Label>
              <Input className="w-48 h-9" placeholder="Lock reason" value={lockReason} onChange={e => setLockReason(e.target.value)} />
            </div>
            <Button size="sm" variant="destructive" onClick={handleLock}>
              <Lock className="h-3.5 w-3.5 mr-1" /> Lock
            </Button>
          </div>

          {/* Active Locks */}
          {locks.length > 0 ? (
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {locks.map(lock => (
                  <div key={lock.id} className="flex items-center justify-between p-2 rounded border border-border">
                    <div className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-destructive" />
                      <div>
                        <p className="text-xs font-medium">{lock.table_name} / {lock.record_id.substring(0, 8)}...</p>
                        <p className="text-[10px] text-muted-foreground">{lock.lock_reason} • {format(new Date(lock.locked_at), 'dd MMM yyyy HH:mm')}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => unlockRecord.mutate(lock.id)}>
                      <Unlock className="h-3.5 w-3.5 mr-1" /> Unlock
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">No active record locks</p>
          )}
        </CardContent>
      </Card>

      {/* Data Access Audit */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            Data Access Audit
          </CardTitle>
          <CardDescription className="text-xs">Recent data access and modification trail</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, table, or action..."
              className="pl-9 h-9"
              value={auditSearch}
              onChange={e => setAuditSearch(e.target.value)}
            />
          </div>
          <ScrollArea className="h-64">
            {auditLoading ? (
              <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>
            ) : auditLogs.length > 0 ? (
              <div className="space-y-1">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/30 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant={log.action_type === 'DELETE' ? 'destructive' : log.action_type === 'INSERT' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                        {log.action_type}
                      </Badge>
                      <span className="font-medium truncate">{log.table_name}</span>
                      <span className="text-muted-foreground truncate">{log.user_email || 'system'}</span>
                    </div>
                    <span className="text-muted-foreground shrink-0 ml-2">
                      {format(new Date(log.created_at), 'dd MMM HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-sm text-muted-foreground">No audit logs found</p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Data Retention & Archive */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Data Retention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: 'audit_logs', label: 'Audit Logs' },
              { key: 'proofreading', label: 'Proofreading History' },
              { key: 'expired_tokens', label: 'Expired Tokens' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between p-2 rounded border border-border">
                <span className="text-sm">{label}</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    className="w-20 h-8 text-right"
                    value={retentionPolicy?.[key] || 0}
                    onChange={e => updateSetting.mutate({ key: 'data_retention_days', value: { ...retentionPolicy, [key]: parseInt(e.target.value) || 0 } })}
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Archive className="h-4 w-4 text-primary" />
              Archive Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded border border-border">
              <span className="text-sm">Auto-archive old records</span>
              <Switch
                checked={archivePolicy?.auto_archive === true}
                onCheckedChange={(v) => updateSetting.mutate({ key: 'data_archive_policy', value: { ...archivePolicy, auto_archive: v } })}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded border border-border">
              <span className="text-sm">Archive after</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  className="w-20 h-8 text-right"
                  value={archivePolicy?.archive_after_months || 12}
                  onChange={e => updateSetting.mutate({ key: 'data_archive_policy', value: { ...archivePolicy, archive_after_months: parseInt(e.target.value) || 12 } })}
                />
                <span className="text-xs text-muted-foreground">months</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DataControlTab;
