/**
 * Shared ID generation utilities to avoid duplication across forms
 */

/**
 * Generate claimant auto ID
 * Format: FirstInitial + LastInitial + 4 random digits
 */
export function generateClaimantId(firstName: string, lastName: string): string {
  const f = (firstName?.trim()?.charAt(0) || "X").toUpperCase();
  const l = (lastName?.trim()?.charAt(0) || "X").toUpperCase();
  const num = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${f}${l}${num}`;
}

/**
 * Generate law firm code base (without sequence number)
 * Format: FirstInitial + LastInitial + YY + MM
 */
export function generateLawFirmCodeBase(contactName: string, firmName: string): string {
  // Split contact name into first and last name
  const nameParts = contactName?.trim()?.split(/\s+/) || [];
  const firstName = nameParts[0] || "X";
  const lastName = nameParts[nameParts.length - 1] || "X";
  
  // Get first initial of first name and first initial of last name
  const firstInitial = firstName.charAt(0).toUpperCase().replace(/[^A-Z]/g, "X");
  const lastInitial = lastName.charAt(0).toUpperCase().replace(/[^A-Z]/g, "X");
  
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2); // Last 2 digits of year
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${firstInitial}${lastInitial}${yy}${mm}`;
}

/**
 * Generate law firm code with unique sequence number
 * This should be called with the next sequence number from the database
 * Format: FirstInitial + LastInitial + YY + MM + SequenceNumber (2 digits)
 * Example: ST251033 = ST (Steve Thompson initials) + 25 (year) + 10 (month) + 33 (sequence)
 */
export function generateLawFirmCode(contactName: string, firmName: string, sequenceNumber: number): string {
  const base = generateLawFirmCodeBase(contactName, firmName);
  const seq = String(sequenceNumber).padStart(2, "0");
  return `${base}${seq}`;
}

/**
 * Generate medical expert code
 * Format: NameInitial + SurnameInitial + 5 random digits
 */
export function generateExpertCode(name: string, surname: string): string {
  const n = (name?.trim()?.charAt(0) || "X").toUpperCase().replace(/[^A-Z]/g, "X");
  const s = (surname?.trim()?.charAt(0) || "X").toUpperCase().replace(/[^A-Z]/g, "X");
  const randomNumbers = Math.floor(10000 + Math.random() * 90000).toString();
  return `${n}${s}${randomNumbers}`;
}

/**
 * Generate appointment request ID
 * Format: FirstInitial + LastInitial + YYYYMM
 */
export function generateAppointmentRequestId(firstName: string, lastName: string): string {
  const f = (firstName?.trim()?.charAt(0) || "X").toUpperCase().replace(/[^A-Z]/g, "X");
  const l = (lastName?.trim()?.charAt(0) || "X").toUpperCase().replace(/[^A-Z]/g, "X");
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${f}${l}${yyyy}${mm}`;
}