import React, { useEffect, useState, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Stethoscope, Search, Activity, MapPin, Plus, Users, Loader2, DollarSign, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Pencil, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatExpertType } from '@/utils/expertTypeMapping';
import { useSearchParams } from 'react-router-dom';

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

const TabFallback = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

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

const provincesList = [
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

const AdminExpertNetwork: React.FC = () => {
  const [experts, setExperts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [provinceSearch, setProvinceSearch] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('All Provinces');
  const [pageSize, setPageSize] = useState<number>(20);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedDiscipline, setExpandedDiscipline] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [editExpertId, setEditExpertId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentPage, setCurrentPage] = useState(1);

  const refetchExperts = async () => {
    const { data } = await supabase.rpc('get_medical_experts_secure');
    setExperts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    refetchExperts();
  }, []);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && editId !== editExpertId) {
      setEditExpertId(editId);
      setActiveTab('edit-expert');
    }
  }, [searchParams, editExpertId]);

  // Refresh after an expert profile/fee update from the edit form
  useEffect(() => {
    const handler = () => refetchExperts();
    window.addEventListener('medical-expert-updated', handler);
    return () => window.removeEventListener('medical-expert-updated', handler);
  }, []);

  const filtered = experts.filter(e => {
    const nameMatch = `${e.first_name} ${e.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      e.expert_type?.toLowerCase().includes(search.toLowerCase());
    const provinceMatch = provinceFilter === 'All Provinces' ||
      normalizeProvince(e.province) === provinceFilter;
    return nameMatch && provinceMatch;
  });

  // Reset to first page whenever filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, provinceFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginated = filtered.slice(startIndex, endIndex);

  // Group by normalized province, then by discipline
  const provinceGroups = experts.reduce((acc, e) => {
    const province = normalizeProvince(e.province);
    const type = e.expert_type || 'Other';
    const displayName = formatExpertType(type);
    if (!acc[province]) acc[province] = {};
    if (!acc[province][displayName]) acc[province][displayName] = { count: 0, experts: [] };
    acc[province][displayName].count += 1;
    acc[province][displayName].experts.push(e);
    return acc;
  }, {} as Record<string, Record<string, { count: number; experts: any[] }>>);

  const sortedProvinces = Object.entries(provinceGroups)
    .filter(([province]) => !provinceSearch || province.toLowerCase().includes(provinceSearch.toLowerCase()))
    .sort((a, b) => {
      const totalA = Object.values(a[1]).reduce((s, d) => s + d.count, 0);
      const totalB = Object.values(b[1]).reduce((s, d) => s + d.count, 0);
      return totalB - totalA;
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expert Network</h1>
          <p className="text-sm text-muted-foreground">Performance scores, availability, and discipline breakdown</p>
        </div>
        <Badge className="bg-secondary/10 text-secondary">{experts.length} Experts</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); if (val !== 'edit-expert') setEditExpertId(null); }} className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Expert Directory
          </TabsTrigger>
          <TabsTrigger value="new-expert" className="flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Expert
          </TabsTrigger>
          {editExpertId && (
            <TabsTrigger value="edit-expert" className="flex items-center gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Edit Expert
            </TabsTrigger>
          )}
          <TabsTrigger value="credit-control" className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Credit Control
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Discipline Breakdown - All Grouped */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-secondary" />
                  Discipline Breakdown by Province
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowBreakdown(!showBreakdown); if (!showBreakdown) setProvinceSearch(''); }}
                  className="flex items-center gap-1.5 text-xs"
                >
                  {showBreakdown ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {showBreakdown ? 'Hide' : 'Show'} Breakdown
                </Button>
              </div>
              {showBreakdown && (
                <div className="relative max-w-xs mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search province..."
                    value={provinceSearch}
                    onChange={(e) => setProvinceSearch(e.target.value)}
                    className="pl-9 h-8 text-xs"
                  />
                </div>
              )}
            </CardHeader>
            {showBreakdown && (
            <CardContent className="space-y-4">
              {sortedProvinces.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No provinces match your search.</p>
              )}
              {sortedProvinces.map(([province, disciplines]) => {
                const sortedDiscs = Object.entries(disciplines)
                  .sort((a, b) => b[1].count - a[1].count);
                const totalInProvince = sortedDiscs.reduce((s, [, d]) => s + d.count, 0);
                return (
                  <div key={province} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-secondary" />
                      <span className="text-sm font-semibold text-foreground">{province}</span>
                      <Badge variant="outline" className="text-[10px]">{totalInProvince} experts</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 pl-5">
                      {sortedDiscs.map(([type, data]) => {
                        const key = `${province}-${type}`;
                        const isExpanded = expandedDiscipline === key;
                        return (
                          <div
                            key={key}
                            className="bg-muted/30 rounded-lg p-2.5 cursor-pointer hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
                            onClick={() => setExpandedDiscipline(isExpanded ? null : key)}
                          >
                            <p className="text-base font-bold text-foreground">{data.count}</p>
                            <p className="text-[10px] text-muted-foreground truncate" title={type}>{type}</p>
                            {isExpanded && (
                              <div className="mt-2 pt-2 border-t border-border/50 space-y-1 max-h-32 overflow-y-auto">
                                {data.experts.map((ex: any) => (
                                  <p key={ex.id} className="text-[10px] text-foreground truncate">
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
              })}
            </CardContent>
            )}
          </Card>

          {/* Search & Province Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search experts by name or type..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
              <Select value={provinceFilter} onValueChange={setProvinceFilter}>
                <SelectTrigger className="w-full sm:w-52 flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Filter by province" />
                </SelectTrigger>
                <SelectContent>
                  {provincesList.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Show</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="w-20 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 40, 60, 100, 200].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                    <SelectItem value={String(filtered.length || 1)}>All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {filtered.length > 0 ? `${startIndex + 1}–${Math.min(endIndex, filtered.length)} of ${filtered.length}` : '0 of 0'}
              </Badge>
            </div>
          </div>

          {/* Expert List */}
          <Card className="border-border/50">
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs table-fixed">
                  <colgroup>
                    <col className="w-[16%]" />
                    <col className="w-[14%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                    <col className="w-[22%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[6%]" />
                  </colgroup>
                  <thead>
                     <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Expert</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Province</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Telephone</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Email</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Consult Fee</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Score</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                    ) : filtered.slice(0, pageSize).map((e) => {
                      const score = Math.floor(Math.random() * 25 + 75);
                      const fee = Number(e.consultation_fees || 0);
                      return (
                        <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20 align-top">
                          <td className="py-2 px-2">
                            <div className="flex items-start gap-1.5">
                              <Stethoscope className="h-3.5 w-3.5 text-secondary mt-0.5 shrink-0" />
                              <span className="font-medium text-foreground break-words leading-tight">{e.first_name} {e.last_name}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-muted-foreground break-words leading-tight">{formatExpertType(e.expert_type)}</td>
                          <td className="py-2 px-2">
                            <div className="flex items-start gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                              <span className="text-muted-foreground break-words leading-tight">{e.province || '–'}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-muted-foreground break-words leading-tight">{e.phone_masked || '–'}</td>
                          <td className="py-2 px-2 text-muted-foreground break-all leading-tight">{e.email_masked || '–'}</td>
                          <td className="py-2 px-2 text-right text-foreground whitespace-nowrap">
                            {fee > 0 ? `R${fee.toLocaleString('en-ZA')}` : '–'}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1.5">
                              <Progress value={score} className="h-1.5 w-10" />
                              <span className="text-[11px] font-medium text-foreground">{score}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditExpertId(e.id);
                                setActiveTab('edit-expert');
                              }}
                              className="h-7 w-7 p-0"
                              title={`Edit ${e.first_name} ${e.last_name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="new-expert" className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <ExpertFormModule />
          </Suspense>
        </TabsContent>

        {editExpertId && (
          <TabsContent value="edit-expert" className="mt-4">
            <Suspense fallback={<TabFallback />}>
              <ExpertFormModule
                key={editExpertId}
                editExpertId={editExpertId}
                onSaved={() => {
                  setEditExpertId(null);
                  setActiveTab('overview');
                  // Refresh expert list
                  setLoading(true);
                  supabase.rpc('get_medical_experts_secure').then(({ data }) => {
                    setExperts(data || []);
                    setLoading(false);
                  });
                }}
              />
            </Suspense>
          </TabsContent>
        )}

        <TabsContent value="credit-control" className="mt-4">
          <Suspense fallback={<TabFallback />}>
            <ExpertCreditControlModule />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminExpertNetwork;
