// src/pages/admin/AdminHeatmap.tsx
import React, { useMemo, useState } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  MapPin, Users, Calendar, Search, RefreshCw, ShieldAlert, CheckCircle2,
  ArrowUpDown, ChevronRight,
} from 'lucide-react';
import {
  useHeatmapData, STATUS_META, ProvinceData, MatterCategory,
} from '@/hooks/useHeatmapData';
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminStatCard,
  AdminPill,
  AdminEmptyState,
  AdminLoadingState,
  AdminSectionLabel,
  AdminTabList,
  AdminTabTrigger,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

const MATTER_FILTERS: { value: 'all' | MatterCategory; label: string }[] = [
  { value: 'all', label: 'All Experts' },
  { value: 'raf', label: 'RAF' },
  { value: 'med_neg', label: 'Med Neg' },
  { value: 'both', label: 'Both' },
];

type SortKey = 'priority' | 'name' | 'demand' | 'coverage';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'priority', label: 'Priority (default)' },
  { value: 'name', label: 'Province name' },
  { value: 'demand', label: 'Demand (high → low)' },
  { value: 'coverage', label: 'Coverage (low → high)' },
];

const PRIORITY_ORDER: Record<ProvinceData['status'], number> = { critical: 0, shortage: 1, balanced: 2, inactive: 3 };

/**
 * Availability Heatmap.
 *
 * Previous structure: every province rendered as a large multi-section
 * card (primary counts, matter breakdown, primary experts, collapsible
 * expert-type list, coverage bar) all at once — 9 provinces meant 9 heavy
 * cards on screen simultaneously.
 *
 * New structure: a single-column, sortable row list. Each row shows the
 * essentials (status, coverage bar, expert/demand counts) at a glance;
 * the full breakdown (matter split, primary experts, expert-type list)
 * moves into a detail sheet opened on click. Same underlying data,
 * same thresholds, same counts — just far less DOM at rest, and a
 * genuinely faster scan across all nine provinces.
 */
const AdminHeatmap: React.FC = () => {
  const {
    provinces, loading, refreshing, refetch,
    totalExperts, totalDemand, criticalCount, balancedCount, matterCounts,
  } = useHeatmapData();

  const [matterFilter, setMatterFilter] = useState<'all' | MatterCategory>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [detailProvince, setDetailProvince] = useState<ProvinceData | null>(null);

  const getDisplayCount = (p: ProvinceData) => {
    if (matterFilter === 'raf') return p.rafExperts;
    if (matterFilter === 'med_neg') return p.medNegExperts;
    if (matterFilter === 'both') return p.bothExperts;
    return p.experts;
  };

  const maxDisplayCount = useMemo(
    () => Math.max(...provinces.map(p => getDisplayCount(p)), 1),
    [provinces, matterFilter],
  );

  const visibleProvinces = useMemo(() => {
    let list = provinces;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sortKey === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortKey === 'demand') {
      sorted.sort((a, b) => b.demand - a.demand);
    } else if (sortKey === 'coverage') {
      sorted.sort((a, b) => getDisplayCount(a) - getDisplayCount(b));
    } else {
      sorted.sort((a, b) => {
        const diff = PRIORITY_ORDER[a.status] - PRIORITY_ORDER[b.status];
        return diff !== 0 ? diff : b.demand - a.demand;
      });
    }
    return sorted;
  }, [provinces, search, sortKey, matterFilter]);

  if (loading) {
    return (
      <AdminPage className="max-w-6xl">
        <AdminHeader eyebrow="Intelligence" title="Availability Heatmap" description="Loading national coverage data…" icon={MapPin} />
        <AdminCard><AdminLoadingState label="Crunching expert coverage vs. demand…" /></AdminCard>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="max-w-6xl">
      <AdminHeader
        eyebrow="Intelligence"
        title="Availability Heatmap"
        description="Real-time expert availability vs. appointment demand, by province (last 12 months)"
        icon={MapPin}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="rounded-none border-black/15 text-black hover:bg-black/5"
            onClick={() => void refetch()}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AdminStatCard label="Total Experts" value={totalExperts} icon={Users} />
        <AdminStatCard label="Appointments (12m)" value={totalDemand} icon={Calendar} />
        <AdminStatCard label="Critical Regions" value={criticalCount} icon={ShieldAlert} hint={criticalCount > 0 ? 'Needs attention' : 'None right now'} />
        <AdminStatCard label="Balanced Regions" value={balancedCount} icon={CheckCircle2} hint={`of ${provinces.length} provinces`} />
      </div>

      {/* Controls */}
      <AdminCard>
        <div className="flex flex-col gap-3 p-3">
          <Tabs value={matterFilter} onValueChange={(v) => setMatterFilter(v as typeof matterFilter)}>
            <AdminTabList>
              {MATTER_FILTERS.map(f => (
                <AdminTabTrigger key={f.value} value={f.value} label={f.label} badge={matterCounts[f.value]} />
              ))}
            </AdminTabList>
          </Tabs>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter provinces…"
                className="h-9 rounded-none border-black/15 pl-8 text-sm"
              />
            </div>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="h-9 w-full rounded-none border-black/15 sm:w-56">
                <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </AdminCard>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Coverage status</span>
        {(Object.keys(STATUS_META) as ProvinceData['status'][]).map((s) => (
          <AdminPill key={s} tone={STATUS_META[s].tone}>{STATUS_META[s].label}</AdminPill>
        ))}
      </div>

      {/* Province row list */}
      {visibleProvinces.length === 0 ? (
        <AdminCard>
          <AdminEmptyState icon={Search} title="No provinces match your search" description="Try a different search term." />
        </AdminCard>
      ) : (
        <div>
          <AdminSectionLabel>Province Breakdown ({visibleProvinces.length})</AdminSectionLabel>
          <AdminCard className="mt-3 divide-y divide-black/10">
            {visibleProvinces.map((prov) => {
              const meta = STATUS_META[prov.status];
              const displayCount = getDisplayCount(prov);
              const coveragePct = displayCount === 0 ? 0 : Math.round((displayCount / maxDisplayCount) * 100);

              return (
                <button
                  key={prov.name}
                  type="button"
                  onClick={() => setDetailProvince(prov)}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-black/[0.03]"
                >
                  <MapPin className="h-4 w-4 shrink-0" style={{ color: BRAND_TEAL }} />
                  <div className="w-36 shrink-0 sm:w-44">
                    <p className="truncate text-sm font-semibold text-black">{prov.name}</p>
                    <AdminPill tone={meta.tone} className="mt-1">{meta.label}</AdminPill>
                  </div>

                  <div className="hidden flex-1 items-center gap-2 sm:flex">
                    <div className="h-1.5 flex-1 overflow-hidden bg-black/10">
                      <div
                        className={`h-full transition-all ${
                          meta.tone === 'destructive' ? 'bg-destructive' :
                          meta.tone === 'warning' ? 'bg-warning' :
                          meta.tone === 'success' ? 'bg-success' : 'bg-slate-300'
                        }`}
                        style={{ width: `${Math.min(coveragePct, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-4 text-right text-sm">
                    <div>
                      <p className="font-bold tabular-nums text-black">{displayCount}</p>
                      <p className="text-[10px] text-slate-400">Experts</p>
                    </div>
                    <div>
                      <p className="font-bold tabular-nums text-black">{prov.demand}</p>
                      <p className="text-[10px] text-slate-400">Demand (12m)</p>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              );
            })}
          </AdminCard>
        </div>
      )}

      {/* Province detail */}
      <Sheet open={!!detailProvince} onOpenChange={(open) => { if (!open) setDetailProvince(null); }}>
        <SheetContent side="right" className="flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-lg">
          {detailProvince && (
            <>
              <SheetHeader className="border-b border-black/10 px-5 py-4 text-left">
                <SheetTitle className="flex items-center gap-2 text-black">
                  <MapPin className="h-4 w-4" style={{ color: BRAND_TEAL }} />
                  {detailProvince.name}
                </SheetTitle>
                <SheetDescription>Full coverage breakdown for the last 12 months.</SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-4 px-5 py-4">
                <AdminPill tone={STATUS_META[detailProvince.status].tone}>{STATUS_META[detailProvince.status].label}</AdminPill>

                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-black/10 bg-black/[0.02] px-3 py-2 text-center">
                    <p className="text-lg font-bold tabular-nums text-black">{detailProvince.experts}</p>
                    <p className="text-[10px] leading-tight text-slate-500">Total Experts</p>
                  </div>
                  <div className="border border-black/10 bg-black/[0.02] px-3 py-2 text-center">
                    <p className="text-lg font-bold tabular-nums text-black">{detailProvince.demand}</p>
                    <p className="text-[10px] leading-tight text-slate-500">Assessments (12m)</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <div className="border border-black/10 px-1.5 py-1.5 text-center">
                    <p className="text-sm font-bold tabular-nums" style={{ color: BRAND_TEAL }}>{detailProvince.rafExperts}</p>
                    <p className="text-[9px] leading-tight text-slate-500">RAF</p>
                  </div>
                  <div className="border border-black/10 px-1.5 py-1.5 text-center">
                    <p className="text-sm font-bold tabular-nums text-warning">{detailProvince.medNegExperts}</p>
                    <p className="text-[9px] leading-tight text-slate-500">Med Neg</p>
                  </div>
                  <div className="border border-black/10 px-1.5 py-1.5 text-center">
                    <p className="text-sm font-bold tabular-nums text-success">{detailProvince.bothExperts}</p>
                    <p className="text-[9px] leading-tight text-slate-500">Both</p>
                  </div>
                </div>

                <div className="border border-black/10 bg-black/[0.02] px-3 py-2 text-center">
                  <p className="text-lg font-bold tabular-nums text-black">{detailProvince.primaryExperts}</p>
                  <p className="text-[10px] leading-tight text-slate-500">Primary Experts</p>
                  <p className="text-[9px] leading-tight text-slate-400">(Ortho, Neuro, Psych)</p>
                </div>

                {Object.entries(detailProvince.expertsByType).length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Expert types</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(detailProvince.expertsByType)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, count]) => (
                          <AdminPill key={type} tone="neutral">{type}: {count}</AdminPill>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AdminPage>
  );
};

export default AdminHeatmap;
