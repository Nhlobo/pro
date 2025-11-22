import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card } from "@/components/ui/card";
import { FileText, Plus, Edit, Trash2, Calendar as CalendarIcon, Upload, Download, Loader2, Mail, FileCheck } from "lucide-react";
import { useShortTermAgreements } from "@/hooks/useShortTermAgreements";
import { ShortTermAgreementDialog } from "./ShortTermAgreementDialog";
import { format, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";

type ReferringAttorney = {
  id: string;
  name: string;
  law_firm: string | null;
};

type ShortTermAgreementManagerProps = {
  attorneys: ReferringAttorney[];
  lawFirmId: string;
};

export const ShortTermAgreementManager = ({ attorneys, lawFirmId }: ShortTermAgreementManagerProps) => {
  const { triggerSync } = useAppointmentSync();
  const { agreements, loading, createAgreement, updateAgreement, deleteAgreement } = useShortTermAgreements(lawFirmId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<any>(null);
  const [selectedAttorney, setSelectedAttorney] = useState<string>("");
  const [contractStartDate, setContractStartDate] = useState<Date>();
  const [contractEndDate, setContractEndDate] = useState<Date>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    agreement_method: "email" as "email" | "telephone" | "both",
    agreement_reference: "",
    contract_description: "",
    total_contract_value: "",
    deposit_amount: "",
    payment_plan_structure: "",
    interest_rate_1_3_months: "",
    interest_rate_6_months: "",
    interest_rate_12_months: "",
    total_reports_agreed: "",
    notes: "",
    payment_status: "pending" as "pending" | "partial" | "paid" | "overdue",
  });

  const resetForm = () => {
    setSelectedAttorney("");
    setContractStartDate(undefined);
    setContractEndDate(undefined);
    setSelectedFile(null);
    setFormData({
      agreement_method: "email",
      agreement_reference: "",
      contract_description: "",
      total_contract_value: "",
      deposit_amount: "",
      payment_plan_structure: "",
      interest_rate_1_3_months: "",
      interest_rate_6_months: "",
      interest_rate_12_months: "",
      total_reports_agreed: "",
      notes: "",
      payment_status: "pending",
    });
  };

  const validateDuration = (startDate: Date, endDate: Date): boolean => {
    const maxEndDate = addMonths(startDate, 12);
    if (endDate > maxEndDate) {
      toast.error("Agreement duration cannot exceed 12 months");
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!selectedAttorney || !contractStartDate || !contractEndDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!validateDuration(contractStartDate, contractEndDate)) {
      return;
    }

    try {
      setIsUploading(true);
      let documentUrl: string | undefined;
      let fileName: string | undefined;

      // Upload file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${lawFirmId}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('short-term-agreements')
          .upload(filePath, selectedFile);

        if (uploadError) {
          toast.error("Failed to upload document");
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('short-term-agreements')
          .getPublicUrl(filePath);

        documentUrl = publicUrl;
        fileName = selectedFile.name;
      }

      const agreementData = {
        referring_attorney_id: selectedAttorney,
        agreement_method: formData.agreement_method,
        agreement_reference: formData.agreement_reference || undefined,
        contract_description: formData.contract_description || undefined,
        contract_start_date: format(contractStartDate, "yyyy-MM-dd"),
        contract_end_date: format(contractEndDate, "yyyy-MM-dd"),
        total_contract_value: formData.total_contract_value ? parseFloat(formData.total_contract_value) : undefined,
        deposit_amount: formData.deposit_amount ? parseFloat(formData.deposit_amount) : undefined,
        payment_plan_structure: formData.payment_plan_structure || undefined,
        interest_rate_1_3_months: formData.interest_rate_1_3_months ? parseFloat(formData.interest_rate_1_3_months) : undefined,
        interest_rate_6_months: formData.interest_rate_6_months ? parseFloat(formData.interest_rate_6_months) : undefined,
        interest_rate_12_months: formData.interest_rate_12_months ? parseFloat(formData.interest_rate_12_months) : undefined,
        total_reports_agreed: formData.total_reports_agreed ? parseInt(formData.total_reports_agreed) : undefined,
        notes: formData.notes || undefined,
        payment_status: formData.payment_status,
        status: "active" as const,
        document_url: documentUrl,
        file_name: fileName,
      };

      await createAgreement(agreementData);
      triggerSync(); // Update all dashboards
      setIsCreateOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error creating agreement:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleEdit = (agreement: any) => {
    setEditingAgreement(agreement);
    setSelectedAttorney(agreement.attorney_id);
    setContractStartDate(new Date(agreement.contract_start_date));
    setContractEndDate(new Date(agreement.contract_end_date));
    setFormData({
      agreement_method: agreement.agreement_method,
      agreement_reference: agreement.agreement_reference || "",
      contract_description: agreement.contract_description || "",
      total_contract_value: agreement.total_contract_value?.toString() || "",
      deposit_amount: agreement.deposit_amount?.toString() || "",
      payment_plan_structure: agreement.payment_plan_structure || "",
      interest_rate_1_3_months: agreement.interest_rate_1_3_months?.toString() || "",
      interest_rate_6_months: agreement.interest_rate_6_months?.toString() || "",
      interest_rate_12_months: agreement.interest_rate_12_months?.toString() || "",
      total_reports_agreed: agreement.total_reports_agreed?.toString() || "",
      notes: agreement.notes || "",
      payment_status: agreement.payment_status,
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingAgreement || !contractStartDate || !contractEndDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!validateDuration(contractStartDate, contractEndDate)) {
      return;
    }

    try {
      setIsUploading(true);
      let documentUrl = editingAgreement.document_url;
      let fileName = editingAgreement.file_name;

      // Upload new file if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `${lawFirmId}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('short-term-agreements')
          .upload(filePath, selectedFile);

        if (uploadError) {
          toast.error("Failed to upload document");
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('short-term-agreements')
          .getPublicUrl(filePath);

        documentUrl = publicUrl;
        fileName = selectedFile.name;
      }

      const updates = {
        attorney_id: selectedAttorney,
        agreement_method: formData.agreement_method,
        agreement_reference: formData.agreement_reference || undefined,
        contract_description: formData.contract_description || undefined,
        contract_start_date: format(contractStartDate, "yyyy-MM-dd"),
        contract_end_date: format(contractEndDate, "yyyy-MM-dd"),
        total_contract_value: formData.total_contract_value ? parseFloat(formData.total_contract_value) : undefined,
        deposit_amount: formData.deposit_amount ? parseFloat(formData.deposit_amount) : undefined,
        payment_plan_structure: formData.payment_plan_structure || undefined,
        interest_rate_1_3_months: formData.interest_rate_1_3_months ? parseFloat(formData.interest_rate_1_3_months) : undefined,
        interest_rate_6_months: formData.interest_rate_6_months ? parseFloat(formData.interest_rate_6_months) : undefined,
        interest_rate_12_months: formData.interest_rate_12_months ? parseFloat(formData.interest_rate_12_months) : undefined,
        total_reports_agreed: formData.total_reports_agreed ? parseInt(formData.total_reports_agreed) : undefined,
        notes: formData.notes || undefined,
        payment_status: formData.payment_status,
        document_url: documentUrl,
        file_name: fileName,
      };

      await updateAgreement(editingAgreement.id, updates);
      triggerSync(); // Update all dashboards
      setIsEditOpen(false);
      resetForm();
      setEditingAgreement(null);
    } catch (error) {
      console.error("Error updating agreement:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this agreement?")) {
      await deleteAgreement(id);
      triggerSync(); // Update all dashboards
    }
  };

  const getAttorneyName = (attorneyId: string) => {
    const attorney = attorneys.find(a => a.id === attorneyId);
    return attorney?.name || "Unknown Referring Attorney";
  };

  const handleGeneratePdf = async (agreementId: string) => {
    setGeneratingPdf(agreementId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-short-term-agreement-pdf', {
        body: { agreementId }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("PDF generated successfully");
      } else {
        throw new Error(data.error || "Failed to generate PDF");
      }
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast.error(error.message || "Failed to generate PDF");
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleSendEmail = async (agreementId: string) => {
    setSendingEmail(agreementId);
    try {
      const { data, error } = await supabase.functions.invoke('send-short-term-agreement-email', {
        body: { agreementId }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Agreement email sent to ${data.recipientEmail}`);
      } else {
        throw new Error(data.error || "Failed to send email");
      }
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setSendingEmail(null);
    }
  };

  const handleDownload = async (documentUrl: string, fileName: string) => {
    try {
      const link = document.createElement('a');
      link.href = documentUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started");
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  };

  const FormFields = () => (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="attorney">Referring Attorney *</Label>
        <Select value={selectedAttorney} onValueChange={setSelectedAttorney}>
          <SelectTrigger>
            <SelectValue placeholder="Select referring attorney" />
          </SelectTrigger>
          <SelectContent>
            {attorneys.map((attorney) => (
              <SelectItem key={attorney.id} value={attorney.id}>
                {attorney.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="agreement_method">Agreement Method *</Label>
        <Select
          value={formData.agreement_method}
          onValueChange={(value: "email" | "telephone" | "both") =>
            setFormData({ ...formData, agreement_method: value })
          }
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

      <div className="grid gap-2">
        <Label htmlFor="agreement_reference">Agreement Reference</Label>
        <Input
          id="agreement_reference"
          value={formData.agreement_reference}
          onChange={(e) => setFormData({ ...formData, agreement_reference: e.target.value })}
          placeholder="e.g., STA-2025-001"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Start Date *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal", !contractStartDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {contractStartDate ? format(contractStartDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={contractStartDate} onSelect={setContractStartDate} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2">
          <Label>End Date * (Max 12 months)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal", !contractEndDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {contractEndDate ? format(contractEndDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={contractEndDate}
                onSelect={setContractEndDate}
                disabled={(date) => contractStartDate ? date < contractStartDate || date > addMonths(contractStartDate, 12) : false}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="contract_description">Contract Description</Label>
        <Textarea
          id="contract_description"
          value={formData.contract_description}
          onChange={(e) => setFormData({ ...formData, contract_description: e.target.value })}
          placeholder="Describe the agreement terms..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="total_contract_value">Total Contract Value (R)</Label>
          <Input
            id="total_contract_value"
            type="number"
            step="0.01"
            value={formData.total_contract_value}
            onChange={(e) => setFormData({ ...formData, total_contract_value: e.target.value })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="deposit_amount">Deposit Amount (R)</Label>
          <Input
            id="deposit_amount"
            type="number"
            step="0.01"
            value={formData.deposit_amount}
            onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="payment_plan_structure">Payment Plan Structure</Label>
        <Input
          id="payment_plan_structure"
          value={formData.payment_plan_structure}
          onChange={(e) => setFormData({ ...formData, payment_plan_structure: e.target.value })}
          placeholder="e.g., Monthly, Quarterly, etc."
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="interest_rate_1_3">Interest 1-3 Months (%)</Label>
          <Input
            id="interest_rate_1_3"
            type="number"
            step="0.01"
            value={formData.interest_rate_1_3_months}
            onChange={(e) => setFormData({ ...formData, interest_rate_1_3_months: e.target.value })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="interest_rate_6">Interest 6 Months (%)</Label>
          <Input
            id="interest_rate_6"
            type="number"
            step="0.01"
            value={formData.interest_rate_6_months}
            onChange={(e) => setFormData({ ...formData, interest_rate_6_months: e.target.value })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="interest_rate_12">Interest 12 Months (%)</Label>
          <Input
            id="interest_rate_12"
            type="number"
            step="0.01"
            value={formData.interest_rate_12_months}
            onChange={(e) => setFormData({ ...formData, interest_rate_12_months: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="total_reports">Total Reports Agreed</Label>
        <Input
          id="total_reports"
          type="number"
          value={formData.total_reports_agreed}
          onChange={(e) => setFormData({ ...formData, total_reports_agreed: e.target.value })}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="payment_status">Payment Status</Label>
        <Select
          value={formData.payment_status}
          onValueChange={(value: any) => setFormData({ ...formData, payment_status: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes..."
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="document">Attach Agreement Document</Label>
        <div className="flex items-center gap-2">
          <Input
            id="document"
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="cursor-pointer"
          />
          {selectedFile && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Upload className="h-3 w-3" />
              {selectedFile.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="text-center py-8">Loading agreements...</div>;
  }

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Short-Term Agreements
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage agreements concluded via email/phone (max 12 months)
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { resetForm(); setIsQuickCreateOpen(true); }}>
            <FileCheck className="mr-2 h-4 w-4" />
            Quick Create & Send
          </Button>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              New Agreement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Short-Term Agreement</DialogTitle>
            </DialogHeader>
            <FormFields />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isUploading}>
                {isUploading ? "Creating..." : "Create Agreement"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {agreements.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No short-term agreements yet</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referring Attorney & Debt</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Payment Details</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agreements.map((agreement) => {
              // Extract referring attorney name from contract description
              const extractAttorneyName = (description: string) => {
                if (!description) return "Unknown";
                // Match pattern: "Short-Term - Attorney Name (X assessments)"
                const match = description.match(/(?:AOD|Short-Term)\s*-\s*([^(]+)/);
                return match ? match[1].trim() : description;
              };

              const outstandingDebt = (agreement.total_contract_value || 0) - (agreement.deposit_amount || 0);
              
              return (
              <TableRow key={agreement.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-semibold text-base">
                      {extractAttorneyName(agreement.contract_description || agreement.file_name || '')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {agreement.total_reports_agreed || 0} assessments
                    </div>
                    <div className={`text-sm font-bold ${outstandingDebt > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      Outstanding Debt: R{outstandingDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="capitalize">{agreement.agreement_method}</TableCell>
                <TableCell>{agreement.agreement_reference || "—"}</TableCell>
                <TableCell>
                  <div className="text-xs space-y-1">
                    <div>{format(new Date(agreement.contract_start_date), "MMM d, yyyy")}</div>
                    <div className="text-muted-foreground">to</div>
                    <div>{format(new Date(agreement.contract_end_date), "MMM d, yyyy")}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-xs space-y-1">
                    <div className="font-medium">Total: R{(agreement.total_contract_value || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="text-muted-foreground">Paid: R{(agreement.deposit_amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="text-muted-foreground">Payments: {agreement.payments_made || 0}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={cn("px-2 py-1 rounded text-xs font-medium",
                    agreement.payment_status === "paid" && "bg-green-100 text-green-800",
                    agreement.payment_status === "partial" && "bg-blue-100 text-blue-800",
                    agreement.payment_status === "pending" && "bg-yellow-100 text-yellow-800",
                    agreement.payment_status === "overdue" && "bg-red-100 text-red-800"
                  )}>
                    {agreement.payment_status}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGeneratePdf(agreement.id)}
                      disabled={generatingPdf === agreement.id}
                      title="Generate PDF"
                    >
                      {generatingPdf === agreement.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendEmail(agreement.id)}
                      disabled={sendingEmail === agreement.id}
                      title="Send Email"
                    >
                      {sendingEmail === agreement.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                    </Button>
                    {agreement.document_url && agreement.file_name && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDownload(agreement.document_url!, agreement.file_name!)}
                        title="Download document"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleEdit(agreement)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(agreement.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Short-Term Agreement</DialogTitle>
          </DialogHeader>
          <FormFields />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isUploading}>
              {isUploading ? "Updating..." : "Update Agreement"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Create & Send Dialog */}
      <ShortTermAgreementDialog
        open={isQuickCreateOpen}
        onOpenChange={setIsQuickCreateOpen}
        referringAttorneyId={lawFirmId}
        referringAttorneyName={attorneys.find(a => a.id === lawFirmId)?.name}
        referringAttorneyEmail={attorneys.find(a => a.id === lawFirmId)?.law_firm || undefined}
      />
      </div>
    </Card>
  );
};
