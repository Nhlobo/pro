import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, FileText, Edit, Paperclip } from "lucide-react";
import { format } from "date-fns";

interface AODEmailPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  aodDocumentId: string;
  regenerate?: boolean;
  onConfirmSend?: () => void;
}

export const AODEmailPreviewDialog: React.FC<AODEmailPreviewDialogProps> = ({
  isOpen,
  onClose,
  aodDocumentId,
  regenerate = false,
  onConfirmSend,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aodDetails, setAodDetails] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(true);
  
  // Editable email fields
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("Agreement of Debt – Payment Terms Confirmation");
  const [emailMessage, setEmailMessage] = useState("");

  useEffect(() => {
    if (isOpen && aodDocumentId) {
      fetchAODDetails();
    }
  }, [isOpen, aodDocumentId]);

  const parseEmails = (emailField: string | string[] | undefined): string[] => {
    if (!emailField) return [];
    if (typeof emailField === 'string') {
      return emailField
        .split(/[,;|]/)
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
    }
    if (Array.isArray(emailField)) {
      return emailField.filter(email => email && email.includes('@'));
    }
    return [];
  };

  const fetchAODDetails = async () => {
    try {
      setLoading(true);
      
      const { data: aodDoc, error } = await supabase
        .from('aod_documents')
        .select(`
          *,
          referring_attorneys (
            name,
            email,
            contact_person,
            phone
          )
        `)
        .eq('id', aodDocumentId)
        .single();

      if (error) throw error;
      setAodDetails(aodDoc);
      
      // Initialize email fields
      const attorney = aodDoc.referring_attorneys;
      const attorneyEmails = parseEmails(attorney?.email);
      setEmailTo(attorneyEmails.join(", "));
      
      // Build default message
      const totalDebt = aodDoc.total_contract_value || 0;
      const deposit = aodDoc.deposit_amount || 0;
      const balance = totalDebt - deposit;
      
      const defaultMessage = `Dear ${attorney?.name},

Please find attached your Agreement of Debt (AOD) confirming the approved payment terms.

Summary:
- Total Debt: R ${totalDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
- Deposit Made: R ${deposit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
- Outstanding Balance: R ${balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}

Kindly review and acknowledge receipt of this Agreement of Debt. Please contact us immediately if you have any questions or concerns regarding the payment terms.

Warm regards,
Kutlwano & Associates
Medico-Legal Accounts Department`;
      
      setEmailMessage(defaultMessage);
    } catch (error) {
      console.error('Error fetching AOD details:', error);
      toast({
        title: "Error",
        description: "Failed to load AOD details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    try {
      setSending(true);
      
      const { data, error } = await supabase.functions.invoke('send-aod-email', {
        body: { 
          aodDocumentId,
          regenerate,
          customEmail: {
            to: emailTo,
            cc: emailCc,
            subject: emailSubject,
            message: emailMessage
          }
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: data?.pdfAttached 
          ? "AOD confirmation email sent successfully with PDF attachment" 
          : "AOD confirmation email sent successfully",
      });

      onConfirmSend?.();
      onClose();
    } catch (error) {
      console.error('Error sending AOD email:', error);
      toast({
        title: "Error",
        description: "Failed to send AOD email",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Not specified';
    return format(new Date(date), "dd MMMM yyyy");
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'R 0.00';
    return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!aodDetails) {
    return null;
  }

  const attorney = aodDetails.referring_attorneys;
  const totalDebt = aodDetails.total_contract_value || 0;
  const deposit = aodDetails.deposit_amount || 0;
  const balance = totalDebt - deposit;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Preview - Agreement of Debt (AOD)
          </DialogTitle>
          <DialogDescription>
            Review and edit the email content before sending
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Editable Email Fields */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Email Details</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit className="h-4 w-4 mr-1" />
                {isEditing ? 'Lock' : 'Edit'}
              </Button>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="emailTo" className="text-sm font-medium">To: *</Label>
                {isEditing ? (
                  <Input
                    id="emailTo"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="recipient@example.com, another@example.com"
                    className="mt-1"
                  />
                ) : (
                  <p className="text-sm mt-1">{emailTo || 'No email provided'}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="emailCc" className="text-sm font-medium">CC: (Optional)</Label>
                {isEditing ? (
                  <Input
                    id="emailCc"
                    value={emailCc}
                    onChange={(e) => setEmailCc(e.target.value)}
                    placeholder="cc@example.com, another@example.com"
                    className="mt-1"
                  />
                ) : (
                  <p className="text-sm mt-1 text-muted-foreground">{emailCc || 'None'}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="emailSubject" className="text-sm font-medium">Subject: *</Label>
                {isEditing ? (
                  <Input
                    id="emailSubject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <p className="text-sm font-semibold mt-1">{emailSubject}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="emailMessage" className="text-sm font-medium">Message: *</Label>
                {isEditing ? (
                  <Textarea
                    id="emailMessage"
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    rows={10}
                    className="mt-1 font-mono text-sm"
                  />
                ) : (
                  <div className="mt-1 rounded-md border border-border bg-card p-4">
                    <pre className="text-sm whitespace-pre-wrap font-sans">{emailMessage}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AOD Document Details for Reference */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>Attached Document Summary</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <Paperclip className="h-3 w-3" />
                <span>PDF will be attached</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="font-medium">Attorney/Firm:</span>
              <span>{attorney?.name}</span>
              
              <span className="font-medium">Total Debt:</span>
              <span className="font-semibold">{formatCurrency(totalDebt)}</span>
              
              <span className="font-medium">Deposit:</span>
              <span>{formatCurrency(deposit)}</span>
              
              <span className="font-medium">Balance:</span>
              <span className="font-semibold">{formatCurrency(balance)}</span>
              
              {aodDetails.contract_start_date && (
                <>
                  <span className="font-medium">Start Date:</span>
                  <span>{formatDate(aodDetails.contract_start_date)}</span>
                </>
              )}
              
              {aodDetails.contract_end_date && (
                <>
                  <span className="font-medium">End Date:</span>
                  <span>{formatDate(aodDetails.contract_end_date)}</span>
                </>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mt-3 border-t pt-2">
              The AOD PDF document will be automatically generated and attached to this email.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSendEmail} 
            disabled={sending || !emailTo || !emailSubject || !emailMessage}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
