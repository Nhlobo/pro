// Client-side mirror of the server password policy. Keep this in sync with
// supabase/functions/_shared/auth-helpers.ts.
export function passwordPolicyMessage(p: string): string | null {
  if (!p || typeof p !== "string") return "Password is required";
  if (p.length < 12) return "Password must be at least 12 characters";
  if (!/[A-Z]/.test(p)) return "Password must contain an uppercase letter";
  if (!/[a-z]/.test(p)) return "Password must contain a lowercase letter";
  if (!/[0-9]/.test(p)) return "Password must contain a number";
  if (!/[^A-Za-z0-9]/.test(p)) return "Password must contain a special character";
  return null;
}
