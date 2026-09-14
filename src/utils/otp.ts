import crypto from 'crypto';

/**
 * Generates a cryptographically random 4-digit OTP
 */
export function generateServiceOtp(): string {
  const buffer = crypto.randomBytes(2);
  const num = buffer.readUInt16BE(0) % 9000 + 1000;
  return num.toString();
}

/**
 * Generates a unique human-friendly Booking Number: NW-YYYYMMDD-XXXX
 */
export function generateBookingNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `NW-${dateStr}-${rand}`;
}

/**
 * Generates a unique Invoice Number: INV-YYYYMMDD-XXXX
 */
export function generateInvoiceNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `INV-${dateStr}-${rand}`;
}
