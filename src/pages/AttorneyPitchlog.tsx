import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Plus, Pencil, Trash2, ClipboardList, BarChart3, Building2, AlertTriangle, CheckCircle2, Target, Flame,
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import DashboardStickyHeader from '@/components/dashboard/DashboardStickyHeader';
import CompanyFooter from '@/components/CompanyFooter';
import {
  AdminPage, AdminHeader, AdminCard, AdminCardHeader, AdminCardBody, AdminStatCard, AdminPill,
  AdminEmptyState, AdminLoadingState, AdminErrorState, AdminTabList, AdminTabTrigger, AdminSearchInput,
} from '@/components/admin/ui/AdminUI';
import { useAttorneyPitchlog, PitchlogEntry, PITCH_STATUSES } from '@/hooks/useAttorneyPitchlog';
import PitchlogFormSheet from '@/components/sales/PitchlogFormSheet';

/**
 * `embedded` drops the page's own header/Helmet/footer when hosted inside
 * another surface's chrome (here, AttorneyPitchlogModule.tsx inside the
 * Admin Attorney CRM's "Pitchlog" tab). Standalone route usage
 * (`/attorney-pitchlog`) is unaffected. Same convention as
 * ReferringAttorneyUpdate's `embedded` prop.
 *
 * `defaultTab` lets a caller land directly on the Sales Report tab — used
 * by AdminAttorneyCRM's "Closed Deals" header action.
 */
interface AttorneyPitchlogProps {
  embedded?: boolean;
  defaultTab?: string;
}

const statusTone = (status: string): 'neutral' | 'teal' | 'success' | 'warning' | 'destructive' => {
  switch (status) {
    case 'Interested': return 'success';
    case 'Followed Up': return 'teal';
    case 'Re-pitched': return 'warning';
    case 'Not Interested': return 'destructive';
    default: return 'neutral';
  }
};

const AttorneyPitchlog: React.FC<AttorneyPitchlogProps> = ({ embedded = false, defaultTab }) => {
  const {
    entries, loading, error, saving, referringAttorneys,
    consultant, allConsultants, admin,
    refetch, addEntry, updateEntry, deleteEntry,
  } = useAttorneyPitchlog();

  const [tab, setTab] = useState(defaultTab === 'sales-report' ? 'sales-report' : 'pitch-log');
  React.useEffect(() => {
    if (defaultTab) setTab(defaultTab);
  }, [defaultTab]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [consultantFilter, setConsultantFilter] = useState('all');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PitchlogEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PitchlogEntry | null>(null);

  const openAdd = () => { setEditingEntry(null); setSheetOpen(true); };
  const openEdit = (entry: PitchlogEntry) => { setEditingEntry(entry); setSheetOpen(true); };

  const handleSave = async (id: string | null, input: Parameters<typeof addEntry>[0]) =>
    id ? updateEntry(id, input) : addEntry(input);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteEntry(deleteTarget.id);
    setDeleteTarget(null);
  };

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(e => {
      if (statusFilter !== 'all' && e.pitch_status !== statusFilter) return false;
      if (admin && consultantFilter !== 'all' && e.consultant_id !== consultantFilter) return false;
      if (!q) return true;
      return (
        e.law_firm_name?.toLowerCase().includes(q) ||
        e.contact_person?.toLowerCase().includes(q) ||
        e.province?.toLowerCase().includes(q)
      );
    });
  }, [entries, search, statusFilter, consultantFilter, admin]);

  const stats = useMemo(() => {
    const totalPitches = entries.length;
    const pitched = entries.filter(e => e.pitch_status === 'Pitched').length;
    const rePitched = entries.filter(e => e.pitch_status === 'Re-pitched').length;
    const followedUp = entries.filter(e => e.pitch_status === 'Followed Up').length;
    const interested = entries.filter(e => e.pitch_status === 'Interested').length;
    const closed = entries.filter(e => e.deal_closed).length;
    const overdueFollowUps = entries.filter(e => e.follow_up_date && !e.deal_closed && isPast(new Date(e.follow_up_date)) && !isToday(new Date(e.follow_up_date))).length;
    const conversionRate = totalPitches > 0 ? ((closed / totalPitches) * 100).toFixed(1) : '0';

    const provinceBreakdown: Record<string, number> = {};
    const practiceBreakdown: Record<string, number> = {};
    entries.forEach(e => {
      provinceBreakdown[e.province || 'Unknown'] = (provinceBreakdown[e.province || 'Unknown'] || 0) + 1;
      practiceBreakdown[e.practice_area || 'Unknown'] = (practiceBreakdown[e.practice_area || 'Unknown'] || 0) + 1;
    });

    const closedDeals = entries
      .filter(e => e.deal_closed)
      .sort((a, b) => (b.deal_closed_date || '').localeCompare(a.deal_closed_date || ''));

    return { totalPitches, pitched, rePitched, followedUp, interested, closed, overdueFollowUps, conversionRate, provinceBreakdown, practiceBreakdown, closedDeals };
  }, [entries]);

  const consultantName = (id: string | null) => allConsultants.find(c => c.id === id)?.name || '—';

  return (
    <div className={embedded ? '' : 'min-h-screen bg-background'}>
      {!embedded && (
        <Helmet>
          <title>Attorney Pitchlog - Medico-Legal Assessment System</title>
          <meta name="description" content="Track attorney pitches, follow-ups and conversions." />
        </Helmet>
      )}

      {!embedded && (
        <DashboardStickyHeader
          title="Attorney Pitchlog"
          backHref="/dashboard"
          backLabel="Dashboard"
          actions={
            <Button
              size="sm"
              onClick={openAdd}
              className="gap-1 bg-white text-[#0F7A9C] hover:bg-white/90"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Log Pitch</span>
            </Button>
          }
        />
      )}

      <main className={embedded ? '' : 'container mx-auto px-4 py-8'}>
        <AdminPage>
          {embedded ? (
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-black">Attorney Pitchlog</h2>
                <p className="text-xs text-slate-500">Track pitches, follow-ups and conversions.</p>
              </div>
              <Button size="sm" className="gap-1 rounded-none" onClick={openAdd}>
                <Plus className="h-4 w-4" /> Log Pitch
              </Button>
            </div>
          ) : (
            <AdminHeader
              eyebrow="Sales"
              title="Attorney Pitchlog"
              description="Track attorney pitches, follow-ups and conversions"
              icon={ClipboardList}
            />
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <AdminTabList>
              <AdminTabTrigger value="pitch-log" label="Pitch Log" icon={ClipboardList} badge={stats.overdueFollowUps || undefined} />
              <AdminTabTrigger value="sales-report" label="Sales Report" icon={BarChart3} />
            </AdminTabList>

            <div className="mt-4 space-y-4">
              <TabsContent value="pitch-log" className="mt-0 space-y-4 focus-visible:outline-none">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <AdminStatCard label="Pitched" value={stats.pitched} icon={ClipboardList} />
                  <AdminStatCard label="Re-pitched" value={stats.rePitched} icon={Flame} />
                  <AdminStatCard label="Followed Up" value={stats.followedUp} icon={Target} />
                  <AdminStatCard label="Interested" value={stats.interested} icon={CheckCircle2} />
                  <AdminStatCard
                    label="Overdue Follow-ups"
                    value={stats.overdueFollowUps}
                    icon={AlertTriangle}
                    hint={stats.overdueFollowUps > 0 ? 'Needs attention' : 'All caught up'}
                  />
                </div>

                <AdminCard>
                  <AdminCardHeader
                    title="Pitch Log"
                    description={`${filteredEntries.length} of ${entries.length} pitches`}
                    actions={
                      <Button size="sm" className="gap-1 rounded-none" onClick={openAdd}>
                        <Plus className="h-4 w-4" /> Log Pitch
                      </Button>
                    }
                  />
                  <AdminCardBody className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <AdminSearchInput value={search} onChange={setSearch} placeholder="Search firm, contact, province…" className="flex-1" />
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-[180px] rounded-none"><SelectValue placeholder="All statuses" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          {PITCH_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {admin && (
                        <Select value={consultantFilter} onValueChange={setConsultantFilter}>
                          <SelectTrigger className="w-full sm:w-[200px] rounded-none"><SelectValue placeholder="All consultants" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All consultants</SelectItem>
                            {allConsultants.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </AdminCardBody>

                  {loading ? (
                    <AdminLoadingState label="Loading pitch log…" />
                  ) : error ? (
                    <AdminErrorState message={error} onRetry={refetch} />
                  ) : filteredEntries.length === 0 ? (
                    <AdminEmptyState
                      icon={Building2}
                      title={entries.length === 0 ? 'No pitches logged yet' : 'No pitches match your filters'}
                      description={entries.length === 0 ? 'Log your first attorney pitch to start tracking it here.' : undefined}
                      action={entries.length === 0 ? (
                        <Button size="sm" className="rounded-none mt-2" onClick={openAdd}>
                          <Plus className="h-4 w-4 mr-1" /> Log Pitch
                        </Button>
                      ) : undefined}
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-black/[0.03] hover:bg-black/[0.03]">
                            <TableHead className="text-xs font-semibold text-black">Firm</TableHead>
                            <TableHead className="text-xs font-semibold text-black">Contact</TableHead>
                            <TableHead className="text-xs font-semibold text-black">Province</TableHead>
                            <TableHead className="text-xs font-semibold text-black">Area</TableHead>
                            <TableHead className="text-xs font-semibold text-black">Status</TableHead>
                            <TableHead className="text-xs font-semibold text-black">Follow-up</TableHead>
                            {admin && <TableHead className="text-xs font-semibold text-black">Consultant</TableHead>}
                            <TableHead className="text-xs font-semibold w-20"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredEntries.map(entry => {
                            const overdue = entry.follow_up_date && !entry.deal_closed && isPast(new Date(entry.follow_up_date)) && !isToday(new Date(entry.follow_up_date));
                            return (
                              <TableRow key={entry.id}>
                                <TableCell className="text-sm font-medium">
                                  {entry.law_firm_name}
                                  {entry.deal_closed && <AdminPill tone="success" className="ml-2">Closed</AdminPill>}
                                </TableCell>
                                <TableCell className="text-sm">{entry.contact_person}</TableCell>
                                <TableCell className="text-sm">{entry.province}</TableCell>
                                <TableCell className="text-sm">{entry.practice_area}</TableCell>
                                <TableCell><AdminPill tone={statusTone(entry.pitch_status)}>{entry.pitch_status}</AdminPill></TableCell>
                                <TableCell className="text-sm">
                                  {entry.follow_up_date ? (
                                    <span className={overdue ? 'text-destructive font-medium' : ''}>
                                      {format(new Date(entry.follow_up_date), 'd MMM yyyy')}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </TableCell>
                                {admin && <TableCell className="text-sm">{consultantName(entry.consultant_id)}</TableCell>}
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(entry)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(entry)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </AdminCard>
              </TabsContent>

              <TabsContent value="sales-report" className="mt-0 space-y-4 focus-visible:outline-none">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <AdminStatCard label="Total Pitches" value={stats.totalPitches} icon={ClipboardList} />
                  <AdminStatCard label="Deals Closed" value={stats.closed} icon={CheckCircle2} />
                  <AdminStatCard label="Conversion Rate" value={`${stats.conversionRate}%`} icon={Target} />
                  <AdminStatCard label="Overdue Follow-ups" value={stats.overdueFollowUps} icon={AlertTriangle} />
                </div>

                <AdminCard>
                  <AdminCardHeader title="Province Breakdown" />
                  <AdminCardBody>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(stats.provinceBreakdown).sort(([, a], [, b]) => b - a).map(([province, count]) => (
                        <div key={province} className="flex items-center justify-between border border-black/10 p-2.5">
                          <span className="text-sm text-black truncate">{province}</span>
                          <AdminPill tone="teal">{count}</AdminPill>
                        </div>
                      ))}
                    </div>
                  </AdminCardBody>
                </AdminCard>

                <AdminCard>
                  <AdminCardHeader title="Practice Area Breakdown" />
                  <AdminCardBody>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(stats.practiceBreakdown).sort(([, a], [, b]) => b - a).map(([area, count]) => (
                        <div key={area} className="flex items-center justify-between border border-black/10 p-2.5">
                          <span className="text-sm text-black truncate">{area}</span>
                          <AdminPill tone="teal">{count}</AdminPill>
                        </div>
                      ))}
                    </div>
                  </AdminCardBody>
                </AdminCard>

                <AdminCard>
                  <AdminCardHeader title="Closed Deals" description={`${stats.closedDeals.length} closed`} />
                  <AdminCardBody className="p-0">
                    {stats.closedDeals.length === 0 ? (
                      <AdminEmptyState icon={CheckCircle2} title="No closed deals yet" />
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-black/[0.03] hover:bg-black/[0.03]">
                              <TableHead className="text-xs font-semibold text-black">Closed</TableHead>
                              <TableHead className="text-xs font-semibold text-black">Firm</TableHead>
                              <TableHead className="text-xs font-semibold text-black">Area</TableHead>
                              {admin && <TableHead className="text-xs font-semibold text-black">Consultant</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stats.closedDeals.map(deal => (
                              <TableRow key={deal.id}>
                                <TableCell className="text-sm">{deal.deal_closed_date ? format(new Date(deal.deal_closed_date), 'd MMM yyyy') : '—'}</TableCell>
                                <TableCell className="text-sm font-medium">{deal.law_firm_name}</TableCell>
                                <TableCell className="text-sm">{deal.practice_area}</TableCell>
                                {admin && <TableCell className="text-sm">{consultantName(deal.consultant_id)}</TableCell>}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </AdminCardBody>
                </AdminCard>
              </TabsContent>
            </div>
          </Tabs>
        </AdminPage>
      </main>

      {!embedded && <CompanyFooter />}

      <PitchlogFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingEntry={editingEntry}
        saving={saving}
        onSave={handleSave}
        referringAttorneys={referringAttorneys}
        isAdmin={admin}
        ownConsultant={consultant}
        allConsultants={allConsultants}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this pitch entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && `This will permanently remove the pitch record for ${deleteTarget.law_firm_name}. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-none bg-destructive hover:bg-destructive/90" onClick={handleConfirmDelete}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AttorneyPitchlog;
