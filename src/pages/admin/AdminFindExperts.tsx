// src/pages/admin/AdminFindExperts.tsx
import React, { useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Loader2, Search, MapPin, Stethoscope, ExternalLink, Star, Mail, User,
  ShieldCheck, Phone, Globe, RotateCcw, Clock, Video, ChevronRight, FileText,
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
 * New structure — enterprise, single source of truth for search: one
 * sticky toolbar holds quick search AND the structured filters together
 * (no more duplicate "type a sentence" card vs. "pick from dropdowns"
 * card competing for attention). Nothing here is behind a collapse/
 * accordion — every control enterprise ops staff need is visible at
 * once, always in the same place while they scroll a long result set.
 * Full page width goes to results instead of a permanent 280px sidebar,
 * which matters once External Directories returns 80–100 rows.
 *
 * Platform vs. External used to be two tabs, so a search that found
 * nothing on the platform (common — the in-house directory is small)
 * looked like a dead end unless someone knew to click the other tab,
 * even though the external search had already run and found matches.
 * Both sections stack on one page instead, so a single search shows
 * everything it found in one scroll — no second click required to
 * discover results exist.
 *
 * Performance: both result lists are virtualized with dynamic row
 * measurement (@tanstack/react-virtual) — external directory results can
 * run up to 100 rows, and this keeps that scroll smooth regardless of
 * count. Card components are memoized (`React.memo`) so toggling a
 * toolbar switch or typing in the profession filter never re-renders
 * rows that didn't change. All search/filter/scoring logic is unchanged,
 * still living entirely in `useExpertSearch`.
 */
const AdminFindExperts: React.FC = () => {
  const {
    province, setProvince, city, setCity, profession, setProfession,
    professionQuery, setProfessionQuery, professionOptions, districts, loadingDistricts,
    internal, recommended, loadingInternal,
    external, loadingExternal, externalError, trustedTotal, externalTotal, hasSearchedExternal,
    trustedOnly, setTrustedOnly, externalLimit, setExternalLimit,
    includeRecomed, setIncludeRecomed, includeMedpages, setIncludeMedpages,
    quickQuery, setQuickQuery, lastParsedQuery, lastFreeText, runQuickSearch,
    runExternalSearch, handleSearch, handleReset, isSearching,
  } = useExpertSearch();

  // Read-only profile view — a click on a card's "View Profile" opens this
  // dialog with everything already fetched for that expert, instead of
  // navigating to the admin directory's edit form.
  const [viewExpert, setViewExpert] = useState<InternalExpert | null>(null);

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

      {/* Unified search toolbar — quick search + structured filters together, sticky while results scroll */}
      <AdminCard className="mb-4 lg:sticky lg:top-4 lg:z-10">
        <AdminCardBody className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="quick-expert-search" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Quick Search
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="quick-expert-search"
                  placeholder='e.g. "neurosurgeon expert witness" or "orthopaedic surgeon Gauteng"'
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') runQuickSearch(); }}
                  className="rounded-none border-black/15 pl-9"
                />
              </div>
              <Button
                className="rounded-none bg-black text-white hover:bg-black/90 shrink-0"
                onClick={() => runQuickSearch()}
                disabled={isSearching || !quickQuery.trim()}
              >
                {isSearching && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                <Search className="mr-1.5 h-3.5 w-3.5" />
                Search
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Searches the platform directory and every external directory (all connected sources) at once. Say the specialty the way you would to a colleague — "expert witness" is understood and ignored.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3 border-t border-black/10 pt-3">
            <div className="w-full space-y-1.5 sm:w-40">
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

            <div className="w-full space-y-1.5 sm:w-40">
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

            <div className="w-full space-y-1.5 sm:w-56">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type of Expert</Label>
              <div className="flex gap-1.5">
                <Input
                  placeholder="Search profession…"
                  value={professionQuery}
                  onChange={(e) => setProfessionQuery(e.target.value)}
                  className="rounded-none border-black/15"
                />
                <Select value={profession} onValueChange={setProfession}>
                  <SelectTrigger className="w-9 shrink-0 rounded-none border-black/15 px-2"><SelectValue placeholder="" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {professionOptions.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {profession && <AdminPill tone="teal">{profession}</AdminPill>}
            </div>

            <div className="flex gap-2">
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
          </div>

          {lastParsedQuery && (
            <div className="flex flex-wrap gap-1.5 border-t border-black/10 pt-3">
              {lastParsedQuery.profession && <AdminPill tone="teal">Type: {lastParsedQuery.profession}</AdminPill>}
              {!lastParsedQuery.profession && lastFreeText && (
                <AdminPill tone="teal">Searching for: "{lastFreeText}"</AdminPill>
              )}
              {lastParsedQuery.province && <AdminPill tone="neutral">Province: {lastParsedQuery.province}</AdminPill>}
              {lastParsedQuery.city && <AdminPill tone="neutral">Location: {lastParsedQuery.city}</AdminPill>}
            </div>
          )}
        </AdminCardBody>
      </AdminCard>

      {/* Results — full page width now that filters live in the toolbar above */}
      <div className="space-y-4">

          {/* Recommended */}
          {recommended.length > 0 && (
            <div>
              <AdminSectionLabel>
                <span className="inline-flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} /> Recommended Experts
                </span>
              </AdminSectionLabel>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {recommended.map((e) => <ExpertCard key={e.id} expert={e} compact onView={setViewExpert} />)}
              </div>
            </div>
          )}

          {/* Platform Experts — always visible, no tab click required */}
          <div>
            <AdminSectionLabel>
              <span className="inline-flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} /> Platform Experts
                {internal.length > 0 && <AdminPill tone="teal">{internal.length}</AdminPill>}
              </span>
            </AdminSectionLabel>
            <div className="mt-3">
              {loadingInternal ? (
                <AdminCard><AdminCardBody><LoadingRow label="Searching the platform directory…" /></AdminCardBody></AdminCard>
              ) : internal.length === 0 ? (
                <AdminCard>
                  <AdminEmptyState
                    icon={Stethoscope}
                    title="No matches on the platform yet"
                    description="No registered experts match these filters. This just means no one on the platform fits — check External Directories below for real matches from HPCSA and other registries."
                  />
                </AdminCard>
              ) : (
                <VirtualizedResults items={internal} renderItem={(e) => <ExpertCard expert={e} onView={setViewExpert} />} />
              )}
            </div>
          </div>

          {/* External Directories — always visible, stacked below Platform Experts */}
          <div>
            <AdminSectionLabel>
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} /> External Directories
                {external.length > 0 && <AdminPill tone="teal">{external.length}</AdminPill>}
              </span>
            </AdminSectionLabel>
            <div className="mt-3">
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
                              if (profession || lastFreeText) runExternalSearch({ limit: n });
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
                              if (profession || lastFreeText) runExternalSearch({ includeRecomed: v });
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
                              if (profession || lastFreeText) runExternalSearch({ includeMedpages: v });
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
                              if (profession || lastFreeText) runExternalSearch({ trustedOnly: v });
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
                            <span className="font-medium text-black">{profession || (lastFreeText ? `"${lastFreeText}"` : 'experts')}</span>
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
                          description={`We searched up to ${externalLimit} sources for ${profession || (lastFreeText ? `"${lastFreeText}"` : 'that')}${city ? ` in ${city}` : province ? ` in ${province}` : ''}. Try a broader location or a related profession.`}
                        />
                      )}
                    </AdminCard>
                  ) : (
                    <VirtualizedResults items={external} renderItem={(r) => <ExternalResultCard result={r} />} />
                  )}
                </div>
              </div>
            </div>
        </div>

      <ExpertProfileDialog expert={viewExpert} onOpenChange={(open) => { if (!open) setViewExpert(null); }} />
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

/**
 * Read-only profile view opened by a card's "View Profile" button — shows
 * everything already fetched for that expert without navigating to the
 * admin directory's edit form. Nothing here is editable; there is no save
 * action, only the fields as a fact sheet.
 */
const ExpertProfileDialog: React.FC<{
  expert: InternalExpert | null;
  onOpenChange: (open: boolean) => void;
}> = ({ expert, onOpenChange }) => {
  if (!expert) return null;
  const fullName = `${expert.first_name} ${expert.last_name}`.trim();
  const exp = expert.medico_legal_years_experience ?? expert.years_experience ?? null;

  return (
    <Dialog open={!!expert} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-4 w-4" style={{ color: BRAND_TEAL }} />
            {fullName}
          </DialogTitle>
          <DialogDescription>{expert.expert_type}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <AdminPill tone="neutral"><MapPin className="h-3 w-3" /> {expert.province}{expert.city ? ` · ${expert.city}` : ''}</AdminPill>
            {expert.virtual_assessment && <AdminPill tone="teal"><Video className="h-3 w-3" /> Virtual assessments</AdminPill>}
            <AdminPill tone={expert.status === 'active' ? 'teal' : 'neutral'}><ShieldCheck className="h-3 w-3" /> {expert.status}</AdminPill>
          </div>

          {(expert.matter_types?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Matter types</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {expert.matter_types!.map((m) => <AdminPill key={m} tone="neutral">{m}</AdminPill>)}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {exp !== null && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Experience</p>
                <p>{exp} yrs medico-legal</p>
              </div>
            )}
            {expert.hpcsa_number && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">HPCSA number</p>
                <p className="font-mono">{expert.hpcsa_number}</p>
              </div>
            )}
            {expert.assessment_turnaround_days ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assessment turnaround</p>
                <p className="flex items-center gap-1"><Clock className="h-3 w-3" /> {expert.assessment_turnaround_days} days</p>
              </div>
            ) : null}
            {expert.report_turnaround_days ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report turnaround</p>
                <p className="flex items-center gap-1"><Clock className="h-3 w-3" /> {expert.report_turnaround_days} days</p>
              </div>
            ) : null}
          </div>

          {(expert.languages?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Languages</p>
              <p>{expert.languages!.join(', ')}</p>
            </div>
          )}

          <div className="border-t border-black/10 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</p>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {expert.email ? (
                <a href={`mailto:${expert.email}`} className="flex items-center gap-2 text-black hover:underline">
                  <Mail className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} /> {expert.email}
                </a>
              ) : null}
              {expert.contact_number ? (
                <a href={`tel:${expert.contact_number}`} className="flex items-center gap-2 text-black hover:underline">
                  <Phone className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} /> {expert.contact_number}
                </a>
              ) : null}
              {!expert.email && !expert.contact_number && (
                <p className="text-xs italic text-slate-400">No contact details on file</p>
              )}
            </div>
          </div>

          {expert.cv_document_url && (
            <a
              href={expert.cv_document_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium underline"
              style={{ color: BRAND_TEAL }}
            >
              <FileText className="h-3.5 w-3.5" /> View CV <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ExpertCard: React.FC<{ expert: InternalExpert; compact?: boolean; onView: (expert: InternalExpert) => void }> = React.memo(({ expert, compact, onView }) => {
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

        {/* Contact reflects what's actually on file — email and phone are
            separate, real actions instead of a single button that silently
            assumed email and ignored a stored phone number entirely. */}
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          {expert.email && (
            <Button asChild size="sm" variant="outline" className="rounded-none border-black/15 text-black hover:bg-black/5">
              <a href={`mailto:${expert.email}`}><Mail className="mr-1 h-3 w-3" />Email</a>
            </Button>
          )}
          {expert.contact_number && (
            <Button asChild size="sm" variant="outline" className="rounded-none border-black/15 text-black hover:bg-black/5">
              <a href={`tel:${expert.contact_number}`}><Phone className="mr-1 h-3 w-3" />Call</a>
            </Button>
          )}
          {!expert.email && !expert.contact_number && (
            <span className="self-center text-xs italic text-slate-400">No contact details on file</span>
          )}
          {/* Opens the read-only profile dialog on this page — no
              navigation to the admin directory's edit form. */}
          <Button
            size="sm"
            className="ml-auto rounded-none bg-black text-white hover:bg-black/90"
            onClick={() => onView(expert)}
          >
            View Profile <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </AdminCardBody>
    </AdminCard>
  );
});
ExpertCard.displayName = 'ExpertCard';

const ExternalResultCard: React.FC<{ result: ExternalResult }> = React.memo(({ result: r }) => {
  const [expanded, setExpanded] = useState(false);

  const emails = r.emails ?? [];
  const phones = r.phones ?? [];
  const websites = r.websites ?? [];
  const sources = r.sources ?? [];

  const CONTACT_PREVIEW = 3;
  const SOURCE_PREVIEW = 6;
  const hiddenContactCount =
    !expanded
      ? Math.max(0, emails.length - CONTACT_PREVIEW) + Math.max(0, phones.length - CONTACT_PREVIEW) + Math.max(0, websites.length - CONTACT_PREVIEW)
      : 0;
  const hiddenSourceCount = !expanded ? Math.max(0, sources.length - SOURCE_PREVIEW) : 0;
  const hasMore = hiddenContactCount > 0 || hiddenSourceCount > 0 || (r.snippet?.length ?? 0) > 220;

  const shownEmails = expanded ? emails : emails.slice(0, CONTACT_PREVIEW);
  const shownPhones = expanded ? phones : phones.slice(0, CONTACT_PREVIEW);
  const shownWebsites = expanded ? websites : websites.slice(0, CONTACT_PREVIEW);
  const shownSources = expanded ? sources : sources.slice(0, SOURCE_PREVIEW);

  return (
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
        <p className={expanded ? 'text-slate-500' : 'line-clamp-3 text-slate-500'}>{r.snippet}</p>

        <div className="flex flex-wrap gap-1">
          {r.registry_id && <AdminPill tone="teal" className="font-mono">{r.registry_id}</AdminPill>}
          {r.profession && <AdminPill tone="neutral">{r.profession}</AdminPill>}
          {r.province && <AdminPill tone="neutral">{r.province}</AdminPill>}
          {r.city && <AdminPill tone="neutral">{r.city}</AdminPill>}
          {(r.sources_count ?? 0) > 1 && <AdminPill tone="neutral">{r.sources_count} sources</AdminPill>}
        </div>

        {(emails.length || phones.length || websites.length) ? (
          <div className="space-y-1 border border-black/10 bg-black/[0.02] p-2">
            {shownEmails.map((e) => (
              <a key={e} href={`mailto:${e}`} className="flex items-center gap-2 break-all text-xs text-black hover:underline">
                <Mail className="h-3 w-3 shrink-0" style={{ color: BRAND_TEAL }} /> {e}
              </a>
            ))}
            {shownPhones.map((p) => (
              <a key={p} href={`tel:${p}`} className="flex items-center gap-2 text-xs text-black hover:underline">
                <Phone className="h-3 w-3 shrink-0" style={{ color: BRAND_TEAL }} /> {p}
              </a>
            ))}
            {shownWebsites.map((w) => (
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

        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          {shownSources.length > 1 ? (
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {shownSources.map((s) => (
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

          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="self-start text-xs font-medium underline"
              style={{ color: BRAND_TEAL }}
            >
              {expanded ? 'Show less' : 'Show all details'}
            </button>
          )}
        </div>
      </AdminCardBody>
    </AdminCard>
  );
});
ExternalResultCard.displayName = 'ExternalResultCard';

export default AdminFindExperts;
