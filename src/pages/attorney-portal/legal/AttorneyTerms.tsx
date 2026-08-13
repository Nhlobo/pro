import LegalPageLayout from '@/pages/legal/LegalPageLayout';
import LegalSectionCard from '@/pages/legal/LegalSectionCard';
import { CheckCircle2, ShieldCheck, Database, Activity, Scale, RefreshCw, Mail } from 'lucide-react';

/**
 * Terms of Use — Attorney external portal. Same shell and section
 * structure as the internal /terms page and its ExpertTerms.tsx
 * sibling, worded for a referring attorney accessing matter data
 * through the external link+OTP portal rather than a full staff
 * account.
 */
const AttorneyTerms = () => (
  <LegalPageLayout
    title="Terms of Use"
    description="Terms governing use of the Medico-Legal Pro Attorney Portal."
    backHref="/external-portal/sign-in"
    backLabel="Back to sign in"
  >
    <p className="text-sm text-slate-500">Last updated: {new Date().toLocaleDateString('en-ZA')}</p>

    <div className="not-prose grid gap-4">
      <LegalSectionCard number={1} title="Acceptance" icon={CheckCircle2}>
        <p>
          By accessing the Attorney Portal you agree to these terms. Access is granted only to
          referring attorneys and firms working with Kutlwano &amp; Associate (Pty) Ltd.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={2} title="Authorised use" icon={ShieldCheck}>
        <ul>
          <li>Use the portal only to manage matters referred by you or your firm.</li>
          <li>Keep your access link and one-time codes confidential — do not share your login.</li>
          <li>Do not attempt to bypass access controls or view matters not referred by you.</li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard number={3} title="Data ownership" icon={Database}>
        <p>
          Case data belongs to the claimant on whose behalf it was submitted. You may access and
          process it strictly to manage the referral, coordinate the assessment, and receive the
          resulting report for the matter.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={4} title="Availability" icon={Activity}>
        <p>
          We work to keep the portal available, but do not guarantee uninterrupted operation.
          Scheduled maintenance and unforeseen incidents may cause downtime.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={5} title="Liability" icon={Scale}>
        <p>
          To the maximum extent permitted by law, our liability arising from use of the portal is
          limited to the fees paid for the affected service in the preceding three months.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={6} title="Changes" icon={RefreshCw}>
        <p>
          We may update these terms from time to time. Continued use after changes constitutes
          acceptance of the updated terms.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={7} title="Contact" icon={Mail}>
        <p>
          Questions about these terms: <a href="mailto:info@kutlwanoassociate.com">info@kutlwanoassociate.com</a>.
        </p>
      </LegalSectionCard>
    </div>
  </LegalPageLayout>
);

export default AttorneyTerms;
