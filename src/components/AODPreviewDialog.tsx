import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, FileText, Mail, Edit2, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface AODPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aodDocumentId: string;
  onFinalize?: () => void;
}

interface AODData {
  id: string;
  referring_attorney_id: string;
  contract_start_date: string;
  contract_end_date: string;
  total_contract_value: number;
  deposit_amount: number;
  payment_due_date?: string;
  payment_plan_structure?: string;
  notes?: string;
  attorney_signature?: string;
  company_signature?: string;
  attorney_signature_date?: string;
  company_signature_date?: string;
}

export function AODPreviewDialog({ open, onOpenChange, aodDocumentId, onFinalize }: AODPreviewDialogProps) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(true);
  const [pdfPreview, setPdfPreview] = useState<string>("");
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [aodData, setAodData] = useState<AODData | null>(null);
  const [attorneyInfo, setAttorneyInfo] = useState<any>(null);

  const [editableData, setEditableData] = useState({
    contract_start_date: "",
    contract_end_date: "",
    payment_due_date: "",
    total_contract_value: "",
    deposit_amount: "",
    payment_plan_structure: "",
    notes: "",
    attorney_signature: "",
    company_signature: "Kutlwano & Associates",
    attorney_signature_date: new Date().toISOString().split('T')[0],
    company_signature_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (open && aodDocumentId) {
      loadAODData();
    }
  }, [open, aodDocumentId]);

  const loadAODData = async () => {
    setLoading(true);
    try {
      const { data: aod, error: aodError } = await supabase
        .from('aod_documents')
        .select('*')
        .eq('id', aodDocumentId)
        .single();

      if (aodError) throw aodError;

      const { data: attorney, error: attorneyError } = await supabase
        .from('referring_attorneys')
        .select('*')
        .eq('id', aod.referring_attorney_id)
        .single();

      if (attorneyError) throw attorneyError;

      setAodData(aod);
      setAttorneyInfo(attorney);

      // Calculate payment date based on contract end date
      const paymentDate = aod.payment_due_date || aod.contract_end_date;

      setEditableData({
        contract_start_date: aod.contract_start_date || "",
        contract_end_date: aod.contract_end_date || "",
        payment_due_date: paymentDate || "",
        total_contract_value: aod.total_contract_value?.toString() || "",
        deposit_amount: aod.deposit_amount?.toString() || "",
        payment_plan_structure: aod.payment_plan_structure || "",
        notes: aod.notes || "",
        attorney_signature: attorney.contact_person || attorney.name || "",
        company_signature: "Kutlwano & Associates",
        attorney_signature_date: new Date().toISOString().split('T')[0],
        company_signature_date: new Date().toISOString().split('T')[0]
      });

      // Generate initial preview
      await generatePreview(aod, attorney);

    } catch (error: any) {
      console.error("Error loading AOD data:", error);
      toast.error("Failed to load AOD data");
    } finally {
      setLoading(false);
    }
  };

  const generatePreview = async (aod?: AODData, attorney?: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-aod-pdf', {
        body: { 
          aodDocumentId: aodDocumentId,
          previewMode: true,
          customData: editing ? editableData : undefined
        }
      });

      if (error) throw error;

      if (data.success && data.pdfData) {
        // Create a data URI from the base64 PDF
        const pdfDataUri = `data:application/pdf;base64,${data.pdfData}`;
        setPdfPreview(data.pdfData);
        setPdfUrl(pdfDataUri);
      }
    } catch (error: any) {
      console.error("Error generating preview:", error);
      toast.error("Failed to generate preview");
    }
  };

  const handleUpdatePreview = async () => {
    setGenerating(true);
    await generatePreview();
    setGenerating(false);
    toast.success("Preview updated");
  };

  const handleSaveChanges = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase
        .from('aod_documents')
        .update({
          contract_start_date: editableData.contract_start_date,
          contract_end_date: editableData.contract_end_date,
          payment_due_date: editableData.payment_due_date,
          total_contract_value: parseFloat(editableData.total_contract_value),
          deposit_amount: parseFloat(editableData.deposit_amount),
          payment_plan_structure: editableData.payment_plan_structure,
          notes: editableData.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', aodDocumentId);

      if (error) throw error;

      await generatePreview();
      setEditing(false);
      toast.success("Changes saved successfully");
    } catch (error: any) {
      console.error("Error saving changes:", error);
      toast.error("Failed to save changes");
    } finally {
      setGenerating(false);
    }
  };

  const handleFinalize = async () => {
    setGenerating(true);
    try {
      // Generate final PDF
      const { data, error } = await supabase.functions.invoke('generate-aod-pdf', {
        body: { 
          aodDocumentId: aodDocumentId,
          previewMode: false,
          customData: editableData
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Final AOD document generated");
        
        // Optionally send email
        const shouldSend = confirm("Would you like to send this AOD to the referring attorney now?");
        
        if (shouldSend) {
          await handleSendEmail();
        }
        
        onFinalize?.();
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Error finalizing AOD:", error);
      toast.error("Failed to finalize AOD");
    } finally {
      setGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-aod-email', {
        body: { 
          aodDocumentId: aodDocumentId,
          recipientEmail: attorneyInfo?.email
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`AOD sent to ${attorneyInfo?.email}`);
      }
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!pdfUrl) return;
    
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `AOD-${aodDocumentId.substring(0, 8)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("PDF downloaded");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            AOD Document Preview & Edit
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {/* Edit Panel */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Edit Details</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(!editing)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  {editing ? "Lock" : "Edit"}
                </Button>
              </div>

              <Card className="p-4 space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Referring Attorney</Label>
                  <p className="font-semibold">{attorneyInfo?.name}</p>
                  <p className="text-sm text-muted-foreground">{attorneyInfo?.email}</p>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date">Contract Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={editableData.contract_start_date}
                      onChange={(e) => setEditableData({ ...editableData, contract_start_date: e.target.value })}
                      disabled={!editing}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date">Contract End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={editableData.contract_end_date}
                      onChange={(e) => setEditableData({ ...editableData, contract_end_date: e.target.value })}
                      disabled={!editing}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="payment_date">Payment Due Date</Label>
                  <Input
                    id="payment_date"
                    type="date"
                    value={editableData.payment_due_date}
                    onChange={(e) => setEditableData({ ...editableData, payment_due_date: e.target.value })}
                    disabled={!editing}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="total_value">Total Contract Value (R)</Label>
                    <Input
                      id="total_value"
                      type="number"
                      value={editableData.total_contract_value}
                      onChange={(e) => setEditableData({ ...editableData, total_contract_value: e.target.value })}
                      disabled={!editing}
                    />
                  </div>
                  <div>
                    <Label htmlFor="deposit">Deposit Amount (R)</Label>
                    <Input
                      id="deposit"
                      type="number"
                      value={editableData.deposit_amount}
                      onChange={(e) => setEditableData({ ...editableData, deposit_amount: e.target.value })}
                      disabled={!editing}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="payment_plan">Payment Plan Structure</Label>
                  <Textarea
                    id="payment_plan"
                    value={editableData.payment_plan_structure}
                    onChange={(e) => setEditableData({ ...editableData, payment_plan_structure: e.target.value })}
                    disabled={!editing}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={editableData.notes}
                    onChange={(e) => setEditableData({ ...editableData, notes: e.target.value })}
                    disabled={!editing}
                    rows={3}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-semibold">Signatures</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="attorney_sig">Attorney Signature</Label>
                      <Input
                        id="attorney_sig"
                        value={editableData.attorney_signature}
                        onChange={(e) => setEditableData({ ...editableData, attorney_signature: e.target.value })}
                        disabled={!editing}
                        placeholder="Attorney name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="attorney_date">Date</Label>
                      <Input
                        id="attorney_date"
                        type="date"
                        value={editableData.attorney_signature_date}
                        onChange={(e) => setEditableData({ ...editableData, attorney_signature_date: e.target.value })}
                        disabled={!editing}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="company_sig">Company Signature</Label>
                      <Input
                        id="company_sig"
                        value={editableData.company_signature}
                        onChange={(e) => setEditableData({ ...editableData, company_signature: e.target.value })}
                        disabled={!editing}
                      />
                    </div>
                    <div>
                      <Label htmlFor="company_date">Date</Label>
                      <Input
                        id="company_date"
                        type="date"
                        value={editableData.company_signature_date}
                        onChange={(e) => setEditableData({ ...editableData, company_signature_date: e.target.value })}
                        disabled={!editing}
                      />
                    </div>
                  </div>
                </div>

                {editing && (
                  <div className="flex gap-2">
                    <Button onClick={handleSaveChanges} disabled={generating} className="flex-1">
                      {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                      Save Changes
                    </Button>
                    <Button onClick={handleUpdatePreview} disabled={generating} variant="outline">
                      Update Preview
                    </Button>
                  </div>
                )}
              </Card>
            </div>

            {/* Preview Panel */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Document Preview</h3>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={!pdfUrl}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
              <Card className="p-4">
                {pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    className="w-full h-[600px] border rounded-lg"
                    title="AOD Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleFinalize} disabled={generating || sending || editing}>
            {generating || sending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Finalize & Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
