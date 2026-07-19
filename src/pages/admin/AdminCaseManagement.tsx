// src/pages/admin/AdminCaseManagement.tsx
//
// ── Design notes ─────────────────────────────────────────────────────
// Ground-up visual redesign of Case Management. Nothing here reuses the
// shared /admin/ui kit — this page has its own visual system, built around
// the vocabulary of a legal case registry rather than a generic admin
// dashboard: a docket masthead, a "chain of custody" stage rail (cases
// really do move through these stages in order, so a connected sequence
// is earned here, not decorative), a trial-readiness seal, and a matter
// ledger with folio-numbered pagination.
//
// Data fetching, filtering math, and the RPC contract are untouched from
// the previous implementation — only presentation changed.
// ─────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';
import { format } from 'date-fns';
import {
  Inbox,
  Gavel,
  FileClock,
  FileCheck2,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  FolderSearch,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Palette — kept local to this page on purpose, so this registry has  */
/* its own identity rather than borrowing the shared admin theme.      */
/*   ink     #101A17  primary text / active fills                      */
/*   paper   #F5F6F3  page background (cool, not cream)                */
/*   rail    #0F6E63  deep registry teal — structure + primary accent  */
/*   amber   #B8802A  awaiting / pending signal                        */
/*   clay    #A6432D  missing / at-risk signal                         */
/*   line    #DBDDD6  hairline rule                                    */
/*   mute    #626D66  secondary text                                   */
/* ------------------------------------------------------------------ */

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap';
const F_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const F_BODY = "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif";
const F_MONO = "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace";

const STAGE_CONFIG: { key: string; name: string; icon: typeof Inbox; match: (a: any) => boolean }[] = [
  { key: 'intake', name: 'Intake', icon: Inbox, match: (a) => a.case_status === 'scheduled' },
  { key: 'assessment', name: 'Assessment', icon: Gavel, match: (a) => a.case_status === 'in_progress' },
  { key: 'report_pending', name: 'Report Pending', icon: FileClock, match: (a) => a.report_status === 'not_received' },
  { key: 'report_submitted', name: 'Report Submitted', icon: FileCheck2, match: (a) => a.report_status === 'completed' },
];

const PAGE_SIZE = 15;

/* Semicircle gauge geometry — an 80-radius half-circle arc. */
const GAUGE_R = 80;
const GAUGE_CIRC = Math.PI * GAUGE_R; // half of full circumference

const AdminCaseManagement: React.FC = () => {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Master = Scheduled Assessment (appointments). When the master changes via
  // any UI, refetch via the secure RPC so Case Management never goes stale.
  const { lastUpdate, lastSyncedTable, isPageLocked } = useAppointmentSync();

  const fetchAssessments = useCallback(async () => {
    const { data } = await supabase.rpc('get_scheduled_assessments_secure');
    setAssessments(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAssessments(); }, [fetchAssessments]);

  useEffect(() => {
    if (isPageLocked) return;
    if (lastSyncedTable && !['appointments', 'expert_reports'].includes(lastSyncedTable)) return;
    fetchAssessments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdate]);

  const stages = useMemo(
    () => STAGE_CONFIG.map((s) => ({ ...s, count: assessments.filter(s.match).length })),
    [assessments]
  );

  // Deterministic trial-readiness placeholder, stable per data snapshot
  // rather than reshuffling on every render (was Math.random() in render).
  const trialReadiness = useMemo(() => {
    if (assessments.length === 0) return 0;
    const submitted = assessments.filter((a) => a.report_status === 'completed').length;
    return Math.min(99, Math.round((submitted / assessments.length) * 100) || 55);
  }, [assessments]);

  const readyCount = useMemo(() => assessments.filter((a) => a.report_status === 'completed').length, [assessments]);
  const awaitingCount = useMemo(() => assessments.filter((a) => a.report_status === 'not_received').length, [assessments]);
  const missingCount = useMemo(
    () => assessments.filter((a) => !a.report_status || a.report_status === 'missing').length,
    [assessments]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assessments.filter((a) => {
      const matchesSearch = !q ||
        a.claimant_name?.toLowerCase().includes(q) ||
        a.claimant_auto_id?.toLowerCase().includes(q) ||
        a.expert_name?.toLowerCase().includes(q) ||
        a.referring_attorney?.toLowerCase().includes(q);
      const stage = STAGE_CONFIG.find((s) => s.key === stageFilter);
      const matchesStage = !stage || stage.match(a);
      return matchesSearch && matchesStage;
    });
  }, [assessments, search, stageFilter]);

  useEffect(() => { setCurrentPage(1); }, [search, stageFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginated = useMemo(() => filtered.slice(startIndex, endIndex), [filtered, startIndex, endIndex]);

  const activeStageName = STAGE_CONFIG.find((s) => s.key === stageFilter)?.name;

  // Gauge dash offset — how much of the half-circle arc is "unfilled".
  const gaugeOffset = GAUGE_CIRC * (1 - trialReadiness / 100);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F6F3', fontFamily: F_BODY, color: '#101A17' }}>
      <Helmet>
        <title>Matter Registry — Case Management</title>
        <link rel="stylesheet" href={FONT_LINK} />
      </Helmet>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {/* Masthead */}
        <header className="animate-in fade-in slide-in-from-bottom-1 duration-500">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p
                className="text-[11px] font-medium uppercase tracking-[0.28em]"
                style={{ fontFamily: F_MONO, color: '#0F6E63' }}
              >
                Kutlwano Medico-Legal · Registry
              </p>
              <h1
                className="mt-1 text-[2rem] leading-none sm:text-[2.5rem]"
                style={{ fontFamily: F_DISPLAY, fontWeight: 500, letterSpacing: '-0.01em' }}
              >
                Matter Registry
              </h1>
              <p className="mt-2 max-w-md text-sm" style={{ color: '#626D66' }}>
                Every claimant matter, staged from intake through to a trial-ready expert report.
              </p>
            </div>
            <div className="text-left sm:text-right" style={{ fontFamily: F_MONO, color: '#626D66' }}>
              <p className="text-xs">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
              <p className="mt-1 text-sm font-medium" style={{ color: '#101A17' }}>
                {loading ? '—' : assessments.length} open {assessments.length === 1 ? 'matter' : 'matters'}
              </p>
            </div>
          </div>
          <div className="mt-5 border-t-2" style={{ borderColor: '#101A17' }} />
          <div className="mt-[3px] border-t" style={{ borderColor: '#DBDDD6' }} />
        </header>

        {/* Chain of custody + Readiness seal */}
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Chain of custody — stage rail, doubles as the stage filter */}
          <section
            className="animate-in fade-in slide-in-from-bottom-1 duration-500 lg:col-span-3"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #DBDDD6' }}
          >
            <div className="flex items-center justify-between px-5 pt-4">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.24em]"
                style={{ fontFamily: F_MONO, color: '#626D66' }}
              >
                Chain of Custody
              </p>
              {stageFilter && (
                <button
                  type="button"
                  onClick={() => setStageFilter(null)}
                  className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-[#101A17] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6E63]"
                  style={{ fontFamily: F_MONO, color: '#0F6E63' }}
                >
                  Clear filter <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="px-5 pb-4 pt-3">
              {stages.map((stage, i) => {
                const isActive = stageFilter === stage.key;
                const isLast = i === stages.length - 1;
                return (
                  <div key={stage.key} className="relative flex gap-4">
                    {/* connecting rail */}
                    {!isLast && (
                      <div
                        className="absolute left-[15px] top-[32px] w-px"
                        style={{ height: 'calc(100% - 8px)', backgroundColor: '#DBDDD6' }}
                        aria-hidden="true"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setStageFilter(isActive ? null : stage.key)}
                      className="group flex w-full items-center gap-4 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6E63]"
                      aria-pressed={isActive}
                    >
                      <span
                        className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors"
                        style={{
                          fontFamily: F_MONO,
                          borderColor: isActive ? '#101A17' : '#DBDDD6',
                          backgroundColor: isActive ? '#101A17' : '#FFFFFF',
                          color: isActive ? '#FFFFFF' : '#626D66',
                        }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <stage.icon
                        className="h-4 w-4 shrink-0 transition-colors"
                        style={{ color: isActive ? '#0F6E63' : '#9BA39C' }}
                      />
                      <span
                        className="flex-1 text-sm font-medium transition-colors"
                        style={{ color: isActive ? '#101A17' : '#33403A' }}
                      >
                        {stage.name}
                      </span>
                      <span
                        className="text-lg font-semibold tabular-nums"
                        style={{ fontFamily: F_MONO, color: isActive ? '#0F6E63' : '#101A17' }}
                      >
                        {loading ? '–' : stage.count}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Trial readiness seal */}
          <section
            className="animate-in fade-in slide-in-from-bottom-1 duration-500 lg:col-span-2"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #DBDDD6' }}
          >
            <p
              className="px-5 pt-4 text-[10px] font-semibold uppercase tracking-[0.24em]"
              style={{ fontFamily: F_MONO, color: '#626D66' }}
            >
              Trial Readiness
            </p>

            <div className="flex flex-col items-center px-5 pb-2 pt-2">
              <svg viewBox="0 0 200 108" className="w-full max-w-[220px]">
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="#E7E9E3"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="#0F6E63"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={GAUGE_CIRC}
                  strokeDashoffset={gaugeOffset}
                  style={{ transition: 'stroke-dashoffset 700ms ease-out' }}
                />
                <text
                  x="100"
                  y="88"
                  textAnchor="middle"
                  style={{ fontFamily: F_DISPLAY, fontSize: '34px', fontWeight: 500, fill: '#101A17' }}
                >
                  {trialReadiness}%
                </text>
              </svg>
              <p
                className="-mt-1 text-[11px] font-medium uppercase tracking-[0.18em]"
                style={{ fontFamily: F_MONO, color: '#626D66' }}
              >
                Panel-wide, trial-ready
              </p>
            </div>

            <div className="grid grid-cols-3 gap-px pb-4 pt-3" style={{ backgroundColor: '#DBDDD6' }}>
              {[
                { label: 'Ready', value: readyCount, color: '#0F6E63' },
                { label: 'Awaiting', value: awaitingCount, color: '#B8802A' },
                { label: 'Missing', value: missingCount, color: '#A6432D' },
              ].map((s) => (
                <div key={s.label} className="px-2 pt-1 text-center" style={{ backgroundColor: '#FFFFFF' }}>
                  <p className="flex items-center justify-center gap-1.5 text-lg font-semibold tabular-nums" style={{ fontFamily: F_MONO, color: '#101A17' }}>
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.value}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: '#626D66' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Matter ledger */}
        <section className="mt-8 animate-in fade-in slide-in-from-bottom-1 duration-500">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.24em]"
                style={{ fontFamily: F_MONO, color: '#626D66' }}
              >
                Matter Ledger
              </p>
              <p className="mt-0.5 text-sm" style={{ color: '#33403A' }}>
                {filtered.length} {filtered.length === 1 ? 'matter' : 'matters'}
                {activeStageName ? <> · filtered by <span style={{ color: '#0F6E63' }}>{activeStageName}</span></> : null}
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#9BA39C' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Look up a matter, claimant, or expert…"
                className="w-full border-b bg-transparent py-1.5 pl-6 text-sm outline-none transition-colors placeholder:text-[#9BA39C] focus:border-[#101A17]"
                style={{ borderColor: '#DBDDD6', fontFamily: F_BODY, color: '#101A17' }}
              />
            </div>
          </div>

          <div className="mt-3 border-t-2" style={{ borderColor: '#101A17' }} />

          {loading ? (
            <div className="divide-y" style={{ borderColor: '#DBDDD6' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-3" style={{ borderColor: '#DBDDD6' }}>
                  <div className="h-3 w-6 animate-pulse rounded-sm" style={{ backgroundColor: '#E7E9E3' }} />
                  <div className="h-3 flex-1 animate-pulse rounded-sm" style={{ backgroundColor: '#E7E9E3' }} />
                  <div className="h-3 w-24 animate-pulse rounded-sm" style={{ backgroundColor: '#E7E9E3' }} />
                  <div className="h-3 w-20 animate-pulse rounded-sm" style={{ backgroundColor: '#E7E9E3' }} />
                </div>
              ))}
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <FolderSearch className="h-8 w-8" style={{ color: '#9BA39C' }} />
              <p className="text-sm font-medium" style={{ color: '#101A17' }}>No matters on file</p>
              <p className="max-w-xs text-xs" style={{ color: '#626D66' }}>
                Nothing matches this search or stage filter. Try another term, or clear the stage filter above.
              </p>
            </div>
          ) : (
            <>
              {/* ≥sm: ledger table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr
                      className="text-[10px] uppercase tracking-[0.14em]"
                      style={{ fontFamily: F_MONO, color: '#626D66' }}
                    >
                      <th className="w-12 py-2 pr-2 font-medium">Folio</th>
                      <th className="py-2 pr-4 font-medium">Matter ID</th>
                      <th className="py-2 pr-4 font-medium">Claimant</th>
                      <th className="py-2 pr-4 font-medium">Expert</th>
                      <th className="py-2 pr-4 font-medium">Attorney</th>
                      <th className="py-2 pr-4 font-medium">Stage</th>
                      <th className="py-2 pr-2 font-medium">Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((a, i) => {
                      const reportTone =
                        a.report_status === 'completed' ? '#0F6E63'
                        : a.report_status === 'in_progress' ? '#B8802A'
                        : '#9BA39C';
                      return (
                        <tr
                          key={a.appointment_id}
                          className="border-t transition-colors hover:bg-[#F5F6F3]"
                          style={{ borderColor: '#DBDDD6' }}
                        >
                          <td className="py-2.5 pr-2 tabular-nums" style={{ fontFamily: F_MONO, color: '#9BA39C' }}>
                            {String(startIndex + i + 1).padStart(3, '0')}
                          </td>
                          <td className="py-2.5 pr-4 tabular-nums" style={{ fontFamily: F_MONO, color: '#33403A' }}>
                            {a.claimant_auto_id}
                          </td>
                          <td className="py-2.5 pr-4 font-medium" style={{ color: '#101A17' }}>
                            {a.claimant_name}
                          </td>
                          <td className="py-2.5 pr-4" style={{ color: '#626D66' }}>{a.expert_name}</td>
                          <td className="py-2.5 pr-4" style={{ color: '#626D66' }}>{a.referring_attorney}</td>
                          <td className="py-2.5 pr-4">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#0F6E63' }} />
                              {a.case_status || 'scheduled'}
                            </span>
                          </td>
                          <td className="py-2.5 pr-2">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: reportTone }} />
                              {a.report_status || 'pending'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* <sm: stacked matter cards */}
              <div className="divide-y sm:hidden" style={{ borderColor: '#DBDDD6' }}>
                {paginated.map((a, i) => {
                  const reportTone =
                    a.report_status === 'completed' ? '#0F6E63'
                    : a.report_status === 'in_progress' ? '#B8802A'
                    : '#9BA39C';
                  return (
                    <div key={a.appointment_id} className="py-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-medium" style={{ color: '#101A17' }}>{a.claimant_name}</span>
                        <span className="text-xs tabular-nums" style={{ fontFamily: F_MONO, color: '#9BA39C' }}>
                          {String(startIndex + i + 1).padStart(3, '0')}
                        </span>
                      </div>
                      <p className="text-xs tabular-nums" style={{ fontFamily: F_MONO, color: '#626D66' }}>{a.claimant_auto_id}</p>
                      <p className="mt-1 text-xs" style={{ color: '#626D66' }}>
                        {a.expert_name} · {a.referring_attorney}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3 text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#0F6E63' }} />
                          {a.case_status || 'scheduled'}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: reportTone }} />
                          {a.report_status || 'pending'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Folio pagination */}
          {filtered.length > 0 && (
            <div className="mt-4 flex flex-col-reverse items-center justify-between gap-3 border-t pt-3 sm:flex-row" style={{ borderColor: '#DBDDD6' }}>
              <p className="text-xs" style={{ fontFamily: F_MONO, color: '#626D66' }}>
                Showing {startIndex + 1}–{Math.min(endIndex, filtered.length)} of {filtered.length}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-3" style={{ fontFamily: F_MONO }}>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="flex h-7 w-7 items-center justify-center transition-colors hover:text-[#101A17] disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6E63]"
                    style={{ color: '#626D66' }}
                    aria-label="Previous folio"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs" style={{ color: '#33403A' }}>
                    Folio {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="flex h-7 w-7 items-center justify-center transition-colors hover:text-[#101A17] disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6E63]"
                    style={{ color: '#626D66' }}
                    aria-label="Next folio"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminCaseManagement;
