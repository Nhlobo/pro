import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  Database,
  Mail,
  RefreshCw,
  Webhook,
  Wifi,
  WifiOff,
  AlertTriangle,
  Clock,
  Gauge,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminPill,
  AdminEmptyState,
} from '@/components/admin/ui/AdminUI';

type Status = 'healthy' | 'degraded' | 'down' | 'unknown';
type PillTone = 'neutral' | 'teal' | 'success' | 'warning' | 'destructive';

interface HealthSnapshot {
  dbLatencyMs: number | null;
  dbStatus: Status;
  authLatencyMs: number | null;
  authStatus: Status;
  emailPending: number;
  emailFailed24h: number;
  emailSent24h: number;
  emailStatus: Status;
  webhookFailures24h: number;
  webhookTotal24h: number;
  webhookStatus: Status;
  auditEvents1h: number;
  recentErrors: Array<{ source: string; message: string; created_at: string }>;
  takenAt: string;
}

const REFRESH_INTERVAL_MS = 30_000;

const STATUS_TONE: Record<Status, PillTone> = {
  healthy: 'success',
  degraded: 'warning',
  down: 'destructive',
  unknown: 'neutral',
};

const StatusBadge: React.FC<{ status: Status; label?: string }> = ({ status, label }) => (
  <AdminPill tone={STATUS_TONE[status]} className="capitalize">
    {status !== 'healthy' && <AlertTriangle className="h-3 w-3" />}
    {label ?? status}
  </AdminPill>
);

const HealthStatCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  status: Status;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}> = ({ title, icon, status, primary, secondary }) => (
  <AdminCard className="transition-colors hover:border-black/25">
    <div className="p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {icon}
          {title}
        </span>
        <StatusBadge status={status} />
      </div>
      <p className="text-xl font-bold tabular-nums text-black md:text-2xl">{primary}</p>
      {secondary && <p className="mt-1 text-xs text-slate-500">{secondary}</p>}
    </div>
  </AdminCard>
);

const SystemHealthTab: React.FC = () => {
  const { isConnected, syncStatus, lastSyncedTable } = useAppointmentSync();
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const probeHealth = useCallback(async () => {
    setError(null);
    try {
      // DB latency probe
      const dbStart = performance.now();
      const { error: dbErr } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .limit(1);
      const dbLatencyMs = Math.round(performance.now() - dbStart);
      const dbStatus: Status = dbErr ? 'down' : dbLatencyMs > 1500 ? 'degraded' : 'healthy';

      // Auth latency probe
      const authStart = performance.now();
      const { error: authErr } = await supabase.auth.getSession();
      const authLatencyMs = Math.round(performance.now() - authStart);
      const authStatus: Status = authErr ? 'down' : authLatencyMs > 1500 ? 'degraded' : 'healthy';

      const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const since1h = new Date(Date.now() - 3600 * 1000).toISOString();

      const [
        { count: emailPending },
        { count: emailFailed24h },
        { count: emailSent24h },
        { count: webhookTotal24h },
        { data: webhookFailedRows },
        { count: auditEvents1h },
        { data: recentEmailErrors },
      ] = await Promise.all([
        supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', since24h),
        supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('created_at', since24h),
        supabase.from('webhook_logs').select('id', { count: 'exact', head: true }).gte('created_at', since24h),
        supabase
          .from('webhook_logs')
          .select('id, event_type, error, response_status, created_at')
          .gte('created_at', since24h)
          .or('error.not.is.null,response_status.gte.400')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', since1h),
        supabase
          .from('email_queue')
          .select('id, email_type, error_message, created_at')
          .eq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const webhookFailures24h = webhookFailedRows?.length ?? 0;

      const emailStatus: Status =
        (emailFailed24h ?? 0) > 10 ? 'down' : (emailFailed24h ?? 0) > 0 ? 'degraded' : 'healthy';
      const webhookStatus: Status =
        webhookFailures24h > 5 ? 'down' : webhookFailures24h > 0 ? 'degraded' : 'healthy';

      const recentErrors = [
        ...(recentEmailErrors ?? []).map((r: any) => ({
          source: `Email · ${r.email_type ?? 'unknown'}`,
          message: r.error_message ?? 'Send failed',
          created_at: r.created_at,
        })),
        ...(webhookFailedRows ?? []).map((r: any) => ({
          source: `Webhook · ${r.event_type ?? 'unknown'}`,
          message: r.error ?? `HTTP ${r.response_status}`,
          created_at: r.created_at,
        })),
      ]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8);

      setSnapshot({
        dbLatencyMs,
        dbStatus,
        authLatencyMs,
        authStatus,
        emailPending: emailPending ?? 0,
        emailFailed24h: emailFailed24h ?? 0,
        emailSent24h: emailSent24h ?? 0,
        emailStatus,
        webhookFailures24h,
        webhookTotal24h: webhookTotal24h ?? 0,
        webhookStatus,
        auditEvents1h: auditEvents1h ?? 0,
        recentErrors,
        takenAt: new Date().toISOString(),
      });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to probe system health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    probeHealth();
    const id = setInterval(probeHealth, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [probeHealth]);

  const realtimeStatus: Status = useMemo(() => {
    if (syncStatus === 'error') return 'down';
    if (!isConnected) return 'degraded';
    return 'healthy';
  }, [isConnected, syncStatus]);

  const overall: Status = useMemo(() => {
    if (!snapshot) return 'unknown';
    const arr: Status[] = [
      snapshot.dbStatus,
      snapshot.authStatus,
      snapshot.emailStatus,
      snapshot.webhookStatus,
      realtimeStatus,
    ];
    if (arr.includes('down')) return 'down';
    if (arr.includes('degraded')) return 'degraded';
    return 'healthy';
  }, [snapshot, realtimeStatus]);

  return (
    <div className="mt-4 space-y-4 md:space-y-6">
      <AdminCard>
        <AdminCardHeader
          icon={Activity}
          title="System Health & Uptime"
          description="Live signals from the database, auth, realtime, email queue and webhooks."
          actions={
            <div className="flex items-center gap-2">
              <StatusBadge status={overall} label={`Overall: ${overall}`} />
              <Button
                variant="outline"
                size="sm"
                className="rounded-none border-black/15 text-black hover:bg-black/5"
                onClick={probeHealth}
                disabled={loading}
              >
                <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          }
        />
        {(snapshot || error) && (
          <AdminCardBody className="pt-3">
            {snapshot && (
              <p className="text-xs text-slate-500">
                Last checked {formatDistanceToNow(new Date(snapshot.takenAt), { addSuffix: true })} · auto-refresh
                every {REFRESH_INTERVAL_MS / 1000}s
              </p>
            )}
            {error && (
              <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" /> {error}
              </p>
            )}
          </AdminCardBody>
        )}
      </AdminCard>

      {loading && !snapshot ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-none" />
          ))}
        </div>
      ) : snapshot ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <HealthStatCard
              title="Database"
              icon={<Database className="h-3.5 w-3.5" />}
              status={snapshot.dbStatus}
              primary={snapshot.dbLatencyMs !== null ? `${snapshot.dbLatencyMs} ms` : '—'}
              secondary="Round-trip latency to Supabase Postgres"
            />
            <HealthStatCard
              title="Authentication"
              icon={<Gauge className="h-3.5 w-3.5" />}
              status={snapshot.authStatus}
              primary={snapshot.authLatencyMs !== null ? `${snapshot.authLatencyMs} ms` : '—'}
              secondary="Session check latency"
            />
            <HealthStatCard
              title="Realtime Sync"
              icon={isConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              status={realtimeStatus}
              primary={isConnected ? 'Connected' : 'Disconnected'}
              secondary={lastSyncedTable ? `Last event: ${lastSyncedTable}` : 'No events yet'}
            />
            <HealthStatCard
              title="Email Queue"
              icon={<Mail className="h-3.5 w-3.5" />}
              status={snapshot.emailStatus}
              primary={`${snapshot.emailSent24h} sent / ${snapshot.emailFailed24h} failed`}
              secondary={`${snapshot.emailPending} pending · last 24h`}
            />
            <HealthStatCard
              title="Webhooks"
              icon={<Webhook className="h-3.5 w-3.5" />}
              status={snapshot.webhookStatus}
              primary={`${snapshot.webhookTotal24h} fired`}
              secondary={`${snapshot.webhookFailures24h} failed · last 24h`}
            />
            <HealthStatCard
              title="Activity"
              icon={<Clock className="h-3.5 w-3.5" />}
              status="healthy"
              primary={`${snapshot.auditEvents1h}`}
              secondary="Audit events in the last hour"
            />
          </div>

          <AdminCard>
            <AdminCardHeader icon={AlertTriangle} title="Recent Incidents" />
            <AdminCardBody>
              {snapshot.recentErrors.length === 0 ? (
                <AdminEmptyState
                  icon={Activity}
                  title="All clear"
                  description="No email or webhook failures in the last 24 hours."
                />
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {snapshot.recentErrors.map((err, i) => (
                    <div key={i} className="border border-black/10 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-black">{err.source}</span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {formatDistanceToNow(new Date(err.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-xs text-slate-500">{err.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </AdminCardBody>
          </AdminCard>
        </>
      ) : null}
    </div>
  );
};

export default SystemHealthTab;
