import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldOff, ShieldCheck, Clock, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

type PersonType = 'attorney' | 'expert';

interface AccessCodeRow {
  id: string;
  access_code: string;
  is_active: boolean;
  expires_at: string | null;
  deactivated_at: string | null;
  deactivation_reason: string | null;
  last_accessed_at: string | null;
  access_count: number;
}

interface PortalAccessControlProps {
  /** 'attorney' | 'expert' — which access_codes table to look at */
  personType: PersonType;
  /** referring_attorney_id or expert_id */
  personId: string;
}

/**
 * Drop this into any admin detail panel (Attorney CRM, Expert Network) to
 * show whether a person's portal access link is currently live, and let
 * an admin/employee revoke or reactivate it. Authorization is enforced
 * server-side by the admin_set_access_code_status RPC (admin/employee
 * only) — this component doesn't need its own permission check.
 */
const PortalAccessControl: React.FC<PortalAccessControlProps> = ({ personType, personId }) => {
  const [codes, setCodes] = useState<AccessCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  const table = personType === 'attorney' ? 'attorney_access_codes' : 'expert_access_codes';
  const personColumn = personType === 'attorney' ? 'referring_attorney_id' : 'expert_id';

  const loadCodes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select('id, access_code, is_active, expires_at, deactivated_at, deactivation_reason, last_accessed_at, access_count')
      .eq(personColumn, personId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Could not load portal access status');
    } else {
      setCodes((data as AccessCodeRow[]) || []);
    }
    setLoading(false);
  }, [table, personColumn, personId]);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  const isCurrentlyActive = codes.some((c) => c.is_active);

  const handleReactivate = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_set_access_code_status', {
      _table: personType,
      _person_id: personId,
      _activate: true,
    });
    setBusy(false);

    if (error) {
      toast.error(error.message || 'Failed to reactivate access');
    } else {
      toast.success('Portal access reactivated — link is live for another year');
      loadCodes();
    }
  };

  const handleRevoke = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_set_access_code_status', {
      _table: personType,
      _person_id: personId,
      _activate: false,
      _reason: revokeReason.trim() || null,
    });
    setBusy(false);
    setRevokeDialogOpen(false);
    setRevokeReason('');

    if (error) {
      toast.error(error.message || 'Failed to revoke access');
    } else {
      toast.success('Portal access revoked — the link will no longer work');
      loadCodes();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading portal access status…
      </div>
    );
  }

  if (codes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <KeyRound className="h-4 w-4" /> No portal access link has been issued yet — one is generated automatically on their first appointment confirmation email.
      </div>
    );
  }

  const latest = codes[0];

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Portal access link</span>
          {isCurrentlyActive ? (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
          ) : (
            <Badge variant="secondary">Revoked / Expired</Badge>
          )}
        </div>

        {isCurrentlyActive ? (
          <Button variant="destructive" size="sm" onClick={() => setRevokeDialogOpen(true)} disabled={busy}>
            <ShieldOff className="h-4 w-4 mr-1.5" /> Revoke access
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleReactivate} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1.5" />}
            Reactivate access
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        {latest.expires_at && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Expires {format(new Date(latest.expires_at), 'd MMM yyyy')}
          </div>
        )}
        {latest.last_accessed_at && (
          <div>Last used {format(new Date(latest.last_accessed_at), 'd MMM yyyy, HH:mm')} · {latest.access_count} time{latest.access_count === 1 ? '' : 's'}</div>
        )}
        {!latest.is_active && latest.deactivation_reason && (
          <div>Deactivated: {latest.deactivation_reason}{latest.deactivated_at ? ` (${format(new Date(latest.deactivated_at), 'd MMM yyyy')})` : ''}</div>
        )}
      </div>

      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke portal access</DialogTitle>
            <DialogDescription>
              This immediately disables their access link. They won't be able to view their cases until you reactivate it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="revoke-reason">Reason (optional, kept in the audit log)</Label>
            <Textarea
              id="revoke-reason"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="e.g. Requested by law firm, suspected link sharing…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Revoke access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalAccessControl;
