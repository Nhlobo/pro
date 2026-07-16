import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Mocks -----------------------------------------------------------------

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    from: vi.fn(),
  },
}));

import { startRegistration } from '@simplewebauthn/browser';
import { supabase } from '@/integrations/supabase/client';
import { enrollTrustedDevice, listTrustedDevices, clearTrustedDevice } from '@/utils/trustedDevice';

// --- Helpers -----------------------------------------------------------------

/** Marks (or un-marks) the WebAuthn platform authenticator as available. */
function setBiometricSupport(available: boolean) {
  (globalThis as any).PublicKeyCredential = {
    isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(available),
  };
}

function removeWebAuthnApi() {
  delete (globalThis as any).PublicKeyCredential;
}

/** Builds a chainable fake for `supabase.from('trusted_devices')...maybeSingle()`. */
function mockTrustedDeviceLookup(result: { data: any; error: any }) {
  const eqCalls: Array<[string, unknown]> = [];
  const isCalls: Array<[string, unknown]> = [];
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn((col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return builder;
    }),
    is: vi.fn((col: string, val: unknown) => {
      isCalls.push([col, val]);
      return builder;
    }),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  (supabase.from as any).mockReturnValue(builder);
  return { builder, eqCalls, isCalls };
}

const USER_ID = 'user-123';
const USER_EMAIL = 'jane@example.com';
const CREDENTIAL_ID = 'cred-abc';

function mockSuccessfulWebauthnFlow() {
  (supabase.functions.invoke as any)
    .mockResolvedValueOnce({ data: { options: { challenge: 'c' } }, error: null }) // options
    .mockResolvedValueOnce({
      data: { verified: true, credentialId: CREDENTIAL_ID, label: 'iPhone' },
      error: null,
    }); // verify
  (startRegistration as any).mockResolvedValue({ id: CREDENTIAL_ID });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  setBiometricSupport(true);
});

afterEach(() => {
  removeWebAuthnApi();
});

describe('enrollTrustedDevice', () => {
  it('returns an unavailable status without calling Supabase when WebAuthn API is missing', async () => {
    removeWebAuthnApi();

    const result = await enrollTrustedDevice({ userId: USER_ID, userEmail: USER_EMAIL });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('no-webauthn-api');
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns a descriptive error when fetching registration options fails', async () => {
    (supabase.functions.invoke as any).mockResolvedValueOnce({ data: null, error: new Error('network down') });

    const result = await enrollTrustedDevice({ userId: USER_ID, userEmail: USER_EMAIL });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('network down');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns an error and does not query trusted_devices when verification is not verified', async () => {
    (supabase.functions.invoke as any)
      .mockResolvedValueOnce({ data: { options: {} }, error: null })
      .mockResolvedValueOnce({ data: { verified: false, credentialId: CREDENTIAL_ID, label: 'x' }, error: null });
    (startRegistration as any).mockResolvedValue({ id: CREDENTIAL_ID });

    const result = await enrollTrustedDevice({ userId: USER_ID, userEmail: USER_EMAIL });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Biometric registration could not be verified.');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('queries trusted_devices with the correct user id, credential id, and revoked_at filter', async () => {
    mockSuccessfulWebauthnFlow();
    const { eqCalls, isCalls, builder } = mockTrustedDeviceLookup({ data: { id: 'row-1' }, error: null });

    await enrollTrustedDevice({ userId: USER_ID, userEmail: USER_EMAIL });

    expect(supabase.from).toHaveBeenCalledWith('trusted_devices');
    expect(builder.select).toHaveBeenCalledWith('id');
    expect(eqCalls).toEqual([
      ['user_id', USER_ID],
      ['credential_id', CREDENTIAL_ID],
    ]);
    expect(isCalls).toEqual([['revoked_at', null]]);
  });

  it('succeeds and caches the device locally when the server confirms the trusted-device row', async () => {
    mockSuccessfulWebauthnFlow();
    mockTrustedDeviceLookup({ data: { id: 'row-1' }, error: null });

    const result = await enrollTrustedDevice({ userId: USER_ID, userEmail: USER_EMAIL, label: 'ignored' });

    expect(result).toEqual({ ok: true });
    const devices = listTrustedDevices(USER_EMAIL);
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({
      userEmail: USER_EMAIL,
      credentialId: CREDENTIAL_ID,
      label: 'iPhone',
    });
  });

  it('fails and clears the local cache when the server has no matching trusted-device row (data is null)', async () => {
    mockSuccessfulWebauthnFlow();
    mockTrustedDeviceLookup({ data: null, error: null });

    const result = await enrollTrustedDevice({ userId: USER_ID, userEmail: USER_EMAIL });

    expect(result.ok).toBe(false);
    expect(result.error).toBe(
      'Biometric registration finished in the browser, but the trusted device was not saved on the server. Please try again or contact support.',
    );
    expect(listTrustedDevices()).toHaveLength(0);
  });

  it('fails and clears the local cache when the trusted-device lookup itself errors', async () => {
    mockSuccessfulWebauthnFlow();
    mockTrustedDeviceLookup({ data: null, error: new Error('db unreachable') });

    const result = await enrollTrustedDevice({ userId: USER_ID, userEmail: USER_EMAIL });

    expect(result.ok).toBe(false);
    expect(result.error).toBe(
      'Biometric registration finished in the browser, but the trusted device was not saved on the server. Please try again or contact support.',
    );
    expect(listTrustedDevices()).toHaveLength(0);
  });

  it('wipes any pre-existing locally cached devices when the server check fails, preventing a false "enabled" state', async () => {
    // Simulate a stale/previous successful enrollment already cached locally.
    localStorage.setItem(
      'mlp.trusted-devices.v1',
      JSON.stringify([{ userEmail: 'someone-else@example.com', credentialId: 'old-cred', label: 'Old', enrolledAt: '2020-01-01T00:00:00.000Z' }]),
    );
    expect(listTrustedDevices()).toHaveLength(1);

    mockSuccessfulWebauthnFlow();
    mockTrustedDeviceLookup({ data: null, error: null });

    const result = await enrollTrustedDevice({ userId: USER_ID, userEmail: USER_EMAIL });

    expect(result.ok).toBe(false);
    expect(listTrustedDevices()).toHaveLength(0);
  });

  it('does not query trusted_devices at all when the support check fails', async () => {
    setBiometricSupport(false);

    const result = await enrollTrustedDevice({ userId: USER_ID, userEmail: USER_EMAIL });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('no-platform-authenticator');
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe('clearTrustedDevice (used by enrollTrustedDevice on server-check failure)', () => {
  it('removes all cached devices regardless of associated email', () => {
    localStorage.setItem(
      'mlp.trusted-devices.v1',
      JSON.stringify([
        { userEmail: 'a@example.com', credentialId: 'c1', label: 'A', enrolledAt: '2020-01-01T00:00:00.000Z' },
        { userEmail: 'b@example.com', credentialId: 'c2', label: 'B', enrolledAt: '2020-01-01T00:00:00.000Z' },
      ]),
    );
    clearTrustedDevice();
    expect(listTrustedDevices()).toEqual([]);
  });
});