import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Users, Search, Star, TrendingUp, DollarSign, Building2, UserPlus, List, Briefcase } from 'lucide-react';

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
  <div className="space-y-4 p-4">
    <Skeleton className="h-10 w-full" />
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

const CRMOverview: React.FC = () => {
  const [attorneys, setAttorneys] = useState<AttorneyRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<TierKey>('all');

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

  const attorneyTiers = attorneys.map((a, i) => ({
    ...a,
    tier: assignTier(i, attorneys.length),
  }));

  const tiers: { key: TierKey; label: string; count: number; color: string; activeColor: string }[] = [
    { key: 'preferred', label: 'Preferred Partner', count: attorneyTiers.filter(a => a.tier === 'preferred').length, color: 'bg-kutlwano-gold text-foreground', activeColor: 'ring-2 ring-kutlwano-gold' },
    { key: 'active', label: 'Active', count: attorneyTiers.filter(a => a.tier === 'active').length, color: 'bg-success text-primary-foreground', activeColor: 'ring-2 ring-success' },
    { key: 'occasional', label: 'Occasional', count: attorneyTiers.filter(a => a.tier === 'occasional').length, color: 'bg-info text-primary-foreground', activeColor: 'ring-2 ring-info' },
    { key: 'new', label: 'New/Probationary', count: attorneyTiers.filter(a => a.tier === 'new').length, color: 'bg-muted text-muted-foreground', activeColor: 'ring-2 ring-muted-foreground' },
  ];

  const tierBadge = (tier: TierKey) => {
    const map: Record<TierKey, { label: string; className: string }> = {
      all: { label: 'All', className: '' },
      preferred: { label: 'Preferred', className: 'bg-kutlwano-gold/20 text-kutlwano-gold border-kutlwano-gold/30' },
      active: { label: 'Active', className: 'bg-success/10 text-success border-success/30' },
      occasional: { label: 'Occasional', className: 'bg-info/10 text-info border-info/30' },
      new: { label: 'New', className: 'bg-muted text-muted-foreground' },
    };
    return map[tier];
  };

  const filtered = attorneyTiers.filter(a => {
    const matchesSearch = a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.contact_person?.toLowerCase().includes(search.toLowerCase());
    const matchesTier = selectedTier === 'all' || a.tier === selectedTier;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="space-y-6 mt-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tiers.map((tier) => (
          <Card
            key={tier.key}
            className={`border-border/50 cursor-pointer transition-all hover:shadow-md ${selectedTier === tier.key ? tier.activeColor + ' shadow-md' : ''}`}
            onClick={() => setSelectedTier(selectedTier === tier.key ? 'all' : tier.key)}
          >
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

      {selectedTier !== 'all' && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={tierBadge(selectedTier).className}>
            Showing: {tierBadge(selectedTier).label} ({filtered.length})
          </Badge>
          <button onClick={() => setSelectedTier('all')} className="text-xs text-muted-foreground hover:text-foreground underline">
            Clear filter
          </button>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search attorneys..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

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
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No attorneys found</td></tr>
                ) : filtered.slice(0, 50).map((a) => {
                  const badge = tierBadge(a.tier);
                  return (
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
                        <Badge variant="outline" className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>
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

const AdminAttorneyCRM: React.FC = () => {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Attorney CRM</h1>
        <p className="text-sm text-muted-foreground">Attorneys, claimants, outreach & pitchlog management</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5" />
            CRM Overview
          </TabsTrigger>
          <TabsTrigger value="pitchlog" className="flex items-center gap-1.5 text-xs">
            <Briefcase className="h-3.5 w-3.5" />
            Pitchlog
          </TabsTrigger>
          <TabsTrigger value="new-claimant" className="flex items-center gap-1.5 text-xs">
            <UserPlus className="h-3.5 w-3.5" />
            New Claimant
          </TabsTrigger>
          <TabsTrigger value="all-claimants" className="flex items-center gap-1.5 text-xs">
            <List className="h-3.5 w-3.5" />
            All Claimants
          </TabsTrigger>
          <TabsTrigger value="new-attorney" className="flex items-center gap-1.5 text-xs">
            <UserPlus className="h-3.5 w-3.5" />
            New Attorney
          </TabsTrigger>
          <TabsTrigger value="all-attorneys" className="flex items-center gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" />
            All Attorneys
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <CRMOverview />
        </TabsContent>

        <TabsContent value="pitchlog">
          <Suspense fallback={<TabFallback />}>
            <AttorneyPitchlogModule />
          </Suspense>
        </TabsContent>

        <TabsContent value="new-claimant">
          <Suspense fallback={<TabFallback />}>
            <ClaimantFormModule />
          </Suspense>
        </TabsContent>

        <TabsContent value="all-claimants">
          <Suspense fallback={<TabFallback />}>
            <ClaimantListModule />
          </Suspense>
        </TabsContent>

        <TabsContent value="new-attorney">
          <Suspense fallback={<TabFallback />}>
            <ReferringAttorneyFormModule />
          </Suspense>
        </TabsContent>

        <TabsContent value="all-attorneys">
          <Suspense fallback={<TabFallback />}>
            <ReferringAttorneyListModule />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAttorneyCRM;
