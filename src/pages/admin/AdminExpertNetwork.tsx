// src/pages/admin/AdminExpertNetwork.tsx
import React, { useEffect, useMemo, useState, Suspense, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
  Stethoscope,
  Search,
  Activity,
  MapPin,
  Plus,
  Users,
  ChevronDown,
  ChevronUp,
  Pencil,
  ClipboardList,
  Building2,
  Wallet,
  Gauge,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatExpertType } from '@/utils/expertTypeMapping';
import { useSearchParams } from 'react-router-dom';
import { RandSign } from '@/components/icons/RandSign';
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminStatCard,
  AdminEmptyState,
  AdminTabList,
  AdminTabTrigger,
  AdminSearchInput,
  AdminPagination,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

// Retry dynamic imports once on failure (handles stale chunk hashes after deploy)
const lazyWithRetry = <T,>(factory: () => Promise<T>) =>
  React.lazy(() =>
    (factory() as Promise<any>).catch(async (err) => {
      console.warn('[lazyWithRetry] first import failed, retrying...', err);
      await new Promise((r) => setTimeout(r, 400));
      try {
        return await factory();
      } catch (err2) {
        console.error('[lazyWithRetry] retry failed, reloading page', err2);
        if (typeof window !== 'undefined') {
          // Force reload to pick up new asset manifest
          window.location.reload();
        }
        throw err2;
      }
    })
  );

const ExpertFormModule = lazyWithRetry(() => import('@/components/admin/ExpertFormModule'));
const ExpertCreditControlModule = lazyWithRetry(() => import('@/components/admin/ExpertCreditControlModule'));
const ExpertFeeReviewApprovals = lazyWithRetry(() => import('@/components/admin/ExpertFeeReviewApprovals'));

const TabFallback = () => (
  <div className="space-y-4 border border-black/10 bg-white p-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-24" />
    </div>
    <Skeleton className="h-64 w-full" />
  </div>
);

const normalizeProvince = (province: string): string => {
  const p = (province || '').trim().toLowerCase().replace(/[_-]/g, ' ');
  const map: Record<string, string> = {
    gauteng: 'Gauteng',
    guateng: 'Gauteng',
    limpopo: 'Limpopo',
    'kwazulu natal': 'KwaZulu-Natal',
    kzn: 'KwaZulu-Natal',
    'free state': 'Free State',
    'western cape': 'Western Cape',
    'eastern cape': 'Eastern Cape',
    'northern cape': 'Northern Cape',
    'north west': 'North West',
    mpumalanga: 'Mpumalanga',
  };
  return map[p] || province || 'Unknown';
};

const PROVINCES = [
  'All Provinces',
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];

const PAGE_SIZE_OPTIONS = [10, 20, 40, 60, 100];

/** Deterministic 75–99 "performance score" per expert id — stable across
 *  re-renders (unlike Math.random() in render, which used to reshuffle
 *  every score on each keystroke of the search box). Placeholder pending
 *  a real scoring model; presentation-only, no backend change. */
const scoreForId = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return 75 + (hash % 25);
};

const AdminExpertNetwork: React.FC = () => {
  const [experts, setExperts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('All Provinces');
  const [provinceSearch, setProvinceSearch] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [expandedDiscipline, setExpandedDiscipline] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [editExpertId, setEditExpertId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const refetchExperts = useCallback(async () => {
    const { data } = await supabase.rpc('get_medical_experts_secure');
    setExperts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { refetchExperts(); }, [refetchExperts]);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && editId !== editExpertId) {
      setEditExpertId(editId);
      setActiveTab('edit-expert');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Refresh after an expert profile/fee update from the edit form
  useEffect(() => {
    const handler = () => refetchExperts();
    window.addEventListener('medical-expert-updated', handler);
    return () => window.removeEventListener('medical-expert-updated', handler);
  }, [refetchExperts]);

  const openEdit = useCallback((id: string) => {
    setEditExpertId(id);
    setActiveTab('edit-expert');
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return experts.filter((e) => {
      const nameMatch = !q ||
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
        e.expert_type?.toLowerCase().includes(q);
      const provinceMatch = provinceFilter === 'All Provinces' || normalizeProvince(e.province) === provinceFilter;
      return nameMatch && provinceMatch;
    });
  }, [experts, search, provinceFilter]);

  useEffect(() => { setCurrentPage(1); }, [search, provinceFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginated = useMemo(() => filtered.slice(startIndex, endIndex), [filtered, startIndex, endIndex]);

  // Group by normalized province, then by discipline — only recomputed when
  // the underlying dataset changes, not on every filter/search keystroke.
  const provinceGroups = useMemo(() => {
    return experts.reduce((acc, e) => {
      const province = normalizeProvince(e.province);
      const displayName = formatExpertType(e.expert_type || 'Other');
      if (!acc[province]) acc[province] = {};
      if (!acc[province][displayName]) acc[province][displayName] = { count: 0, experts: [] as any[] };
      acc[province][displayName].count += 1;
      acc[province][displayName].experts.push(e);
      return acc;
    }, {} as Record<string, Record<string, { count: number; experts: any[] }>>);
  }, [experts]);

  const sortedProvinces = useMemo(() => {
    return Object.entries(provinceGroups)
      .filter(([province]) => !provinceSearch || province.toLowerCase().includes(provinceSearch.toLowerCase()))
      .sort((a, b) => {
        const totalA = Object.values(a[1]).reduce((s, d: any) => s + d.count, 0);
        const totalB = Object.values(b[1]).reduce((s, d: any) => s + d.count, 0);
        return totalB - totalA;
      });
  }, [provinceGroups, provinceSearch]);

  const kpis = useMemo(() => {
    const provinces = new Set(experts.map((e) => normalizeProvince(e.province))).size;
    const disciplines = new Set(experts.map((e) => e.expert_type || 'Other')).size;
    const fees = experts.map((e) => Number(e.consultation_fees || 0)).filter((f) => f > 0);
    const avgFee = fees.length ? fees.reduce((s, f) => s + f, 0) / fees.length : 0;
    return { provinces, disciplines, avgFee };
  }, [experts]);

  return (
    <AdminPage className="max-w-7xl">
      <AdminHeader
        eyebrow="Network"
        title="Expert Network"
        description="Directory, coverage, credit control and fee governance for every panel expert"
        icon={Stethoscope}
        actions={
          <Badge variant="outline" className="rounded-none border-black/15 text-black">
            {experts.length} experts
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminStatCard label="Total Experts" value={experts.length} icon={Users} loading={loading} />
        <AdminStatCard label="Provinces Covered" value={kpis.provinces} icon={MapPin} loading={loading} />
        <AdminStatCard label="Disciplines" value={kpis.disciplines} icon={Activity} loading={loading} />
        <AdminStatCard
          label="Avg. Consultation Fee"
          value={kpis.avgFee > 0 ? `R${kpis.avgFee.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}` : '–'}
          icon={RandSign as any}
          loading={loading}
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => { setActiveTab(val); if (val !== 'edit-expert') setEditExpertId(null); }}
        className="w-full"
      >
        <AdminTabList sticky columns={editExpertId ? 5 : 4}>
          <AdminTabTrigger value="overview" label="Directory" icon={Users} center />
          <AdminTabTrigger value="new-expert" label="New Expert" icon={Plus} center />
          {editExpertId && <AdminTabTrigger value="edit-expert" label="Edit Expert" icon={Pencil} center />}
          <AdminTabTrigger value="credit-control" label="Credit Control" icon={RandSign as any} center />
          <AdminTabTrigger value="fee-reviews" label="Fee Reviews" icon={ClipboardList} center />
        </AdminTabList>

        <div className="mt-4">
          <TabsContent value="overview" className="mt-0 space-y-4 focus-visible:outline-none">
            {/* Coverage breakdown */}
            <AdminCard>
              <AdminCardHeader
                icon={Building2}
                title="Discipline Breakdown by Province"
                description={showBreakdown ? undefined : 'Expand to see how the panel is distributed across provinces and disciplines'}
                actions={
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-none border-black/15 text-xs"
                    onClick={() => { setShowBreakdown((v) => !v); if (showBreakdown) setProvinceSearch(''); }}
                  >
                    {showBreakdown ? <ChevronUp className="mr-1.5 h-3.5 w-3.5" /> : <ChevronDown className="mr-1.5 h-3.5 w-3.5" />}
                    {showBreakdown ? 'Hide' : 'Show'} Breakdown
                  </Button>
                }
              />
              {showBreakdown && (
                <AdminCardBody className="space-y-4">
                  <AdminSearchInput
                    value={provinceSearch}
                    onChange={setProvinceSearch}
                    placeholder="Search province…"
                    className="max-w-xs"
                  />
                  {sortedProvinces.length === 0 ? (
                    <AdminEmptyState icon={MapPin} title="No provinces match your search" />
                  ) : (
                    sortedProvinces.map(([province, disciplines]) => {
                      const sortedDiscs = Object.entries(disciplines).sort((a: any, b: any) => b[1].count - a[1].count);
                      const totalInProvince = sortedDiscs.reduce((s, [, d]: any) => s + d.count, 0);
                      return (
                        <div key={province} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} />
                            <span className="text-sm font-semibold text-black">{province}</span>
                            <Badge variant="outline" className="rounded-none border-black/15 text-[10px] text-slate-500">
                              {totalInProvince} experts
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pl-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                            {sortedDiscs.map(([type, data]: any) => {
                              const key = `${province}-${type}`;
                              const isExpanded = expandedDiscipline === key;
                              return (
                                <div
                                  key={key}
                                  className="cursor-pointer border border-black/10 bg-black/[0.02] p-2.5 transition-colors hover:border-black/25"
                                  onClick={() => setExpandedDiscipline(isExpanded ? null : key)}
                                >
                                  <p className="text-base font-bold text-black">{data.count}</p>
                                  <p className="truncate text-[10px] text-slate-500" title={type}>{type}</p>
                                  {isExpanded && (
                                    <div className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-black/10 pt-2">
                                      {data.experts.map((ex: any) => (
                                        <p key={ex.id} className="truncate text-[10px] text-black">
                                          {ex.first_name} {ex.last_name}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </AdminCardBody>
              )}
            </AdminCard>

            {/* Search & filters */}
            <AdminCard>
              <AdminCardBody className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <AdminSearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search experts by name or discipline…"
                  className="w-full sm:max-w-md"
                />
                <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                  <Select value={provinceFilter} onValueChange={setProvinceFilter}>
                    <SelectTrigger className="h-10 w-full rounded-none border-black/15 sm:w-52">
                      <MapPin className="mr-1 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <SelectValue placeholder="Filter by province" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="h-10 w-24 rounded-none border-black/15">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                      ))}
                      <SelectItem value={String(filtered.length || 1)}>All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </AdminCardBody>
            </AdminCard>

            {/* Expert directory table */}
            <AdminCard>
              <AdminCardHeader icon={Gauge} title="Expert Directory" description={`${filtered.length} matching experts`} />
              {loading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
                </div>
              ) : paginated.length === 0 ? (
                <AdminEmptyState
                  icon={Stethoscope}
                  title="No experts match your filters"
                  description="Try a different name, discipline, or province."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table className="text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-3 [&_th]:text-[11px]">
                    <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.black/10%)]">
                      <TableRow>
                        <TableHead>Expert</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Province</TableHead>
                        <TableHead>Telephone</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Consult Fee</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead className="text-right">Edit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((e) => {
                        const score = scoreForId(e.id);
                        const fee = Number(e.consultation_fees || 0);
                        return (
                          <TableRow key={e.id} className="align-top hover:bg-black/[0.02]">
                            <TableCell>
                              <div className="flex items-start gap-1.5">
                                <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: BRAND_TEAL }} />
                                <span className="break-words font-medium leading-tight text-black">
                                  {e.first_name} {e.last_name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="break-words leading-tight text-slate-500">
                              {formatExpertType(e.expert_type)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-start gap-1">
                                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                                <span className="break-words leading-tight text-slate-500">{e.province || '–'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="break-words leading-tight text-slate-500">{e.phone_masked || '–'}</TableCell>
                            <TableCell className="break-all leading-tight text-slate-500">{e.email_masked || '–'}</TableCell>
                            <TableCell className="whitespace-nowrap text-right text-black">
                              {fee > 0 ? `R${fee.toLocaleString('en-ZA')}` : '–'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Progress value={score} className="h-1.5 w-10" />
                                <span className="text-[11px] font-medium text-black">{score}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(e.id)}
                                className="h-7 w-7 rounded-none p-0"
                                title={`Edit ${e.first_name} ${e.last_name}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
          </TabsContent>

          <TabsContent value="new-expert" className="mt-0 focus-visible:outline-none">
            <Suspense fallback={<TabFallback />}>
              <ExpertFormModule />
            </Suspense>
          </TabsContent>

          {editExpertId && (
            <TabsContent value="edit-expert" className="mt-0 focus-visible:outline-none">
              <Suspense fallback={<TabFallback />}>
                <ExpertFormModule
                  key={editExpertId}
                  editExpertId={editExpertId}
                  onSaved={() => {
                    setEditExpertId(null);
                    setActiveTab('overview');
                    setLoading(true);
                    refetchExperts();
                  }}
                />
              </Suspense>
            </TabsContent>
          )}

          <TabsContent value="credit-control" className="mt-0 focus-visible:outline-none">
            <Suspense fallback={<TabFallback />}>
              <ExpertCreditControlModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="fee-reviews" className="mt-0 focus-visible:outline-none">
            <Suspense fallback={<TabFallback />}>
              <ExpertFeeReviewApprovals />
            </Suspense>
          </TabsContent>
        </div>
      </Tabs>
    </AdminPage>
  );
};

export default AdminExpertNetwork;
