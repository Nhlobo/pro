import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  FileText, 
  Save, 
  Download, 
  Mail, 
  Edit, 
  Eye,
  Building,
  DollarSign,
  Calendar,
  Users,
  FileCheck,
  Pencil
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AOD_TEMPLATE_SECTIONS,
  CREDITOR_INFO,
  DEFAULT_PAYMENT_STAGES,
  AODDebtorInfo,
  AODFinancialTerms,
  AODServiceScope,
  populateTemplate,
  numberToWords,
  AODClause,
} from "./AODTemplateData";

interface AODTemplateGeneratorProps {
  aodDocumentId?: string;
  attorneyId?: string;
  onSave?: (documentId: string) => void;
  onClose?: () => void;
}

export const AODTemplateGenerator = ({
  aodDocumentId,
  attorneyId,
  onSave,
  onClose,
}: AODTemplateGeneratorProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("debtor");
  const [editMode, setEditMode] = useState(true);
  const [editedClauses, setEditedClauses] = useState<Record<string, string>>({});

  // Agreement Type
  const [agreementType, setAgreementType] = useState<"long-term" | "short-term">("long-term");
  const [agreementDuration, setAgreementDuration] = useState(12);
  const [paymentFrequency, setPaymentFrequency] = useState<"monthly" | "quarterly" | "bi-annual">("quarterly");

  // Debtor Info
  const [debtor, setDebtor] = useState<AODDebtorInfo>({
    lawFirmName: "",
    registrationNumber: "",
    authorizedRepName: "",
    authorizedRepCapacity: "Director",
    domiciliumAddress: "",
  });

  // Financial Terms
  const [financial, setFinancial] = useState<AODFinancialTerms>({
    totalAmount: 0,
    totalAmountWords: "",
    depositAmount: 0,
    depositAmountWords: "",
    depositDate: new Date().toISOString().split("T")[0],
    outstandingBalance: 0,
    outstandingBalanceWords: "",
    numberOfQuarters: 4,
    quarterlyPayment: 0,
    quarterlyPaymentWords: "",
    firstPaymentDate: "",
    lastPaymentDate: "",
    interestRate: 7.25,
  });

  // Service Scope
  const [scope, setScope] = useState<AODServiceScope>({
    matterTypes: ["Road Accident Fund (RAF)"],
    numberOfAssessments: 10,
    expertTypes: [],
  });

  // Load existing AOD data
  useEffect(() => {
    if (aodDocumentId) {
      loadAODDocument();
    } else if (attorneyId) {
      loadAttorneyInfo();
    }
  }, [aodDocumentId, attorneyId]);

  // Auto-calculate financial values based on payment frequency
  useEffect(() => {
    const outstanding = financial.totalAmount - financial.depositAmount;
    
    // Calculate number of payments based on frequency
    let numberOfPayments = 1;
    let monthsPerPayment = 1;
    
    switch (paymentFrequency) {
      case "monthly":
        numberOfPayments = agreementDuration;
        monthsPerPayment = 1;
        break;
      case "quarterly":
        numberOfPayments = Math.ceil(agreementDuration / 3);
        monthsPerPayment = 3;
        break;
      case "bi-annual":
        numberOfPayments = Math.ceil(agreementDuration / 6);
        monthsPerPayment = 6;
        break;
    }
    
    const paymentAmount = numberOfPayments > 0 ? outstanding / numberOfPayments : 0;

    const firstDate = new Date();
    firstDate.setMonth(firstDate.getMonth() + monthsPerPayment);
    const lastDate = new Date(firstDate);
    lastDate.setMonth(lastDate.getMonth() + (numberOfPayments - 1) * monthsPerPayment);

    setFinancial((prev) => ({
      ...prev,
      outstandingBalance: outstanding,
      outstandingBalanceWords: numberToWords(outstanding),
      totalAmountWords: numberToWords(prev.totalAmount),
      depositAmountWords: numberToWords(prev.depositAmount),
      numberOfQuarters: numberOfPayments,
      quarterlyPayment: paymentAmount,
      quarterlyPaymentWords: numberToWords(paymentAmount),
      firstPaymentDate: firstDate.toLocaleDateString("en-ZA"),
      lastPaymentDate: lastDate.toLocaleDateString("en-ZA"),
    }));
  }, [financial.totalAmount, financial.depositAmount, agreementDuration, paymentFrequency]);

  const loadAODDocument = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("aod_documents")
        .select(`*, referring_attorneys(*)`)
        .eq("id", aodDocumentId)
        .single();

      if (error) throw error;

      if (data) {
        // Populate form with existing data
        const attorney = data.referring_attorneys;
        setDebtor({
          lawFirmName: data.debtor_law_firm_name || attorney?.name || "",
          registrationNumber: data.debtor_registration_number || "",
          authorizedRepName: data.debtor_authorized_rep || attorney?.contact_person || "",
          authorizedRepCapacity: "Director",
          domiciliumAddress: data.debtor_domicilium_address || attorney?.address || "",
        });

        setFinancial((prev) => ({
          ...prev,
          totalAmount: data.total_contract_value || 0,
          depositAmount: data.deposit_amount || 0,
          interestRate: data.interest_rate_12_months || 7.25,
        }));

        setScope({
          matterTypes: data.matter_types || ["Road Accident Fund (RAF)"],
          numberOfAssessments: data.total_reports_agreed || 10,
          expertTypes: [],
        });

        // Determine agreement type from duration
        const durationTerm = data.agreement_duration_term;
        if (durationTerm) {
          const months = parseInt(durationTerm);
          setAgreementDuration(months);
          setAgreementType(months >= 12 ? "long-term" : "short-term");
        }
      }
    } catch (error) {
      console.error("Error loading AOD:", error);
      toast({
        title: "Error",
        description: "Failed to load agreement data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAttorneyInfo = async () => {
    try {
      const { data, error } = await supabase
        .from("referring_attorneys")
        .select("*")
        .eq("id", attorneyId)
        .single();

      if (error) throw error;

      if (data) {
        setDebtor({
          lawFirmName: data.name || "",
          registrationNumber: "",
          authorizedRepName: data.contact_person || "",
          authorizedRepCapacity: data.attorney_role || "Director",
          domiciliumAddress: data.address || "",
        });
      }
    } catch (error) {
      console.error("Error loading attorney:", error);
    }
  };

  const handleClauseEdit = (clauseId: string, newContent: string) => {
    setEditedClauses((prev) => ({
      ...prev,
      [clauseId]: newContent,
    }));
  };

  const getClauseContent = (clause: AODClause): string => {
    if (editedClauses[clause.id]) {
      return editedClauses[clause.id];
    }
    return populateTemplate(clause.content, debtor, financial, scope, agreementDuration);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const documentData = {
        debtor_law_firm_name: debtor.lawFirmName,
        debtor_registration_number: debtor.registrationNumber,
        debtor_authorized_rep: debtor.authorizedRepName,
        debtor_domicilium_address: debtor.domiciliumAddress,
        total_contract_value: financial.totalAmount,
        deposit_amount: financial.depositAmount,
        total_amount_words: financial.totalAmountWords,
        matter_types: scope.matterTypes,
        total_reports_agreed: scope.numberOfAssessments,
        agreement_duration_term: `${agreementDuration} months`,
        agreement_type: agreementType,
        payment_frequency: paymentFrequency,
        interest_rate_12_months: financial.interestRate,
        document_status: "draft",
        updated_at: new Date().toISOString(),
      };

      if (aodDocumentId) {
        const { error } = await supabase
          .from("aod_documents")
          .update(documentData)
          .eq("id", aodDocumentId);

        if (error) throw error;

        toast({
          title: "Agreement Updated",
          description: "The AOD agreement has been saved successfully.",
        });
        onSave?.(aodDocumentId);
      } else if (attorneyId) {
        const { data, error } = await supabase
          .from("aod_documents")
          .insert({
            ...documentData,
            referring_attorney_id: attorneyId,
            uploaded_by: user.id,
            file_name: `AOD Agreement - ${debtor.lawFirmName}`,
            document_url: "pending",
          })
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Agreement Created",
          description: "New AOD agreement has been created.",
        });
        onSave?.(data.id);
      }
    } catch (error: any) {
      console.error("Error saving:", error);
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const generatePreviewHTML = (): string => {
    let html = `
      <div style="font-family: 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a365d; margin-bottom: 5px;">KUTLWANO & ASSOCIATES MEDICO LEGAL</h1>
          <h2 style="color: #2d3748;">ACKNOWLEDGEMENT OF DEBT</h2>
        </div>
        
        <div style="margin-bottom: 20px;">
          <p>The parties to this Acknowledgement of Debt are listed below as follows:</p>
        </div>
        
        <div style="background: #f7fafc; padding: 15px; border-left: 4px solid #3182ce; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0;">CREDITOR</h3>
          <p style="margin: 5px 0;"><strong>${CREDITOR_INFO.companyName}</strong></p>
          <p style="margin: 5px 0;">Registration Number: ${CREDITOR_INFO.registrationNumber}</p>
        </div>
        
        <div style="background: #f7fafc; padding: 15px; border-left: 4px solid #48bb78; margin-bottom: 30px;">
          <h3 style="margin: 0 0 10px 0;">DEBTOR</h3>
          <p style="margin: 5px 0;"><strong>${debtor.lawFirmName}</strong></p>
          <p style="margin: 5px 0;">Registration Number: ${debtor.registrationNumber || "_______________"}</p>
          <p style="margin: 5px 0;">Represented by: ${debtor.authorizedRepName || "_______________"} (${debtor.authorizedRepCapacity})</p>
        </div>
    `;

    // Add all sections
    AOD_TEMPLATE_SECTIONS.forEach((section) => {
      html += `<h3 style="color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 30px;">${section.name.toUpperCase()}</h3>`;
      section.clauses.forEach((clause) => {
        const content = getClauseContent(clause);
        html += `<p style="margin: 15px 0; text-align: justify;">${content.replace(/\n/g, "<br>")}</p>`;
      });
    });

    // Add Bank Details
    html += `
      <div style="background: #edf2f7; padding: 20px; margin: 30px 0; border-radius: 8px;">
        <h4 style="margin: 0 0 15px 0;">BANKING DETAILS</h4>
        <table style="width: 100%;">
          <tr><td style="width: 150px;"><strong>Bank:</strong></td><td>${CREDITOR_INFO.bankName}</td></tr>
          <tr><td><strong>Account Name:</strong></td><td>${CREDITOR_INFO.accountName}</td></tr>
          <tr><td><strong>Account Number:</strong></td><td>${CREDITOR_INFO.accountNumber}</td></tr>
          <tr><td><strong>Branch:</strong></td><td>${CREDITOR_INFO.branchName}</td></tr>
          <tr><td><strong>Branch Code:</strong></td><td>${CREDITOR_INFO.branchCode}</td></tr>
        </table>
      </div>
    `;

    // Add Signature Blocks
    html += `
      <div style="margin-top: 50px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 50px;">
          <div style="width: 45%;">
            <p>SIGNED AT _______________ ON THIS ___ DAY OF _______</p>
            <h4>CREDITOR</h4>
            <p>Duly authorised representative: ${CREDITOR_INFO.managingDirector}</p>
            <p style="margin-top: 30px; border-top: 1px solid #000; padding-top: 5px;">Signature</p>
          </div>
          <div style="width: 45%;">
            <p>SIGNED AT _______________ ON THIS ___ DAY OF _______</p>
            <h4>DEBTOR</h4>
            <p>Duly authorised representative: ${debtor.authorizedRepName || "_______________"}</p>
            <p style="margin-top: 30px; border-top: 1px solid #000; padding-top: 5px;">Signature</p>
          </div>
        </div>
        
        <h4>WITNESSES</h4>
        <div style="display: flex; justify-content: space-between;">
          <div style="width: 45%;">
            <p>Full Name: _______________</p>
            <p>ID Number: _______________</p>
            <p style="border-top: 1px solid #000; padding-top: 5px; margin-top: 30px;">Signature</p>
          </div>
          <div style="width: 45%;">
            <p>Full Name: _______________</p>
            <p>ID Number: _______________</p>
            <p style="border-top: 1px solid #000; padding-top: 5px; margin-top: 30px;">Signature</p>
          </div>
        </div>
      </div>
      
      <div style="page-break-before: always; margin-top: 50px;">
        <h2 style="text-align: center; color: #2d3748;">ANNEXURE A – PAYMENT & REPORT RELEASE SCHEDULE</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background: #3182ce; color: white;">
              <th style="padding: 10px; border: 1px solid #e2e8f0;">Stage</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0;">Description</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0;">Payment</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0;">Outcome</th>
            </tr>
          </thead>
          <tbody>
            ${DEFAULT_PAYMENT_STAGES.map(stage => `
              <tr>
                <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">${stage.stage}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${stage.description}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${stage.percentagePayable}</td>
                <td style="padding: 10px; border: 1px solid #e2e8f0;">${stage.actionOutcome}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      </div>
    `;

    return html;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">AOD Agreement Generator</h2>
            <p className="text-sm text-muted-foreground">
              Create and edit Acknowledgement of Debt agreements
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={editMode}
              onCheckedChange={setEditMode}
              id="edit-mode"
            />
            <Label htmlFor="edit-mode" className="flex items-center gap-1">
              {editMode ? <Edit className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {editMode ? "Edit Mode" : "Preview Mode"}
            </Label>
          </div>
        </div>
      </div>

      {/* Agreement Type Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Agreement Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div
              onClick={() => setAgreementType("long-term")}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                agreementType === "long-term"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Long-Term AOD</span>
                <Badge variant={agreementType === "long-term" ? "default" : "outline"}>
                  12-24 months
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Quarterly payments with full legal terms
              </p>
            </div>
            <div
              onClick={() => setAgreementType("short-term")}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                agreementType === "short-term"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Short-Term Agreement</span>
                <Badge variant={agreementType === "short-term" ? "default" : "outline"}>
                  1-11 months
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Monthly payments with simplified terms
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <Label>Duration</Label>
              <Select
                value={agreementDuration.toString()}
                onValueChange={(v) => setAgreementDuration(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agreementType === "long-term" ? (
                    <>
                      <SelectItem value="12">12 Months</SelectItem>
                      <SelectItem value="18">18 Months</SelectItem>
                      <SelectItem value="24">24 Months</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="1">30 Days (1 Month)</SelectItem>
                      <SelectItem value="2">60 Days (2 Months)</SelectItem>
                      <SelectItem value="3">90 Days (3 Months)</SelectItem>
                      <SelectItem value="4">120 Days (4 Months)</SelectItem>
                      <SelectItem value="6">6 Months</SelectItem>
                      <SelectItem value="7">7 Months</SelectItem>
                      <SelectItem value="8">8 Months</SelectItem>
                      <SelectItem value="9">9 Months</SelectItem>
                      <SelectItem value="10">10 Months</SelectItem>
                      <SelectItem value="11">11 Months</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Payment Frequency</Label>
              <Select
                value={paymentFrequency}
                onValueChange={(v) => setPaymentFrequency(v as "monthly" | "quarterly" | "bi-annual")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly (Every 3 Months)</SelectItem>
                  <SelectItem value="bi-annual">Bi-Annual (Every 6 Months)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {editMode ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="debtor" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Debtor
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Financial
            </TabsTrigger>
            <TabsTrigger value="scope" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Scope
            </TabsTrigger>
            <TabsTrigger value="clauses" className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Clauses
            </TabsTrigger>
          </TabsList>

          <TabsContent value="debtor" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Debtor Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Law Firm Name</Label>
                    <Input
                      value={debtor.lawFirmName}
                      onChange={(e) =>
                        setDebtor((prev) => ({ ...prev, lawFirmName: e.target.value }))
                      }
                      placeholder="Enter law firm name"
                    />
                  </div>
                  <div>
                    <Label>Registration Number</Label>
                    <Input
                      value={debtor.registrationNumber}
                      onChange={(e) =>
                        setDebtor((prev) => ({ ...prev, registrationNumber: e.target.value }))
                      }
                      placeholder="e.g., 2020/123456/07"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Authorized Representative</Label>
                    <Input
                      value={debtor.authorizedRepName}
                      onChange={(e) =>
                        setDebtor((prev) => ({ ...prev, authorizedRepName: e.target.value }))
                      }
                      placeholder="Mr./Ms. Full Name"
                    />
                  </div>
                  <div>
                    <Label>Capacity</Label>
                    <Select
                      value={debtor.authorizedRepCapacity}
                      onValueChange={(v) =>
                        setDebtor((prev) => ({ ...prev, authorizedRepCapacity: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Director">Director</SelectItem>
                        <SelectItem value="Managing Director">Managing Director</SelectItem>
                        <SelectItem value="Partner">Partner</SelectItem>
                        <SelectItem value="Principal Attorney">Principal Attorney</SelectItem>
                        <SelectItem value="Associate">Associate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Domicilium Address</Label>
                  <Textarea
                    value={debtor.domiciliumAddress}
                    onChange={(e) =>
                      setDebtor((prev) => ({ ...prev, domiciliumAddress: e.target.value }))
                    }
                    placeholder="Full physical address for legal correspondence"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Financial Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Total Contract Value (R)</Label>
                    <Input
                      type="number"
                      value={financial.totalAmount}
                      onChange={(e) =>
                        setFinancial((prev) => ({
                          ...prev,
                          totalAmount: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {financial.totalAmountWords}
                    </p>
                  </div>
                  <div>
                    <Label>Deposit Amount (R)</Label>
                    <Input
                      type="number"
                      value={financial.depositAmount}
                      onChange={(e) =>
                        setFinancial((prev) => ({
                          ...prev,
                          depositAmount: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {financial.depositAmountWords}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Deposit Date</Label>
                    <Input
                      type="date"
                      value={financial.depositDate}
                      onChange={(e) =>
                        setFinancial((prev) => ({ ...prev, depositDate: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Interest Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={financial.interestRate}
                      onChange={(e) =>
                        setFinancial((prev) => ({
                          ...prev,
                          interestRate: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <h4 className="font-medium">Auto-Calculated Values</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Outstanding Balance:</span>
                      <p className="font-medium">
                        R {financial.outstandingBalance.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Number of Payments:</span>
                      <p className="font-medium">{financial.numberOfQuarters}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {agreementType === "long-term" ? "Quarterly" : "Monthly"} Payment:
                      </span>
                      <p className="font-medium">
                        R {financial.quarterlyPayment.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Payment Period:</span>
                      <p className="font-medium">
                        {financial.firstPaymentDate} - {financial.lastPaymentDate}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scope" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Service Scope</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Matter Types</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {["Road Accident Fund (RAF)", "Personal Injury", "Medical Negligence"].map(
                      (type) => (
                        <Badge
                          key={type}
                          variant={scope.matterTypes.includes(type) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            setScope((prev) => ({
                              ...prev,
                              matterTypes: prev.matterTypes.includes(type)
                                ? prev.matterTypes.filter((t) => t !== type)
                                : [...prev.matterTypes, type],
                            }));
                          }}
                        >
                          {type}
                        </Badge>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <Label>Number of Assessments</Label>
                  <Input
                    type="number"
                    value={scope.numberOfAssessments}
                    onChange={(e) =>
                      setScope((prev) => ({
                        ...prev,
                        numberOfAssessments: parseInt(e.target.value) || 10,
                      }))
                    }
                    min={10}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum 10 assessments to activate agreement
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clauses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Edit Agreement Clauses</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <Accordion type="multiple" className="w-full">
                    {AOD_TEMPLATE_SECTIONS.map((section) => (
                      <AccordionItem key={section.id} value={section.id}>
                        <AccordionTrigger className="text-left">
                          {section.name}
                          <Badge variant="secondary" className="ml-2">
                            {section.clauses.length} clauses
                          </Badge>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 pt-2">
                            {section.clauses.map((clause) => (
                              <div key={clause.id} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-medium">{clause.title}</Label>
                                  {clause.isEditable && (
                                    <Badge variant="outline" className="text-xs">
                                      Editable
                                    </Badge>
                                  )}
                                </div>
                                <Textarea
                                  value={getClauseContent(clause)}
                                  onChange={(e) => handleClauseEdit(clause.id, e.target.value)}
                                  disabled={!clause.isEditable}
                                  className={!clause.isEditable ? "bg-muted" : ""}
                                  rows={4}
                                />
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Agreement Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] border rounded-lg p-4">
              <div dangerouslySetInnerHTML={{ __html: generatePreviewHTML() }} />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button variant="outline" onClick={() => setEditMode(!editMode)}>
          {editMode ? (
            <>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </>
          ) : (
            <>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </>
          )}
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Agreement"}
        </Button>
      </div>
    </div>
  );
};

export default AODTemplateGenerator;
