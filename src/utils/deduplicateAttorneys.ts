export type Attorney = {
  id: string;
  name?: string;
  email?: string;
  email_masked?: string;
  phone?: string;
  phone_masked?: string;
  code?: string;
  [key: string]: any;
};

/**
 * Removes duplicate attorneys based on email, phone, or code
 * @param attorneys - Array of attorney objects
 * @returns Deduplicated array of attorneys
 */
export const deduplicateAttorneys = <T extends Attorney>(attorneys: T[]): T[] => {
  return attorneys.reduce((acc: T[], current) => {
    const emailToCheck = current.email_masked || current.email;
    const phoneToCheck = current.phone_masked || current.phone;
    
    const isDuplicate = acc.some(attorney => {
      const existingEmail = attorney.email_masked || attorney.email;
      const existingPhone = attorney.phone_masked || attorney.phone;
      
      return (
        (emailToCheck && existingEmail === emailToCheck) ||
        (phoneToCheck && existingPhone === phoneToCheck) ||
        (current.code && attorney.code === current.code && current.code !== null)
      );
    });
    
    if (!isDuplicate) {
      acc.push(current);
    }
    
    return acc;
  }, []);
};
