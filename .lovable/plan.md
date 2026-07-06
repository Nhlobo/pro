## Audit findings

**1. Idle logout (15 min inactivity)** — `src/components/IdleLogoutGuard.tsx` is already wired in `App.tsx` (line 174) and correctly:
- Listens for mouse/keyboard/touch/scroll/click activity
- After 15 min idle → shows "Are you still working?" modal with 60s countdown
- Auto-signs out via `useAuth().signOut()` if no response
- Skips activity capture while the prompt is open (so countdown can complete)

Status: **Active and correct.** No code change needed — I'll just verify by reading the flow end-to-end.

**2. Persist session across app close** — `src/integrations/supabase/client.ts` currently uses:
```ts
storage: localStorage,
persistSession: true,
autoRefreshToken: true,
```
This is why closing the tab/app keeps the user signed in on next launch. The user wants the opposite: **closing the app must force a re-sign-in.**

**3. Offline session cap** — `useOfflineRedirect.tsx` already force-signs-out after 15 min offline. Keep as-is.

**4. Cleanup on sign-out** — `useAuth.signOut()` already clears `supabase.auth.*` and `sb-*` keys from `localStorage`. Will extend to also clear `sessionStorage` so the new storage swap stays clean.

---

## Changes (frontend only — no backend, no DB, no edge functions)

### A. Swap Supabase auth storage to `sessionStorage`
File: `src/integrations/supabase/client.ts`
- Change `storage: localStorage` → `storage: sessionStorage`
- Keep `persistSession: true` and `autoRefreshToken: true` so the session survives page refreshes and tab navigations **within the same browser session**, but is dropped the moment the tab/PWA is fully closed.
- Result: closing the browser tab or the installed PWA fully signs the user out; reopening lands on `/auth` (already the default via `ProtectedRoute` + root redirect).

### B. Extend sign-out cleanup to sessionStorage
File: `src/hooks/useAuth.tsx` — `cleanupAuthState()`
- Also iterate `sessionStorage` and remove `supabase.auth.*` / `sb-*` keys, matching the existing localStorage cleanup. Prevents stale tokens if the storage backend is ever toggled again.

### C. Verify (no code change) idle logout
- Re-read `IdleLogoutGuard` + confirm it's mounted once inside `AuthProvider` in `App.tsx`. Already true.
- Confirm the 15-min constant (`IDLE_WARNING_MS = 15 * 60 * 1000`). Already correct.

---

## What I will NOT touch
- Any file under `supabase/` (config, functions, migrations)
- `integrations/supabase/types.ts`
- Any hook that calls RPCs / DB (`useActivityTracker`, permissions, etc.)
- Routing, portal layouts, styling, or business logic
- Backend, database schema, RLS, edge functions

## Risk / trade-offs
- **Multi-tab behavior:** `sessionStorage` is per-tab. If a user opens the app in a second tab, that new tab will require its own sign-in. This is the standard, expected trade-off for "log out on close" and matches the user's request. If they later want single-sign-in across tabs, we can add a `BroadcastChannel` bridge — not included here to keep the change minimal and safe.
- No impact on the offline flow, PWA install, splash, admin styling, or any existing feature.

## Verification steps after implementing
1. Sign in → refresh page → still signed in ✅
2. Sign in → close tab → reopen app URL → lands on `/auth` ✅
3. Sign in → leave idle 15 min → warning modal → 60s countdown → auto sign-out ✅
4. Sign in → click "Yes, I'm still here" → session continues ✅
