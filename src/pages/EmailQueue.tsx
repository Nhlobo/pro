import { EmailQueueManager } from "@/components/EmailQueueManager";
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
            <h1 className="text-3xl font-bold">Email History</h1>
            <p className="text-muted-foreground">Monitor email delivery, track responses, and forward unattended emails</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin')} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>
      </div>

      <EmailQueueManager />
    </div>
  );
};

export default EmailQueue;
