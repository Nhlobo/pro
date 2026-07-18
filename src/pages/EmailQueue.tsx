import { Mail } from "lucide-react";
import { EmailQueueManager } from "@/components/EmailQueueManager";
import { AdminPage, AdminHeader } from "@/components/admin/ui/AdminUI";

// This page is hosted inside the Admin Portal (see the /email-queue route
// in App.tsx), so the portal's top bar already renders the page title and
// the single "Back to Operations Dashboard" control. No second header or
// second back button is rendered here — AdminHeader below only adds the
// eyebrow/description row, matching every other Admin Portal screen
// (Profile, Sales Performance, System Control, Access & IAM, Analytics).
const EmailQueue = () => {
  return (
    <AdminPage className="brand-legal-theme max-w-7xl">
      <AdminHeader
        eyebrow="Communications"
        title="Email History"
        description="Monitor email delivery, track responses, and forward unattended emails."
        icon={Mail}
      />
      <EmailQueueManager />
    </AdminPage>
  );
};

export default EmailQueue;
