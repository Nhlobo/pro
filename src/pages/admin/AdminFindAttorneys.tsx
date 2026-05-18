import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search, MapPin, Briefcase, ExternalLink, Star, Mail, User, ShieldCheck, Phone, Globe, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SA_PROVINCES = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
  'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape',
];

const PRACTICE_AREAS = [
  'Road Accident Fund', 'Personal Injury', 'Medical Negligence', 'Litigation',
  'Family Law', 'Criminal Law', 'Commercial Law', 'Labour Law', 'Estates & Trusts',
  'Conveyancing', 'Insurance Law', 'Public Liability', 'Class Action',
];

const ATTORNEY_ROLES = [
  { value: 'any', label: 'Any role' },
  { value: 'plaintiff', label: 'Plaintiff' },
  { value: 'defense', label: 'Defense' },
];

interface InternalAttorney {
  id: string;
  name: string;
  contact_person: string | null;
  attorney_role: string | null;
  province: string | null;
  code: string;
  phone_masked?: string;
  email_masked?: string;
}

interface ExternalResult {
  source_url: string;
  title: string;
  snippet: string;
  name?: string;
  firm?: string;
  bar_number?: string;
  province?: string;
  city?: string;
  practice_area?: string;
  trusted?: boolean;
  sources?: { url: string; host: string; title: string; trusted: boolean }[];
  sources_count?: number;
  emails?: string[];
  phones?: string[];
  websites?: { url: string; host: string }[];
}

const fuzzy = (h: string, n: string) => !n || h.toLowerCase().includes(n.toLowerCase());

const AdminFindAttorneys: React.FC = () => {
  const { toast } = useToast();
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [practiceArea, setPracticeArea] = useState('');
  const [practiceQuery, setPracticeQuery] = useState('');
  const [attorneyRole, setAttorneyRole] = useState('any');
  const [internal, setInternal] = useState<InternalAttorney[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(false);
  const [external, setExternal] = useState<ExternalResult[]>([]);
  const [loadingExternal, setLoadingExternal] = useState(false);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [trustedTotal, setTrustedTotal] = useState<number | null>(null);
  const [externalTotal, setExternalTotal] = useState<number | null>(null);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [hasSearchedExternal, setHasSearchedExternal] = useState(false);
  const [externalLimit, setExternalLimit] = useState<number>(40);
  const [includeLssa, setIncludeLssa] = useState(true);
  const [includeFindAnAttorney, setIncludeFindAnAttorney] = useState(true);
  const [visibleCount, setVisibleCount] = useState(20);
  const [isPaging, setIsPaging] = useState(false);
  const PAGE_SIZE = 20;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = () => {
    if (isPaging || visibleCount >= external.length) return;
    setIsPaging(true);
    window.setTimeout(() => {
      setVisibleCount((c) => Math.min(c + PAGE_SIZE, external.length));
      setIsPaging(false);
    }, 350);
  };

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [external.length, visibleCount, isPaging]);

  useEffect(() => { void runInternalSearch(); /* eslint-disable-line */ }, []);

  useEffect(() => {
    if (!province) { setDistricts([]); return; }
    let cancelled = false;
    (async () => {
      setLoadingDistricts(true);
      const { data, error } = await supabase
        .from('sa_districts')
        .select('name')
        .eq('province', province)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (cancelled) return;
      if (error) {
        toast({ title: 'Could not load districts', description: error.message, variant: 'destructive' });
        setDistricts([]);
      } else {
        setDistricts((data ?? []).map((d: { name: string }) => d.name));
      }
      setLoadingDistricts(false);
    })();
    return () => { cancelled = true; };
  }, [province, toast]);

  const practiceOptions = useMemo(() => {
    const q = practiceQuery.toLowerCase();
    return PRACTICE_AREAS.filter((p) => p.toLowerCase().includes(q));
  }, [practiceQuery]);

  const runInternalSearch = async () => {
    setLoadingInternal(true);
    try {
      const { data, error } = await supabase.rpc('get_referring_attorneys_list');
      if (error) throw error;
      const filtered = (data || []).filter((a: any) => {
        if (a.name && /kutlwano associate/i.test(a.name)) return false;
        if (province && a.province && !fuzzy(a.province, province)) return false;
        if (attorneyRole !== 'any' && a.attorney_role && !fuzzy(a.attorney_role, attorneyRole)) return false;
        return true;
      });
      setInternal(filtered);
    } catch (err: any) {
      toast({ title: 'Search failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingInternal(false);
    }
  };

  const runExternalSearch = async (overrides?: { trustedOnly?: boolean; limit?: number; includeLssa?: boolean; includeFindAnAttorney?: boolean }) => {
    if (!practiceArea) {
      toast({ title: 'Select a practice area', description: 'Practice area is required for external search.', variant: 'destructive' });
      return;
    }
    const useTrusted = overrides?.trustedOnly ?? trustedOnly;
    const useLimit = overrides?.limit ?? externalLimit;
    const useLssa = overrides?.includeLssa ?? includeLssa;
    const useFaa = overrides?.includeFindAnAttorney ?? includeFindAnAttorney;
    setLoadingExternal(true);
    setExternal([]);
    setExternalError(null);
    setHasSearchedExternal(true);
    try {
      const { data, error } = await supabase.functions.invoke('find-attorneys-external', {
        body: {
          province, city, practiceArea,
          attorneyRole: attorneyRole === 'any' ? '' : attorneyRole,
          limit: useLimit, trustedOnly: useTrusted,
          includeLssa: useLssa, includeFindAnAttorney: useFaa,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setExternal(data?.results ?? []);
      setVisibleCount(PAGE_SIZE);
      setTrustedTotal(typeof data?.trusted_total === 'number' ? data.trusted_total : null);
      setExternalTotal(typeof data?.total === 'number' ? data.total : (data?.results ?? []).length);
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      setExternalError(msg);
      toast({ title: 'External search failed', description: msg, variant: 'destructive' });
    } finally {
      setLoadingExternal(false);
    }
  };

  const handleSearch = () => { void runInternalSearch(); void runExternalSearch(); };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <Helmet>
        <title>Find Attorneys | Medico-Legal Pro</title>
        <meta name="description" content="Search referring attorneys across the platform and verified South African legal directories." />
      </Helmet>

      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Find Attorneys</h1>
        <p className="text-muted-foreground text-sm">
          Search referring attorneys for RAF, Personal Injury and Medical Negligence matters.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-4 w-4" /> Search Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Province</Label>
              <Select value={province} onValueChange={(v) => { setProvince(v); setCity(''); }}>
                <SelectTrigger><SelectValue placeholder="All provinces" /></SelectTrigger>
                <SelectContent>
                  {SA_PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>District / City</Label>
              <Select value={city} onValueChange={setCity} disabled={!province || loadingDistricts}>
                <SelectTrigger>
                  <SelectValue placeholder={!province ? 'Pick province first' : loadingDistricts ? 'Loading...' : districts.length ? 'Select district' : 'No districts available'} />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Attorney Role</Label>
              <Select value={attorneyRole} onValueChange={setAttorneyRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ATTORNEY_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Practice Area</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search..."
                  value={practiceQuery}
                  onChange={(e) => setPracticeQuery(e.target.value)}
                  className="w-1/2"
                />
                <Select value={practiceArea} onValueChange={setPracticeArea}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {practiceOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => { setProvince(''); setCity(''); setPracticeArea(''); setPracticeQuery(''); setAttorneyRole('any'); setExternal([]); void runInternalSearch(); }}>
              Reset
            </Button>
            <Button onClick={handleSearch} disabled={loadingInternal || loadingExternal}>
              {(loadingInternal || loadingExternal) && <Loader2 className="h-4 w-4 animate-spin" />}
              Search Attorneys
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="internal">
        <TabsList>
          <TabsTrigger value="internal">
            Platform Attorneys {internal.length > 0 && <Badge variant="secondary" className="ml-2">{internal.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="external">
            External Directories {external.length > 0 && <Badge variant="secondary" className="ml-2">{external.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="internal" className="mt-4">
          {loadingInternal ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : internal.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              No referring attorneys match your filters.
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {internal.map((a) => <AttorneyCard key={a.id} attorney={a} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="external" className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="font-medium">Trusted registries</span>
              <span className="text-muted-foreground hidden sm:inline">
                LSSA, LPC, Bar Councils & verified legal directories
              </span>
              {externalTotal !== null && (
                <Badge variant="outline">
                  Showing {Math.min(visibleCount, external.length)} of {externalTotal}
                </Badge>
              )}
              {trustedTotal !== null && <Badge variant="secondary">{trustedTotal} trusted</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Label htmlFor="ext-limit" className="text-muted-foreground">Show</Label>
                <Select
                  value={String(externalLimit)}
                  onValueChange={(v) => {
                    const n = Number(v);
                    setExternalLimit(n);
                    if (practiceArea) void runExternalSearch({ limit: n });
                  }}
                >
                  <SelectTrigger id="ext-limit" className="h-8 w-[88px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[40, 60, 80, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={includeLssa} onCheckedChange={(v) => { setIncludeLssa(v); if (practiceArea) void runExternalSearch({ includeLssa: v }); }} />
                <span>LSSA</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={includeFindAnAttorney} onCheckedChange={(v) => { setIncludeFindAnAttorney(v); if (practiceArea) void runExternalSearch({ includeFindAnAttorney: v }); }} />
                <span>FindAnAttorney</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={trustedOnly} onCheckedChange={(v) => { setTrustedOnly(v); if (practiceArea) void runExternalSearch({ trustedOnly: v }); }} />
                <span className="text-muted-foreground">Trusted only</span>
              </label>
            </div>
          </div>

          {loadingExternal ? (
            <Card>
              <CardContent className="py-10 flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div>
                  <p className="font-medium">Searching public directories…</p>
                  <p className="text-sm text-muted-foreground">
                    Fetching up to {externalLimit} {trustedOnly ? 'trusted-registry' : 'external'} results for{' '}
                    <span className="font-medium text-foreground">{practiceArea || 'attorneys'}</span>
                    {city ? ` in ${city}` : province ? ` in ${province}` : ''}. This can take 10–20 seconds.
                  </p>
                </div>
                <div className="w-full max-w-sm h-1 bg-muted rounded overflow-hidden">
                  <div className="h-full w-1/3 bg-primary animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ) : externalError ? (
            <Card className="border-destructive/40">
              <CardContent className="py-8 text-center space-y-3">
                <p className="font-medium text-destructive">Couldn't load external results</p>
                <p className="text-sm text-muted-foreground">{externalError}</p>
                <Button size="sm" variant="outline" onClick={() => void runExternalSearch()}>Try again</Button>
              </CardContent>
            </Card>
          ) : external.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground space-y-2">
                {!hasSearchedExternal ? (
                  <p>Run a search with a practice area to surface results from LSSA and other public directories.</p>
                ) : trustedOnly ? (
                  <>
                    <p className="font-medium text-foreground">No trusted-registry matches</p>
                    <p>Try turning off the "Trusted only" toggle, or broaden the location.</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-foreground">No external results found</p>
                    <p>
                      We searched up to {externalLimit} sources for{' '}
                      <span className="font-medium">{practiceArea}</span>
                      {city ? ` in ${city}` : province ? ` in ${province}` : ''}. Try a broader location or a related practice area.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {external.slice(0, visibleCount).map((r) => (
                <Card key={r.source_url}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-start justify-between gap-2">
                      <span className="line-clamp-2">{r.name || r.firm || r.title}</span>
                      {r.trusted ? (
                        <Badge className="shrink-0 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />Trusted
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0">External</Badge>
                      )}
                    </CardTitle>
                    {r.firm && r.firm !== r.name && (
                      <p className="text-xs text-muted-foreground line-clamp-1 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />{r.firm}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-muted-foreground line-clamp-3">{r.snippet}</p>
                    <div className="flex flex-wrap gap-1">
                      {r.bar_number && <Badge variant="default" className="font-mono">{r.bar_number}</Badge>}
                      {r.practice_area && <Badge variant="secondary">{r.practice_area}</Badge>}
                      {r.province && <Badge variant="secondary">{r.province}</Badge>}
                      {r.city && <Badge variant="secondary">{r.city}</Badge>}
                      {(r.sources_count ?? 0) > 1 && (
                        <Badge variant="outline">{r.sources_count} sources</Badge>
                      )}
                    </div>

                    {(r.emails?.length || r.phones?.length || r.websites?.length) ? (
                      <div className="space-y-1 rounded-md border bg-muted/30 p-2">
                        {r.emails?.slice(0, 3).map((e) => (
                          <a key={e} href={`mailto:${e}`} className="flex items-center gap-2 text-xs hover:text-primary break-all">
                            <Mail className="h-3 w-3 shrink-0" /> {e}
                          </a>
                        ))}
                        {r.phones?.slice(0, 3).map((p) => (
                          <a key={p} href={`tel:${p}`} className="flex items-center gap-2 text-xs hover:text-primary">
                            <Phone className="h-3 w-3 shrink-0" /> {p}
                          </a>
                        ))}
                        {r.websites?.slice(0, 3).map((w) => (
                          <a key={w.host} href={w.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs hover:text-primary">
                            <Globe className="h-3 w-3 shrink-0" /> {w.host}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No contact details detected — open the source for more info.
                      </p>
                    )}

                    {(r.sources?.length ?? 0) > 1 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {r.sources!.slice(0, 6).map((s) => (
                          <a key={s.url} href={s.url} target="_blank" rel="noreferrer"
                            className="text-xs underline text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                            {s.host}<ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <a href={r.source_url} target="_blank" rel="noreferrer">
                          Open Source <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            {isPaging && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {Array.from({ length: Math.min(PAGE_SIZE, external.length - visibleCount) }).map((_, i) => (
                  <Card key={`sk-${i}`}>
                    <CardHeader className="pb-2 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                      <div className="flex gap-1">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                      <Skeleton className="h-16 w-full rounded-md" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {visibleCount < external.length && (
              <div ref={sentinelRef} className="flex justify-center py-6">
                <Button variant="outline" onClick={loadMore} disabled={isPaging}>
                  {isPaging ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading…</>
                  ) : (
                    <>Load more ({external.length - visibleCount} remaining)</>
                  )}
                </Button>
              </div>
            )}
            </>

          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const AttorneyCard: React.FC<{ attorney: InternalAttorney }> = ({ attorney }) => {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-start justify-between gap-2">
          <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{attorney.name}</span>
          {attorney.attorney_role && <Badge variant="outline">{attorney.attorney_role}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm flex-1 flex flex-col">
        {attorney.contact_person && (
          <p className="flex items-center gap-1 text-muted-foreground">
            <User className="h-3 w-3" />{attorney.contact_person}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {attorney.province && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />{attorney.province}
            </Badge>
          )}
          {attorney.code && <Badge variant="outline" className="font-mono text-[10px]">{attorney.code}</Badge>}
        </div>
        {attorney.email_masked && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{attorney.email_masked}</p>
        )}
        {attorney.phone_masked && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{attorney.phone_masked}</p>
        )}
        <div className="mt-auto pt-2">
          <Button asChild size="sm" className="w-full">
            <a href={`/admin/attorney-crm?id=${attorney.id}`}>View Profile</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminFindAttorneys;
