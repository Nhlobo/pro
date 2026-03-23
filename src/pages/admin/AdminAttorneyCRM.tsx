import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Users, Search, Star, TrendingUp, DollarSign, Building2, UserPlus, List, Briefcase, GitMerge, CheckCircle } from 'lucide-react';
import MergeAttorneyDialog from '@/components/MergeAttorneyDialog';

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
  const [showMergeDialog, setShowMergeDialog] = useState(false);

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

      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search attorneys..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowMergeDialog(true)} className="flex items-center gap-1.5">
          <GitMerge className="h-4 w-4" />
          Merge Duplicates
        </Button>
      </div>

      <MergeAttorneyDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        onMergeComplete={() => {
          const refetch = async () => {
            const { data } = await supabase
              .from('referring_attorneys')
              .select('id, name, contact_person, email, phone, province')
              .order('name');
            setAttorneys(data || []);
          };
          refetch();
        }}
      />

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
  const [activeTab, setActiveTab] = useState('overview');
  const [pitchlogDefaultTab, setPitchlogDefaultTab] = useState<string | undefined>(undefined);

  // Fetch closed deals count (pitchlog entries matched to referring attorneys with scheduled appointments)
  const { data: closedDealsCount = 0 } = useQuery({
    queryKey: ['crm-closed-deals-count'],
    queryFn: async () => {
      const [{ data: pitchEntries }, { data: attorneys }, { data: appointments }] = await Promise.all([
        supabase.from('attorney_pitchlog').select('id, law_firm_name, matched_referring_attorney_id'),
        supabase.from('referring_attorneys').select('id, name'),
        supabase.from('appointments').select('id, referring_attorney_id').is('deleted_at', null).eq('case_status', 'scheduled'),
      ]);

      // Build appointment count per referring attorney
      const apptCountByRA: Record<string, number> = {};
      (appointments || []).forEach(a => {
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
          const match = (attorneys || []).find(ra =>
            normalise(ra.name).includes(normalise(entry.law_firm_name)) ||
            normalise(entry.law_firm_name).includes(normalise(ra.name))
          );
          if (match && raIdsWithAppts.has(match.id)) matchedId = match.id;
        }
        if (matchedId && !seenRA.has(matchedId)) {
          seenRA.add(matchedId);
          // Count actual scheduled appointments, not just 1 per firm
          count += apptCountByRA[matchedId] || 1;
        }
      }
      return count;
    },
  });

  const handleClosedDealsClick = () => {
    setPitchlogDefaultTab('sales-report');
    setActiveTab('pitchlog');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attorney CRM</h1>
          <p className="text-sm text-muted-foreground">Attorneys, claimants, outreach & pitchlog management</p>
        </div>
        {closedDealsCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClosedDealsClick}
            className="flex items-center gap-1.5"
          >
            <CheckCircle className="h-4 w-4 text-success" />
            <span className="font-semibold">{closedDealsCount}</span>
            <span className="text-muted-foreground">Closed Deals</span>
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v !== 'pitchlog') setPitchlogDefaultTab(undefined); }} className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5" />
            CRM Overview
          </TabsTrigger>
          <TabsTrigger value="pitchlog" className="flex items-center gap-1.5 text-xs">
            <Briefcase className="h-3.5 w-3.5" />
            Pitchlog
            {closedDealsCount > 0 && (
              <Badge className="ml-1 bg-success/20 text-success border-success/30 text-[10px] px-1.5 py-0">
                {closedDealsCount} closed
              </Badge>
            )}
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
            <AttorneyPitchlogModule defaultTab={pitchlogDefaultTab} />
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
