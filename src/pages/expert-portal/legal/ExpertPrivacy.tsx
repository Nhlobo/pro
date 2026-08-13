import LegalPageLayout from '@/pages/legal/LegalPageLayout';
import LegalSectionCard from '@/pages/legal/LegalSectionCard';
import { Mail, Phone, MessageSquare, LogIn, ShieldAlert, Link2Off, WifiOff } from 'lucide-react';

/**
 * Help & Support — Expert external portal.
 *
 * Same LegalPageLayout/LegalSectionCard shell as the internal
 * /help page (same contact tiles, same numbered-card styling), but
 * the content and "common issues" below are specific to a medical
 * expert signing in through the external portal (link + OTP, no
 * staff password), not a full internal account — so it points back
 * to /external-portal/sign-in instead of /auth, and covers the
 * issues an expert actually hits (access link expired, profile not
 * yet linked by admin) instead of internal password-reset flows.
 */
const ExpertHelp = () => (
  <LegalPageLayout
    title="Help & Support"
    description="Get help accessing the Medico-Legal Pro Expert Portal."
    backHref="/expert-portal"
    backLabel="Back to dashboard"
  >
    <p>
      Need a hand accessing your Expert Portal? Our support team is available Monday to Friday,
      08:00 – 17:00 SAST.
    </p>

    <div className="not-prose mt-6 grid gap-4 sm:grid-cols-2">
      <a
        href="tel:0100234042"
        className="flex items-start gap-3 border border-black/10 bg-white p-4 no-underline transition hover:border-[#00BAAD]"
      >
        <Phone className="mt-1 h-5 w-5 text-[#00BAAD]" />
        <div>
          <div className="text-sm font-semibold text-black">Support line</div>
          <div className="text-sm text-slate-600">010 023 4042</div>
        </div>
      </a>
      <a
        href="mailto:info@kutlwanoassociate.com"
        className="flex items-start gap-3 border border-black/10 bg-white p-4 no-underline transition hover:border-[#00BAAD]"
      >
        <Mail className="mt-1 h-5 w-5 text-[#00BAAD]" />
        <div>
          <div className="text-sm font-semibold text-black">Email support</div>
          <div className="text-sm text-slate-600">info@kutlwanoassociate.com</div>
        </div>
      </a>
    </div>

    <h2>Common issues</h2>
    <div className="not-prose grid gap-4">
      <LegalSectionCard number={1} title="Access link expired or already used" icon={LogIn}>
        <p>
          Registration links are single-use. If yours has expired, use &ldquo;Returning
          user?&rdquo; on the sign-in page to request a new one-time code by email instead.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={2} title="Your profile isn't linked yet" icon={Link2Off}>
        <p>
          If you've signed in but your dashboard shows &ldquo;Expert Profile Not Linked&rdquo;,
          an administrator still needs to connect your account to your medical expert record.
          Contact us using the details above and we'll link it for you.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={3} title="Access not authorised" icon={ShieldAlert}>
        <p>
          Your access may be pending approval or has been paused. Contact your case
          administrator or our support line to confirm your status.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={4} title="Slow or blank screens" icon={WifiOff}>
        <p>
          Check your internet connection. If a page stays blank after a few seconds, try
          refreshing — if it persists, let us know which page it was.
        </p>
      </LegalSectionCard>
    </div>

    <div className="not-prose mt-6 flex items-start gap-3 border border-black/10 bg-[#F7F5EE] p-4">
      <MessageSquare className="mt-1 h-5 w-5 text-black" />
      <div className="text-sm text-slate-700">
        For account-specific issues please include your registered email and a screenshot of
        the message you are seeing.
      </div>
    </div>
  </LegalPageLayout>
);

export default ExpertHelp;
