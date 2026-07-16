import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/utils/trustedDevice", () => ({
  enrollTrustedDevice: vi.fn(),
  getDismissedKey: (email: string) => `dismissed:${email}`,
  isBiometricSupported: vi.fn(),
  isTrustedDeviceEnrolled: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { useAuth } from "@/hooks/useAuth";
import { enrollTrustedDevice, isBiometricSupported, isTrustedDeviceEnrolled } from "@/utils/trustedDevice";
import { toast } from "sonner";
import { BiometricEnrollPrompt } from "@/components/BiometricEnrollPrompt";

const DISMISS_KEY = "dismissed:jane@example.com";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  (useAuth as any).mockReturnValue({ user: { id: "user-1", email: "jane@example.com" }, loading: false });
  (isBiometricSupported as any).mockResolvedValue(true);
  (isTrustedDeviceEnrolled as any).mockReturnValue(false);
});

describe("BiometricEnrollPrompt", () => {
  it("opens the enroll dialog when biometrics are supported and not previously dismissed or enrolled", async () => {
    render(<BiometricEnrollPrompt />);
    expect(await screen.findByText("Enable biometric sign-in?")).toBeInTheDocument();
  });

  it("does not open when the user already dismissed the prompt", async () => {
    localStorage.setItem(DISMISS_KEY, "true");
    render(<BiometricEnrollPrompt />);
    await waitFor(() => expect(isTrustedDeviceEnrolled).not.toHaveBeenCalled());
    expect(screen.queryByText("Enable biometric sign-in?")).not.toBeInTheDocument();
  });

  it("calls enrollTrustedDevice with the current user id, email, and a platform label", async () => {
    (enrollTrustedDevice as any).mockResolvedValue({ ok: true });
    render(<BiometricEnrollPrompt />);
    const enableButton = await screen.findByText("Enable biometrics");

    fireEvent.click(enableButton);

    await waitFor(() =>
      expect(enrollTrustedDevice).toHaveBeenCalledWith({
        userId: "user-1",
        userEmail: "jane@example.com",
        label: expect.any(String),
      }),
    );
  });

  it("closes the dialog on successful enrollment without marking the prompt as dismissed", async () => {
    (enrollTrustedDevice as any).mockResolvedValue({ ok: true });
    render(<BiometricEnrollPrompt />);
    const enableButton = await screen.findByText("Enable biometrics");

    fireEvent.click(enableButton);

    await waitFor(() => expect(screen.queryByText("Enable biometric sign-in?")).not.toBeInTheDocument());
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  it("keeps the dialog open and shows a toast, without marking it dismissed, after a failed enrollment", async () => {
    (enrollTrustedDevice as any).mockResolvedValue({
      ok: false,
      error: "Biometric registration finished in the browser, but the trusted device was not saved on the server. Please try again or contact support.",
      status: "available",
    });
    render(<BiometricEnrollPrompt />);
    const enableButton = await screen.findByText("Enable biometrics");

    fireEvent.click(enableButton);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Biometric registration finished in the browser, but the trusted device was not saved on the server. Please try again or contact support.",
      ),
    );
    expect(screen.getByText("Enable biometric sign-in?")).toBeInTheDocument();
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  it("does not auto-dismiss on failure even for statuses other than 'no-platform-authenticator' (regression)", async () => {
    // Prior behavior dismissed the prompt for any failure status except
    // 'no-platform-authenticator'. This verifies that regression is fixed:
    // the dialog must stay open for ALL failure statuses.
    (enrollTrustedDevice as any).mockResolvedValue({
      ok: false,
      error: "The browser blocked the biometric check on this page.",
      status: "check-failed",
    });
    render(<BiometricEnrollPrompt />);
    const enableButton = await screen.findByText("Enable biometrics");

    fireEvent.click(enableButton);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText("Enable biometric sign-in?")).toBeInTheDocument();
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  it("shows a generic toast message when the failed result has no error text", async () => {
    (enrollTrustedDevice as any).mockResolvedValue({ ok: false });
    render(<BiometricEnrollPrompt />);
    const enableButton = await screen.findByText("Enable biometrics");

    fireEvent.click(enableButton);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not enable biometric sign-in."));
    expect(screen.getByText("Enable biometric sign-in?")).toBeInTheDocument();
  });

  it("still marks the prompt as dismissed when the user explicitly clicks 'Not now'", async () => {
    render(<BiometricEnrollPrompt />);
    const notNowButton = await screen.findByText("Not now");

    fireEvent.click(notNowButton);

    expect(localStorage.getItem(DISMISS_KEY)).toBe("true");
    expect(screen.queryByText("Enable biometric sign-in?")).not.toBeInTheDocument();
  });
});