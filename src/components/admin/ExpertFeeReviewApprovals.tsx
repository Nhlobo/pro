import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Loader2, Check, X, Search, ClipboardList } from 'lucide-react';

interface ReviewRequest {
  id: string;
  expert_id: string;
  submitted_by: string | null;
  fee_field: string;
  current_value: number | null;
  proposed_value: number;
  effective_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

interface ExpertLite {
  id: string;
  first_name: string;
  last_name: string;
  expert_type: string | null;
}

const formatFeeField = (k: string) =>
  k.replace(/_/g, ' ').replace(/\bfees?\b/i, 'Fee').replace(/\b\w/g, c => c.toUpperCase());

const fmtZAR = (v: number | null | undefined) =>
  v == null ? '–' : `R${Number(v).toLocaleString('en-ZA')}`;

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: '2-digit' }) : '–';

const ExpertFeeReviewApprovals: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [experts, setExperts] = useState<Record<string, ExpertLite>>({});
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [decision, setDecision] = useState<{ req: ReviewRequest; action: 'approve' | 'reject' } | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('expert_fee_review_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: 'Failed to load requests', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    const list: ReviewRequest[] = data || [];
    setRequests(list);
    const ids = Array.from(new Set(list.map(r => r.expert_id)));
    if (ids.length) {
      const { data: exps } = await supabase
        .from('medical_experts')
        .select('id, first_name, last_name, expert_type')
        .in('id', ids);
      const map: Record<string, ExpertLite> = {};
      (exps || []).forEach((e: any) => { map[e.id] = e; });
      setExperts(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDecision = (req: ReviewRequest, action: 'approve' | 'reject') => {
    setDecision({ req, action });
    setDecisionNotes('');
  };

  const submitDecision = async () => {
    if (!decision) return;
    const { req, action } = decision;
    if (action === 'reject' && decisionNotes.trim().length < 5) {
      toast({ title: 'Reason required', description: 'Please provide a brief reason for rejection (5+ chars).', variant: 'destructive' });
      return;
    }
    setWorking(true);
    try {
      const status = action === 'approve' ? 'approved' : 'rejected';
      const { error } = await (supabase as any)
        .from('expert_fee_review_requests')
        .update({
          status,
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
          review_notes: decisionNotes.trim() || null,
        })
        .eq('id', req.id);
      if (error) throw error;

      // If approved and effective date is today or in the past, apply fee immediately
      if (action === 'approve') {
        const eff = new Date(req.effective_date);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (eff <= today) {
          const { error: feeErr } = await supabase
            .from('medical_experts')
            .update({ [req.fee_field]: req.proposed_value } as any)
            .eq('id', req.expert_id);
          if (feeErr) {
            toast({ title: 'Approved but fee not applied', description: feeErr.message, variant: 'destructive' });
          } else {
            window.dispatchEvent(new Event('medical-expert-updated'));
          }
        }
      }

      toast({ title: action === 'approve' ? 'Request approved' : 'Request rejected' });
      setDecision(null);
      setDecisionNotes('');
      await load();
    } catch (e: any) {
      toast({ title: 'Action failed', description: e?.message || 'Could not save decision.', variant: 'destructive' });
    } finally {
      setWorking(false);
    }
  };

  const filtered = requests.filter(r => {
    if (r.status !== tab) return false;
    if (!search.trim()) return true;
    const e = experts[r.expert_id];
    const name = e ? `${e.first_name} ${e.last_name}` : '';
    const hay = `${name} ${e?.expert_type || ''} ${r.fee_field} ${r.reason}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  const counts = {
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  return (
    <Card className="rounded-none border-black/10 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-secondary" />
            Annual Fee Review Requests
          </CardTitle>
          <Badge variant="secondary">{counts.pending} pending</Badge>
        </div>
        <div className="relative max-w-xs mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search expert, fee, reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No {tab} requests.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Expert</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Current → Proposed</TableHead>
                      <TableHead>Effective</TableHead>
                      <TableHead className="max-w-[260px]">Reason</TableHead>
                      {tab === 'pending' ? (
                        <TableHead className="text-right">Actions</TableHead>
                      ) : (
                        <TableHead>Decision</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const e = experts[r.expert_id];
                      const delta = r.current_value != null
                        ? r.proposed_value - r.current_value
                        : null;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.created_at)}</TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">
                              {e ? `${e.first_name} ${e.last_name}` : '—'}
                            </div>
                            <div className="text-xs text-muted-foreground">{e?.expert_type || ''}</div>
                          </TableCell>
                          <TableCell className="text-xs">{formatFeeField(r.fee_field)}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            <span className="text-muted-foreground">{fmtZAR(r.current_value)}</span>
                            <span className="mx-1">→</span>
                            <span className="font-medium text-foreground">{fmtZAR(r.proposed_value)}</span>
                            {delta != null && delta !== 0 && (
                              <span className={`ml-2 text-[10px] ${delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {delta > 0 ? '↑' : '↓'} {fmtZAR(Math.abs(delta))}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.effective_date)}</TableCell>
                          <TableCell className="text-xs max-w-[260px]">
                            <span className="line-clamp-3" title={r.reason}>{r.reason}</span>
                          </TableCell>
                          {tab === 'pending' ? (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="outline" onClick={() => openDecision(r, 'approve')}>
                                  <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => openDecision(r, 'reject')}>
                                  <X className="h-3.5 w-3.5 mr-1" /> Reject
                                </Button>
                              </div>
                            </TableCell>
                          ) : (
                            <TableCell className="text-xs">
                              <div className="flex flex-col gap-0.5">
                                <Badge variant={r.status === 'approved' ? 'default' : 'destructive'} className="w-fit text-[10px]">
                                  {r.status}
                                </Badge>
                                <span className="text-muted-foreground">{fmtDate(r.reviewed_at)}</span>
                                {r.review_notes && (
                                  <span className="text-muted-foreground italic line-clamp-2" title={r.review_notes}>
                                    “{r.review_notes}”
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.action === 'approve' ? 'Approve' : 'Reject'} fee review request
            </DialogTitle>
            <DialogDescription>
              {decision && (
                <span>
                  {experts[decision.req.expert_id]
                    ? `${experts[decision.req.expert_id].first_name} ${experts[decision.req.expert_id].last_name}`
                    : 'Expert'} – {formatFeeField(decision.req.fee_field)}: {fmtZAR(decision.req.current_value)} → {fmtZAR(decision.req.proposed_value)} (effective {fmtDate(decision.req.effective_date)})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decision-notes">
              Decision reason {decision?.action === 'reject' ? '(required)' : '(optional)'}
            </Label>
            <Textarea
              id="decision-notes"
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              placeholder={decision?.action === 'approve'
                ? 'Optional note recorded with the approval.'
                : 'Explain why this request is being rejected.'}
              rows={4}
            />
            {decision?.action === 'approve' && decision.req && new Date(decision.req.effective_date) <= new Date() && (
              <p className="text-xs text-muted-foreground">
                Effective date has passed — the new fee will be applied immediately.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDecision(null)} disabled={working}>Cancel</Button>
            <Button
              onClick={submitDecision}
              disabled={working}
              variant={decision?.action === 'reject' ? 'destructive' : 'default'}
            >
              {working && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {decision?.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ExpertFeeReviewApprovals;
