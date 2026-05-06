import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, AlertTriangle, Loader2, Users, Calendar, ChevronDown, ChevronUp, Eye, EyeOff, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const PRIMARY_EXPERT_TYPES = ['orthopaedic surgeon', 'neurosurgeon', 'clinical psychologist', 'neurologist'];

const isPrimaryExpert = (expertType: string): boolean => {
  const normalized = (expertType || '').toLowerCase().trim().replace(/[_\-]/g, ' ');
  return PRIMARY_EXPERT_TYPES.some(t => normalized.includes(t) || 
    (t === 'orthopaedic surgeon' && (normalized.includes('orthopedic') || normalized.includes('orthopaedic'))) ||
    (t === 'clinical psychologist' && normalized.includes('clinical psychol'))
  );
};

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

type MatterCategory = 'raf' | 'med_neg' | 'both';

const categorizeMatters = (matterTypes: string[] | null | undefined): MatterCategory => {
  const arr = (matterTypes || []).map(m => (m || '').toLowerCase());
  const hasRaf = arr.some(m => m.includes('mva') || m.includes('raf'));
  const hasMedNeg = arr.some(m => m.includes('med neg') || m.includes('med_neg') || m.includes('medical negligence'));
  if (hasRaf && hasMedNeg) return 'both';
  if (hasMedNeg) return 'med_neg';
  return 'raf';
};

interface ProvinceData {
  name: string;
  experts: number;
  primaryExperts: number;
  rafExperts: number;
  medNegExperts: number;
  bothExperts: number;
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
  const navigate = useNavigate();
  const [provinces, setProvinces] = useState<ProvinceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProvinces, setExpandedProvinces] = useState<Set<string>>(new Set());

  // Section visibility — only the grid is toggleable; the three alert
  // sections (No Primary Experts, Low Primary Availability, Regional
  // Demand Alerts) are permanently hidden per requirement.
  const SECTION_KEYS = ['grid'] as const;
  type SectionKey = typeof SECTION_KEYS[number];
  const [visible, setVisible] = useState<Record<SectionKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem('heatmap_section_visibility');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { grid: parsed.grid ?? true };
      }
    } catch {}
    return { grid: true };
  });

  const toggleSection = (key: SectionKey) => {
    setVisible(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem('heatmap_section_visibility', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const SECTION_LABELS: Record<SectionKey, string> = {
    grid: 'Province Heatmap',
  };

  const toggleExpand = (name: string) => {
    setExpandedProvinces(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      // Fetch experts and demand-by-province in parallel.
      // Demand uses a SECURITY DEFINER RPC so all roles (including sales
      // consultants) see the same appointment counts as admins.
      const [expertsRes, demandRes] = await Promise.all([
        supabase.rpc('get_heatmap_experts_by_province'),
        supabase.rpc('get_heatmap_demand_by_province'),
      ]);

      const expertRows: Array<{ province: string; expert_type: string; expert_count: number }> = (expertsRes.data as any) || [];
      const demandRows: Array<{ province: string; demand: number }> = (demandRes.data as any) || [];

      // Count experts per normalized province and by type
      const expertCounts: Record<string, number> = {};
      const primaryExpertCounts: Record<string, number> = {};
      const expertsByTypePerProvince: Record<string, Record<string, number>> = {};
      expertRows.forEach((e) => {
        const prov = normalizeProvince(e.province);
        const count = Number(e.expert_count || 0);
        expertCounts[prov] = (expertCounts[prov] || 0) + count;
        if (isPrimaryExpert(e.expert_type)) {
          primaryExpertCounts[prov] = (primaryExpertCounts[prov] || 0) + count;
        }
        if (!expertsByTypePerProvince[prov]) expertsByTypePerProvince[prov] = {};
        const type = e.expert_type || 'Unknown';
        expertsByTypePerProvince[prov][type] = (expertsByTypePerProvince[prov][type] || 0) + count;
      });

      // Demand: aggregate counts returned by RPC, normalising province names.
      const demandCounts: Record<string, number> = {};
      demandRows.forEach((r) => {
        const prov = normalizeProvince(r.province);
        demandCounts[prov] = (demandCounts[prov] || 0) + Number(r.demand || 0);
      });

      const provinceData: ProvinceData[] = ALL_PROVINCES.map(name => {
        const expCount = expertCounts[name] || 0;
        const primCount = primaryExpertCounts[name] || 0;
        const demCount = demandCounts[name] || 0;
        const { status, color } = getStatus(expCount, demCount);
        return { name, experts: expCount, primaryExperts: primCount, demand: demCount, status, color, expertsByType: expertsByTypePerProvince[name] || {} };
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
    .map(p => ({ name: p.name, primary: p.primaryExperts, total: p.experts }))
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
      <div>
        <Button variant="outline" size="sm" onClick={() => navigate('/')} className="gap-1">
          <Home className="h-4 w-4" /> Back to Home
        </Button>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">National Availability Heatmap</h1>
          <p className="text-sm text-muted-foreground">Real-time expert availability vs appointment demand (last 12 months)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />{totalExperts} Experts</Badge>
          <Badge variant="outline" className="gap-1"><Calendar className="h-3 w-3" />{totalDemand} Appointments</Badge>
        </div>
      </div>

      {/* Section visibility toggle bar */}
      <Card className="border-border/50">
        <CardContent className="py-2 px-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">Show / Hide:</span>
          {SECTION_KEYS.map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={visible[key] ? 'secondary' : 'outline'}
              onClick={() => toggleSection(key)}
              className="h-7 text-xs gap-1"
            >
              {visible[key] ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {SECTION_LABELS[key]}
            </Button>
          ))}
        </CardContent>
      </Card>


      {/* Heatmap Grid */}
      {visible.grid && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {provinces.map((prov) => {
          const maxExperts = Math.max(...provinces.map(p => p.experts), 1);
          const coveragePct = prov.experts === 0 ? 0 : Math.round((prov.experts / maxExperts) * 100);
          // Categorical coverage: absolute thresholds
          // High: >= 30 experts, Medium: >= 19 experts, Low: <= 18 experts
          const coverageLabel = prov.experts === 0
            ? 'None'
            : prov.experts >= 30 ? 'High' : prov.experts >= 19 ? 'Medium' : 'Low';
          const coverageColor = coverageLabel === 'High'
            ? 'text-success'
            : coverageLabel === 'Medium'
              ? 'text-warning'
              : coverageLabel === 'Low'
                ? 'text-destructive'
                : 'text-muted-foreground';
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
                    <p className="text-lg font-bold text-foreground">{prov.demand}</p>
                    <p className="text-[10px] text-muted-foreground">Assessments (12m)</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-muted/30 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-foreground">{prov.primaryExperts}</p>
                    <p className="text-[10px] text-muted-foreground">Primary Experts</p>
                    <p className="text-[8px] text-muted-foreground/70">(Ortho, Neuro, Psych)</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2 text-center">
                    <p className={`text-sm font-semibold ${coverageColor}`}>{coverageLabel}</p>
                    <p className="text-[10px] text-muted-foreground">Expert Coverage</p>
                  </div>
                </div>
                {Object.keys(prov.expertsByType).length > 0 && (
                  <div className="mb-3">
                    <button
                      onClick={() => toggleExpand(prov.name)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center"
                    >
                      {expandedProvinces.has(prov.name) ? (
                        <><ChevronUp className="h-3 w-3" /> Hide expert types</>
                      ) : (
                        <><ChevronDown className="h-3 w-3" /> Show expert types ({Object.keys(prov.expertsByType).length})</>
                      )}
                    </button>
                    {expandedProvinces.has(prov.name) && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(prov.expertsByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                          <Badge key={type} variant="outline" className="text-[9px] px-1.5 py-0">
                            {type}: {count}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
      )}
    </div>
  );
};

export default AdminHeatmap;
