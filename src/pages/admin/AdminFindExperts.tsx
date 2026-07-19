// src/pages/admin/AdminFindExperts.tsx
import React, { useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Tabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Loader2, Search, MapPin, Stethoscope, ExternalLink, Star, Mail, User,
  ShieldCheck, Phone, Globe, RotateCcw, Clock, Video, ChevronRight,
} from 'lucide-react';
import { useExpertSearch, SA_PROVINCES, InternalExpert, ExternalResult } from '@/hooks/useExpertSearch';
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminPill,
  AdminEmptyState,
  AdminSectionLabel,
  AdminTabList,
  AdminTabTrigger,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

/**
 * Find Experts.
 *
 * Previous structure: a full-width filter card on top, then a two-tab
 * (Internal/External) results area below it — filters and results
 * competed for the same vertical scroll, and every result rendered its
 * full DOM at once.
 *
 * New structure: a persistent left filter rail (sticky on desktop) next
 * to a dedicated results panel, so refining a search never requires
 * scrolling back up. Both result lists are virtualized with dynamic row
 * measurement (@tanstack/react-virtual) — external directory results can
 * run up to 100 rows, and this keeps that scroll smooth regardless of
 * count. All search/filter/scoring logic is unchanged, now living in
 * `useExpertSearch`.
 */
const AdminFindExperts: React.FC = () => {
  const {
    province, setProvince, city, setCity, profession, setProfession,
    professionQuery, setProfessionQuery, professionOptions, districts, loadingDistricts,
    internal, recommended, loadingInternal,
    external, loadingExternal, externalError, trustedTotal, externalTotal, hasSearchedExternal,
    trustedOnly, setTrustedOnly, externalLimit, setExternalLimit,
    includeRecomed, setIncludeRecomed, includeMedpages, setIncludeMedpages,
    runExternalSearch, handleSearch, handleReset, isSearching,
  } = useExpertSearch();

  const [activeTab, setActiveTab] = useState<'internal' | 'external'>('internal');

  return (
    <AdminPage className="max-w-7xl">
      <Helmet>
        <title>Find Experts | Medico-Legal Pro</title>
        <meta name="description" content="Search medico-legal experts by province, district, and profession across the platform and verified directories." />
      </Helmet>

      <AdminHeader
        eyebrow="Intelligence"
        title="Find Experts"
        description="Search medico-legal experts available for RAF and Medical Negligence matters"
        icon={Search}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Filter rail */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <AdminCard>
            <AdminCardHeader icon={Search} title="Search Filters" description="Narrow by location and profession." />
            <AdminCardBody className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Province</Label>
                <Select value={province} onValueChange={setProvince}>
                  <SelectTrigger className="rounded-none border-black/15"><SelectValue placeholder="All provinces" /></SelectTrigger>
                  <SelectContent>
                    {SA_PROVINCES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">District / City</Label>
                <Select value={city} onValueChange={setCity} disabled={!province || loadingDistricts}>
                  <SelectTrigger className="rounded-none border-black/15">
                    <SelectValue placeholder={!province ? 'Pick province first' : loadingDistricts ? 'Loading...' : districts.length ? 'Select district' : 'No districts available'} />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type of Expert</Label>
                <Input
                  placeholder="Search profession…"
                  value={professionQuery}
                  onChange={(e) => setProfessionQuery(e.target.value)}
                  className="rounded-none border-black/15"
                />
                <Select value={profession} onValueChange={setProfession}>
                  <SelectTrigger className="rounded-none border-black/15"><SelectValue placeholder="Select profession" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {professionOptions.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2 border-t border-black/10 pt-3">
                <Button
                  className="rounded-none bg-black text-white hover:bg-black/90"
                  onClick={handleSearch}
                  disabled={isSearching}
                >
                  {isSearching && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  <Search className="mr-1.5 h-3.5 w-3.5" />
                  Search Experts
                </Button>
                <Button
                  variant="outline"
                  className="rounded-none border-black/15 text-black hover:bg-black/5"
                  onClick={handleReset}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Reset
                </Button>
              </div>
            </AdminCardBody>
          </AdminCard>
        </div>

        {/* Results panel */}
        <div className="min-w-0 space-y-4">
          {/* Recommended */}
          {recommended.length > 0 && (
            <div>
              <AdminSectionLabel>
                <span className="inline-flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} /> Recommended Experts
                </span>
              </AdminSectionLabel>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {recommended.map((e) => <ExpertCard key={e.id} expert={e} compact />)}
              </div>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
            <AdminTabList>
              <AdminTabTrigger value="internal" label="Platform Experts" icon={Stethoscope} badge={internal.length || null} />
              <AdminTabTrigger value="external" label="External Directories" icon={Globe} badge={external.length || null} />
            </AdminTabList>

            <div className="mt-4">
              {activeTab === 'internal' && (
                loadingInternal ? (
                  <AdminCard><AdminCardBody><LoadingRow label="Searching the platform directory…" /></AdminCardBody></AdminCard>
                ) : internal.length === 0 ? (
                  <AdminCard>
                    <AdminEmptyState icon={Stethoscope} title="No matches" description="No medico-legal experts match your current filters." />
                  </AdminCard>
                ) : (
                  <VirtualizedResults items={internal} renderItem={(e) => <ExpertCard expert={e} />} />
                )
              )}

              {activeTab === 'external' && (
                <div className="space-y-3">
                  {/* Toolbar */}
                  <AdminCard>
                    <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <ShieldCheck className="h-4 w-4" style={{ color: BRAND_TEAL }} />
                        <span className="font-medium text-black">Trusted registries only</span>
                        <span className="hidden text-xs text-slate-500 sm:inline">
                          HPCSA, professional bodies, and verified medico-legal directories
                        </span>
                        {externalTotal !== null && (
                          <AdminPill tone="neutral">
                            Showing {external.length}{externalTotal > external.length ? ` of ${externalTotal}` : ''}
                          </AdminPill>
                        )}
                        {trustedTotal !== null && (
                          <AdminPill tone="teal">{trustedTotal} trusted</AdminPill>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Label htmlFor="ext-limit" className="text-slate-500">Show</Label>
                          <Select
                            value={String(externalLimit)}
                            onValueChange={(v) => {
                              const n = Number(v);
                              setExternalLimit(n);
                              if (profession) runExternalSearch({ limit: n });
                            }}
                          >
                            <SelectTrigger id="ext-limit" className="h-8 w-[88px] rounded-none border-black/15">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[40, 60, 80, 100].map((n) => (
                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-black">
                          <Switch
                            checked={includeRecomed}
                            onCheckedChange={(v) => {
                              setIncludeRecomed(v);
                              if (profession) runExternalSearch({ includeRecomed: v });
                            }}
                            aria-label="Include Recomed results"
                          />
                          Recomed
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-black">
                          <Switch
                            checked={includeMedpages}
                            onCheckedChange={(v) => {
                              setIncludeMedpages(v);
                              if (profession) runExternalSearch({ includeMedpages: v });
                            }}
                            aria-label="Include Medpages results"
                          />
                          Medpages
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-500">
                          <Switch
                            checked={trustedOnly}
                            onCheckedChange={(v) => {
                              setTrustedOnly(v);
                              if (profession) runExternalSearch({ trustedOnly: v });
                            }}
                            aria-label="Filter to trusted registries only"
                          />
                          Trusted only
                        </label>
                      </div>
                    </div>
                  </AdminCard>

                  {loadingExternal ? (
                    <AdminCard>
                      <AdminCardBody className="flex flex-col items-center gap-3 py-10 text-center">
                        <span
                          className="h-8 w-8 animate-spin rounded-full border-2 border-black/15"
                          style={{ borderTopColor: BRAND_TEAL }}
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-medium text-black">Searching public directories…</p>
                          <p className="text-sm text-slate-500">
                            Fetching up to {externalLimit} {trustedOnly ? 'trusted-registry' : 'external'} results for{' '}
                            <span className="font-medium text-black">{profession || 'experts'}</span>
                            {city ? ` in ${city}` : province ? ` in ${province}` : ''}. This can take 10–20 seconds.
                          </p>
                        </div>
                        <div className="h-1 w-full max-w-sm overflow-hidden bg-black/10">
                          <div className="h-full w-1/3 animate-pulse" style={{ backgroundColor: BRAND_TEAL }} />
                        </div>
                      </AdminCardBody>
                    </AdminCard>
                  ) : externalError ? (
                    <AdminCard className="border-destructive/40">
                      <AdminCardBody className="space-y-3 py-8 text-center">
                        <p className="font-medium text-destructive">Couldn't load external results</p>
                        <p className="text-sm text-slate-500">{externalError}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-none border-black/15 text-black hover:bg-black/5"
                          onClick={() => runExternalSearch()}
                        >
                          Try again
                        </Button>
                      </AdminCardBody>
                    </AdminCard>
                  ) : external.length === 0 ? (
                    <AdminCard>
                      {!hasSearchedExternal ? (
                        <AdminEmptyState
                          icon={Globe}
                          title="No external search yet"
                          description="Run a search with a profession selected to surface results from HPCSA and other public directories."
                        />
                      ) : trustedOnly ? (
                        <AdminEmptyState
                          icon={ShieldCheck}
                          title="No trusted-registry matches"
                          description='Try turning off "Trusted registries only", or broaden the location.'
                        />
                      ) : (
                        <AdminEmptyState
                          icon={Globe}
                          title="No external results found"
                          description={`We searched up to ${externalLimit} sources for ${profession}${city ? ` in ${city}` : province ? ` in ${province}` : ''}. Try a broader location or a related profession.`}
                        />
                      )}
                    </AdminCard>
                  ) : (
                    <VirtualizedResults items={external} renderItem={(r) => <ExternalResultCard result={r} />} />
                  )}
                </div>
              )}
            </div>
          </Tabs>
        </div>
      </div>
    </AdminPage>
  );
};

/* ------------------------------------------------------------------ */
/* Virtualized results list — dynamic row measurement so cards of      */
/* differing height (missing fields, variable contact info, etc.)      */
/* still virtualize correctly instead of assuming a fixed row size.    */
/* ------------------------------------------------------------------ */

function VirtualizedResults<T>({ items, renderItem }: { items: T[]; renderItem: (item: T) => React.ReactNode }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 260,
    overscan: 6,
  });

  return (
    <div ref={parentRef} className="max-h-[75vh] overflow-y-auto pr-1">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            ref={virtualizer.measureElement}
            data-index={row.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${row.start}px)`,
            }}
            className="pb-4"
          >
            {renderItem(items[row.index])}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Presentational sub-components                                      */
/* ------------------------------------------------------------------ */

const LoadingRow: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
    <span
      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/15"
      style={{ borderTopColor: BRAND_TEAL }}
      aria-hidden="true"
    />
    {label}
  </div>
);

const ExpertCard: React.FC<{ expert: InternalExpert; compact?: boolean }> = ({ expert, compact }) => {
  const fullName = `${expert.first_name} ${expert.last_name}`.trim();
  const exp = expert.medico_legal_years_experience ?? expert.years_experience ?? null;

  return (
    <AdminCard className="flex flex-col">
      <AdminCardHeader
        icon={User}
        title={<span className="truncate">{fullName}</span>}
        actions={expert.virtual_assessment ? (
          <AdminPill tone="teal"><Video className="h-3 w-3" /> Virtual</AdminPill>
        ) : undefined}
      />
      <AdminCardBody className="flex flex-1 flex-col gap-2 text-sm">
        <div className="flex flex-wrap gap-1.5">
          <AdminPill tone="neutral"><Stethoscope className="h-3 w-3" /> {expert.expert_type}</AdminPill>
          <AdminPill tone="neutral">
            <MapPin className="h-3 w-3" /> {expert.province}{expert.city ? ` · ${expert.city}` : ''}
          </AdminPill>
        </div>

        {exp !== null && (
          <p className="text-xs text-slate-500">{exp} yrs medico-legal experience</p>
        )}

        {(expert.matter_types?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {expert.matter_types!.slice(0, 3).map((m) => (
              <AdminPill key={m} tone="neutral" className="text-[9px]">{m}</AdminPill>
            ))}
          </div>
        )}

        {!compact && (expert.languages?.length ?? 0) > 0 && (
          <p className="text-xs text-slate-500">Languages: {expert.languages!.join(', ')}</p>
        )}

        {!compact && (expert.report_turnaround_days || expert.assessment_turnaround_days) && (
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="h-3 w-3 shrink-0" />
            {expert.assessment_turnaround_days ? `Assessment ${expert.assessment_turnaround_days}d` : ''}
            {expert.assessment_turnaround_days && expert.report_turnaround_days ? ' · ' : ''}
            {expert.report_turnaround_days ? `Report ${expert.report_turnaround_days}d` : ''}
          </p>
        )}

        <div className="mt-auto flex gap-2 pt-2">
          {expert.email && (
            <Button asChild size="sm" variant="outline" className="flex-1 rounded-none border-black/15 text-black hover:bg-black/5">
              <a href={`mailto:${expert.email}`}><Mail className="mr-1 h-3 w-3" />Contact</a>
            </Button>
          )}
          <Button asChild size="sm" className="flex-1 rounded-none bg-black text-white hover:bg-black/90">
            <a href={`/admin/experts?edit=${expert.id}`}>
              View Profile <ChevronRight className="ml-1 h-3 w-3" />
            </a>
          </Button>
        </div>
      </AdminCardBody>
    </AdminCard>
  );
};

const ExternalResultCard: React.FC<{ result: ExternalResult }> = ({ result: r }) => (
  <AdminCard className="flex flex-col">
    <AdminCardHeader
      title={<span className="line-clamp-2">{r.name || r.title}</span>}
      description={r.name && r.title !== r.name ? <span className="line-clamp-1">{r.title}</span> : undefined}
      actions={r.trusted ? (
        <AdminPill tone="teal"><ShieldCheck className="h-3 w-3" /> Trusted</AdminPill>
      ) : (
        <AdminPill tone="neutral">External</AdminPill>
      )}
    />
    <AdminCardBody className="flex flex-1 flex-col gap-2 text-sm">
      <p className="line-clamp-3 text-slate-500">{r.snippet}</p>

      <div className="flex flex-wrap gap-1">
        {r.registry_id && <AdminPill tone="teal" className="font-mono">{r.registry_id}</AdminPill>}
        {r.profession && <AdminPill tone="neutral">{r.profession}</AdminPill>}
        {r.province && <AdminPill tone="neutral">{r.province}</AdminPill>}
        {r.city && <AdminPill tone="neutral">{r.city}</AdminPill>}
        {(r.sources_count ?? 0) > 1 && <AdminPill tone="neutral">{r.sources_count} sources</AdminPill>}
      </div>

      {(r.emails?.length || r.phones?.length || r.websites?.length) ? (
        <div className="space-y-1 border border-black/10 bg-black/[0.02] p-2">
          {r.emails?.slice(0, 3).map((e) => (
            <a key={e} href={`mailto:${e}`} className="flex items-center gap-2 break-all text-xs text-black hover:underline">
              <Mail className="h-3 w-3 shrink-0" style={{ color: BRAND_TEAL }} /> {e}
            </a>
          ))}
          {r.phones?.slice(0, 3).map((p) => (
            <a key={p} href={`tel:${p}`} className="flex items-center gap-2 text-xs text-black hover:underline">
              <Phone className="h-3 w-3 shrink-0" style={{ color: BRAND_TEAL }} /> {p}
            </a>
          ))}
          {r.websites?.slice(0, 3).map((w) => (
            <a key={w.host} href={w.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-black hover:underline">
              <Globe className="h-3 w-3 shrink-0" style={{ color: BRAND_TEAL }} /> {w.host}
            </a>
          ))}
        </div>
      ) : (
        <p className="text-xs italic text-slate-400">
          No contact details detected — open the source for more info.
        </p>
      )}

      <div className="mt-auto pt-1">
        {(r.sources?.length ?? 0) > 1 ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {r.sources!.slice(0, 6).map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-slate-500 underline hover:text-black"
              >
                {s.host}<ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        ) : (
          <a
            href={r.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-slate-500 underline hover:text-black"
          >
            View source <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </AdminCardBody>
  </AdminCard>
);

export default AdminFindExperts;
