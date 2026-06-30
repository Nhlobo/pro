/**
 * Maps an appointment matter_type (from Schedule New Appointment) to the
 * phrase used in the email/PDF sentence:
 *
 *   "...provide a comprehensive medico-legal report in relation to <PHRASE>."
 *
 * Source of truth for matter_type values is the assessment-type select on
 * the New Appointment form (src/pages/NewAppointment.tsx):
 *   MVA / RAF, Medical Negligence, Merit Report, Assault Matter,
 *   Slip and Fall Matter, Joint Minutes, Addendum, Affidavits,
 *   Court Preparation, Court Attendance.
 */
export const getClaimPhraseForMatterType = (matterType?: string | null): string => {
  const t = (matterType || "").toLowerCase().trim();

  if (!t) return "a Road Accident Fund claim";

  // Med Neg
  if (t.includes("neg")) return "a Medical Negligence claim";

  // Affidavits
  if (t.includes("affidavit")) return "an Affidavit in support of the claim";

  // Addendum (post-report)
  if (t.includes("addendum")) return "an Addendum to the previously issued medico-legal report";

  // Joint Minutes (post-report)
  if (t.includes("joint minute")) return "Joint Minutes following the medico-legal assessment";

  // Merit Report
  if (t.includes("merit")) return "a Merit Report on the claim";

  // Assault Matter
  if (t.includes("assault")) return "an Assault Matter claim";

  // Slip and Fall
  if (t.includes("slip") || t.includes("fall")) return "a Slip and Fall Matter claim";

  // Mitigation
  if (t.includes("mitigation")) return "Mitigation in respect of the claim";

  // Court Preparation / Court Attendance
  if (t.includes("court preparation")) return "Court Preparation in respect of the claim";
  if (t.includes("court attendance")) return "Court Attendance in respect of the claim";

  // RAF / MVA explicit
  if (t.includes("raf") || t.includes("mva") || t.includes("road accident")) {
    return "a Road Accident Fund claim";
  }

  // Generic fallback — echo the matter type so the sentence stays meaningful
  return `a ${matterType} matter`;
};
