/**
 * Helper to guarantee public, shareable URLs for friends and students.
 * In the AI Studio preview environment:
 * - ais-dev-* requires developer Google Cloud authentication (friends cannot open it).
 * - ais-pre-* is the public preview URL that ANY device, friend, or student can open freely.
 */
export function getPublicUrl(path: string = ''): string {
  if (typeof window === 'undefined') return path;
  
  let origin = window.location.origin;
  if (origin.includes('ais-dev-')) {
    origin = origin.replace('ais-dev-', 'ais-pre-');
  }
  
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${path ? cleanPath : ''}`;
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
