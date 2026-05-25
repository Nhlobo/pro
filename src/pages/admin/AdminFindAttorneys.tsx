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
import { nameKey, normEmail, normPhone, canonUrl, hostOf } from '@/utils/attorneyNormalize';

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
  const [deepSearch, setDeepSearch] = useState(false);
  const [includeLssa, setIncludeLssa] = useState(true);
  const [includeFindAnAttorney, setIncludeFindAnAttorney] = useState(true);
  const [includeGoogle, setIncludeGoogle] = useState(true);
  const [nameQ, setNameQ] = useState('');
  const [phoneQ, setPhoneQ] = useState('');
  const [emailQ, setEmailQ] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const [isPaging, setIsPaging] = useState(false);
  const PAGE_SIZE = 20;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const dedupedExternal = useMemo(() => {
    // Internal identity signatures to suppress duplicate external entries
    const internalSig = new Set<string>();
    internal.forEach((a) => {
      const n = nameKey(a.name); if (n && n.split(' ').length >= 2) internalSig.add(`n:${n}`);
      const eRaw = a.email_masked || '';
      if (eRaw && !eRaw.includes('*')) { const en = normEmail(eRaw); if (en) internalSig.add(`e:${en}`); }
      const pRaw = a.phone_masked || '';
      if (pRaw && !pRaw.includes('*')) { const pn = normPhone(pRaw); if (pn.length >= 9) internalSig.add(`p:${pn}`); }
    });

    type Bucket = { item: ExternalResult; keys: Set<string> };
    const buckets: Bucket[] = [];
    const keyIndex = new Map<string, Bucket>();

    const sigsFor = (r: ExternalResult): string[] => {
      const sigs: string[] = [];
      const firmK = nameKey(r.firm);
      const nameK = nameKey(r.name);
      if (firmK && firmK.split(' ').length >= 2) sigs.push(`n:${firmK}`);
      if (nameK && nameK !== firmK && nameK.split(' ').length >= 2) sigs.push(`n:${nameK}`);
      if (r.bar_number) sigs.push(`b:${r.bar_number.toLowerCase().replace(/\s+/g, '')}`);
      (r.emails || []).forEach((e) => { const en = normEmail(e); if (en) sigs.push(`e:${en}`); });
      (r.phones || []).forEach((p) => { const np = normPhone(p); if (np.length >= 9) sigs.push(`p:${np}`); });
      (r.websites || []).forEach((w) => { const h = (w.host || '').toLowerCase().replace(/^www\./, ''); if (h) sigs.push(`w:${h}`); });
      const cu = canonUrl(r.source_url); if (cu) sigs.push(`u:${cu}`);
      const h = hostOf(r.source_url); if (h && !sigs.some((s) => s.startsWith('w:'))) sigs.push(`w:${h}`);
      return Array.from(new Set(sigs));
    };

    const mergeArr = <T,>(a: T[] = [], b: T[] = []) => Array.from(new Set([...(a || []), ...(b || [])]));
    const mergeWebsites = (a: { url: string; host: string }[] = [], b: { url: string; host: string }[] = []) => {
      const seen = new Set<string>(); const out: { url: string; host: string }[] = [];
      for (const w of [...(a || []), ...(b || [])]) {
        const k = (w.host || '').toLowerCase().replace(/^www\./, '');
        if (k && !seen.has(k)) { seen.add(k); out.push({ ...w, host: k }); }
      }
      return out;
    };
    const mergeSources = (a: ExternalResult['sources'] = [], b: ExternalResult['sources'] = []) => {
      const seen = new Set<string>(); const out: NonNullable<ExternalResult['sources']> = [];
      for (const s of [...(a || []), ...(b || [])]) {
        const k = canonUrl(s.url); if (k && !seen.has(k)) { seen.add(k); out.push(s); }
      }
      return out;
    };

    for (const r of external) {
      const sigs = sigsFor(r);
      if (sigs.some((s) => internalSig.has(s))) continue; // matches a platform attorney
      const hit = sigs.map((s) => keyIndex.get(s)).find(Boolean) as Bucket | undefined;
      if (hit) {
        hit.item = {
          ...hit.item,
          name: hit.item.name || r.name,
          firm: hit.item.firm || r.firm,
          bar_number: hit.item.bar_number || r.bar_number,
          province: hit.item.province || r.province,
          city: hit.item.city || r.city,
          trusted: hit.item.trusted || r.trusted,
          emails: mergeArr(hit.item.emails, r.emails),
          phones: mergeArr(hit.item.phones, r.phones),
          websites: mergeWebsites(hit.item.websites, r.websites),
          sources: mergeSources(hit.item.sources, r.sources),
        };
        hit.item.sources_count = hit.item.sources?.length ?? hit.item.sources_count;
        sigs.forEach((s) => { hit.keys.add(s); keyIndex.set(s, hit); });
      } else {
        const bucket: Bucket = { item: { ...r }, keys: new Set(sigs) };
        buckets.push(bucket);
        sigs.forEach((s) => keyIndex.set(s, bucket));
      }
    }
    return buckets.map((b) => b.item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [external, internal]);

  const loadMore = () => {
    if (isPaging || visibleCount >= dedupedExternal.length) return;
    setIsPaging(true);
    window.setTimeout(() => {
      setVisibleCount((c) => Math.min(c + PAGE_SIZE, dedupedExternal.length));
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
  }, [dedupedExternal.length, visibleCount, isPaging]);

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
        if (nameQ) {
          const hay = `${a.name ?? ''} ${a.contact_person ?? ''}`;
          if (!fuzzy(hay, nameQ)) return false;
        }
        if (phoneQ) {
          const digits = phoneQ.replace(/\D/g, '');
          const hay = `${a.phone_masked ?? ''} ${a.phone ?? ''}`.replace(/\D/g, '');
          if (digits && !hay.includes(digits)) return false;
        }
        if (emailQ) {
          const hay = `${a.email_masked ?? ''} ${a.email ?? ''}`;
          if (!fuzzy(hay, emailQ)) return false;
        }
        return true;
      });
      setInternal(filtered);
    } catch (err: any) {
      toast({ title: 'Search failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingInternal(false);
    }
  };

  const runExternalSearch = async (overrides?: { trustedOnly?: boolean; limit?: number; includeLssa?: boolean; includeFindAnAttorney?: boolean; includeGoogle?: boolean }) => {
    if (!practiceArea && !nameQ && !phoneQ && !emailQ) {
      toast({ title: 'Add a search term', description: 'Pick a practice area or enter a name, phone, or email.', variant: 'destructive' });
      return;
    }
    const useTrusted = overrides?.trustedOnly ?? trustedOnly;
    const useLimit = overrides?.limit ?? externalLimit;
    const useLssa = overrides?.includeLssa ?? includeLssa;
    const useFaa = overrides?.includeFindAnAttorney ?? includeFindAnAttorney;
    const useGoogle = overrides?.includeGoogle ?? includeGoogle;
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
          includeGoogle: useGoogle,
          name: nameQ, phone: phoneQ, email: emailQ,
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

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="search-name">Attorney / Firm Name</Label>
              <Input id="search-name" placeholder="e.g. Smith Attorneys" value={nameQ} onChange={(e) => setNameQ(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="search-phone">Telephone</Label>
              <Input id="search-phone" placeholder="e.g. 011 555 0123 or +27..." value={phoneQ} onChange={(e) => setPhoneQ(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="search-email">Email</Label>
              <Input id="search-email" type="email" placeholder="e.g. info@firm.co.za" value={emailQ} onChange={(e) => setEmailQ(e.target.value)} />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Name, telephone or email lookups search both registered attorneys and external directories (incl. Google).
          </p>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => { setProvince(''); setCity(''); setPracticeArea(''); setPracticeQuery(''); setAttorneyRole('any'); setNameQ(''); setPhoneQ(''); setEmailQ(''); setExternal([]); void runInternalSearch(); }}>
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
            External Directories {dedupedExternal.length > 0 && <Badge variant="secondary" className="ml-2">{dedupedExternal.length}</Badge>}
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
                  Showing {Math.min(visibleCount, dedupedExternal.length)} of {externalTotal}
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
                    if (practiceArea || nameQ || phoneQ || emailQ) void runExternalSearch({ limit: n });
                  }}
                >
                  <SelectTrigger id="ext-limit" className="h-8 w-[88px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[40, 60, 80, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={includeLssa} onCheckedChange={(v) => { setIncludeLssa(v); if (practiceArea || nameQ || phoneQ || emailQ) void runExternalSearch({ includeLssa: v }); }} />
                <span>LSSA</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={includeFindAnAttorney} onCheckedChange={(v) => { setIncludeFindAnAttorney(v); if (practiceArea || nameQ || phoneQ || emailQ) void runExternalSearch({ includeFindAnAttorney: v }); }} />
                <span>FindAnAttorney</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={includeGoogle} onCheckedChange={(v) => { setIncludeGoogle(v); if (practiceArea || nameQ || phoneQ || emailQ) void runExternalSearch({ includeGoogle: v }); }} />
                <span>Google</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={trustedOnly} onCheckedChange={(v) => { setTrustedOnly(v); if (practiceArea || nameQ || phoneQ || emailQ) void runExternalSearch({ trustedOnly: v }); }} />
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
          ) : dedupedExternal.length === 0 ? (
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
              {dedupedExternal.slice(0, visibleCount).map((r) => {
                const heading = r.firm || r.name || r.title;
                const contact = r.firm && r.name && r.firm !== r.name ? r.name : undefined;
                const roleLabel = attorneyRole === 'plaintiff' ? 'Plaintiff'
                  : attorneyRole === 'defense' ? 'Defense'
                  : 'Attorney';
                const provinceShort: Record<string, string> = {
                  'KwaZulu-Natal': 'KZN', 'Western Cape': 'WC', 'Eastern Cape': 'EC',
                  'Northern Cape': 'NC', 'North West': 'NW', 'Free State': 'FS',
                  'Gauteng': 'GP', 'Mpumalanga': 'MP', 'Limpopo': 'LP',
                };
                const provShort = r.province ? provinceShort[r.province] : undefined;
                return (
                <Card key={r.source_url} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-start justify-between gap-2">
                      <span className="flex items-start gap-2 min-w-0">
                        <Building2 className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <span className="line-clamp-2 font-semibold">{heading}</span>
                      </span>
                      <Badge variant="outline" className="shrink-0 rounded-full">{roleLabel}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm flex-1 flex flex-col">
                    {contact && (
                      <p className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="h-3.5 w-3.5" />{contact}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {r.province && (
                        <Badge className="rounded-full bg-primary text-primary-foreground hover:bg-primary flex items-center gap-1">
                          {provShort && <span className="font-bold">{provShort}</span>}
                          <span>{r.province}</span>
                        </Badge>
                      )}
                      {r.bar_number && (
                        <Badge variant="outline" className="font-mono text-[10px] rounded-full">{r.bar_number}</Badge>
                      )}
                      {r.trusted && (
                        <Badge variant="secondary" className="flex items-center gap-1 rounded-full">
                          <ShieldCheck className="h-3 w-3" />Trusted
                        </Badge>
                      )}
                    </div>
                    {r.emails?.slice(0, 1).map((e) => (
                      <a key={e} href={`mailto:${e}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary break-all">
                        <Mail className="h-3.5 w-3.5 shrink-0" />{e}
                      </a>
                    ))}
                    {r.phones?.slice(0, 1).map((p) => (
                      <a key={p} href={`tel:${p}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                        <Phone className="h-3.5 w-3.5 shrink-0" />{p}
                      </a>
                    ))}
                    {r.websites?.slice(0, 1).map((w) => (
                      <a key={w.host} href={w.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                        <Globe className="h-3.5 w-3.5 shrink-0" />{w.host}
                      </a>
                    ))}
                    {!r.emails?.length && !r.phones?.length && !r.websites?.length && (
                      <p className="text-xs text-muted-foreground italic">No contact details detected.</p>
                    )}
                    <div className="mt-auto pt-2 flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="outline" className="flex-1">
                        <a href={r.source_url} target="_blank" rel="noreferrer">
                          Open Source <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                      {(r.sources_count ?? 0) > 1 && (
                        <Badge variant="outline" className="rounded-full">{r.sources_count} sources</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );})}
            </div>
            {isPaging && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {Array.from({ length: Math.min(PAGE_SIZE, dedupedExternal.length - visibleCount) }).map((_, i) => (
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
            {visibleCount < dedupedExternal.length && (
              <div ref={sentinelRef} className="flex justify-center py-6">
                <Button variant="outline" onClick={loadMore} disabled={isPaging}>
                  {isPaging ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading…</>
                  ) : (
                    <>Load more ({dedupedExternal.length - visibleCount} remaining)</>
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
