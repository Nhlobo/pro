import LegalPageLayout from '@/pages/legal/LegalPageLayout';
import LegalSectionCard from '@/pages/legal/LegalSectionCard';
import { FileText, Database, Settings, Share2, Clock, UserCheck, Mail } from 'lucide-react';

/**
 * Privacy Policy — Attorney external portal. Same shell and section
 * structure as the internal /privacy page and its ExpertPrivacy.tsx
 * sibling, worded for a referring attorney accessing matter data
 * through the external link+OTP portal rather than a full staff
 * account.
 */
const AttorneyPrivacy = () => (
  <LegalPageLayout
    title="Privacy Policy"
    description="How Kutlwano & Associate collects, uses and protects your information within the Medico-Legal Pro Attorney Portal."
    backHref="/external-portal/sign-in"
    backLabel="Back to sign in"
  >
    <p className="text-sm text-slate-500">Last updated: {new Date().toLocaleDateString('en-ZA')}</p>

    <div className="not-prose grid gap-4">
      <LegalSectionCard number={1} title="Introduction" icon={FileText}>
        <p>
          Kutlwano &amp; Associate (Pty) Ltd (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the
          Medico-Legal Pro Attorney Portal, used by referring attorneys and their firms who do
          not hold a staff account. This policy explains how we handle your personal information
          in line with the Protection of Personal Information Act, 2013 (POPIA).
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={2} title="Information we collect" icon={Database}>
        <ul>
          <li>Your professional details (name, firm, contact information)</li>
          <li>Matter, claimant, appointment and report information for cases you refer</li>
          <li>Sign-in activity (access link and one-time code use) for account security</li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard number={3} title="How we use your information" icon={Settings}>
        <ul>
          <li>To grant and secure your access to your firm's referred matters</li>
          <li>To coordinate appointments, expert reports and payments related to your matters</li>
          <li>To comply with legal, regulatory and audit obligations</li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard number={4} title="Sharing" icon={Share2}>
        <p>
          You can only see matters referred by you or your firm. We share your professional
          information only with the medical experts and staff involved in a matter you referred.
          We do not sell personal information.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={5} title="Retention" icon={Clock}>
        <p>
          Case and report records are retained for the period required by professional, tax and
          litigation obligations, after which they are securely destroyed.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={6} title="Your rights" icon={UserCheck}>
        <p>
          You may request access, correction or deletion of your personal information by
          contacting us at <a href="mailto:info@kutlwanoassociate.com">info@kutlwanoassociate.com</a>.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={7} title="Contact" icon={Mail}>
        <p>
          Information Officer, Kutlwano &amp; Associate (Pty) Ltd — 010 023 4042 —
          info@kutlwanoassociate.com.
        </p>
      </LegalSectionCard>
    </div>
  </LegalPageLayout>
);

export default AttorneyPrivacy;
