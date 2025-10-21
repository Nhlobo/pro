import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AppointmentRequestEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  request: any;
}

export const AppointmentRequestEmailDialog: React.FC<AppointmentRequestEmailDialogProps> = ({
  isOpen,
  onClose,
  request
}) => {
  const { toast } = useToast();
  const [recipientEmail, setRecipientEmail] = useState(request?.attorney_email || "");
  const [subject, setSubject] = useState(`Appointment Request Update - ${request?.claimant_first_name} ${request?.claimant_last_name}`);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendEmail = async () => {
    if (!recipientEmail || !message) {
      toast({
        title: "Missing Information",
        description: "Please enter recipient email and message",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-appointment-update-email', {
        body: {
          recipientEmail,
          subject,
          message,
          requestData: {
            id: request.id,
            referring_attorney_name: request.referring_attorney_name,
            claimant_first_name: request.claimant_first_name,
            claimant_last_name: request.claimant_last_name,
            expert_type_requested: request.expert_type_requested,
            matter_type: request.matter_type,
            province: request.province,
            status: request.status,
            suggested_date: request.suggested_date,
            confirmed_appointment_date: request.confirmed_appointment_date,
            approval_notes: request.approval_notes
          }
        }
      });

      if (error) throw error;

      toast({
        title: "Email Sent",
        description: `Update notification sent to ${recipientEmail}`,
      });

      onClose();
      setMessage("");
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({
        title: "Email Failed",
        description: error.message || "Failed to send email notification",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Appointment Update Email
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
            <div><strong>Attorney:</strong> {request?.referring_attorney_name}</div>
            <div><strong>Claimant:</strong> {request?.claimant_first_name} {request?.claimant_last_name}</div>
            <div><strong>Expert Type:</strong> {request?.expert_type_requested}</div>
            <div><strong>Status:</strong> {request?.status}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Email *</Label>
            <Input
              id="recipient"
              type="email"
              placeholder="attorney@lawfirm.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              placeholder="Enter your message to the referring attorney..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSendEmail} disabled={isLoading}>
            {isLoading ? (
              "Sending..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
