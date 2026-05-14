/**
 * Typed Supabase query/mutation helpers for `appointments`.
 *
 * These wrappers force every appointment update to flow through the generated
 * `Database` types so that:
 *   - Update payloads are checked against the real column types.
 *   - `case_status` is always normalised through `toDbCaseStatus` before
 *     hitting the case-sensitive DB check constraint.
 *   - Callers get a fully-typed `Row` back instead of `any`.
 *
 * Use these helpers from hooks/components instead of calling
 * `supabase.from('appointments').update(...)` directly.
 */
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toDbCaseStatus, toUiCaseStatus } from '@/utils/caseStatusMapping';

export type AppointmentRow = Database['public']['Tables']['appointments']['Row'];
export type AppointmentInsert = Database['public']['Tables']['appointments']['Insert'];
export type AppointmentUpdate = Database['public']['Tables']['appointments']['Update'];

/** Discriminated result so callers can branch without try/catch noise. */
export type TypedResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Fully-typed appointment update. Automatically:
 *   - stamps `updated_at`
 *   - normalises `case_status` to the DB-allowed casing
 *   - returns the typed updated row
 */
export async function updateAppointment(
  appointmentId: string,
  patch: AppointmentUpdate,
): Promise<TypedResult<AppointmentRow>> {
  const normalised: AppointmentUpdate = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  if (typeof patch.case_status === 'string') {
    const db = toDbCaseStatus(patch.case_status);
    if (!db) {
      return { ok: false, error: `"${patch.case_status}" is not an allowed case status.` };
    }
    normalised.case_status = db;
  }

  const { data, error } = await supabase
    .from('appointments')
    .update(normalised)
    .eq('id', appointmentId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as AppointmentRow };
}

/**
 * Convenience helper: status-only update returning the canonical UI label
 * alongside the persisted DB value.
 */
export async function updateAppointmentCaseStatus(
  appointmentId: string,
  newStatus: string,
): Promise<TypedResult<{ row: AppointmentRow; dbStatus: string; uiStatus: string }>> {
  const dbStatus = toDbCaseStatus(newStatus);
  if (!dbStatus) {
    return { ok: false, error: `"${newStatus}" is not an allowed case status.` };
  }

  const result = await updateAppointment(appointmentId, { case_status: dbStatus });
  if (!result.ok) {
    const err = (result as { ok: false; error: string }).error;
    return { ok: false, error: err };
  }

  return {
    ok: true,
    data: {
      row: result.data,
      dbStatus,
      uiStatus: toUiCaseStatus(dbStatus),
    },
  };
}

/** Typed single-row fetch by id. */
export async function getAppointmentById(
  appointmentId: string,
): Promise<TypedResult<AppointmentRow>> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as AppointmentRow };
}
