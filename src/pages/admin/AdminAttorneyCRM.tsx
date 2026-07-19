// src/pages/admin/AdminAttorneyCRM.tsx
import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  Star,
  TrendingUp,
  Building2,
  UserPlus,
  List,
  Briefcase,
  GitMerge,
  CheckCircle,
  BarChart3,
} from 'lucide-react';
import MergeAttorneyDialog from '@/components/MergeAttorneyDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { RandSign } from '@/components/icons/RandSign';
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminPill,
  AdminEmptyState,
  AdminTabList,
  AdminTabTrigger,
  AdminSearchInput,
  AdminPagination,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

const SalesDashboardModule = lazy(() => import('@/pages/SalesDashboard'));
const AttorneyPitchlogModule = lazy(() => import('@/components/admin/AttorneyPitchlogModule'));
const ClaimantFormModule = lazy(() => import('@/components/admin/ClaimantFormModule'));
const ClaimantListModule = lazy(() => import('@/components/admin/ClaimantListModule'));
const ReferringAttorneyFormModule = lazy(() => import('@/components/admin/ReferringAttorneyFormModule'));
const ReferringAttorneyListModule = lazy(() => import('@/components/admin/ReferringAttorneyListModule'));

interface AttorneyRow {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  province: string | null;
}

const TabFallback = () => (
  <div className="space-y-4 border border-black/10 bg-white p-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-24" />
    </div>
    <Skeleton className="h-64 w-full" />
  </div>
);

type TierKey = 'all' | 'preferred' | 'active' | 'occasional' | 'new';

const assignTier = (index: number, total: number): TierKey => {
  const pct = index / total;
  if (pct < 0.15) return 'preferred';
  if (pct < 0.70) return 'active';
  if (pct < 0.90) return 'occasional';
  return 'new';
};

const TIER_META: Record<Exclude<TierKey, 'all'>, { label: string; icon: typeof Star }> = {
  preferred: { label: 'Preferred Partner', icon: Star },
  active: { label: 'Active', icon: TrendingUp },
  occasional: { label: 'Occasional', icon: Building2 },
  new: { label: 'New / Probationary', icon: UserPlus },
};

const TIER_PILL_TONE: Record<TierKey, 'neutral' | 'teal' | 'success' | 'warning' | 'destructive'> = {
  all: 'neutral',
  preferred: 'teal',
  active: 'success',
  occasional: 'warning',
  new: 'neutral',
};

/** Deterministic placeholder score/deposit-status per attorney id — stable
 *  across re-renders instead of reshuffling on every keystroke. */
const hashOf = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
};
const scoreForId = (id: string) => 70 + (hashOf(id) % 30);

const PAGE_SIZE = 25;

const CRMOverview: React.FC<{ hideTable?: boolean }> = ({ hideTable }) => {
  const [attorneys, setAttorneys] = useState<AttorneyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTier, setSelectedTier] = useState<TierKey>('all');
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchAttorneys = async () => {
    const { data } = await supabase
      .from('referring_attorneys')
      .select('id, name, contact_person, email, phone, province')
      .order('name');
    setAttorneys(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAttorneys(); }, []);

  const attorneyTiers = useMemo(
    () => attorneys.map((a, i) => ({ ...a, tier: assignTier(i, attorneys.length) })),
    [attorneys]
  );

  const tierCounts = useMemo(() => {
    const counts: Record<Exclude<TierKey, 'all'>, number> = { preferred: 0, active: 0, occasional: 0, new: 0 };
    attorneyTiers.forEach((a) => { counts[a.tier as Exclude<TierKey, 'all'>] += 1; });
    return counts;
  }, [attorneyTiers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attorneyTiers.filter((a) => {
      const matchesSearch = !q ||
        a.name?.toLowerCase().includes(q) ||
        a.contact_person?.toLowerCase().includes(q);
      const matchesTier = selectedTier === 'all' || a.tier === selectedTier;
      return matchesSearch && matchesTier;
    });
  }, [attorneyTiers, search, selectedTier]);

  useEffect(() => { setCurrentPage(1); }, [search, selectedTier]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginated = useMemo(() => filtered.slice(startIndex, endIndex), [filtered, startIndex, endIndex]);

  return (
    <div className="mt-4 space-y-4">
      {/* Tier tiles — click to filter the table below */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(Object.keys(TIER_META) as Exclude<TierKey, 'all'>[]).map((key) => {
          const meta = TIER_META[key];
          const isActive = selectedTier === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedTier(isActive ? 'all' : key)}
              className="text-left"
            >
              <AdminCard className={`h-full transition-colors hover:border-black/25 ${isActive ? 'border-black' : ''}`}>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5">
                    <meta.icon className="h-4 w-4" style={{ color: BRAND_TEAL }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold text-black">{loading ? '–' : tierCounts[key]}</p>
                    <p className="truncate text-[11px] text-slate-500">{meta.label}</p>
                  </div>
                </div>
              </AdminCard>
            </button>
          );
        })}
      </div>

      {!hideTable && (
        <>
          <MergeAttorneyDialog
            open={showMergeDialog}
            onOpenChange={setShowMergeDialog}
            onMergeComplete={fetchAttorneys}
          />

          <AdminCard>
            <AdminCardHeader
              icon={Building2}
              title="Referring Attorneys"
              description={
                selectedTier === 'all'
                  ? `${filtered.length} attorneys`
                  : `${filtered.length} attorneys · filtered by ${TIER_META[selectedTier as Exclude<TierKey, 'all'>].label}`
              }
              actions={
                <>
                  <AdminSearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search attorneys…"
                    className="w-full sm:w-64"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-none border-black/15"
                    onClick={() => setShowMergeDialog(true)}
                  >
                    <GitMerge className="mr-1.5 h-3.5 w-3.5" />
                    Merge Duplicates
                  </Button>
                </>
              }
            />
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : paginated.length === 0 ? (
              <AdminEmptyState
                icon={Building2}
                title="No attorneys found"
                description="Try a different search term or clear the tier filter."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table className="text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-3 [&_th]:text-[11px]">
                  <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.black/10%)]">
                    <TableRow>
                      <TableHead>Firm</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Province</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Deposit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((a) => {
                      const meta = TIER_META[a.tier as Exclude<TierKey, 'all'>];
                      const score = scoreForId(a.id);
                      return (
                        <TableRow key={a.id} className="hover:bg-black/[0.02]">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                              <span className="font-medium text-black">{a.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-500">{a.contact_person || '–'}</TableCell>
                          <TableCell className="text-slate-500">{a.province || '–'}</TableCell>
                          <TableCell>
                            <AdminPill tone={TIER_PILL_TONE[a.tier]}>{meta.label}</AdminPill>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-emerald-600" />
                              <span className="font-medium text-emerald-700">{score}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <AdminPill tone="success">
                              <RandSign className="mr-0.5 h-3 w-3" />
                              Paid
                            </AdminPill>
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
        </>
      )}
    </div>
  );
};

const AdminAttorneyCRM: React.FC = () => {
  const { isSalesConsultant } = usePermissions();
  const isSales = isSalesConsultant();
  const [activeTab, setActiveTab] = useState('sales-dashboard');
  const [pitchlogDefaultTab, setPitchlogDefaultTab] = useState<string | undefined>(undefined);

  // Fetch closed deals count (pitchlog entries matched to referring attorneys with scheduled appointments)
  const { data: closedDealsCount = 0 } = useQuery({
    queryKey: ['crm-closed-deals-count'],
    queryFn: async () => {
      const [{ data: pitchEntries }, { data: attorneys }, { data: appointments }] = await Promise.all([
        supabase.from('attorney_pitchlog').select('id, law_firm_name, matched_referring_attorney_id'),
        supabase.from('referring_attorneys').select('id, name'),
        supabase.from('appointments').select('id, referring_attorney_id').is('deleted_at', null).eq('case_status', 'scheduled'),
      ]);

      const apptCountByRA: Record<string, number> = {};
      (appointments || []).forEach((a) => {
        apptCountByRA[a.referring_attorney_id] = (apptCountByRA[a.referring_attorney_id] || 0) + 1;
      });
      const raIdsWithAppts = new Set(Object.keys(apptCountByRA));
      const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
      const seenRA = new Set<string>();
      let count = 0;

      for (const entry of (pitchEntries || [])) {
        let matchedId: string | undefined;
        if (entry.matched_referring_attorney_id) {
          if (raIdsWithAppts.has(entry.matched_referring_attorney_id)) matchedId = entry.matched_referring_attorney_id;
        }
        if (!matchedId && entry.law_firm_name) {
          const match = (attorneys || []).find((ra) =>
            normalise(ra.name).includes(normalise(entry.law_firm_name)) ||
            normalise(entry.law_firm_name).includes(normalise(ra.name))
          );
          if (match && raIdsWithAppts.has(match.id)) matchedId = match.id;
        }
        if (matchedId && !seenRA.has(matchedId)) {
          seenRA.add(matchedId);
          count += apptCountByRA[matchedId] || 1;
        }
      }
      return count;
    },
  });

  const handleClosedDealsClick = () => {
    setPitchlogDefaultTab('sales-report');
    setActiveTab('pitchlog');
  };

  return (
    <AdminPage className="max-w-7xl">
      <AdminHeader
        eyebrow="Relationships"
        title="Attorney CRM"
        description="Attorneys, claimants, outreach & pitchlog management"
        icon={Users}
        actions={
          closedDealsCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClosedDealsClick}
              className="rounded-none border-black/15"
            >
              <CheckCircle className="mr-1.5 h-4 w-4 text-emerald-600" />
              <span className="font-semibold">{closedDealsCount}</span>
              <span className="ml-1 text-slate-500">Closed Deals</span>
            </Button>
          ) : undefined
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => { setActiveTab(v); if (v !== 'pitchlog') setPitchlogDefaultTab(undefined); }}
        className="w-full"
      >
        <AdminTabList sticky columns={7}>
          <AdminTabTrigger value="sales-dashboard" label="Sales Dashboard" icon={BarChart3} center />
          <AdminTabTrigger
            value="pitchlog"
            label="Pitchlog"
            icon={Briefcase}
            badge={closedDealsCount > 0 ? `${closedDealsCount} closed` : undefined}
            center
          />
          <AdminTabTrigger value="overview" label="CRM Overview" icon={Building2} center />
          <AdminTabTrigger value="new-claimant" label="New Claimant" icon={UserPlus} center />
          <AdminTabTrigger value="all-claimants" label="All Claimants" icon={List} center />
          <AdminTabTrigger value="new-attorney" label="New Attorney" icon={UserPlus} center />
          <AdminTabTrigger value="all-attorneys" label="All Attorneys" icon={Users} center />
        </AdminTabList>

        <div className="mt-0">
          <TabsContent value="sales-dashboard" className="mt-0 focus-visible:outline-none">
            <Suspense fallback={<TabFallback />}>
              <SalesDashboardModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
            <CRMOverview hideTable={isSales} />
          </TabsContent>

          <TabsContent value="pitchlog" className="mt-0 focus-visible:outline-none">
            <Suspense fallback={<TabFallback />}>
              <AttorneyPitchlogModule defaultTab={pitchlogDefaultTab} />
            </Suspense>
          </TabsContent>

          <TabsContent value="new-claimant" className="mt-0 focus-visible:outline-none">
            <Suspense fallback={<TabFallback />}>
              <ClaimantFormModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="all-claimants" className="mt-0 focus-visible:outline-none">
            <Suspense fallback={<TabFallback />}>
              <ClaimantListModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="new-attorney" className="mt-0 focus-visible:outline-none">
            <Suspense fallback={<TabFallback />}>
              <ReferringAttorneyFormModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="all-attorneys" className="mt-0 focus-visible:outline-none">
            <Suspense fallback={<TabFallback />}>
              <ReferringAttorneyListModule />
            </Suspense>
          </TabsContent>
        </div>
      </Tabs>
    </AdminPage>
  );
};

export default AdminAttorneyCRM;
