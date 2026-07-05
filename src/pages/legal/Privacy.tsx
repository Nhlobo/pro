import LegalPageLayout from './LegalPageLayout';
import LegalSectionCard from './LegalSectionCard';
import { FileText, Database, Settings, Share2, Clock, UserCheck, Mail } from 'lucide-react';

const Privacy = () => (
  <LegalPageLayout
    title="Privacy Policy"
    description="How Kutlwano & Associate collects, uses and protects your information within Medico-Legal Pro."
  >
    <p className="text-sm text-slate-500">Last updated: {new Date().toLocaleDateString('en-ZA')}</p>

    <div className="not-prose grid gap-4">
      <LegalSectionCard number={1} title="Introduction" icon={FileText}>
        <p>
          Kutlwano &amp; Associate (Pty) Ltd (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the
          Medico-Legal Pro platform. This policy explains how we handle personal information in
          line with the Protection of Personal Information Act, 2013 (POPIA).
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={2} title="Information we collect" icon={Database}>
        <ul>
          <li>Account details (name, email, role, contact information)</li>
          <li>Case and claimant information you upload for medico-legal processing</li>
          <li>System usage, audit trail entries and device metadata for security</li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard number={3} title="How we use your information" icon={Settings}>
        <ul>
          <li>To provide, secure and improve the platform</li>
          <li>To manage matters, appointments, reports and payments</li>
          <li>To comply with legal, regulatory and audit obligations</li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard number={4} title="Sharing" icon={Share2}>
        <p>
          We share personal information only with authorised staff, referring attorneys, medical
          experts and service providers who are contractually bound to protect it. We do not sell
          personal information.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={5} title="Retention" icon={Clock}>
        <p>
          Records are retained for the period required by professional, tax and litigation
          obligations, after which they are securely destroyed.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={6} title="Your rights" icon={UserCheck}>
        <p>
          You may request access, correction or deletion of your personal information by contacting
          us at <a href="mailto:info@kutlwanoassociate.com">info@kutlwanoassociate.com</a>.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={7} title="Contact" icon={Mail}>
        <p>
          Information Officer, Kutlwano &amp; Associate (Pty) Ltd — 011 027 6077 —
          info@kutlwanoassociate.com.
        </p>
      </LegalSectionCard>
    </div>
  </LegalPageLayout>
);

export default Privacy;
