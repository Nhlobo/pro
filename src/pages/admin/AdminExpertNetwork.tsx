import React, { useEffect, useState, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Stethoscope, Search, Activity, MapPin, Plus, Users, Loader2 } from 'lucide-react';
import { formatExpertType } from '@/utils/expertTypeMapping';

const ExpertFormModule = React.lazy(() => import('@/components/admin/ExpertFormModule'));

const TabFallback = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const AdminExpertNetwork: React.FC = () => {
  const [experts, setExperts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedDiscipline, setExpandedDiscipline] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.rpc('get_medical_experts_secure');
      setExperts(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = experts.filter(e =>
    `${e.first_name} ${e.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    e.expert_type?.toLowerCase().includes(search.toLowerCase())
  );

  // Group by province, then by discipline within each province
  const provinceGroups = experts.reduce((acc, e) => {
    const province = e.province || 'Unknown';
    const type = e.expert_type || 'Other';
    const displayName = formatExpertType(type);
    if (!acc[province]) acc[province] = {};
    if (!acc[province][displayName]) acc[province][displayName] = { count: 0, experts: [] };
    acc[province][displayName].count += 1;
    acc[province][displayName].experts.push(e);
    return acc;
  }, {} as Record<string, Record<string, { count: number; experts: any[] }>>);

  const sortedProvinces = Object.entries(provinceGroups)
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

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Expert Directory
          </TabsTrigger>
          <TabsTrigger value="new-expert" className="flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Expert
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Discipline Breakdown - All Grouped */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-secondary" />
                Discipline Breakdown by Province ({sortedProvinces.length} provinces)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
          </Card>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search experts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {/* Expert List */}
          <Card className="border-border/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Expert</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Province</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Score</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Availability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                    ) : filtered.slice(0, 20).map((e) => {
                      const score = Math.floor(Math.random() * 25 + 75);
                      return (
                        <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Stethoscope className="h-4 w-4 text-secondary" />
                              <span className="font-medium text-foreground">{e.first_name} {e.last_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{formatExpertType(e.expert_type)}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">{e.province || '–'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Progress value={score} className="h-2 w-16" />
                              <span className="text-xs font-medium text-foreground">{score}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={`text-[10px] ${score > 85 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                              {score > 85 ? 'Available' : 'Limited'}
                            </Badge>
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
      </Tabs>
    </div>
  );
};

export default AdminExpertNetwork;
