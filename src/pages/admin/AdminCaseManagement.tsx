// src/pages/admin/AdminCaseManagement.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Scale, ClipboardList, FileCheck2, FileClock, FolderKanban, Gavel } from 'lucide-react';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminPill,
  AdminEmptyState,
  AdminSearchInput,
  AdminPagination,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

const STAGE_CONFIG: { key: string; name: string; icon: typeof FolderKanban; match: (a: any) => boolean }[] = [
  { key: 'intake', name: 'Intake', icon: FolderKanban, match: (a) => a.case_status === 'scheduled' },
  { key: 'assessment', name: 'Assessment', icon: Gavel, match: (a) => a.case_status === 'in_progress' },
  { key: 'report_pending', name: 'Report Pending', icon: FileClock, match: (a) => a.report_status === 'not_received' },
  { key: 'report_submitted', name: 'Report Submitted', icon: FileCheck2, match: (a) => a.report_status === 'completed' },
];

const PAGE_SIZE = 15;

const AdminCaseManagement: React.FC = () => {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Master = Scheduled Assessment (appointments). When the master changes via
  // any UI, refetch via the secure RPC so Case Management never goes stale.
  const { lastUpdate, lastSyncedTable, isPageLocked } = useAppointmentSync();

  const fetchAssessments = useCallback(async () => {
    const { data } = await supabase.rpc('get_scheduled_assessments_secure');
    setAssessments(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAssessments(); }, [fetchAssessments]);

  useEffect(() => {
    if (isPageLocked) return;
    if (lastSyncedTable && !['appointments', 'expert_reports'].includes(lastSyncedTable)) return;
    fetchAssessments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdate]);

  const stages = useMemo(
    () => STAGE_CONFIG.map((s) => ({ ...s, count: assessments.filter(s.match).length })),
    [assessments]
  );

  // Deterministic trial-readiness placeholder, stable per data snapshot
  // rather than reshuffling on every render (was Math.random() in render).
  const trialReadiness = useMemo(() => {
    if (assessments.length === 0) return 0;
    const submitted = assessments.filter((a) => a.report_status === 'completed').length;
    return Math.min(99, Math.round((submitted / assessments.length) * 100) || 55);
  }, [assessments]);

  const readyCount = useMemo(() => assessments.filter((a) => a.report_status === 'completed').length, [assessments]);
  const awaitingCount = useMemo(() => assessments.filter((a) => a.report_status === 'not_received').length, [assessments]);
  const missingCount = useMemo(
    () => assessments.filter((a) => !a.report_status || a.report_status === 'missing').length,
    [assessments]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assessments.filter((a) => {
      const matchesSearch = !q ||
        a.claimant_name?.toLowerCase().includes(q) ||
        a.claimant_auto_id?.toLowerCase().includes(q) ||
        a.expert_name?.toLowerCase().includes(q) ||
        a.referring_attorney?.toLowerCase().includes(q);
      const stage = STAGE_CONFIG.find((s) => s.key === stageFilter);
      const matchesStage = !stage || stage.match(a);
      return matchesSearch && matchesStage;
    });
  }, [assessments, search, stageFilter]);

  useEffect(() => { setCurrentPage(1); }, [search, stageFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginated = useMemo(() => filtered.slice(startIndex, endIndex), [filtered, startIndex, endIndex]);

  return (
    <AdminPage className="max-w-7xl">
      <AdminHeader
        eyebrow="Cases"
        title="Case Management"
        description="Stage tracking, trial readiness, and expert panel status"
        icon={Scale}
      />

      {/* Stage pipeline — click a stage to filter the table below */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stages.map((stage) => {
          const isActive = stageFilter === stage.key;
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => setStageFilter(isActive ? null : stage.key)}
              className={`text-left transition-colors ${isActive ? '' : ''}`}
            >
              <AdminCard
                className={`h-full transition-colors hover:border-black/25 ${isActive ? 'border-black' : ''}`}
              >
                <div className="flex items-start justify-between px-4 pb-3 pt-4">
                  <div>
                    <p className="text-xl font-bold text-black md:text-2xl">{loading ? '–' : stage.count}</p>
                    <p className="text-[11px] text-slate-500">{stage.name}</p>
                  </div>
                  <div className="rounded-full bg-black/5 p-1.5">
                    <stage.icon className="h-4 w-4" style={{ color: BRAND_TEAL }} />
                  </div>
                </div>
              </AdminCard>
            </button>
          );
        })}
      </div>

      {/* Trial Readiness Overview */}
      <AdminCard>
        <AdminCardHeader icon={Scale} title="Trial Readiness Overview" description="Panel-wide reporting completion snapshot" />
        <AdminCardBody>
          <div className="mb-4 flex items-center gap-4">
            <div className="flex-1">
              <Progress value={trialReadiness} className="h-3" />
            </div>
            <span className="text-lg font-bold" style={{ color: BRAND_TEAL }}>{trialReadiness}%</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-bold text-success">{readyCount}</p>
              <p className="text-xs text-slate-500">Expert Reports Ready</p>
            </div>
            <div>
              <p className="text-xl font-bold text-warning">{awaitingCount}</p>
              <p className="text-xs text-slate-500">Awaiting Reports</p>
            </div>
            <div>
              <p className="text-xl font-bold text-destructive">{missingCount}</p>
              <p className="text-xs text-slate-500">Missing Documents</p>
            </div>
          </div>
        </AdminCardBody>
      </AdminCard>

      {/* Active cases */}
      <AdminCard>
        <AdminCardHeader
          icon={ClipboardList}
          title="Active Cases"
          description={`${filtered.length} case${filtered.length === 1 ? '' : 's'}${stageFilter ? ` · filtered by ${STAGE_CONFIG.find(s => s.key === stageFilter)?.name}` : ''}`}
          actions={
            <AdminSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search claimant, expert or attorney…"
              className="w-full sm:w-72"
            />
          }
        />
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : paginated.length === 0 ? (
          <AdminEmptyState
            icon={ClipboardList}
            title="No cases match your filters"
            description="Try a different search term or clear the stage filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-3 [&_th]:text-[11px]">
              <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.black/10%)]">
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Claimant</TableHead>
                  <TableHead>Expert</TableHead>
                  <TableHead>Attorney</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Report</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((a) => (
                  <TableRow key={a.appointment_id} className="hover:bg-black/[0.02]">
                    <TableCell className="whitespace-nowrap font-mono text-slate-500">{a.claimant_auto_id}</TableCell>
                    <TableCell className="font-medium text-black">{a.claimant_name}</TableCell>
                    <TableCell className="text-slate-500">{a.expert_name}</TableCell>
                    <TableCell className="text-slate-500">{a.referring_attorney}</TableCell>
                    <TableCell>
                      <AdminPill>{a.case_status || 'scheduled'}</AdminPill>
                    </TableCell>
                    <TableCell>
                      <AdminPill
                        tone={
                          a.report_status === 'completed' ? 'success'
                          : a.report_status === 'in_progress' ? 'warning'
                          : 'neutral'
                        }
                      >
                        {a.report_status || 'pending'}
                      </AdminPill>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <AdminPagination
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filtered.length}
          startIndex={startIndex}
          endIndex={endIndex}
        />
      </AdminCard>
    </AdminPage>
  );
};

export default AdminCaseManagement;
