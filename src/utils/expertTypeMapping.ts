/**
 * Expert Type Mapping and Normalization Utilities
 * Handles all expert type variations and display names across the system
 */

export const expertTypeMapping: Record<string, string> = {
  // Standard mappings - alphabetically sorted for maintainability
  "accident_specialist": "Accident Specialist",
  "anaesthesiologist": "Anaesthesiologist",
  "anesthesiologist": "Anaesthesiologist",
  "audiologist": "Audiologist",
  "biokineticist": "Biokineticist",
  "biokinetisist": "Biokineticist",
  "cardiologist": "Cardiologist",
  "clinical_psychologist": "Clinical Psychologist",
  "dermatologist": "Dermatologist",
  "emergency_medicine": "Emergency Medicine Specialist",
  "endocrinologist": "Endocrinologist",
  "ent": "ENT Surgeon",
  "ent_surgeon": "ENT Surgeon",
  "family_medicine": "Family Medicine Specialist",
  "forensic_pathologist": "Forensic Pathologist",
  "gastroenterologist": "Gastroenterologist",
  "general_practitioner": "General Practitioner",
  "general_surgeon": "General Surgeon",
  "gp": "General Practitioner",
  "internal_medicine": "Internal Medicine Specialist",
  "maxillo": "Maxillofacial Surgeon",
  "maxillofacial": "Maxillofacial Surgeon",
  "maxillofacial_surgeon": "Maxillofacial Surgeon",
  "midwife": "Midwife",
  "neurologist": "Neurologist",
  "neurosurgeon": "Neurosurgeon",
  "nurse": "Nurse",
  "occupational_therapist": "Occupational Therapist",
  "oncologist": "Oncologist",
  "ophthalmologist": "Ophthalmologist",
  "orthopedic": "Orthopaedic Surgeon",
  "orthopedic_surgeon": "Orthopaedic Surgeon",
  "orthopaedic": "Orthopaedic Surgeon",
  "orthopaedic_surgeon": "Orthopaedic Surgeon",
  "pathologist": "Pathologist",
  "physiotherapist": "Physiotherapist",
  "plastic_surgeon": "Plastic Surgeon",
  "psychiatrist": "Psychiatrist",
  "pulmonologist": "Pulmonologist",
  "radiologist": "Radiologist",
  "rheumatologist": "Rheumatologist",
  "speech_therapist": "Speech Therapist",
  "urologist": "Urologist",
};

/**
 * Normalize expert type to standard database format
 * @param type - The expert type string to normalize
 * @returns Normalized expert type in snake_case format
 */
export const normalizeExpertType = (type: string): string => {
  const normalized = type.toLowerCase().trim().replace(/\s+/g, '_');
  
  // Handle common variations
  if (normalized === 'ent' || normalized.includes('ent_')) {
    return 'ent_surgeon';
  }
  if (normalized.includes('orthopedic') || normalized.includes('orthopaedic')) {
    return 'orthopedic_surgeon';
  }
  if (normalized.includes('maxillo')) {
    return 'maxillofacial_surgeon';
  }
  if (normalized === 'gp') {
    return 'general_practitioner';
  }
  if (normalized.includes('anaesth') || normalized.includes('anesth')) {
    return 'anesthesiologist';
  }
  if (normalized.includes('biokinet')) {
    return 'biokinetisist';
  }
  
  return normalized;
};

/**
 * Format expert type for display
 * @param type - The expert type string to format
 * @returns Formatted display name
 */
export const formatExpertType = (type: string): string => {
  const normalized = normalizeExpertType(type);
  
  // Check if we have a mapping
  if (expertTypeMapping[normalized]) {
    return expertTypeMapping[normalized];
  }
  
  // Fallback: convert snake_case to Title Case
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Get all unique expert types from a database query result
 * @param experts - Array of experts from database
 * @returns Array of unique expert types with display names
 */
export const getUniqueExpertTypes = (experts: Array<{ expert_type: string }>): Array<{ value: string; label: string }> => {
  const uniqueTypes = new Set<string>();
  
  experts.forEach(expert => {
    const normalized = normalizeExpertType(expert.expert_type);
    uniqueTypes.add(normalized);
  });
  
  return Array.from(uniqueTypes)
    .map(type => ({
      value: type,
      label: formatExpertType(type)
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

/**
 * Check if an expert type matches a filter (case-insensitive, handles variations)
 * @param expertType - The expert type to check
 * @param filterType - The filter type to match against
 * @returns True if the types match
 */
export const matchesExpertType = (expertType: string, filterType: string): boolean => {
  if (filterType === 'all') return true;
  
  const normalizedExpert = normalizeExpertType(expertType);
  const normalizedFilter = normalizeExpertType(filterType);
  
  return normalizedExpert === normalizedFilter;
};
