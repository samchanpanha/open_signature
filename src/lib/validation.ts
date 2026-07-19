export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidColor(color: string): boolean {
  const colorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
  return colorRegex.test(color);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeString(str: string, maxLength: number = 1000): string {
  return str.trim().slice(0, maxLength);
}
