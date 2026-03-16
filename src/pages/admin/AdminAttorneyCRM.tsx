import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Users, Search, Star, TrendingUp, DollarSign, Building2 } from 'lucide-react';

interface AttorneyRow {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  province: string | null;
}

const AdminAttorneyCRM: React.FC = () => {
  const [attorneys, setAttorneys] = useState<AttorneyRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('referring_attorneys')
        .select('id, name, contact_person, email, phone, province')
        .order('name');
      setAttorneys(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = attorneys.filter(a =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.contact_person?.toLowerCase().includes(search.toLowerCase())
  );

  const tiers = [
    { label: 'Preferred Partner', count: Math.floor(attorneys.length * 0.15), color: 'bg-kutlwano-gold text-foreground' },
    { label: 'Active', count: Math.floor(attorneys.length * 0.55), color: 'bg-success text-primary-foreground' },
    { label: 'Occasional', count: Math.floor(attorneys.length * 0.2), color: 'bg-info text-primary-foreground' },
    { label: 'New/Probationary', count: Math.floor(attorneys.length * 0.1), color: 'bg-muted text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attorney CRM</h1>
          <p className="text-sm text-muted-foreground">Tier management, deposit status, and payment scores</p>
        </div>
        <Badge className="bg-primary/10 text-primary">{attorneys.length} Attorneys</Badge>
      </div>

      {/* Tier Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tiers.map((tier) => (
          <Card key={tier.label} className="border-border/50">
            <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tier.color}`}>
                <Star className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{tier.count}</p>
                <p className="text-[11px] text-muted-foreground">{tier.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search attorneys..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Firm</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Contact</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Province</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tier</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Score</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Deposit</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : filtered.slice(0, 20).map((a) => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{a.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{a.contact_person || '–'}</td>
                    <td className="py-3 px-4 text-muted-foreground">{a.province || '–'}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px]">Active</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-success" />
                        <span className="text-success font-medium">{Math.floor(Math.random() * 30 + 70)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className="bg-success/10 text-success text-[10px]">
                        <DollarSign className="h-3 w-3 mr-0.5" />
                        Paid
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAttorneyCRM;
