import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'mlp.trusted-devices.v1';
const UNLOCK_KEY = 'mlp.trusted-devices.unlockedAt';
const DISMISS_PREFIX = 'mlp.trusted-devices.dismissed.';

type LocalDevice = { userEmail: string; credentialId: string; label: string; enrolledAt: string };
export type ServerTrustedDevice = { id: string; credential_id: string; device_label: string; platform: string | null; user_agent: string | null; last_used_at: string | null; revoked_at: string | null; created_at: string };

const read = (): LocalDevice[] => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { console.warn('trusted device cache read failed', e); return []; } };
const write = (items: LocalDevice[]) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) { console.warn('trusted device cache write failed', e); } };
const emailKey = (email?: string | null) => (email || '').trim().toLowerCase();
const unwrap = <T>(value: any): T => (value?.success && value?.data ? value.data : value) as T;

const WEBAUTHN_ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError: 'Biometric prompt was cancelled or timed out.',
  SecurityError: 'This page is not a secure/allowed origin for biometric enrollment.',
  InvalidStateError: 'This authenticator is already registered.',
  NotSupportedError: 'Biometric authentication is not supported on this device or browser.',
  AbortError: 'Biometric request was aborted.',
};

/**
 * Extracts a human-readable message from a WebAuthn or Supabase function error.
 *
 * @param e - The thrown error
 * @returns A message safe to display to the user
 */
function getErrorStatus(e: unknown): number | null {
  const ctx = (e as any)?.context;
  return ctx && typeof ctx.status === 'number' ? ctx.status : null;
}

async function describeError(e: unknown): Promise<string> {
  try {
    if (e && typeof e === 'object' && 'name' in e && (e as any).name in WEBAUTHN_ERROR_MESSAGES) {
      return WEBAUTHN_ERROR_MESSAGES[(e as any).name as string];
    }
    const ctx = (e as any)?.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json().catch(() => null);
      if (body?.error?.message) return body.error.message as string;
    }
    if (e instanceof Error && e.message) return e.message;
  } catch {
    // fall through to generic message
  }
  return 'Something went wrong. Please try again.';
}

export type BiometricSupportStatus = 'available' | 'no-webauthn-api' | 'no-platform-authenticator' | 'check-failed';

/**
 * Checks biometric support and distinguishes *why* it's unavailable, so failures
 * can be surfaced with a precise reason instead of a single generic message.
 *
 * @returns The support status plus the raw error when the check itself threw.
 */
export async function getBiometricSupportStatus(): Promise<{ status: BiometricSupportStatus; error?: unknown }> {
  if (typeof PublicKeyCredential === 'undefined') return { status: 'no-webauthn-api' };
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return { status: available ? 'available' : 'no-platform-authenticator' };
  } catch (e) {
    console.warn('biometric support check failed', e);
    return { status: 'check-failed', error: e };
  }
}

const SUPPORT_STATUS_MESSAGES: Record<Exclude<BiometricSupportStatus, 'available'>, string> = {
  'no-webauthn-api': 'This browser does not support biometric sign-in (WebAuthn is unavailable).',
  'no-platform-authenticator': 'No fingerprint, face unlock, or screen lock is set up on this device yet. Set one up in your device settings, then come back and try again.',
  'check-failed': 'The browser blocked the biometric check on this page (this can happen in an embedded preview or restricted context).',
};

export type DevicePlatform = 'android' | 'ios' | 'other';

/**
 * Best-effort detection of the OS platform from the user agent, used only to decide
 * which settings deep link (if any) is safe to offer.
 *
 * @returns 'android', 'ios', or 'other'
 */
export function detectDevicePlatform(): DevicePlatform {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'other';
}

/**
 * Whether we can attempt to deep-link directly into the device's biometric/lock-screen
 * settings. Only Android's `intent://` scheme is reliably honored by mobile browsers;
 * there is no equivalent public API on iOS or desktop, so those platforms fall back to
 * manual instructions instead of a link.
 *
 * @returns `true` only on Android
 */
export function canOpenBiometricSettingsDirectly(): boolean {
  return detectDevicePlatform() === 'android';
}

/**
 * Best-effort manual instructions for enabling a screen lock / biometric, shown when
 * we can't (or the deep link fails to) open settings directly.
 *
 * @param platform - The device platform to tailor instructions for
 * @returns A short human-readable instruction string
 */
export function getManualBiometricSetupInstructions(platform: DevicePlatform): string {
  if (platform === 'ios') return 'Go to Settings > Face ID & Passcode (or Touch ID & Passcode) and set one up.';
  if (platform === 'android') return "Go to Settings > Security (sometimes under 'Security & privacy' or 'Biometrics') and set up a fingerprint, face unlock, or PIN.";
  return "Open your device's Settings app and set up a fingerprint, face unlock, or screen lock, then return to this page.";
}

/**
 * Attempts to open the device's Security settings screen. This is a best-effort,
 * Android-only mechanism using the `intent://` scheme — there is no browser API to open
 * OS settings on any platform, so this is not guaranteed to work on every browser/OS
 * version and should always be paired with manual instructions as a fallback.
 *
 * @returns `true` if the deep link was attempted (Android only), `false` otherwise
 */
export function openBiometricDeviceSettings(): boolean {
  if (!canOpenBiometricSettingsDirectly()) return false;
  try {
    // Launches Android's system Security settings screen, where fingerprint/face
    // enrollment lives. NOTE: this requires the `intent://` scheme (double slash) —
    // Chrome/WebView only recognizes the Intent syntax in that exact form. A single
    // `intent:` with no `//` is not a registered scheme, so the browser just tries to
    // navigate to it as a normal (invalid) URL and does nothing — no error, no prompt,
    // it simply fails silently. `S.browser_fallback_url` gives Android somewhere to go
    // if no app resolves the intent (e.g. some OEM security-settings skins), instead of
    // that same silent no-op.
    //
    // IMPORTANT: this is deliberately NOT `window.location.href = intentUrl`. Assigning
    // location.href forces a real top-level navigation attempt on this exact tab, which
    // is both less reliably honored across Android browsers (Chrome's own docs call this
    // out) and, worse, can cause some browsers to tear down and recreate this tab's JS
    // context when the user returns from Settings. Our Supabase auth token lives in
    // sessionStorage (intentionally — see client.ts), which does not survive that
    // teardown, so that path was silently signing people out. Chrome's documented
    // pattern is to trigger the intent via a real, briefly-appended anchor click instead,
    // which hands off to the Settings app without navigating this page away.
    const fallback = encodeURIComponent(window.location.href);
    const intentUrl = `intent://#Intent;action=android.settings.SECURITY_SETTINGS;S.browser_fallback_url=${fallback};end`;
    const link = document.createElement('a');
    link.href = intentUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => link.remove(), 0);
    return true;
  } catch (e) {
    console.warn('failed to open platform biometric settings', e);
    return false;
  }
}

/**
 * Determines whether the current environment supports biometric authentication.
 *
 * @returns `true` if a user-verifying platform authenticator is available, `false` otherwise.
 */
export async function isBiometricSupported() { return (await getBiometricSupportStatus()).status === 'available'; }
/**
 * Lists locally cached trusted devices, optionally filtered by user email.
 *
 * @param userEmail - Email address used to filter devices after trimming and lowercasing
 * @returns The matching cached trusted devices, or all cached devices when no email is provided
 */
export function listTrustedDevices(userEmail?: string) { try { const key = emailKey(userEmail); return key ? read().filter((d) => emailKey(d.userEmail) === key) : read(); } catch (e) { console.warn('trusted device list failed', e); return []; } }
/**
 * Determines whether a trusted device is enrolled for an email address.
 *
 * @param userEmail - The email address to check.
 * @returns `true` if at least one trusted device is enrolled, `false` otherwise.
 */
export function isTrustedDeviceEnrolled(userEmail?: string) { return listTrustedDevices(userEmail).length > 0; }
/**
 * Retrieves the email address associated with the first locally enrolled device.
 *
 * @returns The enrolled email address, or `null` when no device is cached.
 */
export function getEnrolledEmail() { return read()[0]?.userEmail ?? null; }
/**
 * Clears all locally cached trusted devices.
 */
export function clearTrustedDevice() { write([]); }
/**
 * Removes a locally cached trusted device by credential ID.
 *
 * @param credentialId - The credential ID of the device to remove
 */
export function removeTrustedDevice(credentialId: string) { write(read().filter((d) => d.credentialId !== credentialId)); }
/**
 * Renames a locally cached trusted device.
 *
 * @param credentialId - The credential identifier of the device to rename
 * @param label - The new device label
 */
export function renameTrustedDevice(credentialId: string, label: string) { write(read().map((d) => d.credentialId === credentialId ? { ...d, label } : d)); }
export const getDismissedKey = (email: string) => `${DISMISS_PREFIX}${emailKey(email)}`;

/**
 * Enrolls a biometric authenticator as a trusted device for an email address.
 *
 * @param userEmail - Email address associated with the trusted device
 * @param label - Optional display label for the trusted device
 * @returns `{ ok: true }` if enrollment succeeds, otherwise `{ ok: false, error }` with a display-safe reason
 */
export async function enrollTrustedDevice({ userId, userEmail, label }: { userId: string; userEmail: string; userName?: string; label?: string }): Promise<{ ok: boolean; error?: string; status?: BiometricSupportStatus }> {
  try {
    const support = await getBiometricSupportStatus();
    if (support.status !== 'available') return { ok: false, error: SUPPORT_STATUS_MESSAGES[support.status], status: support.status };
    const optionsResult = await supabase.functions.invoke('webauthn-register', { body: { action: 'options' } });
    if (optionsResult.error) throw optionsResult.error;
    const { options } = unwrap<{ options: any }>(optionsResult.data);
    const response = await startRegistration({ optionsJSON: options });
    const verifyResult = await supabase.functions.invoke('webauthn-register', { body: { action: 'verify', response, label, userAgent: navigator.userAgent, platform: navigator.platform } });
    if (verifyResult.error) throw verifyResult.error;
    const verified = unwrap<{ verified: boolean; credentialId: string; label: string }>(verifyResult.data);
    if (!verified.verified) return { ok: false, error: 'Biometric registration could not be verified.' };

    // Do not mark this browser as enrolled until the server-side trusted-device
    // record is visible. Otherwise a failed/partial enrollment leaves localStorage
    // saying "enabled" while the authenticate function correctly responds with
    // "No enrolled biometric devices for this account" on the next unlock attempt.
    const { data: savedDevice, error: savedDeviceError } = await supabase
      .from('trusted_devices' as any)
      .select('id')
      .eq('user_id', userId)
      .eq('credential_id', verified.credentialId)
      .is('revoked_at', null)
      .maybeSingle();
    if (savedDeviceError || !savedDevice) {
      clearTrustedDevice();
      return {
        ok: false,
        error: 'Biometric registration finished in the browser, but the trusted device was not saved on the server. Please try again or contact support.',
      };
    }

    const without = read().filter((d) => d.credentialId !== verified.credentialId && emailKey(d.userEmail) !== emailKey(userEmail));
    write([...without, { userEmail, credentialId: verified.credentialId, label: verified.label, enrolledAt: new Date().toISOString() }]);
    return { ok: true };
  } catch (e) {
    const error = await describeError(e);
    console.warn('trusted device enrollment failed', e);
    return { ok: false, error };
  }
}

/**
 * Verifies the current user with a trusted biometric device and records a successful unlock.
 *
 * @returns `{ verified: true }` on success, otherwise `{ verified: false, error }` with a display-safe reason.
 */
export async function verifyTrustedDevice(userEmail?: string): Promise<{ verified: boolean; error?: string; status?: BiometricSupportStatus }> {
  try {
    const support = await getBiometricSupportStatus();
    if (support.status !== 'available') return { verified: false, error: SUPPORT_STATUS_MESSAGES[support.status], status: support.status };
    const optionsResult = await supabase.functions.invoke('webauthn-authenticate', { body: { action: 'options' } });
    if (optionsResult.error) {
      if (getErrorStatus(optionsResult.error) === 404) {
        // This browser's local cache says it's enrolled, but the server has no active
        // device on record (revoked, or never actually completed). Clear the stale local
        // flag so the app stops showing a lock screen with no way through, and let the
        // person re-enroll instead.
        clearTrustedDevice();
        return { verified: false, error: 'This device is no longer trusted. Please sign in with your password and enable biometric sign-in again.' };
      }
      throw optionsResult.error;
    }
    const { options } = unwrap<{ options: any }>(optionsResult.data);
    const response = await startAuthentication({ optionsJSON: options });
    const verifyResult = await supabase.functions.invoke('webauthn-authenticate', { body: { action: 'verify', response } });
    if (verifyResult.error) throw verifyResult.error;
    const verified = unwrap<{ verified: boolean }>(verifyResult.data).verified;
    if (verified) markUnlocked();
    return { verified };
  } catch (e) {
    const error = await describeError(e);
    console.warn('trusted device verification failed', e);
    return { verified: false, error };
  }
}
/**
 * Records the current time as the latest trusted-device unlock.
 */
export function markUnlocked() { try { sessionStorage.setItem(UNLOCK_KEY, String(Date.now())); } catch (e) { console.warn('trusted device unlock mark failed', e); } }
/**
 * Gets the elapsed time since the last recorded session unlock.
 *
 * @returns The elapsed time in milliseconds, or `null` when no valid unlock timestamp is available.
 */
export function getLastUnlockAgeMs() { try { const at = Number(sessionStorage.getItem(UNLOCK_KEY) || 0); return at ? Date.now() - at : null; } catch { return null; } }

/**
 * Retrieves trusted devices from the server, optionally filtered by user.
 *
 * @param userId - The user ID used to filter the devices
 * @returns Trusted device records ordered by creation time, or an empty array if retrieval fails
 */
export async function fetchServerDevices(userId?: string) { try { let q = supabase.from('trusted_devices').select('id, credential_id, device_label, platform, user_agent, last_used_at, revoked_at, created_at').order('created_at', { ascending: false }); if (userId) q = q.eq('user_id', userId); const { data, error } = await q; if (error) throw error; return (data ?? []) as ServerTrustedDevice[]; } catch (e) { console.warn('trusted device server fetch failed', e); return []; } }
/**
 * Revokes a server-side trusted device with a specified reason.
 *
 * @param deviceId - The identifier of the device to revoke
 * @param reason - The reason for revocation
 * @returns `true` if the device is revoked successfully, `false` otherwise
 */
export async function revokeServerDevice(deviceId: string, reason: string) { try { const { data: auth } = await supabase.auth.getUser(); const { error } = await supabase.from('trusted_devices' as any).update({ revoked_at: new Date().toISOString(), revoked_by: auth.user?.id ?? null, revoked_reason: reason }).eq('id', deviceId); if (error) throw error; return true; } catch (e) { console.warn('trusted device revoke failed', e); return false; } }
/**
 * Renames a server-side trusted device.
 *
 * @param deviceId - The identifier of the device to rename
 * @param label - The new device label
 * @returns `true` if the device is renamed successfully, `false` otherwise
 */
export async function renameServerDevice(deviceId: string, label: string) { try { const { error } = await supabase.from('trusted_devices' as any).update({ device_label: label }).eq('id', deviceId); if (error) throw error; return true; } catch (e) { console.warn('trusted device rename failed', e); return false; } }
