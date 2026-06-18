// In-memory + sessionStorage-backed single-session token tracker.
// We use sessionStorage so a page refresh in the same tab keeps the token,
// but a brand-new tab/window doesn't inherit it (cross-tab leak avoidance).

const KEY = "mlp_session_token";

export function setSessionToken(token: string) {
  try { sessionStorage.setItem(KEY, token); } catch { /* ignore */ }
}
export function getSessionToken(): string | null {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}
export function clearSessionToken() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
