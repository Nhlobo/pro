/**
 * Predicate for the "Potential Attorneys" view in the Attorney Pitchlog.
 *
 * An entry qualifies only when either `identified_challenge` or `comment`
 * is exactly the string "Potential". "Interested" and other values are
 * deliberately excluded.
 */
export interface PotentialEntry {
  identified_challenge?: string | null;
  comment?: string | null;
}

export const isPotentialEntry = (e: PotentialEntry): boolean =>
  e.identified_challenge === 'Potential' || e.comment === 'Potential';
