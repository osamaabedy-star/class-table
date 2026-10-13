/**
 * Helper to build reliable URLs for room links and QR codes.
 * Ensures the generated URL points to the active host (e.g. Vercel, Render, or current host)
 * without dead links or 404s.
 */

const STORAGE_CUSTOM_URL_KEY = 'riyadh_custom_app_base_url';

export function getCustomBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_CUSTOM_URL_KEY) || '';
  } catch {
    return '';
  }
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

export function getPublicUrl(path: string = ''): string {
  if (typeof window === 'undefined') return path;

  // 1. Check if user configured a custom deployed URL (e.g. on Vercel or custom domain)
  const customBase = getCustomBaseUrl();
  let baseOrigin = customBase;

  // 2. Otherwise use current actual window origin and pathname
  if (!baseOrigin) {
    const origin = window.location.origin;
    // Strip trailing slash from pathname (keep subpaths if hosted on GitHub Pages or custom route)
    const pathname = window.location.pathname.replace(/\/+$/, '');
    baseOrigin = `${origin}${pathname}`;
  }

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
