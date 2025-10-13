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
 * Format: ContactInitial + FirmInitial + YYYYMM
 */
export function generateLawFirmCodeBase(contactName: string, firmName: string): string {
  const n = (contactName?.trim()?.charAt(0) || "X").toUpperCase().replace(/[^A-Z]/g, "X");
  const f = (firmName?.trim()?.charAt(0) || "X").toUpperCase().replace(/[^A-Z]/g, "X");
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${n}${f}${yyyy}${mm}`;
}

/**
 * Generate law firm code with unique sequence number
 * This should be called with the next sequence number from the database
 * Format: ContactInitial + FirmInitial + YYYYMM + SequenceNumber (4 digits)
 */
export function generateLawFirmCode(contactName: string, firmName: string, sequenceNumber: number): string {
  const base = generateLawFirmCodeBase(contactName, firmName);
  const seq = String(sequenceNumber).padStart(4, "0");
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