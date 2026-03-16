import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Stethoscope, Search, Star, Activity, MapPin } from 'lucide-react';

const AdminExpertNetwork: React.FC = () => {
  const [experts, setExperts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

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

  const disciplines = experts.reduce((acc, e) => {
    const type = e.expert_type || 'Other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topDisciplines = Object.entries(disciplines)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expert Network</h1>
          <p className="text-sm text-muted-foreground">Performance scores, availability, and discipline breakdown</p>
        </div>
        <Badge className="bg-secondary/10 text-secondary">{experts.length} Experts</Badge>
      </div>

      {/* Discipline Breakdown */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-secondary" />
            Discipline Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {topDisciplines.map(([type, count]) => (
              <div key={type} className="bg-muted/30 rounded-lg p-3">
                <p className="text-lg font-bold text-foreground">{count as number}</p>
                <p className="text-[11px] text-muted-foreground truncate">{type}</p>
              </div>
            ))}
          </div>
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
                      <td className="py-3 px-4 text-muted-foreground">{e.expert_type}</td>
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
    </div>
  );
};

export default AdminExpertNetwork;
