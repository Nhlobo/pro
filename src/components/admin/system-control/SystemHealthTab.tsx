import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  Database,
  Mail,
  RefreshCw,
  Webhook,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

type Status = 'healthy' | 'degraded' | 'down' | 'unknown';

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

const statusColor: Record<Status, string> = {
  healthy: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  degraded: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  down: 'bg-destructive/15 text-destructive border-destructive/30',
  unknown: 'bg-muted text-muted-foreground border-border',
};

const StatusBadge: React.FC<{ status: Status; label?: string }> = ({ status, label }) => (
  <Badge variant="outline" className={cn('capitalize', statusColor[status])}>
    {status === 'healthy' && <CheckCircle2 className="h-3 w-3 mr-1" />}
    {status === 'degraded' && <AlertTriangle className="h-3 w-3 mr-1" />}
    {status === 'down' && <AlertTriangle className="h-3 w-3 mr-1" />}
    {label ?? status}
  </Badge>
);

const StatCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  status: Status;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}> = ({ title, icon, status, primary, secondary }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium flex items-center justify-between">
        <span className="flex items-center gap-2 text-muted-foreground">
          {icon}
          {title}
        </span>
        <StatusBadge status={status} />
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-foreground">{primary}</div>
      {secondary && <p className="text-xs text-muted-foreground mt-1">{secondary}</p>}
    </CardContent>
  </Card>
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
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              System Health & Uptime
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Live signals from the database, auth, realtime, email queue and webhooks.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={overall} label={`Overall: ${overall}`} />
            <Button variant="outline" size="sm" onClick={probeHealth} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {snapshot && (
            <p className="text-xs text-muted-foreground">
              Last checked {formatDistanceToNow(new Date(snapshot.takenAt), { addSuffix: true })} ·
              auto-refresh every {REFRESH_INTERVAL_MS / 1000}s
            </p>
          )}
          {error && (
            <p className="text-xs text-destructive mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {error}
            </p>
          )}
        </CardContent>
      </Card>

      {loading && !snapshot ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : snapshot ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Database"
              icon={<Database className="h-4 w-4" />}
              status={snapshot.dbStatus}
              primary={snapshot.dbLatencyMs !== null ? `${snapshot.dbLatencyMs} ms` : '—'}
              secondary="Round-trip latency to Supabase Postgres"
            />
            <StatCard
              title="Authentication"
              icon={<Gauge className="h-4 w-4" />}
              status={snapshot.authStatus}
              primary={snapshot.authLatencyMs !== null ? `${snapshot.authLatencyMs} ms` : '—'}
              secondary="Session check latency"
            />
            <StatCard
              title="Realtime Sync"
              icon={isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              status={realtimeStatus}
              primary={isConnected ? 'Connected' : 'Disconnected'}
              secondary={lastSyncedTable ? `Last event: ${lastSyncedTable}` : 'No events yet'}
            />
            <StatCard
              title="Email Queue"
              icon={<Mail className="h-4 w-4" />}
              status={snapshot.emailStatus}
              primary={`${snapshot.emailSent24h} sent / ${snapshot.emailFailed24h} failed`}
              secondary={`${snapshot.emailPending} pending · last 24h`}
            />
            <StatCard
              title="Webhooks"
              icon={<Webhook className="h-4 w-4" />}
              status={snapshot.webhookStatus}
              primary={`${snapshot.webhookTotal24h} fired`}
              secondary={`${snapshot.webhookFailures24h} failed · last 24h`}
            />
            <StatCard
              title="Activity"
              icon={<Clock className="h-4 w-4" />}
              status="healthy"
              primary={`${snapshot.auditEvents1h}`}
              secondary="Audit events in the last hour"
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Recent incidents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {snapshot.recentErrors.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No email or webhook failures in the last 24 hours. 🎉
                </p>
              ) : (
                <ScrollArea className="h-64 pr-3">
                  <ul className="space-y-2">
                    {snapshot.recentErrors.map((err, i) => (
                      <li
                        key={i}
                        className="text-sm border border-border rounded-md p-3 bg-muted/30"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{err.source}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(err.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 break-words">
                          {err.message}
                        </p>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default SystemHealthTab;
