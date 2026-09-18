/**
 * Utility functions for strict Gmail address validation and verification code generation.
 * Enforces mandatory Gmail registration without phone / SMS OTP.
 */

export function isGmailAddress(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  // Must match user@gmail.com or user@googlemail.com with valid username characters
  const gmailRegex = /^[a-z0-9](\.?[a-z0-9]){2,63}@(gmail\.com|googlemail\.com)$/i;
  return gmailRegex.test(clean);
}

export function getGmailValidationMessage(email: string): string | null {
  if (!email || !email.trim()) {
    return 'Gmail address is required.';
  }
  const clean = email.trim().toLowerCase();
  
  if (!clean.includes('@')) {
    return 'Please enter a complete email address (e.g., yourname@gmail.com).';
  }

  const parts = clean.split('@');
  if (parts.length !== 2) {
    return 'Invalid email address format.';
  }

  const [username, domain] = parts;

  if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
    return `Only Gmail addresses (@gmail.com) are allowed. "${domain}" is not permitted.`;
  }

  if (username.length < 3) {
    return 'Gmail username must be at least 3 characters long.';
  }

  if (username.length > 64) {
    return 'Gmail username exceeds maximum allowed length.';
  }

  if (!/^[a-z0-9.]+$/i.test(username)) {
    return 'Gmail username can only contain letters, numbers, and periods.';
  }

  if (username.startsWith('.') || username.endsWith('.')) {
    return 'Gmail username cannot start or end with a period.';
  }

  if (username.includes('..')) {
    return 'Gmail username cannot contain consecutive periods.';
  }

  return null;
}

export function generateGmailVerificationCode(): string {
  // Generate a random 6-digit verification code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function maskGmailAddress(email: string): string {
  if (!email) return '';
  const clean = email.trim();
  const atIndex = clean.indexOf('@');
  if (atIndex <= 2) return clean;
  const name = clean.substring(0, atIndex);
  const domain = clean.substring(atIndex);
  const visiblePrefix = name.substring(0, 2);
  const visibleSuffix = name.substring(name.length - 1);
  const maskedLength = Math.max(name.length - 3, 3);
  return `${visiblePrefix}${'*'.repeat(maskedLength)}${visibleSuffix}${domain}`;
}
