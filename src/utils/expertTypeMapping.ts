/**
 * Expert Type Mapping and Normalization Utilities
 * Handles all expert type variations and display names across the system
 */

export const expertTypeMapping: Record<string, string> = {
  // Standard mappings
  "neurosurgeon": "Neurosurgeon",
  "orthopedic_surgeon": "Orthopaedic Surgeon",
  "orthopedic": "Orthopaedic Surgeon",
  "orthopaedic": "Orthopaedic Surgeon",
  "orthopaedic_surgeon": "Orthopaedic Surgeon",
  "clinical_psychologist": "Clinical Psychologist",
  "psychiatrist": "Psychiatrist",
  "cardiologist": "Cardiologist",
  "pulmonologist": "Pulmonologist",
  "neurologist": "Neurologist",
  "radiologist": "Radiologist",
  "plastic_surgeon": "Plastic Surgeon",
  "general_surgeon": "General Surgeon",
  "emergency_medicine": "Emergency Medicine Specialist",
  "internal_medicine": "Internal Medicine Specialist",
  "rheumatologist": "Rheumatologist",
  "endocrinologist": "Endocrinologist",
  "gastroenterologist": "Gastroenterologist",
  "oncologist": "Oncologist",
  "dermatologist": "Dermatologist",
  "urologist": "Urologist",
  "ophthalmologist": "Ophthalmologist",
  "ent_surgeon": "ENT Surgeon",
  "ent": "ENT Surgeon",
  "maxillo": "Maxillofacial Surgeon",
  "maxillofacial": "Maxillofacial Surgeon",
  "maxillofacial_surgeon": "Maxillofacial Surgeon",
  "anesthesiologist": "Anaesthesiologist",
  "anaesthesiologist": "Anaesthesiologist",
  "pathologist": "Pathologist",
  "forensic_pathologist": "Forensic Pathologist",
  "occupational_therapist": "Occupational Therapist",
  "physiotherapist": "Physiotherapist",
  "biokinetisist": "Biokineticist",
  "biokineticist": "Biokineticist",
  "speech_therapist": "Speech Therapist",
  "audiologist": "Audiologist",
  "general_practitioner": "General Practitioner",
  "gp": "General Practitioner",
  "family_medicine": "Family Medicine Specialist",
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
