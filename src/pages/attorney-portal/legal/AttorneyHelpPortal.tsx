import LegalPageLayout from '@/pages/legal/LegalPageLayout';
import LegalSectionCard from '@/pages/legal/LegalSectionCard';
import { Mail, Phone, MessageSquare, LogIn, ShieldAlert, Link2Off, WifiOff } from 'lucide-react';

/**
 * Help & Support — Attorney Portal, SIGNED-IN variant.
 *
 * Sibling of AttorneyHelp.tsx, not a replacement for it. AttorneyHelp is
 * reachable while signed OUT (footer link on ExternalPortalSignIn) as well
 * as signed in, so it can't assume a session exists and its "back" link
 * has to go to /external-portal/sign-in.
 *
 * This page is only ever reached from inside the authenticated portal —
 * currently the "Get Help" button on AttorneyNotLinkedState, shown when a
 * signed-in attorney has no linked firm and so no cases/history to show.
 * Because a session is guaranteed here, "back" goes to the actual
 * /attorney-portal dashboard instead of bouncing a logged-in user back
 * to sign in. Routed behind ProtectedRoute in App.tsx for that reason.
 *
 * Content mirrors AttorneyHelp.tsx — same support channels and common
 * issues — so keep the two in sync if either changes.
 */
const AttorneyHelpPortal = () => (
  <LegalPageLayout
    title="Help & Support"
    description="Get help with the Medico-Legal Pro Attorney Portal."
    backHref="/attorney-portal"
    backLabel="Back to Dashboard"
  >
    <p>
      Need a hand with your Attorney Portal? Our support team is available Monday to
      Friday, 08:00 – 17:00 SAST.
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
      <LegalSectionCard number={1} title="Your firm or matters aren't linked yet" icon={Link2Off}>
        <p>
          If your dashboard shows no matters, an administrator still needs to connect your
          account to your firm's referrals. Contact us using the details above and we'll link
          it for you.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={2} title="Access not authorised" icon={ShieldAlert}>
        <p>
          Your access may be pending approval or has been paused. Contact your case
          administrator or our support line to confirm your status.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={3} title="Signed out unexpectedly" icon={LogIn}>
        <p>
          Sessions can time out after a period of inactivity. Use &ldquo;Returning
          user?&rdquo; on the sign-in page to request a new one-time code by email.
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

export default AttorneyHelpPortal;
