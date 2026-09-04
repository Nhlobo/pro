import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths } from 'date-fns';

export interface SalesConsultantPitchStats {
  totalPitches: number;
  totalClosed: number;
  thisMonthClosed: number;
  lastMonthClosed: number;
  attributed: number;
  pitched: number;
  rePitched: number;
  followedUp: number;
  interested: number;
  conversionRate: string;
  practiceBreakdown: Record<string, number>;
  provinceBreakdown: Record<string, number>;
  recentDeals: { firmName: string; date: string | null; practiceArea: string | null }[];
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Live pitching-activity + deal-closed stats for one sales consultant.
 * Used by SalesConsultantStats — on Index.tsx (the sales consultant's own
 * home screen, identified via their own auth session) and inside
 * EditProfileDialog when an admin edits someone else's profile (identified
 * via that other person's profile id, which is the same id as auth.users).
 *
 * Identity resolution: `userId` (auth.uid() for the person these stats
 * belong to) is the primary and preferred way to find their
 * sales_consultants row — the same `sales_consultants.user_id = auth.uid()`
 * pattern used everywhere else this data model appears (useSalesIncentives,
 * monthly_performance RLS, and attorney_pitchlog's consultant_id + RLS added
 * 2026-09-01). This is also what attorney_pitchlog's RLS now actually
 * requires: a sales consultant can only SELECT rows whose consultant_id
 * resolves back to their own auth.uid(), so a name-only lookup can silently
 * return nothing for a legitimately logged-in consultant even when they
 * have real data.
 *
 * `firstName`/`lastName` are kept as a fallback ONLY for the (hopefully
 * shrinking) set of sales_consultants rows that predate the user_id link,
 * so this card doesn't go blank for anyone not yet backfilled. Once every
 * consultant row has a user_id, the name-matching branch below is dead code
 * and can be deleted.
 */
export const useSalesConsultantStats = (userId: string | undefined, firstName: string, lastName?: string) => {
  const consultantName = firstName?.trim();

  // Preferred path: resolve this person's own sales_consultants row via
  // their auth user id — matches how RLS actually scopes their data.
  const { data: ownConsultant, isLoading: loadingOwnConsultant } = useQuery({
    queryKey: ['sales-consultant-by-user-id', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_consultants')
        .select('id, name')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch sales_consultants to find this consultant's ID by name — only
  // needed as a fallback when there's no user_id-linked row yet.
  const { data: salesConsultants = [] } = useQuery({
    queryKey: ['sales-consultants-for-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_consultants')
        .select('id, name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!consultantName && !ownConsultant && !loadingOwnConsultant,
  });

  const matchedConsultantId = React.useMemo(() => {
    // 1) Own row found via auth uid — always wins, never overridden by a
    // name guess.
    if (ownConsultant) return ownConsultant.id;
    if (loadingOwnConsultant) return null;

    // 2) Legacy fallback: name-based matching for consultants not yet
    // linked to a user_id.
    if (!consultantName) return null;
    const fullTarget = normalise(consultantName + (lastName ? ' ' + lastName : ''));
    const targetFirst = normalise(consultantName);
    const targetLast = lastName ? normalise(lastName) : '';

    let match = salesConsultants.find(c => normalise(c.name) === fullTarget);
    if (!match && targetLast) {
      match = salesConsultants.find(c => {
        const n = normalise(c.name);
        return n.includes(targetFirst) && n.includes(targetLast);
      });
    }
    if (!match) {
      const firstMatches = salesConsultants.filter(c => {
        const n = normalise(c.name);
        return n.startsWith(targetFirst) || n.includes(targetFirst);
      });
      if (firstMatches.length === 1) match = firstMatches[0];
    }
    return match?.id || null;
  }, [ownConsultant, loadingOwnConsultant, consultantName, lastName, salesConsultants]);

  const resolvedName = ownConsultant?.name || consultantName;

  // Fetch pitchlog entries for this consultant — primarily by the real
  // consultant_id link (also what RLS enforces for a sales_consultant
  // session), with a name-ilike union kept only to surface older rows that
  // predate the 2026-09-01 backfill and never got a consultant_id.
  const { data: pitchlogEntries = [], isLoading: loadingPitchlog } = useQuery({
    queryKey: ['sales-consultant-pitchlog', matchedConsultantId, consultantName],
    queryFn: async () => {
      if (!matchedConsultantId && !consultantName) return [];

      const selectCols = 'id, pitch_status, deal_closed, deal_closed_date, month_year, law_firm_name, practice_area, province, matched_referring_attorney_id, consultant_id, created_at';

      let byIdRows: any[] = [];
      if (matchedConsultantId) {
        const { data, error } = await supabase.from('attorney_pitchlog').select(selectCols).eq('consultant_id', matchedConsultantId);
        if (error) throw error;
        byIdRows = data || [];
      }

      let byNameRows: any[] = [];
      if (consultantName) {
        const { data, error } = await supabase.from('attorney_pitchlog').select(selectCols).is('consultant_id', null).ilike('sales_person', `%${consultantName}%`);
        if (error) throw error;
        byNameRows = data || [];
      }

      const map = new Map<string, any>();
      [...byIdRows, ...byNameRows].forEach((r: any) => map.set(r.id, r));
      return Array.from(map.values());
    },
    enabled: !!matchedConsultantId || !!consultantName,
  });

  // Fetch referring attorneys for matching
  const { data: referringAttorneys = [] } = useQuery({
    queryKey: ['referring-attorneys-for-consultant-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referring_attorneys')
        .select('id, name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!matchedConsultantId || !!consultantName,
  });

  // Fetch live appointments attributed to this consultant (deals closed)
  // Combines two sources:
  //  (a) appointments.sales_consultant_id = matched consultant id
  //  (b) appointments linked to referring attorneys that this consultant has pitched & closed in attorney_pitchlog
  const { data: appointmentStats = [] } = useQuery({
    queryKey: ['appointment-stats-for-consultant-stats', matchedConsultantId, consultantName, lastName],
    queryFn: async () => {
      if (!consultantName) return [];

      // (a) Direct attribution by sales_consultant_id
      let directRows: any[] = [];
      if (matchedConsultantId) {
        const { data, error } = await supabase
          .from('appointments')
          .select('id, referring_attorney_id, appointment_date, matter_type, sales_consultant_id')
          .is('deleted_at', null)
          .eq('sales_consultant_id', matchedConsultantId);
        if (error) throw error;
        directRows = data || [];
      }

      // (b) Indirect attribution via this consultant's own closed deals in
      // attorney_pitchlog. Prefer the real consultant_id link; only fall
      // back to sales_person name-matching for legacy rows that have no
      // consultant_id yet (same rationale as the pitchlog fetch above —
      // never let a name guess pull in another consultant's closed deals
      // once we have their real id).
      let pitchRows: any[] = [];
      if (matchedConsultantId) {
        const { data, error } = await supabase
          .from('attorney_pitchlog')
          .select('matched_referring_attorney_id, sales_person, deal_closed')
          .eq('deal_closed', true)
          .not('matched_referring_attorney_id', 'is', null)
          .eq('consultant_id', matchedConsultantId);
        if (error) throw error;
        pitchRows = data || [];
      }
      {
        const firstTok = consultantName.trim();
        const lastTok = lastName?.trim();
        let legacyQuery = supabase
          .from('attorney_pitchlog')
          .select('matched_referring_attorney_id, sales_person, deal_closed')
          .eq('deal_closed', true)
          .not('matched_referring_attorney_id', 'is', null)
          .is('consultant_id', null);
        legacyQuery = legacyQuery.or(
          `sales_person.ilike.%${firstTok}%${lastTok ? `,sales_person.ilike.%${lastTok}%` : ''}`
        );
        const { data, error } = await legacyQuery;
        if (error) throw error;
        pitchRows = [...pitchRows, ...(data || [])];
      }

      const attorneyIds = Array.from(
        new Set((pitchRows || []).map((p: any) => p.matched_referring_attorney_id).filter(Boolean))
      );

      let indirectRows: any[] = [];
      if (attorneyIds.length > 0) {
        const { data, error } = await supabase
          .from('appointments')
          .select('id, referring_attorney_id, appointment_date, matter_type, sales_consultant_id')
          .is('deleted_at', null)
          .in('referring_attorney_id', attorneyIds);
        if (error) throw error;
        indirectRows = data || [];
      }

      // Merge & dedupe by appointment id
      const map = new Map<string, any>();
      [...directRows, ...indirectRows].forEach((r) => map.set(r.id, r));
      return Array.from(map.values());
    },
    enabled: !!consultantName,
  });

  const isLoading = loadingPitchlog;

  const stats: SalesConsultantPitchStats | null = React.useMemo(() => {
    if (!consultantName) return null;
    if (pitchlogEntries.length === 0 && appointmentStats.length === 0) return null;

    const all = pitchlogEntries;
    const now = new Date();
    const currentMonth = format(now, 'yyyy-MM');
    const lastMonth = format(subMonths(now, 1), 'yyyy-MM');

    // LIVE deals = scheduled appointments attributed to this sales consultant
    const totalClosed = appointmentStats.length;
    const thisMonthClosed = appointmentStats.filter(a => {
      if (!a.appointment_date) return false;
      return format(new Date(a.appointment_date), 'yyyy-MM') === currentMonth;
    }).length;
    const lastMonthClosed = appointmentStats.filter(a => {
      if (!a.appointment_date) return false;
      return format(new Date(a.appointment_date), 'yyyy-MM') === lastMonth;
    }).length;

    // Build a lookup of RA name by id
    const raById = new Map(referringAttorneys.map(r => [r.id, r.name]));

    // Recent closed deals (last 5) — from live appointments
    const recentDeals = [...appointmentStats]
      .sort((a, b) => (b.appointment_date || '').localeCompare(a.appointment_date || ''))
      .slice(0, 5)
      .map(a => ({
        firmName: raById.get(a.referring_attorney_id) || 'Unknown firm',
        date: a.appointment_date,
        practiceArea: a.matter_type || null,
      }));

    // Practice area breakdown from live appointments
    const practiceBreakdown: Record<string, number> = {};
    appointmentStats.forEach(a => {
      const area = a.matter_type || 'Unknown';
      practiceBreakdown[area] = (practiceBreakdown[area] || 0) + 1;
    });

    // Pitchlog-derived metrics (activity, not deals)
    const totalPitches = all.length;
    const attributed = all.filter(e => e.matched_referring_attorney_id).length;
    const pitched = all.filter(e => e.pitch_status === 'Pitched').length;
    const rePitched = all.filter(e => e.pitch_status === 'Re-pitched').length;
    const followedUp = all.filter(e => e.pitch_status === 'Followed Up').length;
    const interested = all.filter(e => e.pitch_status === 'Interested').length;
    const conversionRate = totalPitches > 0 ? ((totalClosed / totalPitches) * 100).toFixed(1) : '0';

    // Province breakdown of all pitches
    const provinceBreakdown: Record<string, number> = {};
    all.forEach(entry => {
      const province = entry.province || 'Unknown';
      provinceBreakdown[province] = (provinceBreakdown[province] || 0) + 1;
    });

    return {
      totalPitches,
      totalClosed,
      thisMonthClosed,
      lastMonthClosed,
      attributed,
      pitched,
      rePitched,
      followedUp,
      interested,
      conversionRate,
      practiceBreakdown,
      provinceBreakdown,
      recentDeals,
    };
  }, [consultantName, pitchlogEntries, referringAttorneys, appointmentStats]);

  return { consultantName: resolvedName, stats, isLoading };
};

export default useSalesConsultantStats;
