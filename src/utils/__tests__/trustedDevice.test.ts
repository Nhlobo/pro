import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// --- Mocks -----------------------------------------------------------------

const invokeMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => invokeMock(...args) },
    from: (...args: any[]) => fromMock(...args),
  },
}));

const startRegistrationMock = vi.fn();

vi.mock("@simplewebauthn/browser", () => ({
  startRegistration: (...args: any[]) => startRegistrationMock(...args),
  startAuthentication: vi.fn(),
}));

// Import AFTER mocks so the module under test picks up the mocked deps.
import { enrollTrustedDevice, listTrustedDevices } from "@/utils/trustedDevice";

const STORAGE_KEY = "mlp.trusted-devices.v1";

/** Minimal chainable stand-in for the `.from('trusted_devices')...maybeSingle()` query. */
function makeTrustedDevicesQuery(result: { data: any; error: any }) {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return query;
}

const baseArgs = { userId: "user-1", userEmail: "test@example.com", label: "My Device" };

beforeEach(() => {
  localStorage.clear();
  invokeMock.mockReset();
  fromMock.mockReset();
  startRegistrationMock.mockReset();

  // Simulate a browser with a platform authenticator available by default.
  (globalThis as any).PublicKeyCredential = {
    isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
  };

  startRegistrationMock.mockResolvedValue({ id: "fake-webauthn-response" });
  invokeMock.mockImplementation((_name: string, opts: any) => {
    if (opts?.body?.action === "options") {
      return Promise.resolve({ data: { options: { challenge: "abc" } }, error: null });
    }
    if (opts?.body?.action === "verify") {
      return Promise.resolve({
        data: { verified: true, credentialId: "cred-123", label: "My Device" },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  });
});

afterEach(() => {
  delete (globalThis as any).PublicKeyCredential;
});

describe("enrollTrustedDevice", () => {
  it("enrolls successfully and persists locally once the server confirms the saved device", async () => {
    fromMock.mockReturnValue(makeTrustedDevicesQuery({ data: { id: "row-1" }, error: null }));

    const result = await enrollTrustedDevice(baseArgs);

    expect(result).toEqual({ ok: true });
    const devices = listTrustedDevices("test@example.com");
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ credentialId: "cred-123", userEmail: "test@example.com", label: "My Device" });
  });

  it("queries trusted_devices scoped to the userId and credentialId with revoked_at null", async () => {
    const query = makeTrustedDevicesQuery({ data: { id: "row-1" }, error: null });
    fromMock.mockReturnValue(query);

    await enrollTrustedDevice(baseArgs);

    expect(fromMock).toHaveBeenCalledWith("trusted_devices");
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.eq).toHaveBeenCalledWith("credential_id", "cred-123");
    expect(query.is).toHaveBeenCalledWith("revoked_at", null);
  });

  it("fails and clears the local cache when the server has no matching saved device", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ userEmail: "stale@example.com", credentialId: "stale-cred", label: "Old", enrolledAt: "2020-01-01T00:00:00.000Z" }]),
    );
    fromMock.mockReturnValue(makeTrustedDevicesQuery({ data: null, error: null }));

    const result = await enrollTrustedDevice(baseArgs);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/trusted device was not saved on the server/i);
    expect(listTrustedDevices()).toHaveLength(0);
  });

  it("fails and clears the local cache when the trusted_devices lookup itself errors", async () => {
    fromMock.mockReturnValue(makeTrustedDevicesQuery({ data: null, error: new Error("db down") }));

    const result = await enrollTrustedDevice(baseArgs);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/trusted device was not saved on the server/i);
    expect(listTrustedDevices()).toHaveLength(0);
  });

  it("does not persist a new local entry when the server-side confirmation fails", async () => {
    fromMock.mockReturnValue(makeTrustedDevicesQuery({ data: null, error: null }));

    await enrollTrustedDevice(baseArgs);

    expect(listTrustedDevices("test@example.com")).toHaveLength(0);
  });

  it("never queries trusted_devices when the webauthn verify step itself reports unverified", async () => {
    invokeMock.mockImplementation((_name: string, opts: any) => {
      if (opts?.body?.action === "options") return Promise.resolve({ data: { options: {} }, error: null });
      return Promise.resolve({ data: { verified: false, credentialId: "cred-x", label: "x" }, error: null });
    });

    const result = await enrollTrustedDevice(baseArgs);

    expect(result).toEqual({ ok: false, error: "Biometric registration could not be verified." });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("replaces any previously cached device for the same email once the server confirms enrollment", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ userEmail: "test@example.com", credentialId: "old-cred", label: "Old Phone", enrolledAt: "2020-01-01T00:00:00.000Z" }]),
    );
    fromMock.mockReturnValue(makeTrustedDevicesQuery({ data: { id: "row-2" }, error: null }));

    const result = await enrollTrustedDevice(baseArgs);

    expect(result).toEqual({ ok: true });
    const devices = listTrustedDevices("test@example.com");
    expect(devices).toHaveLength(1);
    expect(devices[0].credentialId).toBe("cred-123");
  });

  it("passes the userId through to the trusted_devices lookup even when userName is omitted", async () => {
    const query = makeTrustedDevicesQuery({ data: { id: "row-3" }, error: null });
    fromMock.mockReturnValue(query);

    await enrollTrustedDevice({ userId: "user-42", userEmail: "another@example.com" });

    expect(query.eq).toHaveBeenCalledWith("user_id", "user-42");
  });
});