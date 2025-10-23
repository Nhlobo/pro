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
import { FileText, Upload, Download, Trash2, Edit, Calendar as CalendarIcon } from "lucide-react";
import { useAODDocuments } from "@/hooks/useAODDocuments";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Attorney = {
  id: string;
  name: string;
  law_firm: string | null;
};

type AODDocumentManagerProps = {
  attorneys: Attorney[];
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

    if (!selectedAttorney || selectedAttorney.trim() === "") {
      toast({
        title: "Error",
        description: "Please select an attorney before uploading",
        variant: "destructive",
      });
      return;
    }

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
    setEditAttorney(doc.attorney_id || "");
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

    if (editAttorney && editAttorney.trim() === "") {
      toast({
        title: "Error",
        description: "Please select a valid attorney",
        variant: "destructive",
      });
      return;
    }

    const metadata = {
      attorney_id: editAttorney || undefined,
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
    setIsEditOpen(false);
    setEditingDoc(null);
  };

  const getAttorneyName = (attorneyId: string) => {
    const attorney = attorneys.find(a => a.id === attorneyId);
    return attorney?.name || "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">AOD Documents (Acknowledgement of Debts)</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {attorneys.length} attorney{attorneys.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Upload className="h-4 w-4" />
              Upload AOD Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload AOD Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="attorney-select">
                  Select Attorney <span className="text-destructive">*</span>
                </Label>
                <Select 
                  value={selectedAttorney} 
                  onValueChange={setSelectedAttorney}
                  required
                >
                  <SelectTrigger id="attorney-select">
                    <SelectValue placeholder="Choose an attorney" />
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
                        No attorneys available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {attorneys?.length === 0 && (
                  <p className="text-sm text-destructive mt-1">
                    Please add attorneys first before uploading AOD documents
                  </p>
                )}
                {!selectedAttorney && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Attorney selection is required
                  </p>
                )}
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !contractStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {contractStartDate ? format(contractStartDate, "PPP") : <span>Pick start date</span>}
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

                <div>
                  <Label>Contract End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !contractEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {contractEndDate ? format(contractEndDate, "PPP") : <span>Pick end date</span>}
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

              <Button onClick={handleUpload} disabled={!selectedFile || !selectedAttorney}>
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
              <TableHead>Attorney</TableHead>
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
              documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{getAttorneyName(doc.attorney_id)}</TableCell>
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
                    <div className="text-xs space-y-1">
                      <div>{doc.payment_plan_structure || "-"}</div>
                      {doc.payment_due_date && (
                        <div className="text-muted-foreground">Due: {doc.payment_due_date}</div>
                      )}
                      {doc.deposit_amount && (
                        <div className="text-muted-foreground">Deposit: R{doc.deposit_amount}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-1">
                      {doc.total_contract_value ? (
                        <>
                          <div className="font-semibold">Total: R{doc.total_contract_value.toLocaleString()}</div>
                          <div className="text-primary">
                            Balance: R{((doc.total_contract_value || 0) - (doc.deposit_amount || 0)).toLocaleString()}
                          </div>
                        </>
                      ) : (
                        <div className="text-muted-foreground">-</div>
                      )}
                      <div className="text-muted-foreground">
                        Payments: {doc.payments_made || 0}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-1">
                      {doc.interest_rate_1_3_months && <div>1-3m: {doc.interest_rate_1_3_months}%</div>}
                      {doc.interest_rate_6_months && <div>6m: {doc.interest_rate_6_months}%</div>}
                      {doc.interest_rate_12_months && <div>12m: {doc.interest_rate_12_months}%</div>}
                      {doc.interest_rate_18_months && <div>18m: {doc.interest_rate_18_months}%</div>}
                      {doc.interest_rate_24_months && <div>24m: {doc.interest_rate_24_months}%</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/aod-payment-tracking/${doc.id}`)}
                      >
                        Track Payments
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadDocument(doc.document_url, doc.file_name)}
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
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit AOD Document Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Attorney</Label>
              <Select value={editAttorney} onValueChange={setEditAttorney}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an attorney" />
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
                      No attorneys available
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !contractStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {contractStartDate ? format(contractStartDate, "PPP") : <span>Pick start date</span>}
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

              <div>
                <Label>Contract End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !contractEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {contractEndDate ? format(contractEndDate, "PPP") : <span>Pick end date</span>}
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
    </div>
  );
};
