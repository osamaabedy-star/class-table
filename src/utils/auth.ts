/**
 * Client-side Authentication Token Helper
 * Stores and retrieves JWT session token for Admin Portal
 */

const TOKEN_KEY = 'riyadh_admin_jwt_token';
const EMAIL_KEY = 'riyadh_admin_email';

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string, email?: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem('riyadh_admin_auth', 'true');
    if (email) {
      localStorage.setItem(EMAIL_KEY, email);
    }
  } catch {
    // ignore
  }
}

export function clearAdminToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('riyadh_admin_auth');
    localStorage.removeItem(EMAIL_KEY);
  } catch {
    // ignore
  }
}

export function getAdminAuthHeaders(): Record<string, string> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Host Token Management for Online Rooms
 * Ensures only the creator / teacher has control over starting, ending, and question navigation
 */
export function getRoomHostToken(roomId: string): string | null {
  if (typeof window === 'undefined' || !roomId) return null;
  try {
    return localStorage.getItem(`room_host_token_${roomId.trim().toUpperCase()}`);
  } catch {
    return null;
  }
}

export function setRoomHostToken(roomId: string, token: string): void {
  if (typeof window === 'undefined' || !roomId || !token) return;
  try {
    localStorage.setItem(`room_host_token_${roomId.trim().toUpperCase()}`, token.trim());
  } catch {
    // ignore
  }
}

export function clearRoomHostToken(roomId: string): void {
  if (typeof window === 'undefined' || !roomId) return;
  try {
    localStorage.removeItem(`room_host_token_${roomId.trim().toUpperCase()}`);
  } catch {
    // ignore
  }
}

export function getHostAuthHeaders(roomId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (roomId) {
    const hostToken = getRoomHostToken(roomId);
    if (hostToken) {
      headers['x-host-token'] = hostToken;
    }
  }
  const adminToken = getAdminToken();
  if (adminToken) {
    headers['Authorization'] = `Bearer ${adminToken}`;
  }
  return headers;
}

