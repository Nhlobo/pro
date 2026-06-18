// Branded HTML email bodies for the authentication module.
// Uses the existing sendEmail() helper (Resend under the hood).
import { sendEmail } from './email.ts';

const BRAND_PRIMARY = '#0F172A';
const BRAND_ACCENT = '#0EA5E9';

function shell(title: string, bodyHtml: string): string {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background:#ffffff; color:#0f172a;">
    <div style="background:${BRAND_PRIMARY}; padding:20px 24px; border-radius:8px 8px 0 0;">
      <h1 style="margin:0; color:#ffffff; font-size:18px; letter-spacing:0.2px;">Medico-Legal Pro</h1>
    </div>
    <div style="padding:28px 24px; border:1px solid #e2e8f0; border-top:0; border-radius:0 0 8px 8px;">
      <h2 style="margin:0 0 16px; font-size:20px; color:${BRAND_PRIMARY};">${title}</h2>
      ${bodyHtml}
      <hr style="border:none; border-top:1px solid #e2e8f0; margin:28px 0;" />
      <p style="font-size:12px; color:#64748b; margin:0;">If you did not request this email, please contact your administrator immediately.</p>
    </div>
  </div>`;
}

export async function sendLoginOtpEmail(to: string, code: string, name?: string | null) {
  const html = shell('Your sign-in code', `
    <p>Hi${name ? ` ${name}` : ''},</p>
    <p>Use the following code to complete your sign-in. It expires in <strong>5 minutes</strong>.</p>
    <div style="font-size:32px; letter-spacing:8px; font-weight:700; color:${BRAND_ACCENT}; text-align:center; padding:18px; background:#f1f5f9; border-radius:6px; margin:16px 0;">${code}</div>
    <p style="font-size:13px; color:#475569;">For your security, do not share this code with anyone. Medico-Legal Pro staff will never ask you for it.</p>
  `);
  return sendEmail({ to, subject: `Medico-Legal Pro sign-in code: ${code}`, html });
}

export async function sendPasswordResetEmail(to: string, link: string, name?: string | null) {
  const html = shell('Reset your password', `
    <p>Hi${name ? ` ${name}` : ''},</p>
    <p>We received a request to reset your Medico-Legal Pro password. Click the button below to choose a new one. This link expires in <strong>1 hour</strong> and can only be used once.</p>
    <div style="text-align:center; margin:24px 0;"><a href="${link}" style="background:${BRAND_ACCENT}; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:600; display:inline-block;">Reset password</a></div>
    <p style="font-size:12px; color:#475569; word-break:break-all;">${link}</p>
  `);
  return sendEmail({ to, subject: 'Reset your Medico-Legal Pro password', html });
}

export async function sendActivationEmail(to: string, link: string, createdByName?: string | null) {
  const html = shell('Activate your account', `
    <p>An account has been created for you on Medico-Legal Pro${createdByName ? ` by ${createdByName}` : ''}.</p>
    <p>Click the button below to activate your account and set your password. This link expires in <strong>24 hours</strong>.</p>
    <div style="text-align:center; margin:24px 0;"><a href="${link}" style="background:${BRAND_ACCENT}; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:600; display:inline-block;">Activate account</a></div>
    <p style="font-size:12px; color:#475569; word-break:break-all;">${link}</p>
  `);
  return sendEmail({ to, subject: 'Activate your Medico-Legal Pro account', html });
}

export async function sendLockoutAdminEmail(toAdmins: string[], lockedEmail: string, ip: string | null) {
  if (toAdmins.length === 0) return { success: true } as const;
  const html = shell('Account lockout alert', `
    <p>The following account has been locked due to repeated failed sign-in attempts:</p>
    <p style="font-size:15px;"><strong>${lockedEmail}</strong></p>
    <p style="font-size:13px; color:#475569;">Source IP: ${ip || 'unknown'}</p>
    <p>Review the authentication history in the User Management module to investigate.</p>
  `);
  return sendEmail({ to: toAdmins, subject: `Account locked: ${lockedEmail}`, html });
}
