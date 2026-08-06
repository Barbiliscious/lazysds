const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A plausible email address - not full RFC 5321 validation, just a typo guard. */
export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
