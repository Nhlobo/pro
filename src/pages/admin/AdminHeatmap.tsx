import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

import { STATUS_META, type MatterCategory, type ProvinceData, useHeatmapData } from '@/hooks/useHeatmapData';

const statusCardClass: Record<ProvinceData['status'], string> = {
  critical: 'border-red-300 bg-red-50/80 dark:border-red-900 dark:bg-red-950/30',
  shortage: 'border-amber-300 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30',
  balanced: 'border-emerald-300 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30',
  inactive: 'border-slate-300 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/40',
};

const matterLabels: Record<'all' | MatterCategory, string> = {
  all: 'All',
  raf: 'RAF',
  med_neg: 'Medical Negligence',
  both: 'Both',
};

function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function ProvinceCard({ province }: { province: ProvinceData }) {
  const meta = STATUS_META[province.status];

  return (
    <Card className={`h-full transition-colors ${statusCardClass[province.status]}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{province.name}</CardTitle>
          <Badge variant={meta.tone === 'destructive' ? 'destructive' : 'secondary'}>{meta.label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2 text-muted-foreground">
          <span>Total experts</span>
          <span className="text-right font-medium text-foreground">{province.experts}</span>
          <span>12m demand</span>
          <span className="text-right font-medium text-foreground">{province.demand}</span>
          <span>Primary experts</span>
          <span className="text-right font-medium text-foreground">{province.primaryExperts}</span>
        </div>

        <Separator />

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">RAF</p>
            <p className="text-base font-semibold">{province.rafExperts}</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">Med Neg</p>
            <p className="text-base font-semibold">{province.medNegExperts}</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">Both</p>
            <p className="text-base font-semibold">{province.bothExperts}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminHeatmap() {
  const {
    provinces,
    loading,
    refreshing,
    refetch,
    totalExperts,
    totalDemand,
    criticalCount,
    balancedCount,
    matterCounts,
  } = useHeatmapData();

  const ordered = useMemo(() => {
    return [...provinces].sort((a, b) => {
      const priority: Record<ProvinceData['status'], number> = { critical: 0, shortage: 1, balanced: 2, inactive: 3 };
      if (priority[a.status] !== priority[b.status]) return priority[a.status] - priority[b.status];
      return a.name.localeCompare(b.name);
    });
  }, [provinces]);

  return (
    <div className="space-y-6 p-4 md:p-6 xl:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Availability Heatmap</h1>
          <p className="text-sm text-muted-foreground">
            Province-level expert supply vs attorney demand (last 12 months).
          </p>
        </div>

        <Button onClick={() => refetch()} disabled={loading || refreshing} className="w-full md:w-auto">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Experts" value={totalExperts} />
        <KpiCard label="Total Demand (12m)" value={totalDemand} />
        <KpiCard label="Critical Provinces" value={criticalCount} hint="Immediate shortage pressure" />
        <KpiCard label="Balanced Provinces" value={balancedCount} />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(Object.keys(matterCounts) as Array<'all' | MatterCategory>).map((key) => (
          <Card key={key}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{matterLabels[key]}</p>
              <p className="text-xl font-semibold">{matterCounts[key]}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Card key={i} className="h-[170px] animate-pulse">
                <CardContent className="h-full p-4" />
              </Card>
            ))}
          </div>
        ) : ordered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No province data available yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {ordered.map((province) => (
              <ProvinceCard key={province.name} province={province} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
