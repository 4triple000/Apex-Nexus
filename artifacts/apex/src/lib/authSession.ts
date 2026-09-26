/**
 * The signed-in user's session ID (set by AuthContext on login/signup).
 * Server routes that run code require it. It travels in `x-apex-auth` so tools
 * can keep using their own `x-session-id` to scope projects.
 */
const AUTH_SESSION_KEY = "apex_session_id";

export function getAuthSessionId(): string {
  try {
    return localStorage.getItem(AUTH_SESSION_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Headers that identify the signed-in user to the API. */
export function authHeaders(): Record<string, string> {
  const sessionId = getAuthSessionId();
  return sessionId ? { "x-apex-auth": sessionId } : {};
}
