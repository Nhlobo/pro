// src/pages/admin/AdminAttorneyCRM.tsx
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs';
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
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import MergeAttorneyDialog from '@/components/MergeAttorneyDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { RandSign } from '@/components/icons/RandSign';
import {
  AdminPage,
  AdminCard,
  AdminCardHeader,
  AdminPill,
  AdminEmptyState,
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

const PAGE_SIZE = 12;

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
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : paginated.length === 0 ? (
              <AdminEmptyState
                icon={Building2}
                title="No attorneys found"
                description="Try a different search term or clear the tier filter."
              />
            ) : (
              // Card grid instead of a wide table — every field stays readable
              // without horizontal or long vertical scrolling, and it scales
              // cleanly from a single phone column up to a 3-up desktop grid.
              <div className="grid grid-cols-1 gap-px bg-black/10 p-px sm:grid-cols-2 xl:grid-cols-3">
                {paginated.map((a) => {
                  const meta = TIER_META[a.tier as Exclude<TierKey, 'all'>];
                  const score = scoreForId(a.id);
                  return (
                    <div key={a.id} className="flex flex-col gap-2.5 bg-white p-4 transition-colors hover:bg-black/[0.02]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate font-semibold text-black">{a.name}</span>
                        </div>
                        <AdminPill tone={TIER_PILL_TONE[a.tier]} className="shrink-0">{meta.label}</AdminPill>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500">
                        <div className="truncate">
                          <span className="text-slate-400">Contact </span>
                          {a.contact_person || '–'}
                        </div>
                        <div className="truncate">
                          <span className="text-slate-400">Province </span>
                          {a.province || '–'}
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-black/5 pt-2.5">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-emerald-600" />
                          <span className="text-xs font-medium text-emerald-700">{score} score</span>
                        </div>
                        <AdminPill tone="success">
                          <RandSign className="mr-0.5 h-3 w-3" />
                          Paid
                        </AdminPill>
                      </div>
                    </div>
                  );
                })}
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

/* ------------------------------------------------------------------ */
/* Module switcher — a permanently horizontally-sliding pill strip     */
/* (not a breakpoint-dependent grid) so the seven CRM sections always  */
/* read as "swipe/scroll to see more" instead of getting cramped at    */
/* tablet widths. The active pill is kept centred in view, and swiping */
/* left/right anywhere in the panel below also advances tabs — giving  */
/* the whole page a native, sliding, app-like feel on touch devices.   */
/* ------------------------------------------------------------------ */

interface CRMTab {
  value: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

const SWIPE_MIN_DISTANCE = 55;
const SWIPE_MAX_OFF_AXIS = 40;

const AdminAttorneyCRM: React.FC = () => {
  const { isSalesConsultant } = usePermissions();
  const isSales = isSalesConsultant();
  const [activeTab, setActiveTab] = useState('sales-dashboard');
  const [pitchlogDefaultTab, setPitchlogDefaultTab] = useState<string | undefined>(undefined);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right');

  const tabStripRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

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

  const CRM_TABS: CRMTab[] = useMemo(() => [
    { value: 'sales-dashboard', label: 'Sales Dashboard', icon: BarChart3 },
    { value: 'pitchlog', label: 'Pitchlog', icon: Briefcase, badge: closedDealsCount > 0 ? `${closedDealsCount} closed` : undefined },
    { value: 'overview', label: 'CRM Overview', icon: Building2 },
    { value: 'new-claimant', label: 'New Claimant', icon: UserPlus },
    { value: 'all-claimants', label: 'All Claimants', icon: List },
    { value: 'new-attorney', label: 'New Attorney', icon: UserPlus },
    { value: 'all-attorneys', label: 'All Attorneys', icon: Users },
  ], [closedDealsCount]);

  const goToTab = (value: string) => {
    const fromIndex = CRM_TABS.findIndex((t) => t.value === activeTab);
    const toIndex = CRM_TABS.findIndex((t) => t.value === value);
    setSlideDir(toIndex >= fromIndex ? 'right' : 'left');
    setActiveTab(value);
    if (value !== 'pitchlog') setPitchlogDefaultTab(undefined);
  };

  // Keep the active pill scrolled into view as tabs change (e.g. via the
  // "Closed Deals" shortcut, which jumps straight to Pitchlog).
  useEffect(() => {
    const active = tabStripRef.current?.querySelector('[data-state="active"]') as HTMLElement | null;
    active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeTab]);

  const handleClosedDealsClick = () => {
    setPitchlogDefaultTab('sales-report');
    goToTab('pitchlog');
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    // Don't hijack swipes that start on something meant to be dragged/
    // scrolled itself (inputs, sliders, horizontally-scrollable tables).
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [role="slider"], .overflow-x-auto, [data-swipe-ignore]')) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dy) > SWIPE_MAX_OFF_AXIS) return;

    const currentIndex = CRM_TABS.findIndex((t) => t.value === activeTab);
    if (dx < 0 && currentIndex < CRM_TABS.length - 1) {
      goToTab(CRM_TABS[currentIndex + 1].value);
    } else if (dx > 0 && currentIndex > 0) {
      goToTab(CRM_TABS[currentIndex - 1].value);
    }
  };

  const slideClass = slideDir === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left';

  return (
    <AdminPage className="max-w-7xl">
      {/* Slim contextual bar — the sticky teal header above already carries
          the "Attorney CRM" title, so this row only adds what it doesn't:
          a one-line description and the closed-deals shortcut. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500 sm:text-sm">
          Attorneys, claimants, outreach &amp; pitchlog management
        </p>
        {closedDealsCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClosedDealsClick}
            className="w-fit rounded-none border-black/15"
          >
            <CheckCircle className="mr-1.5 h-4 w-4 text-emerald-600" />
            <span className="font-semibold">{closedDealsCount}</span>
            <span className="ml-1 text-slate-500">Closed Deals</span>
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={goToTab} className="w-full">
        <div
          ref={tabStripRef}
          className="sticky top-0 z-20 -mx-3 overflow-x-auto scroll-smooth px-3 py-2 sm:mx-0 sm:px-0
                     [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
                     bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
        >
          <TabsList className="flex h-auto w-max items-stretch gap-1 rounded-none border border-black/10 bg-white p-1">
            {CRM_TABS.map((t) => (
              <AdminTabTrigger key={t.value} value={t.value} label={t.label} icon={t.icon} badge={t.badge} />
            ))}
          </TabsList>
        </div>

        <div
          className="mt-3"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <TabsContent value="sales-dashboard" className={cn('mt-0 focus-visible:outline-none', slideClass)}>
            <Suspense fallback={<TabFallback />}>
              <SalesDashboardModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="overview" className={cn('mt-0 focus-visible:outline-none', slideClass)}>
            <CRMOverview hideTable={isSales} />
          </TabsContent>

          <TabsContent value="pitchlog" className={cn('mt-0 focus-visible:outline-none', slideClass)}>
            <Suspense fallback={<TabFallback />}>
              <AttorneyPitchlogModule defaultTab={pitchlogDefaultTab} />
            </Suspense>
          </TabsContent>

          <TabsContent value="new-claimant" className={cn('mt-0 focus-visible:outline-none', slideClass)}>
            <Suspense fallback={<TabFallback />}>
              <ClaimantFormModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="all-claimants" className={cn('mt-0 focus-visible:outline-none', slideClass)}>
            <Suspense fallback={<TabFallback />}>
              <ClaimantListModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="new-attorney" className={cn('mt-0 focus-visible:outline-none', slideClass)}>
            <Suspense fallback={<TabFallback />}>
              <ReferringAttorneyFormModule />
            </Suspense>
          </TabsContent>

          <TabsContent value="all-attorneys" className={cn('mt-0 focus-visible:outline-none', slideClass)}>
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
