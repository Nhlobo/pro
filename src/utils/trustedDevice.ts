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

export async function isBiometricSupported() { try { return typeof PublicKeyCredential !== 'undefined' && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch (e) { console.warn('biometric support check failed', e); return false; } }
export function listTrustedDevices(userEmail?: string) { try { const key = emailKey(userEmail); return key ? read().filter((d) => emailKey(d.userEmail) === key) : read(); } catch (e) { console.warn('trusted device list failed', e); return []; } }
export function isTrustedDeviceEnrolled(userEmail?: string) { return listTrustedDevices(userEmail).length > 0; }
export function getEnrolledEmail() { return read()[0]?.userEmail ?? null; }
export function clearTrustedDevice() { write([]); }
export function removeTrustedDevice(credentialId: string) { write(read().filter((d) => d.credentialId !== credentialId)); }
export function renameTrustedDevice(credentialId: string, label: string) { write(read().map((d) => d.credentialId === credentialId ? { ...d, label } : d)); }
export const getDismissedKey = (email: string) => `${DISMISS_PREFIX}${emailKey(email)}`;

export async function enrollTrustedDevice({ userEmail, label }: { userId: string; userEmail: string; userName?: string; label?: string }) {
  try {
    if (!await isBiometricSupported()) return false;
    const optionsResult = await supabase.functions.invoke('webauthn-register', { body: { action: 'options' } });
    if (optionsResult.error) throw optionsResult.error;
    const { options } = unwrap<{ options: any }>(optionsResult.data);
    const response = await startRegistration({ optionsJSON: options });
    const verifyResult = await supabase.functions.invoke('webauthn-register', { body: { action: 'verify', response, label, userAgent: navigator.userAgent, platform: navigator.platform } });
    if (verifyResult.error) throw verifyResult.error;
    const verified = unwrap<{ verified: boolean; credentialId: string; label: string }>(verifyResult.data);
    if (!verified.verified) return false;
    const without = read().filter((d) => d.credentialId !== verified.credentialId && emailKey(d.userEmail) !== emailKey(userEmail));
    write([...without, { userEmail, credentialId: verified.credentialId, label: verified.label, enrolledAt: new Date().toISOString() }]);
    return true;
  } catch (e) { console.warn('trusted device enrollment failed', e); return false; }
}

export async function verifyTrustedDevice(userEmail?: string) {
  try {
    if (!await isBiometricSupported()) return false;
    const optionsResult = await supabase.functions.invoke('webauthn-authenticate', { body: { action: 'options' } });
    if (optionsResult.error) throw optionsResult.error;
    const { options } = unwrap<{ options: any }>(optionsResult.data);
    const response = await startAuthentication({ optionsJSON: options });
    const verifyResult = await supabase.functions.invoke('webauthn-authenticate', { body: { action: 'verify', response } });
    if (verifyResult.error) throw verifyResult.error;
    const verified = unwrap<{ verified: boolean }>(verifyResult.data).verified;
    if (verified) markUnlocked();
    return verified;
  } catch (e) { console.warn('trusted device verification failed', e); if (userEmail) return false; return false; }
}
export function markUnlocked() { try { sessionStorage.setItem(UNLOCK_KEY, String(Date.now())); } catch (e) { console.warn('trusted device unlock mark failed', e); } }
export function getLastUnlockAgeMs() { try { const at = Number(sessionStorage.getItem(UNLOCK_KEY) || 0); return at ? Date.now() - at : null; } catch { return null; } }

export async function fetchServerDevices(userId?: string) { try { let q = supabase.from('trusted_devices' as any).select('id, credential_id, device_label, platform, user_agent, last_used_at, revoked_at, created_at').order('created_at', { ascending: false }); if (userId) q = q.eq('user_id', userId); const { data, error } = await q; if (error) throw error; return (data ?? []) as ServerTrustedDevice[]; } catch (e) { console.warn('trusted device server fetch failed', e); return []; } }
export async function revokeServerDevice(deviceId: string, reason: string) { try { const { data: auth } = await supabase.auth.getUser(); const { error } = await supabase.from('trusted_devices' as any).update({ revoked_at: new Date().toISOString(), revoked_by: auth.user?.id ?? null, revoked_reason: reason }).eq('id', deviceId); if (error) throw error; return true; } catch (e) { console.warn('trusted device revoke failed', e); return false; } }
export async function renameServerDevice(deviceId: string, label: string) { try { const { error } = await supabase.from('trusted_devices' as any).update({ device_label: label }).eq('id', deviceId); if (error) throw error; return true; } catch (e) { console.warn('trusted device rename failed', e); return false; } }
