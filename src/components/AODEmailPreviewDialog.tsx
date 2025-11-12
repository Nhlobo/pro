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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, FileText } from "lucide-react";
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

  useEffect(() => {
    if (isOpen && aodDocumentId) {
      fetchAODDetails();
    }
  }, [isOpen, aodDocumentId]);

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
            law_firm,
            contact_number
          )
        `)
        .eq('id', aodDocumentId)
        .single();

      if (error) throw error;
      setAodDetails(aodDoc);
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
      
      const { error } = await supabase.functions.invoke('send-aod-email', {
        body: { 
          aodDocumentId,
          regenerate 
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "AOD confirmation email sent successfully",
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
            Review the email content before sending to the referring attorney
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">To:</p>
              <p className="text-sm">{attorney?.email || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Subject:</p>
              <p className="text-sm font-semibold">Agreement of Debt – Payment Terms Confirmation</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="border-b border-border pb-4">
              <h3 className="text-lg font-semibold text-foreground">Kutlwano & Associates</h3>
              <p className="text-sm text-muted-foreground">Medico-Legal Accounts Department</p>
            </div>

            <div>
              <p className="text-sm text-foreground">Dear {attorney?.name},</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-foreground">
                Please find attached your Agreement of Debt (AOD) confirming the approved payment terms.
              </p>
              
              <div className="bg-muted/50 rounded-md p-4 space-y-2">
                <p className="text-sm font-semibold text-foreground mb-3">Summary:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium text-foreground">Referring Attorney:</span>
                  <span className="text-foreground">{attorney?.name}</span>
                  
                  {attorney?.law_firm && (
                    <>
                      <span className="font-medium text-foreground">Firm Name:</span>
                      <span className="text-foreground">{attorney.law_firm}</span>
                    </>
                  )}
                  
                  {attorney?.contact_number && (
                    <>
                      <span className="font-medium text-foreground">Contact Number:</span>
                      <span className="text-foreground">{attorney.contact_number}</span>
                    </>
                  )}
                  
                  <span className="font-medium text-foreground">Total Debt:</span>
                  <span className="text-foreground font-semibold">{formatCurrency(totalDebt)}</span>
                  
                  <span className="font-medium text-foreground">Deposit Made:</span>
                  <span className="text-foreground">{formatCurrency(deposit)}</span>
                  
                  <span className="font-medium text-foreground">Remaining Balance:</span>
                  <span className="text-foreground font-semibold text-amber-600 dark:text-amber-400">
                    {formatCurrency(balance)}
                  </span>
                  
                  {aodDetails.payment_plan_structure && (
                    <>
                      <span className="font-medium text-foreground">Term of Payment:</span>
                      <span className="text-foreground">{aodDetails.payment_plan_structure}</span>
                    </>
                  )}
                  
                  {aodDetails.contract_start_date && (
                    <>
                      <span className="font-medium text-foreground">Agreement Date:</span>
                      <span className="text-foreground">{formatDate(aodDetails.contract_start_date)}</span>
                    </>
                  )}
                  
                  {aodDetails.contract_end_date && (
                    <>
                      <span className="font-medium text-foreground">End Date:</span>
                      <span className="text-foreground">{formatDate(aodDetails.contract_end_date)}</span>
                    </>
                  )}
                  
                  {aodDetails.next_payment_date && (
                    <>
                      <span className="font-medium text-foreground">Next Payment Due:</span>
                      <span className="text-foreground">{formatDate(aodDetails.next_payment_date)}</span>
                    </>
                  )}
                </div>

                {aodDetails.contract_description && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm font-medium text-foreground mb-1">Contract Description:</p>
                    <p className="text-sm text-muted-foreground">{aodDetails.contract_description}</p>
                  </div>
                )}

                {(aodDetails.interest_rate_1_3_months || 
                  aodDetails.interest_rate_6_months || 
                  aodDetails.interest_rate_12_months || 
                  aodDetails.interest_rate_18_months || 
                  aodDetails.interest_rate_24_months) && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm font-medium text-foreground mb-2">Interest Rates:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {aodDetails.interest_rate_1_3_months && (
                        <>
                          <span className="text-muted-foreground">1-3 Months:</span>
                          <span className="text-foreground">{aodDetails.interest_rate_1_3_months}%</span>
                        </>
                      )}
                      {aodDetails.interest_rate_6_months && (
                        <>
                          <span className="text-muted-foreground">6 Months:</span>
                          <span className="text-foreground">{aodDetails.interest_rate_6_months}%</span>
                        </>
                      )}
                      {aodDetails.interest_rate_12_months && (
                        <>
                          <span className="text-muted-foreground">12 Months:</span>
                          <span className="text-foreground">{aodDetails.interest_rate_12_months}%</span>
                        </>
                      )}
                      {aodDetails.interest_rate_18_months && (
                        <>
                          <span className="text-muted-foreground">18 Months:</span>
                          <span className="text-foreground">{aodDetails.interest_rate_18_months}%</span>
                        </>
                      )}
                      {aodDetails.interest_rate_24_months && (
                        <>
                          <span className="text-muted-foreground">24 Months:</span>
                          <span className="text-foreground">{aodDetails.interest_rate_24_months}%</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-4">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2">Important:</p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Kindly review and acknowledge receipt of this Agreement of Debt. Please contact us immediately if you have any questions or concerns regarding the payment terms.
              </p>
            </div>

            {aodDetails.notes && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Additional Notes:</p>
                <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">{aodDetails.notes}</p>
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <p className="text-sm text-foreground">Warm regards,</p>
              <p className="text-sm font-medium text-foreground">Kutlwano & Associates</p>
              <p className="text-sm text-muted-foreground">Medico-Legal Accounts Department</p>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <FileText className="h-3 w-3" />
              <span>AOD document reference: {aodDetails.file_name}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSendEmail} disabled={sending}>
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
