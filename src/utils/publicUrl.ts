/**
 * Helper to build reliable URLs for room links and QR codes.
 * Ensures the generated URL points to the active host (e.g. Vercel, Render, or current host)
 * without dead links or 404s.
 */

export const VERCEL_APP_URL = 'https://class-table-res.vercel.app';
const STORAGE_CUSTOM_URL_KEY = 'riyadh_custom_app_base_url';

export function getCustomBaseUrl(): string {
  if (typeof window === 'undefined') return VERCEL_APP_URL;
  try {
    const saved = localStorage.getItem(STORAGE_CUSTOM_URL_KEY);
    if (saved) return saved;
  } catch {
    // ignore
  }
  return VERCEL_APP_URL;
}

export function setCustomBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (trimmed) {
      localStorage.setItem(STORAGE_CUSTOM_URL_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_CUSTOM_URL_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Get direct URL to join a room through Vercel
 */
export function getVercelRoomUrl(roomId: string): string {
  const code = roomId.trim().toUpperCase();
  return `${VERCEL_APP_URL}/?room=${code}`;
}

export function getPublicUrl(path: string = ''): string {
  if (typeof window === 'undefined') return path;

  // 1. If currently running on Vercel itself, use current origin
  if (window.location.hostname.includes('vercel.app')) {
    const origin = window.location.origin;
    const pathname = window.location.pathname.replace(/\/+$/, '');
    const base = `${origin}${pathname}`;
    if (!path) return base;
    if (path.startsWith('?') || path.startsWith('#')) return `${base}${path}`;
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  // 2. Otherwise default to the official Vercel deployment: https://class-table-res.vercel.app
  const baseOrigin = getCustomBaseUrl() || VERCEL_APP_URL;

  if (!path) return baseOrigin;

  // 3. Format path cleanly whether it starts with '?', '#', or '/'
  if (path.startsWith('?') || path.startsWith('#')) {
    return `${baseOrigin}${path}`;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseOrigin}${cleanPath}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      return successful;
    }
  } catch {
    return false;
  }
}
