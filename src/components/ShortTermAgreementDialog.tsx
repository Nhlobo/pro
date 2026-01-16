import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, FileText, Mail } from "lucide-react";
import { CREDITOR_INFO, AOD_TEMPLATE_SECTIONS, numberToWords } from "./AODTemplateData";

interface ShortTermAgreementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referringAttorneyId: string;
  referringAttorneyName?: string;
  referringAttorneyEmail?: string;
  appointmentIds?: string[];
}

export function ShortTermAgreementDialog({
  open,
  onOpenChange,
  referringAttorneyId,
  referringAttorneyName,
  referringAttorneyEmail,
  appointmentIds = []
}: ShortTermAgreementDialogProps) {
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [agreementId, setAgreementId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    agreementMethod: "email" as "email" | "telephone" | "both",
    paymentTerm: "90_days",
    totalReports: "",
    totalCost: "",
    depositAmount: "",
    agreementReference: "",
    notes: ""
  });

  const calculateDates = (term: string) => {
    const start = new Date();
    let end = new Date();
    
    switch (term) {
      case "90_days":
        end.setMonth(end.getMonth() + 3);
        break;
      case "120_days":
        end.setMonth(end.getMonth() + 4);
        break;
      case "6_months":
        end.setMonth(end.getMonth() + 6);
        break;
      case "11_12_months":
        end.setMonth(end.getMonth() + 12);
        break;
    }
    
    return { start, end };
  };

  const handleCreateAgreement = async () => {
    if (!formData.totalReports || !formData.totalCost) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { start, end } = calculateDates(formData.paymentTerm);
      const totalCost = parseFloat(formData.totalCost);
      const depositAmount = formData.depositAmount ? parseFloat(formData.depositAmount) : totalCost * 0.5;
      const remainingBalance = totalCost - depositAmount;

      // Create short-term agreement
      const { data: agreement, error } = await supabase
        .from('short_term_agreements')
        .insert({
          referring_attorney_id: referringAttorneyId,
          created_by: userData.user.id,
          agreement_method: formData.agreementMethod,
          agreement_reference: formData.agreementReference || undefined,
          contract_start_date: start.toISOString().split('T')[0],
          contract_end_date: end.toISOString().split('T')[0],
          total_reports_agreed: parseInt(formData.totalReports),
          total_contract_value: totalCost,
          deposit_amount: depositAmount,
          payment_status: "pending",
          status: "active",
          notes: formData.notes || undefined,
          payment_plan_structure: `Payment term: ${formData.paymentTerm.replace('_', ' ')}`
        })
        .select()
        .single();

      if (error) throw error;

      // Also create linked AOD document for unified management
      const { error: aodError } = await supabase
        .from('aod_documents')
        .insert({
          referring_attorney_id: referringAttorneyId,
          uploaded_by: userData.user.id,
          file_name: `STA_${start.getFullYear()}_${String(start.getMonth() + 1).padStart(2, '0')}_${referringAttorneyId.substring(0, 8)}.pdf`,
          document_url: '',
          contract_start_date: start.toISOString().split('T')[0],
          contract_end_date: end.toISOString().split('T')[0],
          payment_due_date: end.toISOString().split('T')[0],
          total_contract_value: totalCost,
          deposit_amount: depositAmount,
          total_reports_agreed: parseInt(formData.totalReports),
          payment_plan_structure: `Short-term: ${formData.paymentTerm.replace('_', ' ')}`,
          payment_status: 'pending',
          agreement_type: 'short-term',
          contract_description: `Short-Term Agreement - ${formData.paymentTerm.replace('_', ' ')}`,
          notes: `Linked to Short-Term Agreement: ${agreement.id}\n${formData.notes || ''}`,
          total_amount_words: numberToWords(totalCost)
        });

      if (aodError) {
        console.error("Error creating linked AOD:", aodError);
        // Don't fail the whole operation if AOD creation fails
      }

      setAgreementId(agreement.id);
      toast.success("Agreement created with master AOD template");
      
      // Auto-generate PDF using master template
      await handleGeneratePdf(agreement.id);
      
    } catch (error: any) {
      console.error("Error creating agreement:", error);
      toast.error(error.message || "Failed to create agreement");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdf = async (id?: string) => {
    const targetId = id || agreementId;
    if (!targetId) {
      toast.error("No agreement to generate PDF for");
      return;
    }

    setGeneratingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-short-term-agreement-pdf', {
        body: { agreementId: targetId }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("PDF generated successfully");
        
        // Auto-send email if we have the agreement ID
        if (!id) { // Only auto-send if this was manually triggered
          await handleSendEmail(targetId);
        }
      } else {
        throw new Error(data.error || "Failed to generate PDF");
      }
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast.error(error.message || "Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSendEmail = async (id?: string) => {
    const targetId = id || agreementId;
    if (!targetId) {
      toast.error("No agreement to send email for");
      return;
    }

    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-short-term-agreement-email', {
        body: { 
          agreementId: targetId,
          recipientEmail: referringAttorneyEmail 
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Agreement email sent to ${data.recipientEmail}`);
        onOpenChange(false);
      } else {
        throw new Error(data.error || "Failed to send email");
      }
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Short-Term Agreement</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Referring Attorney</Label>
            <Input value={referringAttorneyName || "Selected Attorney"} disabled />
          </div>

          <div>
            <Label>Agreement Method *</Label>
            <Select
              value={formData.agreementMethod}
              onValueChange={(value: any) => setFormData({ ...formData, agreementMethod: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="telephone">Telephone</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Payment Term *</Label>
            <Select
              value={formData.paymentTerm}
              onValueChange={(value) => setFormData({ ...formData, paymentTerm: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="90_days">90 Days (3 months)</SelectItem>
                <SelectItem value="120_days">120 Days (4 months)</SelectItem>
                <SelectItem value="6_months">6 Months</SelectItem>
                <SelectItem value="11_12_months">11-12 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total Reports *</Label>
              <Input
                type="number"
                value={formData.totalReports}
                onChange={(e) => setFormData({ ...formData, totalReports: e.target.value })}
                placeholder="Number of reports"
              />
            </div>
            <div>
              <Label>Total Cost (R) *</Label>
              <Input
                type="number"
                value={formData.totalCost}
                onChange={(e) => setFormData({ ...formData, totalCost: e.target.value })}
                placeholder="130410.00"
              />
            </div>
          </div>

          <div>
            <Label>Deposit Amount (R) - Optional</Label>
            <Input
              type="number"
              value={formData.depositAmount}
              onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
              placeholder="Auto-calculated as 50% if left empty"
            />
          </div>

          <div>
            <Label>Agreement Reference - Optional</Label>
            <Input
              value={formData.agreementReference}
              onChange={(e) => setFormData({ ...formData, agreementReference: e.target.value })}
              placeholder="STA-2025-001"
            />
          </div>

          <div>
            <Label>Additional Notes - Optional</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional terms or conditions..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            {agreementId ? (
              <>
                <Button
                  onClick={() => handleGeneratePdf()}
                  disabled={generatingPdf}
                  variant="outline"
                >
                  {generatingPdf ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Regenerate PDF
                </Button>
                <Button
                  onClick={() => handleSendEmail()}
                  disabled={sendingEmail}
                >
                  {sendingEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Send Email
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => onOpenChange(false)} variant="outline">
                  Cancel
                </Button>
                <Button onClick={handleCreateAgreement} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create & Send Agreement
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
