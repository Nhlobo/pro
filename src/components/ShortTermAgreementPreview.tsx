import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, FileText, Mail, Edit, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ShortTermAgreementPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentData: {
    id: string;
    referring_attorney_id: string;
    referring_attorney_name?: string;
    referring_attorney_email?: string;
    claimant_name?: string;
    appointment_date: string;
    expert_type?: string;
    service_fee?: number;
    deposit_amount?: number;
    discount_amount?: number;
    discount_rate?: number;
    discount_type?: string;
    payment_terms?: string;
  };
}

export function ShortTermAgreementPreview({
  open,
  onOpenChange,
  appointmentData
}: ShortTermAgreementPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [agreementId, setAgreementId] = useState<string | null>(null);
  const [pdfHtml, setPdfHtml] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(true);

  const [formData, setFormData] = useState({
    agreementMethod: "email" as "email" | "telephone" | "both",
    paymentTerm: appointmentData.payment_terms || "90_days",
    totalReports: "1",
    totalCost: appointmentData.service_fee?.toString() || "",
    depositAmount: appointmentData.deposit_amount?.toString() || "",
    agreementReference: appointmentData.claimant_name || "",
    contractDescription: `Assessment for ${appointmentData.claimant_name || 'claimant'} - ${appointmentData.expert_type || 'expert assessment'}`,
    notes: ""
  });

  useEffect(() => {
    if (open && !agreementId) {
      // Auto-create draft agreement
      createDraftAgreement();
    }
  }, [open]);

  const calculateDates = (term: string) => {
    const start = new Date(appointmentData.appointment_date);
    let end = new Date(start);
    
    const termMap: Record<string, number> = {
      "30 days": 1,
      "60 days": 2,
      "90 days": 3,
      "120 days": 4,
      "6 months": 6,
      "7 months": 7,
      "8 months": 8,
      "9 months": 9,
      "10 months": 10,
      "11 months": 11,
      "12 months": 12
    };
    
    const months = termMap[term] || 3;
    end.setMonth(end.getMonth() + months);
    
    return { start, end };
  };

  const createDraftAgreement = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { start, end } = calculateDates(formData.paymentTerm);
      const totalCost = parseFloat(formData.totalCost) || 0;
      const depositAmount = formData.depositAmount ? parseFloat(formData.depositAmount) : totalCost * 0.5;

      const { data: agreement, error } = await supabase
        .from('short_term_agreements')
        .insert({
          referring_attorney_id: appointmentData.referring_attorney_id,
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
          contract_description: formData.contractDescription,
          notes: formData.notes || undefined,
          payment_plan_structure: `Payment term: ${formData.paymentTerm}`
        })
        .select()
        .single();

      if (error) throw error;

      setAgreementId(agreement.id);
      toast.success("Draft agreement created");
      
      // Auto-generate PDF preview
      await handleGeneratePdf(agreement.id);
      
    } catch (error: any) {
      console.error("Error creating draft agreement:", error);
      toast.error(error.message || "Failed to create draft agreement");
    } finally {
      setLoading(false);
    }
  };

  const updateAgreement = async () => {
    if (!agreementId) return;
    
    setLoading(true);
    try {
      const { start, end } = calculateDates(formData.paymentTerm);
      const totalCost = parseFloat(formData.totalCost) || 0;
      const depositAmount = formData.depositAmount ? parseFloat(formData.depositAmount) : totalCost * 0.5;

      const { error } = await supabase
        .from('short_term_agreements')
        .update({
          agreement_method: formData.agreementMethod,
          agreement_reference: formData.agreementReference || undefined,
          contract_start_date: start.toISOString().split('T')[0],
          contract_end_date: end.toISOString().split('T')[0],
          total_reports_agreed: parseInt(formData.totalReports),
          total_contract_value: totalCost,
          deposit_amount: depositAmount,
          contract_description: formData.contractDescription,
          notes: formData.notes || undefined,
          payment_plan_structure: `Payment term: ${formData.paymentTerm}`
        })
        .eq('id', agreementId);

      if (error) throw error;

      toast.success("Agreement updated");
      
      // Regenerate PDF
      await handleGeneratePdf(agreementId);
      setIsEditing(false);
      
    } catch (error: any) {
      console.error("Error updating agreement:", error);
      toast.error(error.message || "Failed to update agreement");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdf = async (id: string) => {
    setGeneratingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-short-term-agreement-pdf', {
        body: { agreementId: id }
      });

      if (error) throw error;

      setPdfHtml(data.pdfHtml);
      toast.success("PDF preview generated");
      
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast.error(error.message || "Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleFinalizeAndSend = async () => {
    if (!agreementId) return;
    
    setSendingEmail(true);
    try {
      // Send email with PDF
      const { error: emailError } = await supabase.functions.invoke('send-short-term-agreement-email', {
        body: { 
          agreementId,
          recipientEmail: appointmentData.referring_attorney_email
        }
      });

      if (emailError) throw emailError;

      // Update status
      await supabase
        .from('short_term_agreements')
        .update({ status: 'active' })
        .eq('id', agreementId);

      toast.success("Agreement finalized and sent to attorney");
      onOpenChange(false);
      
    } catch (error: any) {
      console.error("Error sending agreement:", error);
      toast.error(error.message || "Failed to send agreement");
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Short-Term Agreement Preview</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Left side - Editable Form */}
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              <div>
                <Label>Agreement Method</Label>
                <Select
                  value={formData.agreementMethod}
                  onValueChange={(value: any) => setFormData({ ...formData, agreementMethod: value })}
                  disabled={!isEditing}
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
                <Label>Payment Term</Label>
                <Select
                  value={formData.paymentTerm}
                  onValueChange={(value) => setFormData({ ...formData, paymentTerm: value })}
                  disabled={!isEditing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30 days">30 Days</SelectItem>
                    <SelectItem value="60 days">60 Days</SelectItem>
                    <SelectItem value="90 days">90 Days</SelectItem>
                    <SelectItem value="120 days">120 Days</SelectItem>
                    <SelectItem value="6 months">6 Months</SelectItem>
                    <SelectItem value="7 months">7 Months</SelectItem>
                    <SelectItem value="8 months">8 Months</SelectItem>
                    <SelectItem value="9 months">9 Months</SelectItem>
                    <SelectItem value="10 months">10 Months</SelectItem>
                    <SelectItem value="11 months">11 Months</SelectItem>
                    <SelectItem value="12 months">12 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Total Reports</Label>
                <Input
                  type="number"
                  value={formData.totalReports}
                  onChange={(e) => setFormData({ ...formData, totalReports: e.target.value })}
                  disabled={!isEditing}
                />
              </div>

              <div>
                <Label>Total Cost (R)</Label>
                <Input
                  type="number"
                  value={formData.totalCost}
                  onChange={(e) => setFormData({ ...formData, totalCost: e.target.value })}
                  disabled={!isEditing}
                />
              </div>

              <div>
                <Label>Deposit Amount (R)</Label>
                <Input
                  type="number"
                  value={formData.depositAmount}
                  onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                  placeholder="50% of total cost"
                  disabled={!isEditing}
                />
              </div>

              <div>
                <Label>Agreement Reference</Label>
                <Input
                  value={formData.agreementReference}
                  onChange={(e) => setFormData({ ...formData, agreementReference: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Claimant name"
                />
              </div>

              <div>
                <Label>Contract Description</Label>
                <Textarea
                  value={formData.contractDescription}
                  onChange={(e) => setFormData({ ...formData, contractDescription: e.target.value })}
                  disabled={!isEditing}
                  rows={3}
                />
              </div>

              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  disabled={!isEditing}
                  rows={3}
                />
              </div>

              {isEditing && (
                <Button onClick={updateAgreement} disabled={loading} className="w-full">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Check className="mr-2 h-4 w-4" />
                  Update & Preview
                </Button>
              )}

              {!isEditing && (
                <Button onClick={() => setIsEditing(true)} variant="outline" className="w-full">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Agreement
                </Button>
              )}
            </div>
          </ScrollArea>

          {/* Right side - PDF Preview */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">PDF Preview</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => agreementId && handleGeneratePdf(agreementId)}
                disabled={generatingPdf}
              >
                {generatingPdf && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <FileText className="mr-2 h-4 w-4" />
                Refresh Preview
              </Button>
            </div>
            
            <ScrollArea className="h-[520px]">
              {generatingPdf ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : pdfHtml ? (
                <div
                  className="bg-white p-6 text-sm"
                  dangerouslySetInnerHTML={{ __html: pdfHtml }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Preview will appear here
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleFinalizeAndSend}
            disabled={sendingEmail || !pdfHtml || isEditing}
          >
            {sendingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Mail className="mr-2 h-4 w-4" />
            Confirm & Send to Attorney
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
