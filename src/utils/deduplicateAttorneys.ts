export type Attorney = {
  id: string;
  name?: string;
  email?: string;
  email_masked?: string;
  phone?: string;
  phone_masked?: string;
  code?: string;
  claimant_count?: number;
  appointment_count?: number;
  [key: string]: any;
};

/**
 * Removes duplicate attorneys based on email, phone, name, or code
 * Prioritizes attorneys that have existing claimants or appointments
 * @param attorneys - Array of attorney objects
 * @returns Deduplicated array of attorneys (preferring records with linked data)
 */
export const deduplicateAttorneys = <T extends Attorney>(attorneys: T[]): T[] => {
  // Sort attorneys to prioritize those with more linked data (claimants/appointments)
  const sortedAttorneys = [...attorneys].sort((a, b) => {
    const aCount = (a.claimant_count || 0) + (a.appointment_count || 0);
    const bCount = (b.claimant_count || 0) + (b.appointment_count || 0);
    // Also sort by created_at (older records first) as a tiebreaker
    if (aCount !== bCount) return bCount - aCount;
    // If both have same count, prefer older record (lower id typically means older)
    return 0;
  });

  return sortedAttorneys.reduce((acc: T[], current) => {
    const emailToCheck = current.email_masked || current.email;
    const phoneToCheck = current.phone_masked || current.phone;
    const nameToCheck = current.name?.toLowerCase().trim();
    
    const isDuplicate = acc.some(attorney => {
      const existingEmail = attorney.email_masked || attorney.email;
      const existingPhone = attorney.phone_masked || attorney.phone;
      const existingName = attorney.name?.toLowerCase().trim();
      
      return (
        // Check for name match (exact match, case-insensitive)
        (nameToCheck && existingName && nameToCheck === existingName) ||
        // Check for email match
        (emailToCheck && existingEmail && emailToCheck === existingEmail) ||
        // Check for phone match
        (phoneToCheck && existingPhone && phoneToCheck === existingPhone) ||
        // Check for code match
        (current.code && attorney.code === current.code && current.code !== null)
      );
    });
    
    if (!isDuplicate) {
      acc.push(current);
    }
    
    return acc;
  }, []);
};

/**
 * Find the primary (canonical) attorney record from duplicates
 * Returns the one with the most linked data (claimants/appointments)
 * @param attorneys - Array of potentially duplicate attorneys
 * @param targetName - The name to search for
 * @returns The primary attorney record or undefined
 */
export const findPrimaryAttorney = <T extends Attorney>(attorneys: T[], targetName: string): T | undefined => {
  const matches = attorneys.filter(a => 
    a.name?.toLowerCase().trim() === targetName.toLowerCase().trim()
  );
  
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];
  
  // Sort by linked data count (descending), then by created_at if available
  return matches.sort((a, b) => {
    const aCount = (a.claimant_count || 0) + (a.appointment_count || 0);
    const bCount = (b.claimant_count || 0) + (b.appointment_count || 0);
    return bCount - aCount;
  })[0];
};
