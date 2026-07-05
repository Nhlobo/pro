import LegalPageLayout from './LegalPageLayout';
import LegalSectionCard from './LegalSectionCard';
import { CheckCircle2, ShieldCheck, Database, Activity, Scale, RefreshCw, Mail } from 'lucide-react';

const Terms = () => (
  <LegalPageLayout
    title="Terms of Use"
    description="Terms governing use of the Medico-Legal Pro platform."
  >
    <p className="text-sm text-slate-500">Last updated: {new Date().toLocaleDateString('en-ZA')}</p>

    <div className="not-prose grid gap-4">
      <LegalSectionCard number={1} title="Acceptance" icon={CheckCircle2}>
        <p>
          By accessing Medico-Legal Pro you agree to these terms. Access is granted to authorised
          users of Kutlwano &amp; Associate (Pty) Ltd and its partners only.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={2} title="Authorised use" icon={ShieldCheck}>
        <ul>
          <li>Use the platform for lawful medico-legal purposes only.</li>
          <li>Keep your credentials confidential and report suspected misuse immediately.</li>
          <li>Do not attempt to bypass access controls, RLS policies or audit mechanisms.</li>
        </ul>
      </LegalSectionCard>

      <LegalSectionCard number={3} title="Data ownership" icon={Database}>
        <p>
          Case data belongs to the referring attorney or claimant on whose behalf it was submitted.
          We process it strictly to deliver the requested services.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={4} title="Availability" icon={Activity}>
        <p>
          We work to keep the service available, but do not guarantee uninterrupted operation.
          Scheduled maintenance and unforeseen incidents may cause downtime.
        </p>
      </LegalSectionCard>

      <LegalSectionCard number={5} title="Liability" icon={Scale}>
        <p>
          To the maximum extent permitted by law, our liability arising from use of the platform is
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

export default Terms;
