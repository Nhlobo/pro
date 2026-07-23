// src/pages/admin/AdminAttorneyCRM.tsx
import React, { lazy, Suspense, useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
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
  MapPin,
  ChevronRight,
} from 'lucide-react';
import MergeAttorneyDialog from '@/components/MergeAttorneyDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { RandSign } from '@/components/icons/RandSign';
import {
  AdminPage,
  AdminCard,
  AdminCardHeader,
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

// Fade + rise-in whenever a tab becomes active — a light-weight "slide"
// feel between panels without pulling in an animation library.
const TAB_CONTENT_CLASS =
  'mt-0 focus-visible:outline-none data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-300';

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

/** Cards-per-slide adapts to viewport so a "page" of the carousel never
 *  needs its own internal scroll — swipe/arrow moves to the next page
 *  instead of scrolling a tall table or list. */
const usePageSize = () => {
  const compute = () => {
    if (typeof window === 'undefined') return 6;
    if (window.matchMedia('(min-width: 1024px)').matches) return 9;
    if (window.matchMedia('(min-width: 640px)').matches) return 6;
    return 4;
  };
  const [size, setSize] = useState(compute);
  useEffect(() => {
    const mqs = [window.matchMedia('(min-width: 1024px)'), window.matchMedia('(min-width: 640px)')];
    const onChange = () => setSize(compute());
    mqs.forEach((mq) => mq.addEventListener('change', onChange));
    return () => mqs.forEach((mq) => mq.removeEventListener('change', onChange));
  }, []);
  return size;
};

type TieredAttorney = AttorneyRow & { tier: TierKey };

const AttorneyCard: React.FC<{ attorney: TieredAttorney; onOpen: (id: string) => void }> = ({ attorney, onOpen }) => {
  const meta = TIER_META[attorney.tier as Exclude<TierKey, 'all'>];
  const score = scoreForId(attorney.id);
  return (
    <button
      type="button"
      onClick={() => onOpen(attorney.id)}
      aria-label={`Open ${attorney.name}`}
      className="group flex h-full w-full flex-col gap-2.5 border border-black/10 bg-white p-3.5 text-left transition-colors hover:border-black/25 hover:bg-black/[0.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BAAD]/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5">
            <Building2 className="h-4 w-4" style={{ color: BRAND_TEAL }} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-black">{attorney.name}</p>
            <p className="truncate text-[11px] text-slate-500">{attorney.contact_person || 'No contact on file'}</p>
          </div>
        </div>
        <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <AdminPill tone={TIER_PILL_TONE[attorney.tier]}>{meta.label}</AdminPill>
        <AdminPill tone="success">
          <RandSign className="mr-0.5 h-3 w-3" />
          Paid
        </AdminPill>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-black/5 pt-2 text-[11px] text-slate-500">
        <span className="inline-flex min-w-0 items-center gap-1">
          <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
          <span className="truncate">{attorney.province || 'No province on file'}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1">
          <TrendingUp className="h-3 w-3 text-emerald-600" />
          <span className="font-medium text-emerald-700">{score}</span>
        </span>
      </div>
    </button>
  );
};

const AttorneyCardGridSkeleton: React.FC<{ count: number }> = ({ count }) => (
  <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="space-y-3 border border-black/10 p-3.5">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-full" />
      </div>
    ))}
  </div>
);

const CRMOverview: React.FC<{ hideList?: boolean }> = ({ hideList }) => {
  const navigate = useNavigate();
  const [attorneys, setAttorneys] = useState<AttorneyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTier, setSelectedTier] = useState<TierKey>('all');
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [api, setApi] = useState<CarouselApi>();
  const [slideIndex, setSlideIndex] = useState(0);
  const pageSize = usePageSize();

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
    (): TieredAttorney[] => attorneys.map((a, i) => ({ ...a, tier: assignTier(i, attorneys.length) })),
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

  const pages = useMemo(() => {
    if (filtered.length === 0) return [[] as TieredAttorney[]];
    const chunks: TieredAttorney[][] = [];
    for (let i = 0; i < filtered.length; i += pageSize) chunks.push(filtered.slice(i, i + pageSize));
    return chunks;
  }, [filtered, pageSize]);

  // Whenever the underlying set of pages changes (search, tier filter,
  // viewport-driven page size, or fresh data), snap the carousel back to
  // the first slide and let it re-measure its slide count.
  useEffect(() => {
    if (!api) return;
    api.reInit();
    api.scrollTo(0);
    setSlideIndex(0);
  }, [pages, api]);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSlideIndex(api.selectedScrollSnap());
    onSelect();
    api.on('select', onSelect);
    api.on('reInit', onSelect);
    return () => { api.off('select', onSelect); };
  }, [api]);

  const openAttorney = useCallback((id: string) => navigate(`/referring-attorney/${id}`), [navigate]);

  const totalPages = pages.length;
  const startIndex = slideIndex * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);

  return (
    <div className="mt-4 space-y-4">
      {/* Tier tiles — click to filter the list below */}
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

      {!hideList && (
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
              <AttorneyCardGridSkeleton count={pageSize} />
            ) : filtered.length === 0 ? (
              <AdminEmptyState
                icon={Building2}
                title="No attorneys found"
                description="Try a different search term or clear the tier filter."
              />
            ) : (
              <Carousel setApi={setApi} opts={{ align: 'start', watchDrag: totalPages > 1 }} className="w-full">
                <CarouselContent className="-ml-0">
                  {pages.map((page, pageIdx) => (
                    <CarouselItem key={pageIdx} className="basis-full pl-0">
                      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                        {page.map((a) => (
                          <AttorneyCard key={a.id} attorney={a} onOpen={openAttorney} />
                        ))}
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
            )}
            {!loading && filtered.length > 0 && (
              <AdminPagination
                page={slideIndex + 1}
                totalPages={totalPages}
                onPageChange={(p) => api?.scrollTo(p - 1)}
                totalItems={filtered.length}
                startIndex={startIndex}
                endIndex={endIndex}
              />
            )}
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
      {/* No in-page title block here on purpose — the sticky teal header
          above already carries "Attorney CRM". This slim row only adds
          what that header doesn't: a one-line orientation note and the
          page's one primary action. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500 sm:text-sm">
          Attorneys, claimants, outreach &amp; pitchlog management
        </p>
        {closedDealsCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClosedDealsClick}
            className="shrink-0 self-start rounded-none border-black/15 sm:self-auto"
          >
            <CheckCircle className="mr-1.5 h-4 w-4 text-emerald-600" />
            <span className="font-semibold">{closedDealsCount}</span>
            <span className="ml-1 text-slate-500">Closed Deals</span>
          </Button>
        )}
      </div>

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
          <TabsContent value="sales-dashboard" className={TAB_CONTENT_CLASS}>
            <Suspense fallback={<TabFallback />}>
              <SalesDashboardModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="overview" className={TAB_CONTENT_CLASS}>
            <CRMOverview hideList={isSales} />
          </TabsContent>

          <TabsContent value="pitchlog" className={TAB_CONTENT_CLASS}>
            <Suspense fallback={<TabFallback />}>
              <AttorneyPitchlogModule defaultTab={pitchlogDefaultTab} />
            </Suspense>
          </TabsContent>

          <TabsContent value="new-claimant" className={TAB_CONTENT_CLASS}>
            <Suspense fallback={<TabFallback />}>
              <ClaimantFormModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="all-claimants" className={TAB_CONTENT_CLASS}>
            <Suspense fallback={<TabFallback />}>
              <ClaimantListModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="new-attorney" className={TAB_CONTENT_CLASS}>
            <Suspense fallback={<TabFallback />}>
              <ReferringAttorneyFormModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="all-attorneys" className={TAB_CONTENT_CLASS}>
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
