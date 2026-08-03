// src/utils/expertFeeHistory.ts
//
// Single source of truth for an expert's fee change history.
//
// Fee edits reach the database through three different paths, each of which
// records history in a different place:
//
//   1. Medical Expert Directory form  -> audit_logs (function_area 'expert_fees')
//   2. Expert Credit Control panel    -> expert_fee_change_history
//   3. Any direct table update        -> expert_fee_history (DB trigger)
//
// Reading only one of them (which every screen used to do) makes the history
// look empty even though fees changed, and makes two screens disagree. This
// helper reads all three, normalises them into one shape and de-duplicates
// rows that describe the same change, so every screen shows the same list.

import { supabase } from '@/integrations/supabase/client';

export interface UnifiedFeeHistoryEntry {
  id: string;
  action_type: string;
  old_values: Record<string, number | null>;
  new_values: Record<string, number | null>;
  changed_fields: string[];
  user_email: string | null;
  created_at: string;
  source: 'directory' | 'credit_control' | 'system';
}

export const FEE_FIELD_LABELS: Record<string, string> = {
  consultation_fee_mva: 'Consultation Fee MVA',
  consultation_fee_med_neg: 'Consultation Fee Med Neg',
  merit_fees: 'Merit Fees',
  consultation_fee_per_hour: 'Hourly Rate Fee',
  court_fees: 'Court Fee',
  addendum_fees: 'Addendum Fee',
  affidavit_fees: 'Affidavit Fee',
  joint_minutes_fees: 'Joint Minutes Fee',
  consultation_fees: 'Consultation Fee (Directory)',
};

export const FEE_FIELD_KEYS = Object.keys(FEE_FIELD_LABELS);

const num = (v: any): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);

// Two rows describe the same change when the same field lands on the same
// value within the same minute — e.g. the credit-control insert plus the row
// the database trigger wrote for the very same UPDATE.
const dedupeKey = (field: string, newValue: number | null, iso: string) =>
  `${field}|${newValue ?? 'null'}|${iso.slice(0, 16)}`;

export async function fetchUnifiedFeeHistory(
  expertId: string,
  limit = 100,
): Promise<UnifiedFeeHistoryEntry[]> {
  if (!expertId) return [];

  const [auditRes, ccRes, sysRes] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('id, action_type, old_values, new_values, changed_fields, user_email, created_at')
      .eq('table_name', 'medical_experts')
      .eq('record_id', expertId)
      .eq('function_area', 'expert_fees')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('expert_fee_change_history' as any)
      .select('id, fee_field, old_value, new_value, changed_by_name, source, created_at')
      .eq('expert_id', expertId)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('expert_fee_history' as any)
      .select('id, fee_field, old_value, new_value, changed_by, changed_at')
      .eq('expert_id', expertId)
      .order('changed_at', { ascending: false })
      .limit(limit),
  ]);

  const entries: UnifiedFeeHistoryEntry[] = [];
  const seen = new Set<string>();

  const claim = (fields: string[], values: Record<string, number | null>, iso: string) => {
    const fresh = fields.filter((f) => !seen.has(dedupeKey(f, values[f] ?? null, iso)));
    fresh.forEach((f) => seen.add(dedupeKey(f, values[f] ?? null, iso)));
    return fresh;
  };

  // 1. Directory form edits (richest: multiple fields + user email in one row).
  for (const row of (auditRes.data as any[]) || []) {
    const newValues: Record<string, number | null> = {};
    const oldValues: Record<string, number | null> = {};
    const candidates: string[] = Array.isArray(row.changed_fields) && row.changed_fields.length
      ? row.changed_fields
      : Object.keys(row.new_values || {});
    for (const f of candidates) {
      if (!FEE_FIELD_KEYS.includes(f)) continue;
      newValues[f] = num(row.new_values?.[f]);
      oldValues[f] = num(row.old_values?.[f]);
    }
    const fields = claim(Object.keys(newValues), newValues, row.created_at);
    if (!fields.length) continue;
    entries.push({
      id: `audit-${row.id}`,
      action_type: row.action_type || 'UPDATE',
      old_values: oldValues,
      new_values: newValues,
      changed_fields: fields,
      user_email: row.user_email ?? null,
      created_at: row.created_at,
      source: 'directory',
    });
  }

  // 2. Credit Control edits.
  for (const row of (ccRes.data as any[]) || []) {
    const values = { [row.fee_field]: num(row.new_value) };
    const fields = claim([row.fee_field], values, row.created_at);
    if (!fields.length) continue;
    entries.push({
      id: `cc-${row.id}`,
      action_type: 'UPDATE',
      old_values: { [row.fee_field]: num(row.old_value) },
      new_values: values,
      changed_fields: fields,
      user_email: row.changed_by_name ?? null,
      created_at: row.created_at,
      source: row.source === 'credit_control' ? 'credit_control' : 'directory',
    });
  }

  // 3. Trigger-written rows (catch-all for anything the UI missed).
  const sysRows = ((sysRes.data as any[]) || []).filter((row) => {
    const values = { [row.fee_field]: num(row.new_value) };
    return claim([row.fee_field], values, row.changed_at).length > 0;
  });

  const actorIds = Array.from(new Set(sysRows.map((r) => r.changed_by).filter(Boolean)));
  const actorMap: Record<string, string> = {};
  if (actorIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .in('id', actorIds as string[]);
    (profiles || []).forEach((p: any) => {
      actorMap[p.id] =
        [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || '';
    });
  }

  for (const row of sysRows) {
    entries.push({
      id: `sys-${row.id}`,
      action_type: 'UPDATE',
      old_values: { [row.fee_field]: num(row.old_value) },
      new_values: { [row.fee_field]: num(row.new_value) },
      changed_fields: [row.fee_field],
      user_email: (row.changed_by && actorMap[row.changed_by]) || null,
      created_at: row.changed_at,
      source: 'system',
    });
  }

  return entries
    .filter((e) => e.changed_fields.length > 0)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, limit);
}
