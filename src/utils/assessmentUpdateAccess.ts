/**
 * Access helpers for the Assessment Update page.
 *
 * Internal admin staff (admins, employees, Medico Legal Manager, Case Manager)
 * must always see ALL assessment updates — they must NEVER be filtered by
 * `referring_attorney_id`, even if one is set on their profile. Only true
 * external referring attorneys should ever be scoped.
 */

export interface AssessmentUpdateProfile {
  referring_attorney_id?: string | null;
  role?: string | null;
  user_type?: string | null;
  position?: string | null;
}

export const INTERNAL_ADMIN_POSITIONS = ['Medico Legal Manager', 'Case Manager'];

export const isInternalAdminProfile = (
  profile: AssessmentUpdateProfile | null | undefined
): boolean => {
  if (!profile) return false;
  return (
    profile.role === 'admin' ||
    profile.user_type === 'employee' ||
    INTERNAL_ADMIN_POSITIONS.includes(profile.position || '')
  );
};

/**
 * Returns true only when the appointments query should be scoped to a single
 * referring attorney. Internal staff always return false regardless of any
 * referring_attorney_id stored on their profile.
 */
export const shouldScopeToReferringAttorney = (
  profile: AssessmentUpdateProfile | null | undefined
): boolean => {
  if (isInternalAdminProfile(profile)) return false;
  return Boolean(profile?.referring_attorney_id);
};
