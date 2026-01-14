import { useState, useEffect } from "react";
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
import { FileText, Upload, Download, Trash2, Edit, Calendar as CalendarIcon, Mail, FileCheck, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAODDocuments } from "@/hooks/useAODDocuments";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AODEmailPreviewDialog } from "./AODEmailPreviewDialog";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";
import { 
  AOD_TEMPLATE_SECTIONS, 
  CREDITOR_INFO, 
  DEFAULT_PAYMENT_STAGES,
  DEFAULT_PAYMENT_SCHEDULE 
} from "./AODTemplateData";

type ReferringAttorney = {
  id: string;
  name: string;
  law_firm: string | null;
};

type AODDocumentManagerProps = {
  attorneys: ReferringAttorney[];
  lawFirmId: string;
  onSyncAttorney?: (attorneyId?: string) => Promise<void>;
  isSyncing?: boolean;
};

export const AODDocumentManager = ({ attorneys, lawFirmId, onSyncAttorney, isSyncing }: AODDocumentManagerProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { triggerSync } = useAppointmentSync();
  const { documents, loading, uploadDocument, downloadDocument, deleteDocument, updateDocument, refetch } = useAODDocuments();
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
  const [paymentTotals, setPaymentTotals] = useState<{ [key: string]: number }>({});
  const [assessmentCounts, setAssessmentCounts] = useState<{ [key: string]: number }>({});
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [pdfGenerationStatus, setPdfGenerationStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');

  // Helper function to generate PDF and auto-download
  const handleGeneratePdf = async (doc: any, isRegenerate = false) => {
    setGeneratingPdfId(doc.id);
    setPdfGenerationStatus('generating');
    
    try {
      toast({ 
        description: isRegenerate ? "Regenerating AOD PDF..." : "Generating AOD PDF...",
        duration: 3000
      });
      
      const { data, error } = await supabase.functions.invoke('generate-aod-pdf', {
        body: { 
          aodDocumentId: doc.id, 
          previewMode: false,
          templateData: {
            sections: AOD_TEMPLATE_SECTIONS,
            creditorInfo: CREDITOR_INFO,
            paymentStages: DEFAULT_PAYMENT_STAGES,
            paymentSchedule: DEFAULT_PAYMENT_SCHEDULE
          }
        }
      });
      
      if (error) throw error;
      
      if (data?.pdfData) {
        // Convert base64 to blob and download as native PDF
        const binaryString = atob(data.pdfData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Generate filename with attorney name and date
        const attorneyName = data.metadata?.attorneyName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Attorney';
        const dateStr = format(new Date(), 'yyyy-MM-dd');
        link.download = `AOD_${attorneyName}_${dateStr}.pdf`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        // Update document status to 'generated' (only if not regenerating)
        const newStatus = isRegenerate ? 'regenerated' : 'generated';
        await supabase
          .from('aod_documents')
          .update({ 
            document_status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', doc.id);
        
        setPdfGenerationStatus('success');
        toast({ 
          description: isRegenerate 
            ? "PDF regenerated and downloaded successfully!" 
            : "PDF generated and downloaded successfully!",
          duration: 3000
        });
        
        // Reset status after a delay
        setTimeout(() => {
          setGeneratingPdfId(null);
          setPdfGenerationStatus('idle');
        }, 2000);
        
        refetch();
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error('No PDF content returned');
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      setPdfGenerationStatus('error');
      toast({ 
        description: `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
      
      setTimeout(() => {
        setGeneratingPdfId(null);
        setPdfGenerationStatus('idle');
      }, 2000);
    }
  };
  
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
    discount_rate: "",
    discount_reason: "",
  });

  // Calculate discounted values
  const calculateDiscountedValue = (originalValue: string, discountRate: string) => {
    const original = parseFloat(originalValue) || 0;
    const rate = parseFloat(discountRate) || 0;
    const discountAmount = (original * rate) / 100;
    return {
      discountAmount,
      finalValue: original - discountAmount,
    };
  };

  // Fetch payment totals and assessment counts for all documents
  useEffect(() => {
    const fetchPaymentTotalsAndCounts = async () => {
      if (documents.length === 0) return;
      
      const totals: { [key: string]: number } = {};
      const counts: { [key: string]: number } = {};
      
      for (const doc of documents) {
        // Fetch payment totals
        const { data: payments } = await supabase
          .from('aod_payments')
          .select('payment_amount')
          .eq('aod_document_id', doc.id);
        
        const totalPaid = (payments || []).reduce((sum, p) => sum + p.payment_amount, 0);
        const initialDeposit = doc.deposit_amount || 0;
        totals[doc.id] = initialDeposit + totalPaid;

        // Fetch assessment counts from appointments table filtered by AOD payment terms
        if (doc.contract_start_date && doc.referring_attorney_id) {
          const startDate = new Date(doc.contract_start_date);
          const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
          const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);

          const { count } = await supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('referring_attorney_id', doc.referring_attorney_id)
            .eq('payment_terms', 'aod')
            .gte('appointment_date', monthStart.toISOString())
            .lte('appointment_date', monthEnd.toISOString())
            .is('deleted_at', null);

          counts[doc.id] = count || 0;
        } else {
          counts[doc.id] = 0;
        }
      }
      
      setPaymentTotals(totals);
      setAssessmentCounts(counts);
    };
    
    fetchPaymentTotalsAndCounts();

    // Subscribe to payment and appointment changes
    const paymentChannel = supabase
      .channel('aod-payment-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'aod_payments'
        },
        () => {
          fetchPaymentTotalsAndCounts();
        }
      )
      .subscribe();

    const appointmentChannel = supabase
      .channel('aod-appointment-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments'
        },
        () => {
          fetchPaymentTotalsAndCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(paymentChannel);
      supabase.removeChannel(appointmentChannel);
    };
  }, [documents]);

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

    // Calculate discount if applied
    const discountRate = formData.discount_rate ? parseFloat(formData.discount_rate) : 0;
    const originalValue = formData.total_contract_value ? parseFloat(formData.total_contract_value) : 0;
    const { discountAmount, finalValue } = calculateDiscountedValue(formData.total_contract_value, formData.discount_rate);

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
      original_contract_value: discountRate > 0 ? originalValue : undefined,
      discount_rate: discountRate > 0 ? discountRate : undefined,
      discount_amount: discountRate > 0 ? discountAmount : undefined,
      discount_reason: formData.discount_reason || undefined,
      total_contract_value: discountRate > 0 ? finalValue : originalValue,
      payments_made: formData.payments_made ? parseInt(formData.payments_made) : 0,
      total_reports_agreed: formData.total_reports_agreed ? parseInt(formData.total_reports_agreed) : undefined,
    };

    const success = await uploadDocument(selectedFile, selectedAttorney, lawFirmId, metadata);
    
    if (success) {
      triggerSync(); // Update all dashboards
      refetch(); // Refresh AOD documents list
      
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
        discount_rate: "",
        discount_reason: "",
      });
    }
  };

  const handleEdit = (doc: any) => {
    setEditingDoc(doc);
    // Use the referring_attorney_id directly from the document
    setEditAttorney(doc.referring_attorney_id || "");
    
    setContractStartDate(doc.contract_start_date ? new Date(doc.contract_start_date) : undefined);
    setContractEndDate(doc.contract_end_date ? new Date(doc.contract_end_date) : undefined);
    // If discount was applied, show original value for editing
    const displayContractValue = doc.original_contract_value && doc.discount_rate 
      ? doc.original_contract_value.toString() 
      : doc.total_contract_value?.toString() || "";
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
      total_contract_value: displayContractValue,
      payments_made: doc.payments_made?.toString() || "0",
      total_reports_agreed: doc.total_reports_agreed?.toString() || "",
      discount_rate: doc.discount_rate?.toString() || "",
      discount_reason: doc.discount_reason || "",
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingDoc) return;

    // Calculate discount if applied
    const discountRate = formData.discount_rate ? parseFloat(formData.discount_rate) : 0;
    const originalValue = formData.total_contract_value ? parseFloat(formData.total_contract_value) : 0;
    const { discountAmount, finalValue } = calculateDiscountedValue(formData.total_contract_value, formData.discount_rate);

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
      original_contract_value: discountRate > 0 ? originalValue : undefined,
      discount_rate: discountRate > 0 ? discountRate : undefined,
      discount_amount: discountRate > 0 ? discountAmount : undefined,
      discount_reason: formData.discount_reason || undefined,
      total_contract_value: discountRate > 0 ? finalValue : originalValue,
      payments_made: formData.payments_made ? parseInt(formData.payments_made) : 0,
      total_reports_agreed: formData.total_reports_agreed ? parseInt(formData.total_reports_agreed) : undefined,
    };

    await updateDocument(editingDoc.id, metadata);
    
    triggerSync(); // Update all dashboards
    refetch(); // Refresh AOD documents list
    
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
      discount_rate: "",
      discount_reason: "",
    });
  };

  const handleResendEmail = (doc: any) => {
    setPreviewDocumentId(doc.id);
    setPreviewRegenerate(true);
    setEmailPreviewOpen(true);
  };

  const handleDeleteDocument = async (docId: string, docUrl: string) => {
    await deleteDocument(docId, docUrl);
    triggerSync(); // Update all dashboards
    refetch(); // Refresh AOD documents list
  };

  const getAttorneyName = (attorneyId: string) => {
    const attorney = attorneys.find(a => a.id === attorneyId);
    return attorney?.name || null;
  };

  // Deduplicate documents: keep only one per attorney per month
  const deduplicatedDocuments = documents.reduce((acc, doc) => {
    const startDate = doc.contract_start_date ? new Date(doc.contract_start_date) : null;
    const monthKey = startDate 
      ? `${doc.referring_attorney_id}_${startDate.getFullYear()}_${startDate.getMonth()}`
      : `${doc.referring_attorney_id}_unknown`;
    
    if (!acc.has(monthKey)) {
      acc.set(monthKey, doc);
    } else {
      // Keep the most recent one
      const existing = acc.get(monthKey);
      if (doc.updated_at > existing.updated_at) {
        acc.set(monthKey, doc);
      }
    }
    
    return acc;
  }, new Map());

  const uniqueDocuments = Array.from(deduplicatedDocuments.values());

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">AOD (Acknowledgement of Debts)</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage agreements for {attorneys.length} referring attorney{attorneys.length !== 1 ? 's' : ''} - Grouped by month
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

              {/* Deposit moved to discount section below */}

              {/* Discount Section */}
              <div className="border rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-4">
                <div className="flex items-center gap-2">
                  <Label className="text-amber-700 dark:text-amber-400 font-semibold">Discount Settings</Label>
                  <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900 border-amber-300">Optional</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Discount Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.discount_rate}
                      onChange={(e) => setFormData({ ...formData, discount_rate: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Discount Amount (R)</Label>
                    <Input
                      type="text"
                      value={
                        formData.discount_rate && formData.total_contract_value
                          ? calculateDiscountedValue(formData.total_contract_value, formData.discount_rate).discountAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })
                          : "0.00"
                      }
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div>
                  <Label>Discount Reason</Label>
                  <Input
                    value={formData.discount_reason}
                    onChange={(e) => setFormData({ ...formData, discount_reason: e.target.value })}
                    placeholder="e.g., Early payment, Bulk booking, Loyalty discount..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Original Contract Value (R)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.total_contract_value}
                    onChange={(e) => setFormData({ ...formData, total_contract_value: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Final Contract Value (R)</Label>
                  <Input
                    type="text"
                    value={
                      formData.discount_rate && formData.total_contract_value
                        ? calculateDiscountedValue(formData.total_contract_value, formData.discount_rate).finalValue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })
                        : formData.total_contract_value 
                          ? parseFloat(formData.total_contract_value).toLocaleString('en-ZA', { minimumFractionDigits: 2 })
                          : "0.00"
                    }
                    disabled
                    className="bg-muted font-semibold text-green-700 dark:text-green-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Deposit/Down Payment (R)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.deposit_amount}
                    onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Remaining Balance (R)</Label>
                  <Input
                    type="text"
                    value={(() => {
                      const finalValue = formData.discount_rate && formData.total_contract_value
                        ? calculateDiscountedValue(formData.total_contract_value, formData.discount_rate).finalValue
                        : parseFloat(formData.total_contract_value) || 0;
                      const deposit = parseFloat(formData.deposit_amount) || 0;
                      return (finalValue - deposit).toLocaleString('en-ZA', { minimumFractionDigits: 2 });
                    })()}
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
              <TableHead>Referring Attorney & Debt</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Assessments</TableHead>
              <TableHead>Contract Value & Payments</TableHead>
              <TableHead>Reports</TableHead>
              <TableHead className="min-w-[180px]">Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : uniqueDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">No AOD documents uploaded yet</TableCell>
              </TableRow>
            ) : (
              uniqueDocuments.map((doc) => {
                // Calculate total debt using all payments including initial deposit
                const totalPaidForDoc = paymentTotals[doc.id] || (doc.deposit_amount || 0);
                const totalDebt = (doc.total_contract_value || 0) - totalPaidForDoc;
                
                // Get attorney name from joined data or fallback to extraction
                const attorneyName = doc.referring_attorneys?.name || 
                  getAttorneyName(doc.referring_attorney_id);
                
                // Skip if attorney is a system company (filtered out from attorneys list)
                if (!attorneyName) {
                  return null;
                }
                
                return (
                <TableRow key={doc.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-foreground">
                          {attorneyName}
                        </div>
                        {onSyncAttorney && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              await onSyncAttorney(doc.referring_attorney_id);
                              // Refresh documents and counts after sync
                              await refetch();
                            }}
                            disabled={isSyncing}
                            title={`Sync appointments for ${attorneyName}`}
                            className="h-6 px-2 text-xs"
                          >
                            <FileCheck className="h-3 w-3 mr-1" />
                            Sync
                          </Button>
                        )}
                      </div>
                      <div className="text-sm text-destructive font-semibold">
                        Total Debt: R{totalDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-0.5">
                      {doc.contract_start_date && doc.contract_end_date ? (
                        <>
                          <div className="font-medium">
                            {format(new Date(doc.contract_start_date), "dd MMM yyyy")}
                          </div>
                          <div className="text-muted-foreground">to</div>
                          <div className="font-medium">
                            {format(new Date(doc.contract_end_date), "dd MMM yyyy")}
                          </div>
                        </>
                      ) : doc.contract_start_date ? (
                        <div className="font-medium">
                          {format(new Date(doc.contract_start_date), "dd MMM yyyy")} - ongoing
                        </div>
                      ) : (
                        <div className="text-muted-foreground">Not specified</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {assessmentCounts[doc.id] || 0} Assessment{(assessmentCounts[doc.id] || 0) !== 1 ? 's' : ''}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-0.5">
                      {doc.total_contract_value ? (
                        <>
                          {doc.discount_rate && doc.discount_rate > 0 ? (
                            <>
                              <div className="line-through text-muted-foreground text-xs">
                                Original: R{(doc.original_contract_value || doc.total_contract_value).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                              </div>
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                                  -{doc.discount_rate}%
                                </Badge>
                              </div>
                              <div className="font-semibold text-green-700 dark:text-green-400">
                                Final: R{doc.total_contract_value.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                              </div>
                            </>
                          ) : (
                            <div>Total Value: R{doc.total_contract_value.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Paid: R{(doc.deposit_amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
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
                    <div className="space-y-2">
                      {/* Generation Status Indicator */}
                      {generatingPdfId === doc.id && (
                        <div className="flex items-center gap-2 mb-2">
                          {pdfGenerationStatus === 'generating' && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 animate-pulse">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Generating...
                            </Badge>
                          )}
                          {pdfGenerationStatus === 'success' && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Downloaded!
                            </Badge>
                          )}
                          {pdfGenerationStatus === 'error' && (
                            <Badge variant="destructive">
                              Failed
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      {(!doc.document_url || doc.document_url === 'pending' || doc.document_url.trim() === '') ? (
                        <div className="flex flex-col gap-2">
                          <span className="text-xs text-muted-foreground">PDF Not Generated</span>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleGeneratePdf(doc, false)}
                            disabled={generatingPdfId === doc.id}
                            title="Generate AOD PDF"
                          >
                            {generatingPdfId === doc.id ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4 mr-1" />
                            )}
                            {generatingPdfId === doc.id ? 'Generating...' : 'Generate PDF'}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {generatingPdfId !== doc.id && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              ✓ PDF Ready
                            </Badge>
                          )}
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 border-blue-200 hover:bg-blue-50"
                              onClick={() => handleGeneratePdf(doc, true)}
                              disabled={generatingPdfId === doc.id}
                              title="Regenerate & Download PDF"
                            >
                              {generatingPdfId === doc.id ? (
                                <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4 text-blue-600" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => downloadDocument(doc.document_url, doc.file_name)}
                              title="Download PDF"
                              className="bg-green-600 hover:bg-green-700 text-white gap-1"
                              disabled={generatingPdfId === doc.id}
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </Button>
                          </div>
                        </div>
                      )}
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
                        onClick={() => handleEdit(doc)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteDocument(doc.id, doc.document_url)}
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
              <Label>Referring Attorney</Label>
              <div className="flex items-center gap-2">
                <Input 
                  value={editingDoc?.referring_attorneys?.name || getAttorneyName(editAttorney) || "Unknown Attorney"}
                  disabled
                  className="bg-muted font-medium"
                />
                <span className="text-xs text-muted-foreground">(Cannot be changed)</span>
              </div>
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

            {/* Deposit moved to discount section below */}

            {/* Discount Section */}
            <div className="border rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-4">
              <div className="flex items-center gap-2">
                <Label className="text-amber-700 dark:text-amber-400 font-semibold">Discount Settings</Label>
                <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900 border-amber-300">Optional</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Discount Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.discount_rate}
                    onChange={(e) => setFormData({ ...formData, discount_rate: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Discount Amount (R)</Label>
                  <Input
                    type="text"
                    value={
                      formData.discount_rate && formData.total_contract_value
                        ? calculateDiscountedValue(formData.total_contract_value, formData.discount_rate).discountAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })
                        : "0.00"
                    }
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
              <div>
                <Label>Discount Reason</Label>
                <Input
                  value={formData.discount_reason}
                  onChange={(e) => setFormData({ ...formData, discount_reason: e.target.value })}
                  placeholder="e.g., Early payment, Bulk booking, Loyalty discount..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Original Contract Value (R)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.total_contract_value}
                  onChange={(e) => setFormData({ ...formData, total_contract_value: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Final Contract Value (R)</Label>
                <Input
                  type="text"
                  value={
                    formData.discount_rate && formData.total_contract_value
                      ? calculateDiscountedValue(formData.total_contract_value, formData.discount_rate).finalValue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })
                      : formData.total_contract_value 
                        ? parseFloat(formData.total_contract_value).toLocaleString('en-ZA', { minimumFractionDigits: 2 })
                        : "0.00"
                  }
                  disabled
                  className="bg-muted font-semibold text-green-700 dark:text-green-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Deposit/Down Payment (R)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.deposit_amount}
                  onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Remaining Balance (R)</Label>
                <Input
                  type="text"
                  value={(() => {
                    const finalValue = formData.discount_rate && formData.total_contract_value
                      ? calculateDiscountedValue(formData.total_contract_value, formData.discount_rate).finalValue
                      : parseFloat(formData.total_contract_value) || 0;
                    const deposit = parseFloat(formData.deposit_amount) || 0;
                    return (finalValue - deposit).toLocaleString('en-ZA', { minimumFractionDigits: 2 });
                  })()}
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
