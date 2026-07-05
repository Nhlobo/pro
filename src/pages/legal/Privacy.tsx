import LegalPageLayout from './LegalPageLayout';

const Privacy = () => (
  <LegalPageLayout
    title="Privacy Policy"
    description="How Kutlwano & Associate collects, uses and protects your information within Medico-Legal Pro."
  >
    <p className="text-sm text-slate-500">Last updated: {new Date().toLocaleDateString('en-ZA')}</p>

    <h2>1. Introduction</h2>
    <p>
      Kutlwano &amp; Associate (Pty) Ltd (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the
      Medico-Legal Pro platform. This policy explains how we handle personal information in
      line with the Protection of Personal Information Act, 2013 (POPIA).
    </p>

    <h2>2. Information we collect</h2>
    <ul>
      <li>Account details (name, email, role, contact information)</li>
      <li>Case and claimant information you upload for medico-legal processing</li>
      <li>System usage, audit trail entries and device metadata for security</li>
    </ul>

    <h2>3. How we use your information</h2>
    <ul>
      <li>To provide, secure and improve the platform</li>
      <li>To manage matters, appointments, reports and payments</li>
      <li>To comply with legal, regulatory and audit obligations</li>
    </ul>

    <h2>4. Sharing</h2>
    <p>
      We share personal information only with authorised staff, referring attorneys, medical
      experts and service providers who are contractually bound to protect it. We do not sell
      personal information.
    </p>

    <h2>5. Retention</h2>
    <p>
      Records are retained for the period required by professional, tax and litigation
      obligations, after which they are securely destroyed.
    </p>

    <h2>6. Your rights</h2>
    <p>
      You may request access, correction or deletion of your personal information by contacting
      us at <a href="mailto:info@kutlwanoassociate.com">info@kutlwanoassociate.com</a>.
    </p>

    <h2>7. Contact</h2>
    <p>
      Information Officer, Kutlwano &amp; Associate (Pty) Ltd — 011 027 6077 —
      info@kutlwanoassociate.com.
    </p>
  </LegalPageLayout>
);

export default Privacy;
