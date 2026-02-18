import React, { useState, useEffect } from "react";
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
import { Mail, Loader2, FileText, Paperclip, CheckCircle2, AlertCircle, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

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

      // Build default editable content
      const expertName = `${appointment?.medical_experts?.first_name || ""} ${appointment?.medical_experts?.last_name || ""}`.trim();
      const attorneyName = appointment?.referring_attorneys?.contact_person || appointment?.referring_attorneys?.name || "";
      const claimantName = `${appointment?.claimants?.first_name || ""} ${appointment?.claimants?.last_name || ""}`.trim();

      setExpertEmailBody(
        `We are appointed as Kutlwano and Associate Pty Ltd to request assessment on behalf of ${appointment?.referring_attorneys?.name || "the referring attorney"}. We request the assessment, Report and RAF4 from Dr. ${expertName} to assess the referred patient for a road accident claim.\n\nWe have attached the following information: ID copy, Summons, Medical records, Instruction letter. Please allow us to upload additional supporting documents if any.`
      );

      setAttorneyEmailBody(
        `This is to confirm the scheduled assessment appointment for ${claimantName}. Please ensure the claimant arrives 15 minutes before the appointment with all relevant medical records and documentation. Valid ID is required.`
      );

      setExpertSubject(`New Appointment Confirmation - ${claimantName}`);
      setAttorneySubject(`New Appointment Confirmation - ${claimantName}`);

      // Fetch claimant documents
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
    try {
      setSending(true);

      const { error } = await supabase.functions.invoke("send-appointment-confirmation", {
        body: {
          appointmentId,
          attorneyEmail,
          attorneyCc: attorneyCc.trim() ? attorneyCc : undefined,
          expertEmail,
          expertCc: expertCc.trim() ? expertCc : undefined,
          attachmentDocumentIds: selectedDocuments.length > 0 ? selectedDocuments : undefined,
          customLocation: editableLocation.trim() || undefined,
          customExpertBody: expertEmailBody.trim() || undefined,
          customAttorneyBody: attorneyEmailBody.trim() || undefined,
          customExpertSubject: expertSubject.trim() || undefined,
          customAttorneySubject: attorneySubject.trim() || undefined,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Appointment confirmation emails sent successfully",
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
    return d.toLocaleString('en-ZA', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Johannesburg',
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Preview - Appointment Confirmation
          </DialogTitle>
          <DialogDescription>
            Review and edit the email content before sending. You can attach supporting documents below.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="expert" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="expert">Expert Email</TabsTrigger>
            <TabsTrigger value="attorney">Attorney Email</TabsTrigger>
          </TabsList>

          {/* EXPERT TAB */}
          <TabsContent value="expert" className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">To:</label>
                <Input
                  type="email"
                  value={expertEmail}
                  onChange={(e) => setExpertEmail(e.target.value)}
                  placeholder="Expert email address"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">CC: (optional)</label>
                <Input
                  type="text"
                  value={expertCc}
                  onChange={(e) => setExpertCc(e.target.value)}
                  placeholder="Additional emails (comma-separated)"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Subject:</label>
                <Input
                  value={expertSubject}
                  onChange={(e) => setExpertSubject(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="border-b border-border pb-4">
                <h3 className="text-lg font-semibold text-foreground">Kutlwano & Associate</h3>
                <p className="text-sm text-muted-foreground">Medico-Legal Assessment Services</p>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-1">Dear {expertDrTitle},</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Email Body (editable):</label>
                <Textarea
                  value={expertEmailBody}
                  onChange={(e) => setExpertEmailBody(e.target.value)}
                  rows={6}
                  className="text-sm"
                />
              </div>

              <div className="bg-muted/50 rounded-md p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Appointment Details:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium text-foreground">Claimant:</span>
                  <span className="text-foreground">{claimant?.first_name} {claimant?.last_name}</span>

                  <span className="font-medium text-foreground">Date & Time:</span>
                  <span className="text-foreground">{formatAppointmentDate(appointmentDetails.appointment_date)}</span>

                  <span className="font-medium text-foreground">Referring Attorney:</span>
                  <span className="text-foreground">{attorney?.name}</span>

                  {appointmentDetails.matter_type && (
                    <>
                      <span className="font-medium text-foreground">Matter Type:</span>
                      <span className="text-foreground">{appointmentDetails.matter_type}</span>
                    </>
                  )}

                  <span className="font-medium text-foreground">Location:</span>
                  <Input
                    value={editableLocation}
                    onChange={(e) => setEditableLocation(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Document Attachments Section */}
              <DocumentAttachmentSection
                claimantDocuments={claimantDocuments}
                selectedDocuments={selectedDocuments}
                setSelectedDocuments={setSelectedDocuments}
                claimantId={claimant?.id}
                onDocumentsUpdated={fetchAppointmentDetails}
              />

              <div className="pt-4 border-t border-border">
                <p className="text-sm text-foreground">Kindly,</p>
                <p className="text-sm font-medium text-foreground">Kutlwano & Associates</p>
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
                <Input
                  type="email"
                  value={attorneyEmail}
                  onChange={(e) => setAttorneyEmail(e.target.value)}
                  placeholder="Attorney email address"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">CC: (optional)</label>
                <Input
                  type="text"
                  value={attorneyCc}
                  onChange={(e) => setAttorneyCc(e.target.value)}
                  placeholder="Additional emails (comma-separated)"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Subject:</label>
                <Input
                  value={attorneySubject}
                  onChange={(e) => setAttorneySubject(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="border-b border-border pb-4">
                <h3 className="text-lg font-semibold text-foreground">Kutlwano & Associate</h3>
                <p className="text-sm text-muted-foreground">Medico-Legal Assessment Services</p>
              </div>

              <div>
                <p className="text-sm text-foreground">Dear {attorney?.contact_person || attorney?.name},</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Email Body (editable):</label>
                <Textarea
                  value={attorneyEmailBody}
                  onChange={(e) => setAttorneyEmailBody(e.target.value)}
                  rows={4}
                  className="text-sm"
                />
              </div>

              <div className="bg-muted/50 rounded-md p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Appointment Details:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
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
                  <Input
                    value={editableLocation}
                    onChange={(e) => setEditableLocation(e.target.value)}
                    className="h-8 text-sm"
                  />

                  {appointmentDetails.matter_type && (
                    <>
                      <span className="font-medium text-foreground">Matter Type:</span>
                      <span className="text-foreground">{appointmentDetails.matter_type}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-4">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2">Important Requirements:</p>
                <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1 list-disc list-inside">
                  <li>Please ensure the claimant arrives 15 minutes before the appointment</li>
                  <li>Bring all relevant medical records and documentation</li>
                  <li>Valid ID is required</li>
                  <li><strong>X-rays are NOT included in our fee charged</strong> – they are charged separately by a radiologist of your choice or our third-party partner (In-house)</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-sm text-foreground">Kind regards,</p>
                <p className="text-sm font-medium text-foreground">Kutlwano & Associates Team</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                <FileText className="h-3 w-3" />
                <span>PDF attachment with full appointment details will be included</span>
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
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSendEmail} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Emails
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

      // Auto-select the newly uploaded document
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
          <Badge variant="secondary" className="text-xs">
            {selectedDocuments.length} selected
          </Badge>
        )}
      </div>

      {claimantDocuments.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1">
          {claimantDocuments.map((doc) => (
            <label
              key={doc.id}
              className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedDocuments.includes(doc.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedDocuments([...selectedDocuments, doc.id]);
                  } else {
                    setSelectedDocuments(selectedDocuments.filter((id) => id !== doc.id));
                  }
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

      {/* Upload new document */}
      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Upload New Supporting Document:</p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            id="email-doc-upload"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
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
