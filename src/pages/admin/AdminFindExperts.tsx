import React, { useEffect, useMemo, useState } from 'react';
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
import { Loader2, Search, MapPin, Stethoscope, ExternalLink, Star, Mail, User, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SA_PROVINCES = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
  'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape',
];

// Districts/cities are loaded dynamically from the public.sa_districts table.

const MEDICO_LEGAL_PROFESSIONS = [
  'Orthopaedic Surgeon', 'Neurosurgeon', 'Occupational Therapist', 'Clinical Psychologist',
  'Industrial Psychologist', 'Psychiatrist', 'Neurologist', 'Plastic Surgeon', 'General Surgeon',
  'Speech Therapist', 'Audiologist', 'Physiotherapist', 'Educational Psychologist', 'Actuary',
  'Nursing Expert', 'Emergency Medicine Specialist', 'Radiologist', 'Urologist', 'Gynaecologist',
  'Paediatrician', 'Dentist', 'Maxillofacial Surgeon', 'Ophthalmologist',
];

interface InternalExpert {
  id: string;
  first_name: string;
  last_name: string;
  expert_type: string;
  province: string;
  city: string | null;
  languages: string[] | null;
  hpcsa_number: string | null;
  medico_legal_years_experience: number | null;
  years_experience: number | null;
  matter_types: string[] | null;
  status: string;
  cv_document_url: string | null;
  virtual_assessment: boolean | null;
  assessment_turnaround_days: number | null;
  report_turnaround_days: number | null;
  email: string | null;
  contact_number: string | null;
  medico_legal_only: boolean | null;
}

interface ExternalResult {
  source_url: string;
  title: string;
  snippet: string;
  name?: string;
  registry_id?: string;
  province?: string;
  city?: string;
  profession?: string;
  trusted?: boolean;
  sources?: { url: string; host: string; title: string; trusted: boolean }[];
  sources_count?: number;
}

const fuzzy = (haystack: string, needle: string) => {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle.toLowerCase());
};

const AdminFindExperts: React.FC = () => {
  const { toast } = useToast();
  const [province, setProvince] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [profession, setProfession] = useState<string>('');
  const [professionQuery, setProfessionQuery] = useState('');
  const [internal, setInternal] = useState<InternalExpert[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(false);
  const [external, setExternal] = useState<ExternalResult[]>([]);
  const [loadingExternal, setLoadingExternal] = useState(false);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [trustedTotal, setTrustedTotal] = useState<number | null>(null);
  const [externalLimit, setExternalLimit] = useState<number>(40);

  useEffect(() => {
    void runInternalSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!province) {
      setDistricts([]);
      return;
    }
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

  const professionOptions = useMemo(() => {
    const q = professionQuery.toLowerCase();
    return MEDICO_LEGAL_PROFESSIONS.filter((p) => p.toLowerCase().includes(q));
  }, [professionQuery]);

  const runInternalSearch = async () => {
    setLoadingInternal(true);
    try {
      let q = supabase
        .from('medical_experts')
        .select('id, first_name, last_name, expert_type, province, city, languages, hpcsa_number, medico_legal_years_experience, years_experience, matter_types, status, cv_document_url, virtual_assessment, assessment_turnaround_days, report_turnaround_days, email, contact_number, medico_legal_only')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(200);

      if (province) q = q.ilike('province', `%${province}%`);

      const { data, error } = await q;
      if (error) throw error;

      const filtered = (data || []).filter((e: any) => {
        // Medico-legal only — accept null as legacy true
        if (e.medico_legal_only === false) return false;
        // City fuzzy
        if (city && e.city && !fuzzy(e.city, city)) return false;
        // Profession match
        if (profession && !fuzzy(e.expert_type || '', profession.replace(/\s+/g, ''))) {
          // also accept formatted versions
          const flat = (e.expert_type || '').replace(/[_\s]/g, '').toLowerCase();
          const want = profession.replace(/[_\s]/g, '').toLowerCase();
          if (!flat.includes(want.slice(0, 6))) return false;
        }
        // Must serve RAF or Med Neg
        const matters = (e.matter_types || []).map((m: string) => m.toLowerCase());
        if (matters.length > 0) {
          const ok = matters.some((m: string) =>
            m.includes('raf') || m.includes('road accident') || m.includes('negligence') || m.includes('medico'),
          );
          if (!ok) return false;
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

  const runExternalSearch = async (overrides?: { trustedOnly?: boolean; limit?: number }) => {
    if (!profession) {
      toast({ title: 'Select a profession', description: 'Profession is required for external search.', variant: 'destructive' });
      return;
    }
    const useTrustedOnly = overrides?.trustedOnly ?? trustedOnly;
    const useLimit = overrides?.limit ?? externalLimit;
    setLoadingExternal(true);
    setExternal([]);
    try {
      const { data, error } = await supabase.functions.invoke('find-experts-external', {
        body: { province, city, expertType: profession, limit: useLimit, trustedOnly: useTrustedOnly },
      });
      if (error) throw error;
      setExternal(data?.results ?? []);
      setTrustedTotal(typeof data?.trusted_total === 'number' ? data.trusted_total : null);
      if ((data?.results ?? []).length === 0) {
        toast({
          title: 'No external results',
          description: useTrustedOnly ? 'No trusted-registry matches. Try turning off the toggle.' : 'Try a broader search.',
        });
      }
    } catch (err: any) {
      toast({ title: 'External search failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingExternal(false);
    }
  };

  const handleSearch = () => {
    void runInternalSearch();
    void runExternalSearch();
  };

  // Recommended = top by experience and turnaround in current results
  const recommended = useMemo(() => {
    return [...internal]
      .sort((a, b) => {
        const aScore = (a.medico_legal_years_experience || a.years_experience || 0)
          - (a.report_turnaround_days || 30) * 0.2;
        const bScore = (b.medico_legal_years_experience || b.years_experience || 0)
          - (b.report_turnaround_days || 30) * 0.2;
        return bScore - aScore;
      })
      .slice(0, 4);
  }, [internal]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <Helmet>
        <title>Find Experts | Medico-Legal Pro</title>
        <meta name="description" content="Search medico-legal experts by province, district, and profession across the platform and verified directories." />
      </Helmet>

      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Find Experts</h1>
        <p className="text-muted-foreground text-sm">
          Search medico-legal experts available for RAF and Medical Negligence matters.
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
                  {SA_PROVINCES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
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
                  {districts.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Type of Expert</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search profession..."
                  value={professionQuery}
                  onChange={(e) => setProfessionQuery(e.target.value)}
                  className="md:w-1/2"
                />
                <Select value={profession} onValueChange={setProfession}>
                  <SelectTrigger><SelectValue placeholder="Select profession" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {professionOptions.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => { setProvince(''); setCity(''); setProfession(''); setProfessionQuery(''); setExternal([]); void runInternalSearch(); }}>
              Reset
            </Button>
            <Button onClick={handleSearch} disabled={loadingInternal || loadingExternal}>
              {(loadingInternal || loadingExternal) && <Loader2 className="h-4 w-4 animate-spin" />}
              Search Experts
            </Button>
          </div>
        </CardContent>
      </Card>

      {recommended.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" /> Recommended Experts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommended.map((e) => <ExpertCard key={e.id} expert={e} compact />)}
          </div>
        </section>
      )}

      <Tabs defaultValue="internal">
        <TabsList>
          <TabsTrigger value="internal">
            Platform Experts {internal.length > 0 && <Badge variant="secondary" className="ml-2">{internal.length}</Badge>}
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
              No medico-legal experts match your filters.
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {internal.map((e) => <ExpertCard key={e.id} expert={e} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="external" className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="font-medium">Trusted registries only</span>
              <span className="text-muted-foreground hidden sm:inline">
                HPCSA, professional bodies, and verified medico-legal directories
              </span>
              {trustedTotal !== null && (
                <Badge variant="secondary">{trustedTotal} trusted</Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Label htmlFor="ext-limit" className="text-muted-foreground">Show</Label>
                <Select
                  value={String(externalLimit)}
                  onValueChange={(v) => {
                    const n = Number(v);
                    setExternalLimit(n);
                    if (profession) void runExternalSearch({ limit: n });
                  }}
                >
                  <SelectTrigger id="ext-limit" className="h-8 w-[88px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[40, 60, 80, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Switch
                checked={trustedOnly}
                onCheckedChange={(v) => {
                  setTrustedOnly(v);
                  if (profession) void runExternalSearch({ trustedOnly: v });
                }}
                aria-label="Filter to trusted registries only"
              />
            </div>
          </div>

          {loadingExternal ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : external.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              {trustedOnly
                ? 'No results from trusted registries — try turning the filter off.'
                : 'Run a search with a profession to surface results from HPCSA and other public directories.'}
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {external.map((r) => (
                <Card key={r.source_url}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-start justify-between gap-2">
                      <span className="line-clamp-2">{r.name || r.title}</span>
                      {r.trusted ? (
                        <Badge className="shrink-0 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />Trusted
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0">External</Badge>
                      )}
                    </CardTitle>
                    {r.name && r.title !== r.name && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{r.title}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-muted-foreground line-clamp-3">{r.snippet}</p>
                    <div className="flex flex-wrap gap-1">
                      {r.registry_id && (
                        <Badge variant="default" className="font-mono">{r.registry_id}</Badge>
                      )}
                      {r.profession && <Badge variant="secondary">{r.profession}</Badge>}
                      {r.province && <Badge variant="secondary">{r.province}</Badge>}
                      {r.city && <Badge variant="secondary">{r.city}</Badge>}
                      {(r.sources_count ?? 0) > 1 && (
                        <Badge variant="outline">{r.sources_count} sources</Badge>
                      )}
                    </div>
                    {(r.sources?.length ?? 0) > 1 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {r.sources!.slice(0, 6).map((s) => (
                          <a
                            key={s.url}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs underline text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                          >
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const ExpertCard: React.FC<{ expert: InternalExpert; compact?: boolean }> = ({ expert, compact }) => {
  const fullName = `${expert.first_name} ${expert.last_name}`.trim();
  const exp = expert.medico_legal_years_experience ?? expert.years_experience ?? null;
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-start justify-between gap-2">
          <span className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />{fullName}</span>
          {expert.virtual_assessment && <Badge variant="outline">Virtual</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm flex-1 flex flex-col">
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="flex items-center gap-1"><Stethoscope className="h-3 w-3" />{expert.expert_type}</Badge>
          <Badge variant="secondary" className="flex items-center gap-1"><MapPin className="h-3 w-3" />{expert.province}{expert.city ? ` · ${expert.city}` : ''}</Badge>
        </div>
        {exp !== null && <p className="text-muted-foreground">{exp} yrs medico-legal experience</p>}
        {(expert.matter_types?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {expert.matter_types!.slice(0, 3).map((m) => (
              <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
            ))}
          </div>
        )}
        {!compact && (expert.languages?.length ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground">Languages: {expert.languages!.join(', ')}</p>
        )}
        {!compact && (expert.report_turnaround_days || expert.assessment_turnaround_days) && (
          <p className="text-xs text-muted-foreground">
            {expert.assessment_turnaround_days ? `Assessment ${expert.assessment_turnaround_days}d` : ''}
            {expert.assessment_turnaround_days && expert.report_turnaround_days ? ' · ' : ''}
            {expert.report_turnaround_days ? `Report ${expert.report_turnaround_days}d` : ''}
          </p>
        )}
        <div className="mt-auto pt-2 flex gap-2">
          {expert.email && (
            <Button asChild size="sm" variant="outline" className="flex-1">
              <a href={`mailto:${expert.email}`}><Mail className="h-3 w-3 mr-1" />Contact</a>
            </Button>
          )}
          <Button asChild size="sm" className="flex-1">
            <a href={`/admin/experts?edit=${expert.id}`}>View Profile</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminFindExperts;
