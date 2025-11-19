import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { FileText, Upload, Download, Trash2, Edit, Calendar as CalendarIcon, Mail } from "lucide-react";
import { useAODDocuments } from "@/hooks/useAODDocuments";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AODEmailPreviewDialog } from "./AODEmailPreviewDialog";

type ReferringAttorney = {
  id: string;
  name: string;
  law_firm: string | null;
};

type AODDocumentManagerProps = {
  attorneys: ReferringAttorney[];
  lawFirmId: string;
};

export const AODDocumentManager = ({ attorneys, lawFirmId }: AODDocumentManagerProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { documents, loading, uploadDocument, downloadDocument, deleteDocument, updateDocument } = useAODDocuments();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAttorney, setSelectedAttorney] = useState<string>("");
  const [editAttorney, setEditAttorney] = useState<string>("");
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [contractStartDate, setContractStartDate] = useState<Date>();
  const [contractEndDate, setContractEndDate] = useState<Date>();
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [previewDocumentId, setPreviewDocumentId] = useState<string>("");
  const [previewRegenerate, setPreviewRegenerate] = useState(false);
  
  const [formData, setFormData] = useState({
    contract_description: "",
    payment_plan_structure: "",
    payment_due_date: "",
    deposit_amount: "",
    interest_rate_1_3_months: "",
    interest_rate_6_months: "",
    interest_rate_12_months: "",
    interest_rate_18_months: "",
    interest_rate_24_months: "",
    notes: "",
    payment_status: "pending",
    next_payment_date: "",
    total_contract_value: "",
    payments_made: "0",
    total_reports_agreed: "",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    // Referring attorney is optional - can be added later when syncing appointments
    const attorneyToUse = selectedAttorney && selectedAttorney.trim() !== "" ? selectedAttorney : null;

    const metadata = {
      contract_description: formData.contract_description || undefined,
      contract_start_date: contractStartDate ? format(contractStartDate, "yyyy-MM-dd") : undefined,
      contract_end_date: contractEndDate ? format(contractEndDate, "yyyy-MM-dd") : undefined,
      payment_plan_structure: formData.payment_plan_structure || undefined,
      payment_due_date: formData.payment_due_date || undefined,
      deposit_amount: formData.deposit_amount ? parseFloat(formData.deposit_amount) : undefined,
      interest_rate_1_3_months: formData.interest_rate_1_3_months ? parseFloat(formData.interest_rate_1_3_months) : undefined,
      interest_rate_6_months: formData.interest_rate_6_months ? parseFloat(formData.interest_rate_6_months) : undefined,
      interest_rate_12_months: formData.interest_rate_12_months ? parseFloat(formData.interest_rate_12_months) : undefined,
      interest_rate_18_months: formData.interest_rate_18_months ? parseFloat(formData.interest_rate_18_months) : undefined,
      interest_rate_24_months: formData.interest_rate_24_months ? parseFloat(formData.interest_rate_24_months) : undefined,
      notes: formData.notes || undefined,
      payment_status: formData.payment_status || 'pending',
      next_payment_date: formData.next_payment_date || undefined,
      total_contract_value: formData.total_contract_value ? parseFloat(formData.total_contract_value) : undefined,
      payments_made: formData.payments_made ? parseInt(formData.payments_made) : 0,
      total_reports_agreed: formData.total_reports_agreed ? parseInt(formData.total_reports_agreed) : undefined,
    };

    const success = await uploadDocument(selectedFile, selectedAttorney, lawFirmId, metadata);
    
    if (success) {
      // Get the latest document and show email preview
      try {
        const { data: latestDoc } = await supabase
          .from('aod_documents')
          .select('id')
          .eq('referring_attorney_id', selectedAttorney)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (latestDoc) {
          toast({
            title: "Document Uploaded",
            description: "Document uploaded successfully. Review and send confirmation email.",
          });
          
          // Show email preview dialog
          setPreviewDocumentId(latestDoc.id);
          setPreviewRegenerate(false);
          setEmailPreviewOpen(true);
        }
      } catch (error) {
        console.error('Error fetching latest document:', error);
        toast({
          title: "Success",
          description: "Document uploaded successfully",
        });
      }

      setIsUploadOpen(false);
      setSelectedFile(null);
      setSelectedAttorney("");
      setContractStartDate(undefined);
      setContractEndDate(undefined);
      setFormData({
        contract_description: "",
        payment_plan_structure: "",
        payment_due_date: "",
        deposit_amount: "",
        interest_rate_1_3_months: "",
        interest_rate_6_months: "",
        interest_rate_12_months: "",
        interest_rate_18_months: "",
        interest_rate_24_months: "",
        notes: "",
        payment_status: "pending",
        next_payment_date: "",
        total_contract_value: "",
        payments_made: "0",
        total_reports_agreed: "",
      });
    }
  };

  const handleEdit = (doc: any) => {
    setEditingDoc(doc);
    // Extract attorney name from contract_description or notes for display
    const extractedAttorney = (() => {
      if (doc.notes && doc.notes.includes('APPOINTMENT:')) {
        const match = doc.notes.match(/Referring Attorney:\s*([^,\n]+)/);
        if (match) return match[1].trim();
      }
      if (doc.contract_description) {
        const match = doc.contract_description.match(/(?:AOD|Short-Term)\s*-\s*([^(]+)/);
        if (match) return match[1].trim();
      }
      return "";
    })();
    
    // Find attorney by name to get ID
    const matchedAttorney = attorneys.find(a => a.name === extractedAttorney);
    setEditAttorney(matchedAttorney?.id || "");
    
    setContractStartDate(doc.contract_start_date ? new Date(doc.contract_start_date) : undefined);
    setContractEndDate(doc.contract_end_date ? new Date(doc.contract_end_date) : undefined);
    setFormData({
      contract_description: doc.contract_description || "",
      payment_plan_structure: doc.payment_plan_structure || "",
      payment_due_date: doc.payment_due_date || "",
      deposit_amount: doc.deposit_amount?.toString() || "",
      interest_rate_1_3_months: doc.interest_rate_1_3_months?.toString() || "",
      interest_rate_6_months: doc.interest_rate_6_months?.toString() || "",
      interest_rate_12_months: doc.interest_rate_12_months?.toString() || "",
      interest_rate_18_months: doc.interest_rate_18_months?.toString() || "",
      interest_rate_24_months: doc.interest_rate_24_months?.toString() || "",
      notes: doc.notes || "",
      payment_status: doc.payment_status || "pending",
      next_payment_date: doc.next_payment_date ? format(new Date(doc.next_payment_date), "yyyy-MM-dd") : "",
      total_contract_value: doc.total_contract_value?.toString() || "",
      payments_made: doc.payments_made?.toString() || "0",
      total_reports_agreed: doc.total_reports_agreed?.toString() || "",
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingDoc) return;

    const metadata = {
      contract_description: formData.contract_description || undefined,
      contract_start_date: contractStartDate ? format(contractStartDate, "yyyy-MM-dd") : undefined,
      contract_end_date: contractEndDate ? format(contractEndDate, "yyyy-MM-dd") : undefined,
      payment_plan_structure: formData.payment_plan_structure || undefined,
      payment_due_date: formData.payment_due_date || undefined,
      deposit_amount: formData.deposit_amount ? parseFloat(formData.deposit_amount) : undefined,
      interest_rate_1_3_months: formData.interest_rate_1_3_months ? parseFloat(formData.interest_rate_1_3_months) : undefined,
      interest_rate_6_months: formData.interest_rate_6_months ? parseFloat(formData.interest_rate_6_months) : undefined,
      interest_rate_12_months: formData.interest_rate_12_months ? parseFloat(formData.interest_rate_12_months) : undefined,
      interest_rate_18_months: formData.interest_rate_18_months ? parseFloat(formData.interest_rate_18_months) : undefined,
      interest_rate_24_months: formData.interest_rate_24_months ? parseFloat(formData.interest_rate_24_months) : undefined,
      notes: formData.notes || undefined,
      payment_status: formData.payment_status || 'pending',
      next_payment_date: formData.next_payment_date || undefined,
      total_contract_value: formData.total_contract_value ? parseFloat(formData.total_contract_value) : undefined,
      payments_made: formData.payments_made ? parseInt(formData.payments_made) : 0,
      total_reports_agreed: formData.total_reports_agreed ? parseInt(formData.total_reports_agreed) : undefined,
    };

    await updateDocument(editingDoc.id, metadata);
    
    toast({
      title: "Document Updated",
      description: "Document updated successfully. Review and send confirmation email.",
    });
    
    // Show email preview dialog for updated document
    setPreviewDocumentId(editingDoc.id);
    setPreviewRegenerate(true);
    setEmailPreviewOpen(true);

    setIsEditOpen(false);
    setEditingDoc(null);
    setEditAttorney("");
    setContractStartDate(undefined);
    setContractEndDate(undefined);
    setFormData({
      contract_description: "",
      payment_plan_structure: "",
      payment_due_date: "",
      deposit_amount: "",
      interest_rate_1_3_months: "",
      interest_rate_6_months: "",
      interest_rate_12_months: "",
      interest_rate_18_months: "",
      interest_rate_24_months: "",
      notes: "",
      payment_status: "pending",
      next_payment_date: "",
      total_contract_value: "",
      payments_made: "0",
      total_reports_agreed: "",
    });
  };

  const handleResendEmail = (doc: any) => {
    setPreviewDocumentId(doc.id);
    setPreviewRegenerate(true);
    setEmailPreviewOpen(true);
  };

  const getAttorneyName = (attorneyId: string) => {
    const attorney = attorneys.find(a => a.id === attorneyId);
    return attorney?.name || "Unknown Referring Attorney";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">AOD (Acknowledgement of Debts)</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage agreements for {attorneys.length} referring attorney{attorneys.length !== 1 ? 's' : ''}
              </p>
            </div>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Upload className="h-4 w-4" />
              Upload AOD
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload AOD</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="attorney-select">
                  Select Referring Attorney (Optional - can sync later)
                </Label>
                <Select 
                  value={selectedAttorney} 
                  onValueChange={setSelectedAttorney}
                >
                  <SelectTrigger id="attorney-select">
                    <SelectValue placeholder="Choose a referring attorney" />
                  </SelectTrigger>
                  <SelectContent>
                    {attorneys?.length > 0 ? (
                      attorneys.map((attorney) => (
                        <SelectItem key={attorney.id} value={attorney.id}>
                          {attorney.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-attorneys" disabled>
                        No referring attorneys available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  You can upload the agreement now and sync appointments later
                </p>
              </div>

              <div>
                <Label>Document File</Label>
                <Input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
              </div>

              <div>
                <Label>Contract Description</Label>
                <Textarea
                  value={formData.contract_description}
                  onChange={(e) => setFormData({ ...formData, contract_description: e.target.value })}
                  placeholder="Describe the contract terms and conditions..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Contract Start Date</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={contractStartDate ? format(contractStartDate, "yyyy-MM-dd") : ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          setContractStartDate(new Date(e.target.value));
                        } else {
                          setContractStartDate(undefined);
                        }
                      }}
                      placeholder="YYYY-MM-DD"
                      className="flex-1"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                        >
                          <CalendarIcon className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={contractStartDate}
                          onSelect={setContractStartDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div>
                  <Label>Contract End Date</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={contractEndDate ? format(contractEndDate, "yyyy-MM-dd") : ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          setContractEndDate(new Date(e.target.value));
                        } else {
                          setContractEndDate(undefined);
                        }
                      }}
                      placeholder="YYYY-MM-DD"
                      className="flex-1"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                        >
                          <CalendarIcon className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={contractEndDate}
                          onSelect={setContractEndDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              <div>
                <Label>Payment Plan Structure</Label>
                <Select
                  value={formData.payment_plan_structure}
                  onValueChange={(value) => setFormData({ ...formData, payment_plan_structure: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="6 Months">6 Months</SelectItem>
                    <SelectItem value="12 Months">12 Months</SelectItem>
                    <SelectItem value="18 Months">18 Months</SelectItem>
                    <SelectItem value="24 Months">24 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Payment Due Period</Label>
                <Select
                  value={formData.payment_due_date}
                  onValueChange={(value) => setFormData({ ...formData, payment_due_date: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment due period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30 days">30 Days</SelectItem>
                    <SelectItem value="60 days">60 Days</SelectItem>
                    <SelectItem value="90 days">90 Days</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="6 months">6 Months</SelectItem>
                    <SelectItem value="12 months">12 Months</SelectItem>
                    <SelectItem value="18 months">18 Months</SelectItem>
                    <SelectItem value="24 months">24 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Deposit/Down Payment Amount (R)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.deposit_amount}
                  onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Total Contract Value (R)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.total_contract_value}
                    onChange={(e) => setFormData({ ...formData, total_contract_value: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Remaining Balance (R)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={
                      formData.total_contract_value && formData.deposit_amount
                        ? (parseFloat(formData.total_contract_value) - parseFloat(formData.deposit_amount)).toFixed(2)
                        : formData.total_contract_value || "0.00"
                    }
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payments Made</Label>
                  <Input
                    type="number"
                    value={formData.payments_made}
                    onChange={(e) => setFormData({ ...formData, payments_made: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Total Reports/Assessments Agreed</Label>
                  <Input
                    type="number"
                    value={formData.total_reports_agreed}
                    onChange={(e) => setFormData({ ...formData, total_reports_agreed: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Interest Rate (1-3 months) %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.interest_rate_1_3_months}
                    onChange={(e) => setFormData({ ...formData, interest_rate_1_3_months: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Interest Rate (6 months) %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.interest_rate_6_months}
                    onChange={(e) => setFormData({ ...formData, interest_rate_6_months: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Interest Rate (12 months) %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.interest_rate_12_months}
                    onChange={(e) => setFormData({ ...formData, interest_rate_12_months: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Interest Rate (18 months) %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.interest_rate_18_months}
                    onChange={(e) => setFormData({ ...formData, interest_rate_18_months: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Interest Rate (24 months) %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.interest_rate_24_months}
                    onChange={(e) => setFormData({ ...formData, interest_rate_24_months: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Additional Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Status</Label>
                  <Select
                    value={formData.payment_status}
                    onValueChange={(value) => setFormData({ ...formData, payment_status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="upcoming">Upcoming (within 15 days)</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Next Payment Date</Label>
                  <Input
                    type="date"
                    value={formData.next_payment_date}
                    onChange={(e) => setFormData({ ...formData, next_payment_date: e.target.value })}
                  />
                </div>
              </div>

              <Button onClick={handleUpload} disabled={!selectedFile}>
                Upload Document
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referring Attorney</TableHead>
              <TableHead>File Name</TableHead>
              <TableHead>Contract Period</TableHead>
              <TableHead>Payment Plan</TableHead>
              <TableHead>Contract Value & Payments</TableHead>
              <TableHead>Interest Rates</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">No AOD documents uploaded yet</TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => {
                // Extract referring attorney name from contract description or notes
                const extractAttorneyName = (description: string, notes: string) => {
                  // Try to extract from notes first (APPOINTMENT:id format includes claimant)
                  if (notes && notes.includes('APPOINTMENT:')) {
                    const match = notes.match(/Referring Attorney:\s*([^,\n]+)/);
                    if (match) return match[1].trim();
                  }
                  // Fallback to contract description
                  if (!description) return "Unknown Attorney";
                  const match = description.match(/(?:AOD|Short-Term)\s*-\s*([^(]+)/);
                  return match ? match[1].trim() : "Unknown Attorney";
                };
                
                const totalDebt = (doc.total_contract_value || 0) - (doc.deposit_amount || 0);
                
                return (
                <TableRow key={doc.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {extractAttorneyName(doc.contract_description || "", doc.notes || "")}
                      </div>
                      <div className="text-sm text-destructive font-semibold mt-1">
                        Total Debt: R{totalDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <div>
                        <div>{doc.file_name}</div>
                        {doc.contract_description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {doc.contract_description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {doc.contract_start_date && doc.contract_end_date ? (
                      <div className="text-xs">
                        <div>{format(new Date(doc.contract_start_date), "PP")}</div>
                        <div>to</div>
                        <div>{format(new Date(doc.contract_end_date), "PP")}</div>
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-0.5">
                      {doc.payment_plan_structure ? (
                        <>
                          <div>{doc.payment_plan_structure}</div>
                          {doc.payment_due_date && (
                            <div className="text-xs text-muted-foreground">Due: {doc.payment_due_date}</div>
                          )}
                          {doc.deposit_amount && (
                            <div className="text-xs text-muted-foreground">Deposit: R{doc.deposit_amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
                          )}
                        </>
                      ) : (
                        <div>-</div>
                      )}
                      <div className="text-xs font-medium">0</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-0.5">
                      {doc.total_contract_value ? (
                        <>
                          <div>Total Value: R{doc.total_contract_value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className="text-xs text-muted-foreground">
                            Paid: R{(doc.deposit_amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Payments Made: {doc.payments_made || 0}
                          </div>
                        </>
                      ) : (
                        <div>-</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-0.5">
                      {doc.interest_rate_1_3_months && <div>1-3m: {doc.interest_rate_1_3_months}%</div>}
                      {doc.interest_rate_6_months && <div>6m: {doc.interest_rate_6_months}%</div>}
                      {doc.interest_rate_12_months && <div>12m: {doc.interest_rate_12_months}%</div>}
                      {doc.interest_rate_18_months && <div>18m: {doc.interest_rate_18_months}%</div>}
                      {doc.interest_rate_24_months && <div>24m: {doc.interest_rate_24_months}%</div>}
                      {!doc.interest_rate_1_3_months && !doc.interest_rate_6_months && !doc.interest_rate_12_months && !doc.interest_rate_18_months && !doc.interest_rate_24_months && <div>-</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/aod-payment-tracking/${doc.id}`)}
                      >
                        Track Payments
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResendEmail(doc)}
                        title="Resend AOD Email"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadDocument(doc.document_url, doc.file_name)}
                        disabled={!doc.document_url || doc.document_url === 'pending' || doc.document_url.trim() === ''}
                        title={(!doc.document_url || doc.document_url === 'pending' || doc.document_url.trim() === '') ? "Document not yet generated" : "Download AOD"}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(doc)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteDocument(doc.id, doc.document_url)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit AOD Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Referring Attorney</Label>
              <Select value={editAttorney} onValueChange={setEditAttorney}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a referring attorney" />
                </SelectTrigger>
                <SelectContent>
                  {attorneys && attorneys.length > 0 ? (
                    attorneys.map((attorney) => (
                      <SelectItem key={attorney.id} value={attorney.id}>
                        {attorney.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No referring attorneys available
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Contract Description</Label>
              <Textarea
                value={formData.contract_description}
                onChange={(e) => setFormData({ ...formData, contract_description: e.target.value })}
                placeholder="Describe the contract terms and conditions..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contract Start Date</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={contractStartDate ? format(contractStartDate, "yyyy-MM-dd") : ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        setContractStartDate(new Date(e.target.value));
                      } else {
                        setContractStartDate(undefined);
                      }
                    }}
                    placeholder="YYYY-MM-DD"
                    className="flex-1"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={contractStartDate}
                        onSelect={setContractStartDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <Label>Contract End Date</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={contractEndDate ? format(contractEndDate, "yyyy-MM-dd") : ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        setContractEndDate(new Date(e.target.value));
                      } else {
                        setContractEndDate(undefined);
                      }
                    }}
                    placeholder="YYYY-MM-DD"
                    className="flex-1"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                      >
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={contractEndDate}
                        onSelect={setContractEndDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <div>
              <Label>Payment Plan Structure</Label>
              <Select
                value={formData.payment_plan_structure}
                onValueChange={(value) => setFormData({ ...formData, payment_plan_structure: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Quarterly">Quarterly</SelectItem>
                  <SelectItem value="6 Months">6 Months</SelectItem>
                  <SelectItem value="12 Months">12 Months</SelectItem>
                  <SelectItem value="18 Months">18 Months</SelectItem>
                  <SelectItem value="24 Months">24 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Payment Due Period</Label>
              <Select
                value={formData.payment_due_date}
                onValueChange={(value) => setFormData({ ...formData, payment_due_date: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment due period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30 days">30 Days</SelectItem>
                  <SelectItem value="60 days">60 Days</SelectItem>
                  <SelectItem value="90 days">90 Days</SelectItem>
                  <SelectItem value="Quarterly">Quarterly</SelectItem>
                  <SelectItem value="6 months">6 Months</SelectItem>
                  <SelectItem value="12 months">12 Months</SelectItem>
                  <SelectItem value="18 months">18 Months</SelectItem>
                  <SelectItem value="24 months">24 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Deposit/Down Payment Amount (R)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.deposit_amount}
                onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Total Contract Value (R)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.total_contract_value}
                  onChange={(e) => setFormData({ ...formData, total_contract_value: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Remaining Balance (R)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={
                    formData.total_contract_value && formData.deposit_amount
                      ? (parseFloat(formData.total_contract_value) - parseFloat(formData.deposit_amount)).toFixed(2)
                      : formData.total_contract_value || "0.00"
                  }
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payments Made</Label>
                <Input
                  type="number"
                  value={formData.payments_made}
                  onChange={(e) => setFormData({ ...formData, payments_made: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Total Reports/Assessments Agreed</Label>
                <Input
                  type="number"
                  value={formData.total_reports_agreed}
                  onChange={(e) => setFormData({ ...formData, total_reports_agreed: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Interest Rate (1-3 months) %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.interest_rate_1_3_months}
                  onChange={(e) => setFormData({ ...formData, interest_rate_1_3_months: e.target.value })}
                />
              </div>
              <div>
                <Label>Interest Rate (6 months) %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.interest_rate_6_months}
                  onChange={(e) => setFormData({ ...formData, interest_rate_6_months: e.target.value })}
                />
              </div>
              <div>
                <Label>Interest Rate (12 months) %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.interest_rate_12_months}
                  onChange={(e) => setFormData({ ...formData, interest_rate_12_months: e.target.value })}
                />
              </div>
              <div>
                <Label>Interest Rate (18 months) %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.interest_rate_18_months}
                  onChange={(e) => setFormData({ ...formData, interest_rate_18_months: e.target.value })}
                />
              </div>
              <div>
                <Label>Interest Rate (24 months) %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.interest_rate_24_months}
                  onChange={(e) => setFormData({ ...formData, interest_rate_24_months: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Additional Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Status</Label>
                <Select
                  value={formData.payment_status}
                  onValueChange={(value) => setFormData({ ...formData, payment_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="upcoming">Upcoming (within 15 days)</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Next Payment Date</Label>
                <Input
                  type="date"
                  value={formData.next_payment_date}
                  onChange={(e) => setFormData({ ...formData, next_payment_date: e.target.value })}
                />
              </div>
            </div>

            <Button onClick={handleUpdate}>Update Document</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AODEmailPreviewDialog
        isOpen={emailPreviewOpen}
        onClose={() => setEmailPreviewOpen(false)}
        aodDocumentId={previewDocumentId}
        regenerate={previewRegenerate}
        onConfirmSend={() => {
          // Optionally refresh documents list after email is sent
        }}
      />
    </div>
  );
};
