import LegalPageLayout from './LegalPageLayout';

const Terms = () => (
  <LegalPageLayout
    title="Terms of Use"
    description="Terms governing use of the Medico-Legal Pro platform."
  >
    <p className="text-sm text-slate-500">Last updated: {new Date().toLocaleDateString('en-ZA')}</p>

    <h2>1. Acceptance</h2>
    <p>
      By accessing Medico-Legal Pro you agree to these terms. Access is granted to authorised
      users of Kutlwano &amp; Associate (Pty) Ltd and its partners only.
    </p>

    <h2>2. Authorised use</h2>
    <ul>
      <li>Use the platform for lawful medico-legal purposes only.</li>
      <li>Keep your credentials confidential and report suspected misuse immediately.</li>
      <li>Do not attempt to bypass access controls, RLS policies or audit mechanisms.</li>
    </ul>

    <h2>3. Data ownership</h2>
    <p>
      Case data belongs to the referring attorney or claimant on whose behalf it was submitted.
      We process it strictly to deliver the requested services.
    </p>

    <h2>4. Availability</h2>
    <p>
      We work to keep the service available, but do not guarantee uninterrupted operation.
      Scheduled maintenance and unforeseen incidents may cause downtime.
    </p>

    <h2>5. Liability</h2>
    <p>
      To the maximum extent permitted by law, our liability arising from use of the platform is
      limited to the fees paid for the affected service in the preceding three months.
    </p>

    <h2>6. Changes</h2>
    <p>
      We may update these terms from time to time. Continued use after changes constitutes
      acceptance of the updated terms.
    </p>

    <h2>7. Contact</h2>
    <p>
      Questions about these terms: <a href="mailto:info@kutlwanoassociate.com">info@kutlwanoassociate.com</a>.
    </p>
  </LegalPageLayout>
);

export default Terms;
