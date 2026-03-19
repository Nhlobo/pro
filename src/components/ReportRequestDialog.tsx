import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Database, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ReportRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  claimantName: string;
  claimantAutoId: string;
}

export function ReportRequestDialog({
  open,
  onOpenChange,
  appointmentId,
  claimantName,
  claimantAutoId,
}: ReportRequestDialogProps) {
  const [requestType, setRequestType] = useState<"email" | "system">("email");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (requestType === "email") {
        // Send email request via edge function
        const { data, error } = await supabase.functions.invoke("send-report-email", {
          body: {
            appointmentId,
            emailType: "report",
            recipientEmail,
            recipientName,
            recipientType: "attorney",
            customMessage,
          },
        });

        if (error) throw error;

        toast({
          title: "Request Sent",
          description: `Report request sent successfully. System employees have been notified.`,
        });
      } else {
        // Create system request in email queue and auto-send
        const { data: inserted, error } = await supabase.from("email_queue").insert({
          email_type: "report_request",
          recipient_email: recipientEmail || "admin@system.com",
          recipient_name: recipientName || "System Admin",
          subject: `Report Request - ${claimantName} (${claimantAutoId})`,
          html_content: `
            <h3>Report Request</h3>
            <p><strong>Claimant:</strong> ${claimantName}</p>
            <p><strong>Case Reference:</strong> ${claimantAutoId}</p>
            <p><strong>Message:</strong> ${customMessage || "No additional message"}</p>
          `,
          status: "pending",
          related_record_id: appointmentId,
          related_table: "appointments",
          metadata: {
            request_type: "system",
            claimant_name: claimantName,
            claimant_auto_id: claimantAutoId,
          },
        }).select("id").single();

        if (error) throw error;
        // Auto-send immediately
        if (inserted?.id) {
          await supabase.functions.invoke("auto-send-queued-email", { body: { emailId: inserted.id } });
        }

        toast({
          title: "Request Created",
          description: "Report request has been queued. System employees will be notified.",
        });
      }

      onOpenChange(false);
      setRecipientEmail("");
      setRecipientName("");
      setCustomMessage("");
    } catch (error: any) {
      console.error("Error submitting report request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit report request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Request Report</DialogTitle>
          <DialogDescription>
            Request a report for {claimantName} ({claimantAutoId}). System employees will be notified automatically via email.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Request Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={requestType === "email" ? "default" : "outline"}
                className="w-full gap-2"
                onClick={() => setRequestType("email")}
              >
                <Mail className="h-4 w-4" />
                Email
              </Button>
              <Button
                type="button"
                variant={requestType === "system" ? "default" : "outline"}
                className="w-full gap-2"
                onClick={() => setRequestType("system")}
              >
                <Database className="h-4 w-4" />
                System Queue
              </Button>
            </div>
          </div>

          {requestType === "email" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="recipientName">Recipient Name *</Label>
                <Input
                  id="recipientName"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Enter recipient name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipientEmail">Recipient Email *</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  required
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="message">Additional Message</Label>
            <Textarea
              id="message"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add any additional notes or instructions..."
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {customMessage.length}/1000 characters
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
