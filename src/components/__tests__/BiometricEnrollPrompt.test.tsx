import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/utils/trustedDevice', () => ({
  enrollTrustedDevice: vi.fn(),
  getDismissedKey: vi.fn(),
  isBiometricSupported: vi.fn(),
  isTrustedDeviceEnrolled: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { useAuth } from '@/hooks/useAuth';
import {
  enrollTrustedDevice,
  getDismissedKey,
  isBiometricSupported,
  isTrustedDeviceEnrolled,
} from '@/utils/trustedDevice';
import { toast } from 'sonner';
import { BiometricEnrollPrompt } from '@/components/BiometricEnrollPrompt';

const USER = { id: 'user-1', email: 'jane@example.com' };
const DISMISS_KEY = 'dismiss-key:jane@example.com';

/** Configures the mocked utils so the effect's eligibility check passes and the dialog opens. */
function mockEligible() {
  (getDismissedKey as any).mockReturnValue(DISMISS_KEY);
  (isTrustedDeviceEnrolled as any).mockReturnValue(false);
  (isBiometricSupported as any).mockResolvedValue(true);
}

async function openDialog() {
  render(<BiometricEnrollPrompt />);
  await screen.findByText('Enable biometric sign-in?');
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  (useAuth as any).mockReturnValue({ user: USER, loading: false });
  mockEligible();
});

describe('BiometricEnrollPrompt — eligibility gating', () => {
  it('opens the prompt when the user is eligible', async () => {
    await openDialog();
    expect(screen.getByText('Enable biometric sign-in?')).toBeInTheDocument();
  });

  it('does not open while auth is still loading', async () => {
    (useAuth as any).mockReturnValue({ user: USER, loading: true });
    render(<BiometricEnrollPrompt />);
    await waitFor(() => {
      expect(screen.queryByText('Enable biometric sign-in?')).not.toBeInTheDocument();
    });
  });

  it('does not open when there is no authenticated user email', async () => {
    (useAuth as any).mockReturnValue({ user: null, loading: false });
    render(<BiometricEnrollPrompt />);
    await waitFor(() => {
      expect(screen.queryByText('Enable biometric sign-in?')).not.toBeInTheDocument();
    });
  });

  it('does not open when a trusted device is already enrolled', async () => {
    (isTrustedDeviceEnrolled as any).mockReturnValue(true);
    render(<BiometricEnrollPrompt />);
    await waitFor(() => {
      expect(screen.queryByText('Enable biometric sign-in?')).not.toBeInTheDocument();
    });
    expect(isBiometricSupported).not.toHaveBeenCalled();
  });

  it('does not open when biometrics are unsupported on this device', async () => {
    (isBiometricSupported as any).mockResolvedValue(false);
    render(<BiometricEnrollPrompt />);
    await waitFor(() => {
      expect(screen.queryByText('Enable biometric sign-in?')).not.toBeInTheDocument();
    });
  });

  it('does not open when the user already dismissed the prompt for this email', async () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    render(<BiometricEnrollPrompt />);
    await waitFor(() => {
      expect(screen.queryByText('Enable biometric sign-in?')).not.toBeInTheDocument();
    });
  });
});

describe('BiometricEnrollPrompt — "Not now"', () => {
  it('records the dismissal and closes the dialog', async () => {
    await openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    await waitFor(() => {
      expect(screen.queryByText('Enable biometric sign-in?')).not.toBeInTheDocument();
    });
    expect(localStorage.getItem(DISMISS_KEY)).toBe('true');
  });
});

describe('BiometricEnrollPrompt — "Enable biometrics"', () => {
  it('calls enrollTrustedDevice with the current user id, email, and a platform label', async () => {
    (enrollTrustedDevice as any).mockResolvedValue({ ok: true });
    await openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Enable biometrics' }));

    await waitFor(() => expect(enrollTrustedDevice).toHaveBeenCalledTimes(1));
    expect(enrollTrustedDevice).toHaveBeenCalledWith({
      userId: USER.id,
      userEmail: USER.email,
      label: expect.any(String),
    });
  });

  it('shows a disabled, busy button while enrollment is in flight', async () => {
    let resolveEnroll: (v: any) => void;
    (enrollTrustedDevice as any).mockReturnValue(
      new Promise((resolve) => {
        resolveEnroll = resolve;
      }),
    );
    await openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Enable biometrics' }));

    const busyButton = await screen.findByRole('button', { name: 'Enabling…' });
    expect(busyButton).toBeDisabled();

    resolveEnroll!({ ok: true });
    await waitFor(() => {
      expect(screen.queryByText('Enable biometric sign-in?')).not.toBeInTheDocument();
    });
  });

  it('closes the dialog on successful enrollment without showing an error toast', async () => {
    (enrollTrustedDevice as any).mockResolvedValue({ ok: true });
    await openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Enable biometrics' }));

    await waitFor(() => {
      expect(screen.queryByText('Enable biometric sign-in?')).not.toBeInTheDocument();
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and shows the server error when the trusted device was not saved (status undefined)', async () => {
    // Regression test: previously `dismiss()` was called for any status other than
    // 'no-platform-authenticator', which would have closed the dialog here even though
    // enrollment failed. It must now stay open so the user isn't misled.
    (enrollTrustedDevice as any).mockResolvedValue({
      ok: false,
      error: 'Biometric registration finished in the browser, but the trusted device was not saved on the server. Please try again or contact support.',
    });
    await openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Enable biometrics' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      'Biometric registration finished in the browser, but the trusted device was not saved on the server. Please try again or contact support.',
    ));
    expect(screen.getByText('Enable biometric sign-in?')).toBeInTheDocument();
  });

  it('keeps the dialog open when enrollment fails with "no-platform-authenticator" status', async () => {
    (enrollTrustedDevice as any).mockResolvedValue({
      ok: false,
      error: 'No fingerprint, face unlock, or screen lock is set up on this device yet. Set one up in your device settings, then come back and try again.',
      status: 'no-platform-authenticator',
    });
    await openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Enable biometrics' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText('Enable biometric sign-in?')).toBeInTheDocument();
  });

  it('falls back to a generic toast message when no error string is returned', async () => {
    (enrollTrustedDevice as any).mockResolvedValue({ ok: false });
    await openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Enable biometrics' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not enable biometric sign-in.'));
    expect(screen.getByText('Enable biometric sign-in?')).toBeInTheDocument();
  });
});