import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, FileText, Paperclip, CheckCircle2, AlertCircle, Upload, X, Users, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// ─── Email memory helpers ──────────────────────────────────────────────────
const EMAIL_MEMORY_KEY = "kamedico_remembered_emails";
const MAX_REMEMBERED = 30;

function getRememberedEmails(): string[] {
  try {
    return JSON.parse(localStorage.getItem(EMAIL_MEMORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function rememberEmails(emails: string[]) {
  const existing = getRememberedEmails();
  const merged = Array.from(new Set([...emails, ...existing])).slice(0, MAX_REMEMBERED);
  localStorage.setItem(EMAIL_MEMORY_KEY, JSON.stringify(merged));
}

function parseEmailsFromString(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter((e) => e.includes("@"));
}

// ─── EmailInputWithMemory component ───────────────────────────────────────
interface EmailInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  excludeEmails?: string[];
}

const EmailInputWithMemory: React.FC<EmailInputProps> = ({ value, onChange, placeholder, type = "text", excludeEmails = [] }) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Compute suggestions based on the last token being typed
  const computeSuggestions = useCallback((raw: string, excludeEmails: string[] = []) => {
    const tokens = raw.split(/[,;]/);
    const current = tokens[tokens.length - 1].trim().toLowerCase();
    if (!current || current.length < 1) { setOpen(false); return; }
    const remembered = getRememberedEmails();
    const alreadyAdded = tokens.slice(0, -1).map((t) => t.trim().toLowerCase());
    const excludeLower = excludeEmails.map(e => e.toLowerCase());
    const filtered = remembered.filter(
      (e) => e.toLowerCase().includes(current) 
        && !alreadyAdded.includes(e.toLowerCase())
        && !excludeLower.includes(e.toLowerCase())
    );
    setSuggestions(filtered);
    setOpen(filtered.length > 0);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    computeSuggestions(e.target.value, excludeEmails);
  };

  const selectSuggestion = (email: string) => {
    const tokens = value.split(/[,;]/);
    tokens[tokens.length - 1] = email;
    onChange(tokens.join(", ") + ", ");
    setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        type={type}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        onFocus={() => computeSuggestions(value, excludeEmails)}
      />
      {open && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg text-sm overflow-hidden max-h-48 overflow-y-auto">
          {suggestions.map((email) => (
            <li
              key={email}
              className="px-3 py-2 cursor-pointer hover:bg-muted text-foreground flex items-center gap-2"
              onMouseDown={(e) => { e.preventDefault(); selectSuggestion(email); }}
            >
              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
              {email}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface AppointmentEmailPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  onConfirmSend?: () => void;
}

const parseEmails = (emailField: string | string[] | undefined): string[] => {
  if (!emailField) return [];
  if (typeof emailField === "string") {
    return emailField
      .split(/[,;|]/)
      .map((email) => email.trim())
      .filter((email) => email && email.includes("@"));
  }
  if (Array.isArray(emailField)) {
    return emailField.filter((email) => email && email.includes("@"));
  }
  return [];
};

export const AppointmentEmailPreviewDialog: React.FC<AppointmentEmailPreviewDialogProps> = ({
  isOpen,
  onClose,
  appointmentId,
  onConfirmSend,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [appointmentDetails, setAppointmentDetails] = useState<any>(null);
  const [attorneyEmail, setAttorneyEmail] = useState("");
  const [attorneyCc, setAttorneyCc] = useState("");
  const [expertEmail, setExpertEmail] = useState("");
  const [expertCc, setExpertCc] = useState("");
  const [claimantDocuments, setClaimantDocuments] = useState<any[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [editableLocation, setEditableLocation] = useState("");

  // Send target: 'expert' | 'attorney' | 'both'
  const [sendTo, setSendTo] = useState<{ expert: boolean; attorney: boolean }>({ expert: true, attorney: true });

  // Editable email content
  const [expertEmailBody, setExpertEmailBody] = useState("");
  const [attorneyEmailBody, setAttorneyEmailBody] = useState("");
  const [expertSubject, setExpertSubject] = useState("New Appointment Confirmation");
  const [attorneySubject, setAttorneySubject] = useState("New Appointment Confirmation");

  useEffect(() => {
    if (isOpen && appointmentId) {
      fetchAppointmentDetails();
    }
  }, [isOpen, appointmentId]);

  const fetchAppointmentDetails = async () => {
    try {
      setLoading(true);

      const { data: appointment, error } = await supabase
        .from("appointments")
        .select(`
          *,
          claimants (
            auto_id,
            first_name,
            last_name,
            contact_number,
            id
          ),
          medical_experts (
            first_name,
            last_name,
            email,
            practice_address,
            expert_type,
            consultation_fees
          ),
          referring_attorneys (
            name,
            email,
            contact_person
          )
        `)
        .eq("id", appointmentId)
        .single();

      if (error) throw error;
      setAppointmentDetails(appointment);
      setEditableLocation(appointment?.medical_experts?.practice_address || "");

      const attorneyEmails = parseEmails(appointment?.referring_attorneys?.email);
      const expertEmails = parseEmails(appointment?.medical_experts?.email);
      setAttorneyEmail(attorneyEmails[0] || "");
      setExpertEmail(expertEmails[0] || "");

      const expertName = `${appointment?.medical_experts?.first_name || ""} ${appointment?.medical_experts?.last_name || ""}`.trim();
      const claimantName = `${appointment?.claimants?.first_name || ""} ${appointment?.claimants?.last_name || ""}`.trim();
      const isNegligence = (appointment?.matter_type || "").toLowerCase().includes("neg");
      const claimType = isNegligence ? "Medical Negligence Claim" : "Road Accident Fund claim";

      setExpertEmailBody(
        `We write to confirm that Kutlwano & Associates Pty Ltd has been duly appointed by ${appointment?.referring_attorneys?.name || "the referring attorney"} to facilitate a medico-legal assessment.\n\nAccordingly, we kindly request that Dr. ${expertName} conduct an assessment of the referred patient and provide a comprehensive medico-legal report in relation to a ${claimType}.`
      );

      setAttorneyEmailBody(
        `This is to confirm the scheduled assessment appointment for ${claimantName}. Please ensure the claimant arrives 15 minutes before the appointment with all relevant medical records and documentation. Valid ID is required.`
      );

      setExpertSubject(`New Appointment Confirmation - ${claimantName}`);
      setAttorneySubject(`New Appointment Confirmation - ${claimantName}`);

      if (appointment?.claimants?.id) {
        const { data: docs } = await supabase
          .from("documents")
          .select("*")
          .eq("claimant_id", appointment.claimants.id)
          .order("created_at", { ascending: false });

        if (docs) {
          setClaimantDocuments(docs);
        }
      }
    } catch (error) {
      console.error("Error fetching appointment details:", error);
      toast({
        title: "Error",
        description: "Failed to load appointment details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!sendTo.expert && !sendTo.attorney) {
      toast({ title: "Select recipient", description: "Please select at least one recipient (Expert or Attorney).", variant: "destructive" });
      return;
    }
    // Remember all emails typed
    const emailsToRemember: string[] = [];
    if (sendTo.attorney) {
      emailsToRemember.push(...parseEmailsFromString(attorneyEmail));
      emailsToRemember.push(...parseEmailsFromString(attorneyCc));
    }
    if (sendTo.expert) {
      emailsToRemember.push(...parseEmailsFromString(expertEmail));
      emailsToRemember.push(...parseEmailsFromString(expertCc));
    }
    rememberEmails(emailsToRemember.filter(Boolean));

    try {
      setSending(true);

      const { error } = await supabase.functions.invoke("send-appointment-confirmation", {
        body: {
          appointmentId,
          // Always pass the email value so the edge function knows the user explicitly set it.
          // An empty string means "don't send to default" — only send if the field has a value.
          // Pass undefined when the recipient type is unchecked so the edge function skips it entirely.
          attorneyEmail: sendTo.attorney ? attorneyEmail : undefined,
          attorneyCc: sendTo.attorney && attorneyCc.trim() ? attorneyCc : undefined,
          expertEmail: sendTo.expert ? expertEmail : undefined,
          expertCc: sendTo.expert && expertCc.trim() ? expertCc : undefined,
          attachmentDocumentIds: selectedDocuments.length > 0 ? selectedDocuments : undefined,
          customLocation: editableLocation.trim() || undefined,
          customExpertBody: expertEmailBody.trim() || undefined,
          customAttorneyBody: attorneyEmailBody.trim() || undefined,
          customExpertSubject: expertSubject.trim() || undefined,
          customAttorneySubject: attorneySubject.trim() || undefined,
        },
      });

      if (error) throw error;

      const sent = [sendTo.expert && "Expert", sendTo.attorney && "Attorney"].filter(Boolean).join(" & ");
      toast({
        title: "Success",
        description: `Appointment confirmation sent to: ${sent}`,
      });

      onConfirmSend?.();
      onClose();
    } catch (error) {
      console.error("Error sending emails:", error);
      toast({
        title: "Error",
        description: "Failed to send confirmation emails",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const formatAppointmentDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleString("en-ZA", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Johannesburg",
      hour12: false,
    });
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

  if (!appointmentDetails) {
    return null;
  }

  const claimant = appointmentDetails.claimants;
  const expert = appointmentDetails.medical_experts;
  const attorney = appointmentDetails.referring_attorneys;
  const expertFullName = `${expert?.first_name || ""} ${expert?.last_name || ""}`.trim();
  const expertDrTitle = `Dr. ${expertFullName || expert?.expert_type || "Expert"}`;
  const isNegligence = (appointmentDetails?.matter_type || "").toLowerCase().includes("neg");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Preview - Appointment Confirmation
          </DialogTitle>
          <DialogDescription>
            Review and edit the email content before sending. Select who to send to below.
          </DialogDescription>
        </DialogHeader>

        {/* Send To Selector */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Send To:</p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={sendTo.expert}
                onCheckedChange={(v) => setSendTo(prev => ({ ...prev, expert: !!v }))}
              />
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Expert</span>
              {expertEmail && <span className="text-xs text-muted-foreground">({expertEmail})</span>}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={sendTo.attorney}
                onCheckedChange={(v) => setSendTo(prev => ({ ...prev, attorney: !!v }))}
              />
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Attorney</span>
              {attorneyEmail && <span className="text-xs text-muted-foreground">({attorneyEmail})</span>}
            </label>
          </div>
        </div>

        <Tabs defaultValue="expert" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="expert" className="flex items-center gap-1">
              <Stethoscope className="h-3 w-3" />Expert Email
            </TabsTrigger>
            <TabsTrigger value="attorney" className="flex items-center gap-1">
              <Users className="h-3 w-3" />Attorney Email
            </TabsTrigger>
          </TabsList>

          {/* EXPERT TAB */}
          <TabsContent value="expert" className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">To:</label>
                <EmailInputWithMemory type="email" value={expertEmail} onChange={setExpertEmail} placeholder="Expert email address" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">CC: (optional)</label>
                <EmailInputWithMemory value={expertCc} onChange={setExpertCc} placeholder="Additional emails (comma-separated)" excludeEmails={[expertEmail]} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Subject:</label>
                <Input value={expertSubject} onChange={(e) => setExpertSubject(e.target.value)} />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="border-b-2 pb-3" style={{ borderColor: "#1fb6ce" }}>
                <h3 className="font-bold text-foreground" style={{ fontSize: 14 }}>KUTLWANO & ASSOCIATES (PTY) LTD</h3>
                <p style={{ fontSize: 11 }} className="text-muted-foreground">Medico-Legal Service</p>
                <p style={{ fontSize: 10, fontStyle: "italic" }} className="text-muted-foreground">"We touch a file, We change a life, We are Kutlwano and Associate"</p>
              </div>

              <div>
                <p style={{ fontSize: 11 }} className="font-medium text-foreground">Dear {expertDrTitle},</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Email Body (editable):</label>
                <Textarea value={expertEmailBody} onChange={(e) => setExpertEmailBody(e.target.value)} rows={6} style={{ fontSize: 11 }} />
              </div>

              <div className="rounded-md p-4 space-y-2" style={{ backgroundColor: "#f0fcff", border: "1px solid #1fb6ce" }}>
                 <p className="font-semibold mb-2" style={{ fontSize: 12, color: "#1fb6ce" }}>Appointment Details:</p>
                 <div className="grid grid-cols-2 gap-2" style={{ fontSize: 10 }}>
                   <span className="font-medium text-foreground">Claimant:</span>
                   <span className="text-foreground">{claimant?.first_name} {claimant?.last_name}</span>
                   <span className="font-medium text-foreground">Date & Time:</span>
                   <span className="text-foreground">{formatAppointmentDate(appointmentDetails.appointment_date)}</span>
                   <span className="font-medium text-foreground">Referring Attorney:</span>
                   <span className="text-foreground">{attorney?.name}</span>
                    {appointmentDetails.matter_type && (
                      <div className="col-span-2 flex justify-end items-center gap-2 mt-1">
                        <span className="font-medium text-foreground">Matter Type:</span>
                        <span style={{ color: "#000000", fontWeight: "normal" }}>{appointmentDetails.matter_type}</span>
                      </div>
                    )}
                     <span className="font-medium text-foreground">Location:</span>
                      <Input value={editableLocation} onChange={(e) => setEditableLocation(e.target.value)} className="h-7" style={{ fontSize: 10, color: "#000000", fontWeight: "normal" }} />
                  </div>
                </div>

              {/* Document Attachments */}
              <DocumentAttachmentSection
                claimantDocuments={claimantDocuments}
                selectedDocuments={selectedDocuments}
                setSelectedDocuments={setSelectedDocuments}
                claimantId={claimant?.id}
                onDocumentsUpdated={fetchAppointmentDetails}
              />

              {/* Expert Important Requirements */}
              <div className="rounded-md p-4" style={{ backgroundColor: "#f0fcff", border: "2px solid #1fb6ce" }}>
                 <p className="font-bold mb-3" style={{ fontSize: 13, color: "#1fb6ce" }}>⚠️ IMPORTANT REQUIREMENTS</p>
                 <p className="font-bold mb-1" style={{ fontSize: 12, color: "#1fb6ce" }}>📋 Please Note:</p>
                 <ul style={{ fontSize: 11, color: "#000000", lineHeight: 1.7, paddingLeft: 20 }}>
                   <li>Kindly confirm your availability for this assessment in writing.</li>
                   <li>Should you need to reschedule, notify our office immediately.</li>
                   <li>All expert rescheduling arrangements must be processed strictly through Kutlwano and Associates (Pty) Ltd.</li>
                   <li>Please review all case documentation provided prior to the assessment.</li>
                   <li>All digital and physical records must be securely stored in compliance with applicable professional and POPIA requirements.</li>
                   <li>Communication, queries must be directed to Kutlwano and Associate.</li>
                   <li>The expert's office is prohibited from contacting or soliciting our referring attorneys.</li>
                 </ul>
                 <p style={{ fontSize: 11, color: "#000000", fontStyle: "italic", marginTop: 8 }}>
                   We value professional integrity, independence, and structured coordination to ensure smooth case management for all parties involved.
                 </p>
               </div>

              <div className="pt-4 border-t border-border">
                <p style={{ fontSize: 11 }} className="text-foreground">Kindly,</p>
                <p style={{ fontSize: 12 }} className="font-medium text-foreground">Kutlwano & Associates</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                <FileText className="h-3 w-3" />
                <span>PDF attachment with full appointment details will be included</span>
              </div>
            </div>
          </TabsContent>

          {/* ATTORNEY TAB */}
          <TabsContent value="attorney" className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">To:</label>
                <EmailInputWithMemory type="email" value={attorneyEmail} onChange={setAttorneyEmail} placeholder="Attorney email address" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">CC: (optional)</label>
                <EmailInputWithMemory value={attorneyCc} onChange={setAttorneyCc} placeholder="Additional emails (comma-separated)" excludeEmails={[attorneyEmail]} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Subject:</label>
                <Input value={attorneySubject} onChange={(e) => setAttorneySubject(e.target.value)} />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="border-b-2 pb-3" style={{ borderColor: "#1fb6ce" }}>
                <h3 className="font-bold text-foreground" style={{ fontSize: 14 }}>KUTLWANO & ASSOCIATES (PTY) LTD</h3>
                <p style={{ fontSize: 11 }} className="text-muted-foreground">Medico-Legal Service</p>
                <p style={{ fontSize: 10, fontStyle: "italic" }} className="text-muted-foreground">"We touch a file, We change a life, We are Kutlwano and Associate"</p>
              </div>

              <p style={{ fontSize: 10 }} className="text-foreground">Dear {attorney?.contact_person || attorney?.name},</p>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Email Body (editable):</label>
                <Textarea value={attorneyEmailBody} onChange={(e) => setAttorneyEmailBody(e.target.value)} rows={4} style={{ fontSize: 10 }} />
              </div>

              <div className="rounded-md p-4" style={{ backgroundColor: "#f0fcff", border: "1px solid #1fb6ce" }}>
                 <p className="font-semibold mb-2" style={{ fontSize: 10, color: "#1fb6ce" }}>Appointment Details:</p>
                 <div className="grid grid-cols-2 gap-2" style={{ fontSize: 10 }}>
                   <span className="font-medium text-foreground">Claimant:</span>
                   <span className="text-foreground">{claimant?.first_name} {claimant?.last_name} ({claimant?.auto_id})</span>
                   <span className="font-medium text-foreground">Date & Time:</span>
                   <span className="text-foreground">{formatAppointmentDate(appointmentDetails.appointment_date)}</span>
                   {expert?.first_name && expert?.last_name && (
                     <>
                       <span className="font-medium text-foreground">Expert:</span>
                       <span className="text-foreground">{expertDrTitle}</span>
                     </>
                   )}
                   <span className="font-medium text-foreground">Expert Type:</span>
                   <span className="text-foreground">{expert?.expert_type}</span>
                     <span className="font-medium text-foreground">Location:</span>
                      <Input value={editableLocation} onChange={(e) => setEditableLocation(e.target.value)} className="h-7" style={{ fontSize: 10, color: "#000000", fontWeight: "normal" }} />
                    {appointmentDetails.matter_type && (
                      <div className="col-span-2 flex justify-end items-center gap-2 mt-1">
                        <span className="font-medium text-foreground">Matter Type:</span>
                        <span style={{ color: "#000000", fontWeight: "normal" }}>{appointmentDetails.matter_type}</span>
                      </div>
                    )}
                 </div>
               </div>

              {/* Attorney Important Requirements - Teal branding */}
              <div className="rounded-md p-4" style={{ backgroundColor: "#f0fcff", border: "2px solid #1fb6ce" }}>
                 <p className="font-bold mb-3" style={{ fontSize: 12, color: "#1fb6ce" }}>⚠️ IMPORTANT REQUIREMENTS</p>

                 <p className="font-bold mb-1" style={{ fontSize: 10, color: "#1fb6ce" }}>📄 Required Documents (Must be provided before assessment):</p>
                 <ul style={{ fontSize: 10, color: "#000000", lineHeight: 1.7, paddingLeft: 20, marginBottom: 10 }}>
                   <li>Instruction letter from your office</li>
                   <li>Complete medical records and reports</li>
                   <li>ID copy of the claimant</li>
                   <li>Any previous assessment reports (if applicable)</li>
                   <li>Relevant imaging/diagnostic results</li>
                   {isNegligence && (
                     <>
                       <li>Summons (particulars of claim)</li>
                       <li>Section 3 notice in terms of Act 40 of 2002</li>
                     </>
                   )}
                 </ul>

                 <p className="font-bold mb-1" style={{ fontSize: 10, color: "#1fb6ce" }}>⏰ Appointment Preparation:</p>
                 <ul style={{ fontSize: 10, color: "#000000", lineHeight: 1.7, paddingLeft: 20, marginBottom: 10 }}>
                   <li>Please ensure the claimant arrives 15 minutes before the appointment</li>
                   <li>Bring all relevant medical records and documentation</li>
                   <li>Valid ID is required</li>
                 </ul>

                 <p className="font-bold mb-1" style={{ fontSize: 10, color: "#1fb6ce" }}>🔄 Cancellation & Rescheduling Policy:</p>
                 <ul style={{ fontSize: 10, color: "#000000", lineHeight: 1.7, paddingLeft: 20, marginBottom: 10 }}>
                   <li>Minimum 48 hours notice required for cancellations</li>
                   <li>Late cancellations may incur cancellation fees</li>
                   <li>Contact Kutlwano & Associate directly for rescheduling</li>
                   <li>No-shows will be charged the full assessment fee</li>
                 </ul>

                 <p className="font-bold mb-1" style={{ fontSize: 10, color: "#1fb6ce" }}>💰 Payment & Fee Information:</p>
                 <ul style={{ fontSize: 10, color: "#000000", lineHeight: 1.7, paddingLeft: 20, marginBottom: 10 }}>
                   <li>Payment terms as per agreement.</li>
                   <li>Invoice will be provided upon completion.</li>
                   <li>Outstanding fees must be settled before report is released.</li>
                   <li><strong>X-rays are NOT included in our fee charged.</strong></li>
                   <li>We offer AOD's for Referring Attorneys.</li>
                 </ul>

                 <p className="font-bold mb-1" style={{ fontSize: 10, color: "#1fb6ce" }}>📞 Contact Information:</p>
                 <ul style={{ fontSize: 10, color: "#000000", lineHeight: 1.7, paddingLeft: 20 }}>
                   <li>For queries: Contact Itebogeng for Med Neg & Virginia for MVA</li>
                   <li>For document submission: info@kutlwanoassociate.com</li>
                   <li>For emergencies: 011 027 6077 / 079 623 8064</li>
                 </ul>
               </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                <FileText className="h-3 w-3" />
                <span>PDF with this month's new appointments will be included</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mr-auto">
            {selectedDocuments.length > 0 ? (
              <Badge variant="secondary" className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                {selectedDocuments.length} document(s) attached
              </Badge>
            ) : (
              <Badge variant="outline" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                No supporting documents attached
              </Badge>
            )}
          </div>
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button onClick={handleSendEmail} disabled={sending || (!sendTo.expert && !sendTo.attorney)}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send to {[sendTo.expert && "Expert", sendTo.attorney && "Attorney"].filter(Boolean).join(" & ") || "..."}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Extracted document attachment component with upload support
const DocumentAttachmentSection: React.FC<{
  claimantDocuments: any[];
  selectedDocuments: string[];
  setSelectedDocuments: React.Dispatch<React.SetStateAction<string[]>>;
  claimantId?: string;
  onDocumentsUpdated?: () => void;
}> = ({ claimantDocuments, selectedDocuments, setSelectedDocuments, claimantId, onDocumentsUpdated }) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 50MB.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !claimantId) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileName = `${Date.now()}-supporting-${selectedFile.name}`;
      const filePath = `documents/supporting/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("attorney-documents")
        .upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const now = new Date();
      const { data: newDoc, error: dbError } = await supabase
        .from("documents")
        .insert({
          document_type: "Supporting Document",
          claimant_id: claimantId,
          file_name: selectedFile.name,
          file_path: filePath,
          file_size: selectedFile.size,
          file_type: selectedFile.type,
          uploaded_by: user.id,
          upload_date: now.toISOString(),
          upload_time: now.toTimeString().split(" ")[0],
          notes: "Uploaded via email preview",
        })
        .select("id")
        .single();

      if (dbError) throw dbError;
      if (newDoc) {
        setSelectedDocuments((prev) => [...prev, newDoc.id]);
      }

      toast({ title: "Uploaded", description: `${selectedFile.name} uploaded successfully.` });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onDocumentsUpdated?.();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/20">
      <div className="flex items-center gap-2 mb-2">
        <Paperclip className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Supporting Documents</p>
        {selectedDocuments.length > 0 && (
          <Badge variant="secondary" className="text-xs">{selectedDocuments.length} selected</Badge>
        )}
      </div>

      {claimantDocuments.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1">
          {claimantDocuments.map((doc) => (
            <label key={doc.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={selectedDocuments.includes(doc.id)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedDocuments([...selectedDocuments, doc.id]);
                  else setSelectedDocuments(selectedDocuments.filter((id) => id !== doc.id));
                }}
                className="rounded"
              />
              <span className="text-sm text-foreground truncate">{doc.file_name}</span>
              <span className="text-xs text-muted-foreground">({doc.document_type})</span>
            </label>
          ))}
        </div>
      )}

      {claimantDocuments.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No existing documents for this claimant.</p>
      )}

      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Upload New Supporting Document:</p>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" id="email-doc-upload" />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="h-3 w-3 mr-1" />
            Choose File
          </Button>
          {selectedFile && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm text-foreground truncate">{selectedFile.name}</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                <X className="h-3 w-3" />
              </Button>
              <Button size="sm" onClick={handleUpload} disabled={uploading}>
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Upload & Attach"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
