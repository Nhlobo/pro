import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, AlertTriangle, Loader2, Users, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ALL_PROVINCES = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
  'Free State', 'Mpumalanga', 'Limpopo', 'North West', 'Northern Cape',
];

const normalizeProvince = (province: string): string => {
  const p = (province || '').trim().toLowerCase().replace(/[_\-]/g, ' ');
  const map: Record<string, string> = {
    'gauteng': 'Gauteng',
    'guateng': 'Gauteng',
    'limpopo': 'Limpopo',
    'kwazulu natal': 'KwaZulu-Natal',
    'kwazulu-natal': 'KwaZulu-Natal',
    'kwazulu_natal': 'KwaZulu-Natal',
    'kzn': 'KwaZulu-Natal',
    'free state': 'Free State',
    'free_state': 'Free State',
    'western cape': 'Western Cape',
    'eastern cape': 'Eastern Cape',
    'northern cape': 'Northern Cape',
    'north west': 'North West',
    'mpumalanga': 'Mpumalanga',
  };
  return map[p] || province || 'Unknown';
};

interface ProvinceData {
  name: string;
  experts: number;
  demand: number;
  status: string;
  color: string;
  expertsByType: Record<string, number>;
}

const getStatus = (experts: number, demand: number): { status: string; color: string } => {
  if (experts === 0 && demand === 0) return { status: 'inactive', color: 'bg-muted-foreground' };
  if (experts === 0) return { status: 'critical', color: 'bg-destructive' };
  const ratio = experts / Math.max(demand, 1);
  if (demand > 0 && ratio < 0.5) return { status: 'critical', color: 'bg-destructive' };
  if (demand > 0 && ratio < 1) return { status: 'shortage', color: 'bg-warning' };
  return { status: 'balanced', color: 'bg-success' };
};

const AdminHeatmap: React.FC = () => {
  const [provinces, setProvinces] = useState<ProvinceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProvinces, setExpandedProvinces] = useState<Set<string>>(new Set());

  const toggleExpand = (name: string) => {
    setExpandedProvinces(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      // Fetch experts and appointments in parallel
      const [expertsRes, appointmentsRes] = await Promise.all([
        supabase.rpc('get_medical_experts_secure'),
        supabase.from('appointments').select('referring_attorney_id, appointment_date, expert_id').is('deleted_at', null),
      ]);

      const experts = expertsRes.data || [];
      const appointments = appointmentsRes.data || [];

      // Count experts per normalized province and by type
      const expertCounts: Record<string, number> = {};
      const expertsByTypePerProvince: Record<string, Record<string, number>> = {};
      experts.forEach((e: any) => {
        const prov = normalizeProvince(e.province);
        expertCounts[prov] = (expertCounts[prov] || 0) + 1;
        if (!expertsByTypePerProvince[prov]) expertsByTypePerProvince[prov] = {};
        const type = e.expert_type || 'Unknown';
        expertsByTypePerProvince[prov][type] = (expertsByTypePerProvince[prov][type] || 0) + 1;
      });

      // For demand, count appointments per expert's province (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

      const expertProvinceMap: Record<string, string> = {};
      experts.forEach((e: any) => {
        expertProvinceMap[e.id] = normalizeProvince(e.province);
      });

      const demandCounts: Record<string, number> = {};
      appointments.forEach((a: any) => {
        if (new Date(a.appointment_date) >= twelveMonthsAgo) {
          const prov = expertProvinceMap[a.expert_id];
          if (prov) {
            demandCounts[prov] = (demandCounts[prov] || 0) + 1;
          }
        }
      });

      const provinceData: ProvinceData[] = ALL_PROVINCES.map(name => {
        const expCount = expertCounts[name] || 0;
        const demCount = demandCounts[name] || 0;
        const { status, color } = getStatus(expCount, demCount);
        return { name, experts: expCount, demand: demCount, status, color, expertsByType: expertsByTypePerProvince[name] || {} };
      });

      // Sort: critical first, then by demand desc
      provinceData.sort((a, b) => {
        const order: Record<string, number> = { critical: 0, shortage: 1, balanced: 2, inactive: 3 };
        const diff = (order[a.status] ?? 3) - (order[b.status] ?? 3);
        if (diff !== 0) return diff;
        return b.demand - a.demand;
      });

      setProvinces(provinceData);
      setLoading(false);
    };
    fetchData();
  }, []);

  const shortageRegions = provinces.filter(p => p.status === 'critical' || p.status === 'shortage');
  const totalExperts = provinces.reduce((s, p) => s + p.experts, 0);
  const totalDemand = provinces.reduce((s, p) => s + p.demand, 0);

  // Identify provinces with low or zero primary experts
  const primaryShortages = provinces
    .map(p => ({ name: p.name, primary: p.expertsByType['Primary'] || 0, total: p.experts }))
    .filter(p => p.total > 0 || provinces.find(pr => pr.name === p.name)?.demand! > 0)
    .sort((a, b) => a.primary - b.primary);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">National Availability Heatmap</h1>
          <p className="text-sm text-muted-foreground">Real-time expert availability vs appointment demand (last 12 months)</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />{totalExperts} Experts</Badge>
          <Badge variant="outline" className="gap-1"><Calendar className="h-3 w-3" />{totalDemand} Appointments</Badge>
        </div>
      </div>

      {/* Primary Expert Shortage Alerts */}
      {primaryShortages.some(p => p.primary === 0) && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="font-semibold text-foreground">Primary Expert Shortage — No Primary Experts</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {primaryShortages.filter(p => p.primary === 0).map(r => (
                <Badge key={r.name} variant="destructive" className="text-xs">
                  {r.name}: 0 Primary / {r.total} total experts
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {primaryShortages.some(p => p.primary > 0 && p.primary <= 2) && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <span className="font-semibold text-foreground">Primary Expert Shortage — Low Availability</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {primaryShortages.filter(p => p.primary > 0 && p.primary <= 2).map(r => (
                <Badge key={r.name} variant="outline" className="text-xs border-warning text-warning">
                  {r.name}: {r.primary} Primary / {r.total} total experts
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* General Regional Shortage Alerts */}
      {shortageRegions.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="font-semibold text-foreground">Regional Demand Alerts</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {shortageRegions.map(r => (
                <Badge key={r.name} variant="destructive" className="text-xs">
                  {r.name}: {r.experts} experts / {r.demand} appointments
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heatmap Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {provinces.map((prov) => {
          const ratio = prov.experts / Math.max(prov.demand, 1);
          const coveragePct = prov.demand === 0 && prov.experts === 0 ? 0 : prov.demand === 0 ? 100 : Math.round(ratio * 100);
          return (
            <Card key={prov.name} className={`border-border/50 ${prov.status === 'critical' ? 'ring-2 ring-destructive/30' : ''}`}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-foreground">{prov.name}</span>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${prov.color}`} />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-muted/30 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-foreground">{prov.experts}</p>
                    <p className="text-[10px] text-muted-foreground">Total Experts</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-foreground">{prov.expertsByType['Primary'] || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Primary Experts</p>
                  </div>
                </div>
                {Object.keys(prov.expertsByType).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {Object.entries(prov.expertsByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                      <Badge key={type} variant="outline" className="text-[9px] px-1.5 py-0">
                        {type}: {count}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-muted/30 rounded-lg p-2 text-center">
                    <p className="text-sm font-semibold text-foreground">{prov.demand}</p>
                    <p className="text-[10px] text-muted-foreground">Appointments (12m)</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2 text-center">
                    <p className="text-sm font-semibold text-foreground">{coveragePct}%</p>
                    <p className="text-[10px] text-muted-foreground">Coverage</p>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${prov.color}`}
                    style={{ width: `${Math.min(coveragePct, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdminHeatmap;
