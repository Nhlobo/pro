import LegalPageLayout from './LegalPageLayout';
import { Mail, Phone, MessageSquare } from 'lucide-react';

const Help = () => (
  <LegalPageLayout
    title="Help & Support"
    description="Get help signing in or using the Medico-Legal Pro platform."
  >
    <p>
      Need a hand? Our support team is available Monday to Friday, 08:00 – 17:00 SAST.
    </p>

    <div className="not-prose mt-6 grid gap-4 sm:grid-cols-2">
      <a
        href="tel:0110276077"
        className="flex items-start gap-3 border border-black/10 bg-white p-4 no-underline transition hover:border-[#00BAAD]"
      >
        <Phone className="mt-1 h-5 w-5 text-[#00BAAD]" />
        <div>
          <div className="text-sm font-semibold text-black">Support line</div>
          <div className="text-sm text-slate-600">011 027 6077</div>
        </div>
      </a>
      <a
        href="tel:0100234042"
        className="flex items-start gap-3 border border-black/10 bg-white p-4 no-underline transition hover:border-[#00BAAD]"
      >
        <Phone className="mt-1 h-5 w-5 text-[#00BAAD]" />
        <div>
          <div className="text-sm font-semibold text-black">Enquiries</div>
          <div className="text-sm text-slate-600">010 023 4042</div>
        </div>
      </a>
      <a
        href="mailto:info@kutlwanoassociate.com"
        className="flex items-start gap-3 border border-black/10 bg-white p-4 no-underline transition hover:border-[#00BAAD] sm:col-span-2"
      >
        <Mail className="mt-1 h-5 w-5 text-[#00BAAD]" />
        <div>
          <div className="text-sm font-semibold text-black">Email support</div>
          <div className="text-sm text-slate-600">info@kutlwanoassociate.com</div>
        </div>
      </a>
    </div>

    <h2>Common issues</h2>
    <ul>
      <li>
        <strong>Can&rsquo;t sign in:</strong> confirm Caps Lock is off, then use
        &ldquo;Forgot Password?&rdquo; on the sign-in page to reset your password.
      </li>
      <li>
        <strong>Email not confirmed:</strong> after signing in you will be prompted to resend
        the confirmation link.
      </li>
      <li>
        <strong>Access not authorised:</strong> your account may be pending role assignment —
        contact your administrator.
      </li>
      <li>
        <strong>Slow or blank screens:</strong> check your internet connection. If you are
        offline you will see a red banner at the top of the screen.
      </li>
    </ul>

    <div className="not-prose mt-6 flex items-start gap-3 border border-black/10 bg-[#F7F5EE] p-4">
      <MessageSquare className="mt-1 h-5 w-5 text-black" />
      <div className="text-sm text-slate-700">
        For account-specific issues please include your registered email and a screenshot of
        the message you are seeing.
      </div>
    </div>
  </LegalPageLayout>
);

export default Help;
