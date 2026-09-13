import { toASCII } from 'punycode';

/**
 * Normalize a domain name to ASCII/Punycode for REG.API.
 * Cyrillic and other IDN labels are converted via Punycode (xn--...).
 */
export function normalizeDomain(domain: string): string {
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.includes('xn--') && !/[^\x00-\x7F]/.test(trimmed)) {
    return trimmed;
  }
  if (!/[^\x00-\x7F]/.test(trimmed)) {
    return trimmed;
  }
  return toASCII(trimmed);
}
