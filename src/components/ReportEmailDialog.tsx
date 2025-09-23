import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ExpertReportTracking } from "@/hooks/useExpertReportTracking";
import { Mail, FileText, AlertTriangle } from "lucide-react";

interface ReportEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  report: ExpertReportTracking | null;
  emailType: 'report' | 'statement';
}

export const ReportEmailDialog: React.FC<ReportEmailDialogProps> = ({
  isOpen,
  onClose,
  report,
  emailType
}) => {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientType, setRecipientType] = useState<'attorney' | 'expert'>('attorney');
  const [customMessage, setCustomMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSendEmail = async () => {
    if (!report || !recipientEmail || !recipientName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-report-email', {
        body: {
          appointmentId: report.appointment_id,
          emailType,
          recipientEmail,
          recipientName,
          recipientType,
          customMessage: customMessage || undefined
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast({
          title: "Email Sent Successfully",
          description: data.message,
        });
        onClose();
        // Reset form
        setRecipientEmail("");
        setRecipientName("");
        setCustomMessage("");
      } else {
        throw new Error(data?.error || "Failed to send email");
      }
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({
        title: "Failed to Send Email",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDialogTitle = () => {
    if (emailType === 'report') {
      return "Email Expert Report";
    }
    return "Distribute Statement";
  };

  const getDialogIcon = () => {
    if (emailType === 'report') {
      return <FileText className="h-5 w-5 text-blue-600" />;
    }
    return <AlertTriangle className="h-5 w-5 text-orange-600" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getDialogIcon()}
            {getDialogTitle()}
          </DialogTitle>
        </DialogHeader>

        {report && (
          <div className="space-y-4">
            {/* Case Information */}
            <div className="bg-muted/50 p-3 rounded-lg">
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Case Details</h4>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Claimant:</span> {report.claimant_name}</p>
                <p><span className="font-medium">Case ID:</span> {report.claimant_auto_id}</p>
                <p><span className="font-medium">Expert:</span> {report.expert_name}</p>
                <p><span className="font-medium">Type:</span> {report.expert_type}</p>
              </div>
            </div>

            {/* Statement Warning */}
            {emailType === 'statement' && (
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium">Important Notice:</p>
                    <p>This report should not be used to distribute Statements to customers. Please use the Customer Statement Run to distribute Statements.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Recipient Type */}
            <div className="space-y-2">
              <Label htmlFor="recipientType">Recipient Type</Label>
              <Select value={recipientType} onValueChange={(value: 'attorney' | 'expert') => setRecipientType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select recipient type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="attorney">Attorney</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Recipient Name */}
            <div className="space-y-2">
              <Label htmlFor="recipientName">Recipient Name *</Label>
              <Input
                id="recipientName"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Enter recipient's name"
                required
              />
            </div>

            {/* Recipient Email */}
            <div className="space-y-2">
              <Label htmlFor="recipientEmail">Email Address *</Label>
              <Input
                id="recipientEmail"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="Enter email address"
                required
              />
            </div>

            {/* Custom Message */}
            <div className="space-y-2">
              <Label htmlFor="customMessage">Additional Message (Optional)</Label>
              <Textarea
                id="customMessage"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Add any additional notes or instructions..."
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSendEmail} disabled={loading}>
            {loading ? (
              <>
                <Mail className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send {emailType === 'report' ? 'Report' : 'Statement'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};