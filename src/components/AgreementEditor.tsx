import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  FileText,
  Save,
  Send,
  Download,
  Edit2,
  CheckCircle,
  AlertTriangle,
  Calendar as CalendarIcon,
  Upload,
  Users,
  Loader2,
  Eye,
  FileSignature,
  Building2
} from "lucide-react";
import { format, addMonths, differenceInMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
  AOD_TEMPLATE_SECTIONS, 
  CREDITOR_INFO, 
  DEFAULT_PAYMENT_STAGES,
  DEFAULT_PAYMENT_SCHEDULE 
} from "./AODTemplateData";
import { supabase } from "@/integrations/supabase/client";

import { RandSign } from "@/components/icons/RandSign";
// Duration options
const SHORT_TERM_DURATIONS = [
  { value: "30days", label: "30 Days", months: 1 },
  { value: "60days", label: "60 Days", months: 2 },
  { value: "90days", label: "90 Days", months: 3 },
  { value: "120days", label: "120 Days", months: 4 },
  { value: "6months", label: "6 Months", months: 6 },
  { value: "7months", label: "7 Months", months: 7 },
  { value: "8months", label: "8 Months", months: 8 },
  { value: "9months", label: "9 Months", months: 9 },
  { value: "10months", label: "10 Months", months: 10 },
  { value: "11months", label: "11 Months", months: 11 },
];

const LONG_TERM_DURATIONS = [
  { value: "12months", label: "12 Months", months: 12 },
  { value: "18months", label: "18 Months", months: 18 },
  { value: "24months", label: "24 Months", months: 24 },
];

interface AgreementEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agreementId?: string;
  agreementType: "aod" | "short_term";
  attorneyId?: string;
  attorneyData?: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    contact_person?: string;
  };
  onSave?: (data: any) => void;
}

export const AgreementEditor = ({
  open,
  onOpenChange,
  agreementId,
  agreementType,
  attorneyId,
  attorneyData,
  onSave,
}: AgreementEditorProps) => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [pdfPreview, setPdfPreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    // Agreement type & duration
    agreementType: agreementType,
    durationTerm: "",
    
    // Creditor (auto-filled)
    creditorName: "Kutlwano & Associates (Pty) Ltd",
    creditorReg: "2016/461385/07",
    creditorRep: "Mr Moleka Boshomane",
    
    // Debtor
    debtorName: attorneyData?.name || "",
    debtorLawFirm: "",
    debtorReg: "",
    debtorRep: attorneyData?.contact_person || "",
    debtorAddress: attorneyData?.address || "",
    debtorEmail: attorneyData?.email || "",
    debtorPhone: attorneyData?.phone || "",
    
    // Case & service data
    matterTypes: [] as string[],
    totalReports: 0,
    expertTypes: [] as string[],
    rollOutPlanRef: "",
    
    // Financial data
    totalAmount: 0,
    totalAmountWords: "",
    depositAmount: 0,
    depositDate: new Date(),
    outstandingBalance: 0,
    paymentFrequency: agreementType === "aod" ? "quarterly" : "monthly",
    interestRate: 0,
    gracePeriodDays: 7,
    
    // Contract dates
    startDate: new Date(),
    endDate: addMonths(new Date(), 12),
    
    // Special conditions
    specialConditions: "",
    notes: "",
    
    // Status
    documentStatus: "draft",
    
    // Signatures
    creditorSigned: false,
    debtorSigned: false,
    witness1Name: "",
    witness1Signed: false,
    witness2Name: "",
    witness2Signed: false,
  });

  // Number to words converter
  const numberToWords = (num: number): string => {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 
                  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    
    if (num === 0) return 'zero';
    if (num < 0) return 'negative ' + numberToWords(-num);
    
    let words = '';
    
    if (Math.floor(num / 1000000) > 0) {
      words += numberToWords(Math.floor(num / 1000000)) + ' million ';
      num %= 1000000;
    }
    if (Math.floor(num / 1000) > 0) {
      words += numberToWords(Math.floor(num / 1000)) + ' thousand ';
      num %= 1000;
    }
    if (Math.floor(num / 100) > 0) {
      words += numberToWords(Math.floor(num / 100)) + ' hundred ';
      num %= 100;
    }
    if (num > 0) {
      if (words !== '') words += 'and ';
      if (num < 20) {
        words += ones[num];
      } else {
        words += tens[Math.floor(num / 10)];
        if (num % 10 > 0) words += '-' + ones[num % 10];
      }
    }
    
    return words.trim() + ' rand';
  };

  // Calculate outstanding balance when deposit changes
  useEffect(() => {
    const outstanding = formData.totalAmount - formData.depositAmount;
    setFormData(prev => ({
      ...prev,
      outstandingBalance: outstanding > 0 ? outstanding : 0,
      totalAmountWords: numberToWords(prev.totalAmount),
    }));
  }, [formData.totalAmount, formData.depositAmount]);

  // Update end date when duration changes
  useEffect(() => {
    if (formData.durationTerm) {
      const allDurations = [...SHORT_TERM_DURATIONS, ...LONG_TERM_DURATIONS];
      const duration = allDurations.find(d => d.value === formData.durationTerm);
      if (duration) {
        setFormData(prev => ({
          ...prev,
          endDate: addMonths(prev.startDate, duration.months),
          paymentFrequency: duration.months >= 12 ? "quarterly" : "monthly",
        }));
      }
    }
  }, [formData.durationTerm, formData.startDate]);

  // Load existing agreement data
  useEffect(() => {
    if (agreementId && open) {
      loadAgreement();
    }
  }, [agreementId, open]);

  const loadAgreement = async () => {
    if (!agreementId) return;
    
    try {
      setLoading(true);
      const table = agreementType === "aod" ? "aod_documents" : "short_term_agreements";
      
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("id", agreementId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setFormData(prev => ({
          ...prev,
          debtorLawFirm: data.debtor_law_firm_name || "",
          debtorReg: data.debtor_registration_number || "",
          debtorRep: data.debtor_authorized_rep || "",
          debtorAddress: data.debtor_domicilium_address || "",
          matterTypes: data.matter_types || [],
          totalReports: data.total_reports_agreed || 0,
          rollOutPlanRef: data.roll_out_plan_reference || "",
          totalAmount: data.total_contract_value || 0,
          totalAmountWords: data.total_amount_words || "",
          depositAmount: data.deposit_amount || 0,
          outstandingBalance: (data.total_contract_value || 0) - (data.deposit_amount || 0),
          paymentFrequency: data.payment_frequency || (agreementType === "aod" ? "quarterly" : "monthly"),
          gracePeriodDays: data.grace_period_days || 7,
          startDate: data.contract_start_date ? new Date(data.contract_start_date) : new Date(),
          endDate: data.contract_end_date ? new Date(data.contract_end_date) : addMonths(new Date(), 12),
          notes: data.notes || "",
          documentStatus: data.document_status || "draft",
          creditorSigned: !!data.creditor_signature_date,
          debtorSigned: !!data.debtor_signature_date,
          witness1Name: data.witness1_name || "",
          witness1Signed: !!data.witness1_signature_date,
          witness2Name: data.witness2_name || "",
          witness2Signed: !!data.witness2_signature_date,
        }));
      }
    } catch (error: any) {
      console.error("Error loading agreement:", error);
      toast.error("Failed to load agreement");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (status: "draft" | "sent" | "signed" | "active") => {
    try {
      setLoading(true);
      
      const agreementData = {
        debtor_law_firm_name: formData.debtorLawFirm,
        debtor_registration_number: formData.debtorReg,
        debtor_authorized_rep: formData.debtorRep,
        debtor_domicilium_address: formData.debtorAddress,
        matter_types: formData.matterTypes,
        total_reports_agreed: formData.totalReports,
        roll_out_plan_reference: formData.rollOutPlanRef,
        total_contract_value: formData.totalAmount,
        total_amount_words: formData.totalAmountWords,
        deposit_amount: formData.depositAmount,
        payment_frequency: formData.paymentFrequency,
        grace_period_days: formData.gracePeriodDays,
        contract_start_date: format(formData.startDate, "yyyy-MM-dd"),
        contract_end_date: format(formData.endDate, "yyyy-MM-dd"),
        notes: formData.notes,
        document_status: status,
        witness1_name: formData.witness1Name,
        witness2_name: formData.witness2Name,
        creditor_signature_date: formData.creditorSigned ? new Date().toISOString() : null,
        debtor_signature_date: formData.debtorSigned ? new Date().toISOString() : null,
        witness1_signature_date: formData.witness1Signed ? new Date().toISOString() : null,
        witness2_signature_date: formData.witness2Signed ? new Date().toISOString() : null,
      };
      
      const table = agreementType === "aod" ? "aod_documents" : "short_term_agreements";
      
      if (agreementId) {
        const { error } = await supabase
          .from(table)
          .update(agreementData)
          .eq("id", agreementId);
        
        if (error) throw error;
      }
      
      toast.success(`Agreement ${status === "draft" ? "saved as draft" : status === "sent" ? "sent" : "saved"}`);
      onSave?.(agreementData);
      
      if (status !== "draft") {
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Error saving agreement:", error);
      toast.error("Failed to save agreement");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdf = async () => {
    try {
      setGenerating(true);
      
      const functionName = agreementType === "aod" 
        ? "generate-aod-pdf" 
        : "generate-short-term-agreement-pdf";
      
      // Build request body with template data for AOD
      const requestBody = agreementType === "aod" 
        ? { 
            aodDocumentId: agreementId,
            templateData: {
              sections: AOD_TEMPLATE_SECTIONS,
              creditorInfo: CREDITOR_INFO,
              paymentStages: DEFAULT_PAYMENT_STAGES,
              paymentSchedule: DEFAULT_PAYMENT_SCHEDULE
            }
          }
        : { agreementId };
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: requestBody
      });
      
      if (error) throw error;
      
      if (data?.pdfData) {
        // Auto-download the native PDF
        const binaryString = atob(data.pdfData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${agreementType === "aod" ? "AOD" : "Agreement"}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        // Update status to generated
        const table = agreementType === "aod" ? "aod_documents" : "short_term_agreements";
        await supabase
          .from(table)
          .update({ 
            document_status: 'generated',
            updated_at: new Date().toISOString()
          })
          .eq('id', agreementId);
        
        setActiveTab("preview");
        toast.success("PDF generated and downloaded");
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error('No PDF content returned');
      }
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast.error(`Failed to generate PDF: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    try {
      setSending(true);
      
      const functionName = agreementType === "aod" 
        ? "send-aod-email" 
        : "send-short-term-agreement-email";
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { 
          [agreementType === "aod" ? "aodDocumentId" : "agreementId"]: agreementId 
        }
      });
      
      if (error) throw error;
      
      await handleSave("sent");
      toast.success("Agreement sent successfully");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error("Failed to send agreement");
    } finally {
      setSending(false);
    }
  };

  const getDurationOptions = () => {
    return agreementType === "aod" ? LONG_TERM_DURATIONS : SHORT_TERM_DURATIONS;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      sent: "default",
      signed: "default",
      active: "default",
    };
    
    const colors: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      sent: "bg-blue-100 text-blue-800",
      signed: "bg-green-100 text-green-800",
      active: "bg-emerald-100 text-emerald-800",
    };
    
    return (
      <Badge className={colors[status] || ""} variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {agreementType === "aod" ? "Long-Term AOD Agreement" : "Short-Term Agreement"} Editor
            {formData.documentStatus && getStatusBadge(formData.documentStatus)}
          </DialogTitle>
          <DialogDescription>
            Edit agreement details, preview, and send to referring attorney
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="signatures">Signatures</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4 h-[50vh]">
            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 pr-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Creditor Information (Auto-filled)
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Company Name</Label>
                    <p className="font-medium">{formData.creditorName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Registration</Label>
                    <p className="font-medium">{formData.creditorReg}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Managing Director</Label>
                    <p className="font-medium">{formData.creditorRep}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Debtor Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="debtorName">Referring Attorney Name</Label>
                    <Input 
                      id="debtorName"
                      value={formData.debtorName}
                      onChange={(e) => setFormData(prev => ({ ...prev, debtorName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="debtorLawFirm">Law Firm Name</Label>
                    <Input 
                      id="debtorLawFirm"
                      value={formData.debtorLawFirm}
                      onChange={(e) => setFormData(prev => ({ ...prev, debtorLawFirm: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="debtorReg">Registration Number</Label>
                    <Input 
                      id="debtorReg"
                      value={formData.debtorReg}
                      onChange={(e) => setFormData(prev => ({ ...prev, debtorReg: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="debtorRep">Authorized Representative</Label>
                    <Input 
                      id="debtorRep"
                      value={formData.debtorRep}
                      onChange={(e) => setFormData(prev => ({ ...prev, debtorRep: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="debtorAddress">Domicilium Address</Label>
                    <Textarea 
                      id="debtorAddress"
                      value={formData.debtorAddress}
                      onChange={(e) => setFormData(prev => ({ ...prev, debtorAddress: e.target.value }))}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Case & Service Data</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Agreement Duration</Label>
                    <Select 
                      value={formData.durationTerm} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, durationTerm: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        {getDurationOptions().map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="totalReports">Number of Assessments</Label>
                    <Input 
                      id="totalReports"
                      type="number"
                      value={formData.totalReports}
                      onChange={(e) => setFormData(prev => ({ ...prev, totalReports: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(formData.startDate, "PPP")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.startDate}
                          onSelect={(date) => date && setFormData(prev => ({ ...prev, startDate: date }))}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(formData.endDate, "PPP")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.endDate}
                          onSelect={(date) => date && setFormData(prev => ({ ...prev, endDate: date }))}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="rollOutPlanRef">Roll-out Plan Reference (Annexure A)</Label>
                    <Input 
                      id="rollOutPlanRef"
                      placeholder="e.g., ANX-A-2025-001"
                      value={formData.rollOutPlanRef}
                      onChange={(e) => setFormData(prev => ({ ...prev, rollOutPlanRef: e.target.value }))}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Financial Tab */}
            <TabsContent value="financial" className="space-y-4 pr-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <RandSign className="h-4 w-4" />
                    Financial Terms
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="totalAmount">Total Amount (R)</Label>
                    <Input 
                      id="totalAmount"
                      type="number"
                      value={formData.totalAmount}
                      onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label>Amount in Words</Label>
                    <p className="text-sm p-2 bg-muted rounded-md capitalize">{formData.totalAmountWords}</p>
                  </div>
                  <div>
                    <Label htmlFor="depositAmount">Deposit Amount (R)</Label>
                    <Input 
                      id="depositAmount"
                      type="number"
                      value={formData.depositAmount}
                      onChange={(e) => setFormData(prev => ({ ...prev, depositAmount: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label>Outstanding Balance (R)</Label>
                    <p className="text-lg font-bold p-2 bg-amber-50 rounded-md text-amber-800">
                      R {formData.outstandingBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <Label>Payment Frequency</Label>
                    <Select 
                      value={formData.paymentFrequency} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, paymentFrequency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="fixed">Fixed Term</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="gracePeriodDays">Grace Period (Days)</Label>
                    <Input 
                      id="gracePeriodDays"
                      type="number"
                      value={formData.gracePeriodDays}
                      onChange={(e) => setFormData(prev => ({ ...prev, gracePeriodDays: parseInt(e.target.value) || 7 }))}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Special Conditions & Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea 
                    placeholder="Add any special conditions or notes..."
                    className="min-h-[100px]"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Signatures Tab */}
            <TabsContent value="signatures" className="space-y-4 pr-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileSignature className="h-4 w-4" />
                    Signature Status
                  </CardTitle>
                  <CardDescription>
                    Track signatures for both parties and witnesses
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Label>Creditor Signature</Label>
                        <Switch 
                          checked={formData.creditorSigned}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, creditorSigned: checked }))}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">{formData.creditorName}</p>
                      {formData.creditorSigned && (
                        <Badge className="mt-2 bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Signed
                        </Badge>
                      )}
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Label>Debtor Signature</Label>
                        <Switch 
                          checked={formData.debtorSigned}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, debtorSigned: checked }))}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">{formData.debtorName || "Referring Attorney"}</p>
                      {formData.debtorSigned && (
                        <Badge className="mt-2 bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Signed
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <Label htmlFor="witness1Name">Witness 1</Label>
                      <Input 
                        id="witness1Name"
                        placeholder="Witness name"
                        className="mt-2"
                        value={formData.witness1Name}
                        onChange={(e) => setFormData(prev => ({ ...prev, witness1Name: e.target.value }))}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-muted-foreground">Signed</span>
                        <Switch 
                          checked={formData.witness1Signed}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, witness1Signed: checked }))}
                        />
                      </div>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <Label htmlFor="witness2Name">Witness 2</Label>
                      <Input 
                        id="witness2Name"
                        placeholder="Witness name"
                        className="mt-2"
                        value={formData.witness2Name}
                        onChange={(e) => setFormData(prev => ({ ...prev, witness2Name: e.target.value }))}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-muted-foreground">Signed</span>
                        <Switch 
                          checked={formData.witness2Signed}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, witness2Signed: checked }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <Label className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Upload Signed Copy
                    </Label>
                    <Input 
                      type="file"
                      accept=".pdf,.jpg,.png"
                      className="mt-2"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          toast.info("Signed document upload will be processed");
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="pr-4">
              {pdfPreview ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Document Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="border rounded-lg p-4 bg-white max-h-[400px] overflow-auto"
                      dangerouslySetInnerHTML={{ __html: pdfPreview }}
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">No preview available</p>
                    <Button onClick={handleGeneratePdf} disabled={generating || !agreementId}>
                      {generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Generate Preview
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => handleSave("draft")} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button variant="outline" onClick={handleGeneratePdf} disabled={generating || !agreementId}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Download PDF
          </Button>
          <Button onClick={handleSendEmail} disabled={sending || !agreementId}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send Agreement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
