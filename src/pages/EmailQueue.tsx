import { EmailQueueManager } from "@/components/EmailQueueManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const EmailQueue = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Email Queue</h1>
            <p className="text-muted-foreground">Review and approve automated emails before they are sent</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin')} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>
      </div>

      <EmailQueueManager />

      <Card>
        <CardHeader>
          <CardTitle>About Email Queue</CardTitle>
          <CardDescription>How the email preview system works</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p>
            All automated emails in the system are now queued for review before being sent to recipients. This includes:
          </p>
          <ul>
            <li>Appointment confirmations</li>
            <li>Assessment status changes</li>
            <li>Payment status updates</li>
            <li>Short-term agreements</li>
            <li>AOD documents</li>
            <li>Report emails</li>
            <li>Appointment requests</li>
          </ul>
          <p>
            Each email can be previewed in full before approving. Once approved, the email will be sent automatically to the recipient.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailQueue;
