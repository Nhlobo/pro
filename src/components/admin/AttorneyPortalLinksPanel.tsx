import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Link2, Copy, Ban, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from '@/components/admin/ui/AdminUI';

/**
 * Secure, expiring portal links for referring attorneys.
 *
 * Replaces the need for a referring attorney to hold a platform login: staff
 * issue a time-limited code tied to one appointment, share the link, and can
 * revoke it at any moment. All code generation happens in the existing
 * `create_attorney_access_code` database function — this panel only calls it.
 */

type AttorneyOption = { id: string; name: string };

type AppointmentOption = {
  id: string;
  appointment_date: string | null;
  matter_type: string | null;
};

type AccessCodeRow = {
  id: string;
  access_code: string;
  appointment_id: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  last_accessed_at: string | null;
  access_count: number;
  deactivation_reason: string | null;
};

const EXPIRY_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days (recommended)' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
];

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      })
    : '—';

const portalLinkFor = (code: string) =>
  `${window.location.origin}/Attorneyzone/case-access?code=${encodeURIComponent(code)}`;

const linkState = (row: AccessCodeRow): 'active' | 'expired' | 'revoked' => {
  if (!row.is_active) return 'revoked';
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return 'expired';
  return 'active';
};

const AttorneyPortalLinksPanel: React.FC = () => {
  const [attorneys, setAttorneys] = useState<AttorneyOption[]>([]);
  const [attorneyId, setAttorneyId] = useState<string>('');
  const [attorneySearch, setAttorneySearch] = useState('');
  const [appointments, setAppointments] = useState<AppointmentOption[]>([]);
  const [appointmentId, setAppointmentId] = useState<string>('');
  const [expiryDays, setExpiryDays] = useState('14');
  const [codes, setCodes] = useState<AccessCodeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Attorney list. System companies are excluded everywhere in this app.
  useEffect(() => {
    (async () => {
      const { data, error: attErr } = await supabase
        .from('referring_attorneys')
        .select('id, name, is_system_company')
        .order('name', { ascending: true });
      if (attErr) {
        setError(attErr.message);
        return;
      }
      setAttorneys(
        (data || [])
          .filter((a: any) => !a.is_system_company)
          .map((a: any) => ({ id: a.id, name: a.name || 'Unnamed firm' })),
      );
    })();
  }, []);

  const loadForAttorney = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);

    const [aptResult, codeResult] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, appointment_date, matter_type')
        .eq('referring_attorney_id', id)
        .is('deleted_at', null)
        .order('appointment_date', { ascending: false })
        .limit(50),
      supabase
        .from('attorney_access_codes')
        .select(
          'id, access_code, appointment_id, is_active, expires_at, created_at, last_accessed_at, access_count, deactivation_reason',
        )
        .eq('referring_attorney_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (aptResult.error || codeResult.error) {
      setError((aptResult.error || codeResult.error)?.message || 'Unable to load portal links.');
      setAppointments([]);
      setCodes([]);
      setLoading(false);
      return;
    }

    const apts = (aptResult.data || []) as AppointmentOption[];
    setAppointments(apts);
    setAppointmentId((prev) => (apts.some((a) => a.id === prev) ? prev : apts[0]?.id || ''));
    setCodes((codeResult.data || []) as AccessCodeRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (attorneyId) loadForAttorney(attorneyId);
  }, [attorneyId, loadForAttorney]);

  const filteredAttorneys = useMemo(() => {
    const q = attorneySearch.trim().toLowerCase();
    if (!q) return attorneys;
    return attorneys.filter((a) => a.name.toLowerCase().includes(q));
  }, [attorneys, attorneySearch]);

  const issueLink = async () => {
    if (!attorneyId || !appointmentId) {
      toast.error('Choose an attorney and an appointment first.');
      return;
    }
    setIssuing(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('create_attorney_access_code', {
        p_appointment_id: appointmentId,
        p_referring_attorney_id: attorneyId,
        p_expires_in_days: Number(expiryDays),
      });
      if (rpcError) throw rpcError;

      const created = Array.isArray(data) ? data[0] : data;
      const code = (created as any)?.access_code;
      if (code) {
        try {
          await navigator.clipboard.writeText(portalLinkFor(code));
          toast.success('Portal link created and copied to your clipboard.');
        } catch {
          toast.success(`Portal link created. Code: ${code}`);
        }
      } else {
        toast.success('Portal link created.');
      }
      await loadForAttorney(attorneyId);
    } catch (e: any) {
      console.error('[AttorneyPortalLinks] issue failed', e);
      toast.error(e?.message || 'Could not create the portal link.');
    } finally {
      setIssuing(false);
    }
  };

  const revokeLink = async (row: AccessCodeRow) => {
    const { error: revokeError } = await supabase
      .from('attorney_access_codes')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
        deactivation_reason: 'Revoked by staff',
      })
      .eq('id', row.id);

    if (revokeError) {
      toast.error(revokeError.message || 'Could not revoke the link.');
      return;
    }
    toast.success('Portal link revoked.');
    loadForAttorney(attorneyId);
  };

  const copyLink = async (row: AccessCodeRow) => {
    try {
      await navigator.clipboard.writeText(portalLinkFor(row.access_code));
      toast.success('Link copied.');
    } catch {
      toast.error('Clipboard unavailable — copy the code manually.');
    }
  };

  return (
    <div className="space-y-4">
      <AdminCard>
        <AdminCardHeader
          icon={ShieldCheck}
          title="Issue a secure portal link"
          description="Time-limited, revocable access for a referring attorney — no platform account required."
        />
        <AdminCardBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Referring attorney</label>
              <Input
                value={attorneySearch}
                onChange={(e) => setAttorneySearch(e.target.value)}
                placeholder="Search firms…"
                className="rounded-none"
              />
              <Select value={attorneyId} onValueChange={setAttorneyId}>
                <SelectTrigger className="rounded-none">
                  <SelectValue placeholder="Select a firm" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {filteredAttorneys.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Appointment</label>
              <Select
                value={appointmentId}
                onValueChange={setAppointmentId}
                disabled={!attorneyId || appointments.length === 0}
              >
                <SelectTrigger className="rounded-none">
                  <SelectValue
                    placeholder={attorneyId ? 'No appointments found' : 'Select a firm first'}
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {appointments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {formatDate(a.appointment_date)} — {a.matter_type || 'Assessment'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Expires after</label>
              <Select value={expiryDays} onValueChange={setExpiryDays}>
                <SelectTrigger className="rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={issueLink}
                disabled={issuing || !attorneyId || !appointmentId}
                className="w-full rounded-none"
              >
                <Link2 className="mr-2 h-4 w-4" />
                {issuing ? 'Creating…' : 'Create link'}
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Creating a new link for an appointment automatically retires the previous one. Expiry is
            enforced on the server — an expired or revoked link returns no case data at all.
          </p>
        </AdminCardBody>
      </AdminCard>

      <AdminCard>
        <AdminCardHeader
          icon={Link2}
          title="Issued links"
          description={attorneyId ? `${codes.length} link${codes.length === 1 ? '' : 's'}` : undefined}
        />
        {!attorneyId ? (
          <AdminEmptyState
            icon={Link2}
            title="Choose a referring attorney"
            description="Pick a firm above to see the links already issued to them."
          />
        ) : loading ? (
          <AdminLoadingState label="Loading portal links…" />
        ) : error ? (
          <AdminErrorState
            title="Could not load portal links"
            message={error}
            onRetry={() => loadForAttorney(attorneyId)}
          />
        ) : codes.length === 0 ? (
          <AdminEmptyState
            icon={Link2}
            title="No links issued yet"
            description="Create one above to give this firm secure access to their cases."
          />
        ) : (
          <>
            {/* ≥md: table */}
            <div className="hidden overflow-x-auto md:block">
              <Table className="text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead>Uses</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {codes.map((row) => {
                    const state = linkState(row);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono">{row.access_code}</TableCell>
                        <TableCell>
                          <Badge
                            variant={state === 'active' ? 'default' : 'secondary'}
                            className="rounded-none capitalize"
                          >
                            {state}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(row.created_at)}</TableCell>
                        <TableCell>{formatDate(row.expires_at)}</TableCell>
                        <TableCell>{formatDate(row.last_accessed_at)}</TableCell>
                        <TableCell>{row.access_count ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-none"
                              onClick={() => copyLink(row)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            {state === 'active' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-none text-destructive"
                                onClick={() => revokeLink(row)}
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* <md: card list so nothing overflows on a phone */}
            <div className="space-y-2 p-3 md:hidden">
              {codes.map((row) => {
                const state = linkState(row);
                return (
                  <div key={row.id} className="min-w-0 border border-black/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs">{row.access_code}</span>
                      <Badge
                        variant={state === 'active' ? 'default' : 'secondary'}
                        className="rounded-none capitalize"
                      >
                        {state}
                      </Badge>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600">
                      <dt>Issued</dt>
                      <dd className="text-right">{formatDate(row.created_at)}</dd>
                      <dt>Expires</dt>
                      <dd className="text-right">{formatDate(row.expires_at)}</dd>
                      <dt>Last used</dt>
                      <dd className="text-right">{formatDate(row.last_accessed_at)}</dd>
                      <dt>Uses</dt>
                      <dd className="text-right">{row.access_count ?? 0}</dd>
                    </dl>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 rounded-none"
                        onClick={() => copyLink(row)}
                      >
                        <Copy className="mr-2 h-3.5 w-3.5" />
                        Copy
                      </Button>
                      {state === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 rounded-none text-destructive"
                          onClick={() => revokeLink(row)}
                        >
                          <Ban className="mr-2 h-3.5 w-3.5" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </AdminCard>

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="rounded-none"
          onClick={() => attorneyId && loadForAttorney(attorneyId)}
          disabled={!attorneyId || loading}
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  );
};

export default AttorneyPortalLinksPanel;
