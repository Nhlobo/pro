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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, FileText, Users, Stethoscope, Plus, X, Paperclip, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

interface BulkConfirmationPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentIds: string[];
  onConfirmSend?: () => void;
}

interface AppointmentDetail {
  id: string;
  appointment_date: string;
  matter_type: string;
  referring_attorney: string;
  referring_attorney_id: string;
  claimants: { first_name: string; last_name: string; auto_id: string };
  medical_experts: {
    first_name: string;
    last_name: string;
    email: string;
    expert_type: string;
    practice_address: string;
  };
  referring_attorneys: { name: string; email: string; contact_person: string };
}

interface AttorneyGroup {
  attorneyName: string;
  attorneyEmail: string;
  ccEmails: string[];
  locationOverride: string;
  appointments: AppointmentDetail[];
}

interface ExpertGroup {
  expertName: string;
  expertEmail: string;
  ccEmails: string[];
  expertType: string;
  locationOverride: string;
  appointments: AppointmentDetail[];
  selectedDocuments: string[];
  availableDocuments: any[];
}

interface PendingUpload {
  groupIdx: number;
  files: File[];
}

export const BulkConfirmationPreviewDialog: React.FC<BulkConfirmationPreviewDialogProps> = ({
  isOpen,
  onClose,
  appointmentIds,
  onConfirmSend,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentDetail[]>([]);
  const [attorneyGroups, setAttorneyGroups] = useState<AttorneyGroup[]>([]);
  const [expertGroups, setExpertGroups] = useState<ExpertGroup[]>([]);

  // Send target toggles
  const [sendToAttorney, setSendToAttorney] = useState(true);
  const [sendToExpert, setSendToExpert] = useState(true);

  useEffect(() => {
    if (isOpen && appointmentIds.length > 0) {
      fetchAppointments();
    }
  }, [isOpen, appointmentIds]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          matter_type,
          referring_attorney,
          referring_attorney_id,
          claimants (first_name, last_name, auto_id),
          medical_experts (first_name, last_name, email, expert_type, practice_address),
          referring_attorneys (name, email, contact_person)
        `)
        .in("id", appointmentIds);

      if (error) throw error;
      setAppointments(data || []);

      // Group by attorney
      const attGroups: Record<string, AttorneyGroup> = {};
      (data || []).forEach((apt: any) => {
        const key = apt.referring_attorney_id;
        if (!attGroups[key]) {
          attGroups[key] = {
            attorneyName: apt.referring_attorneys?.name || apt.referring_attorney,
            attorneyEmail: apt.referring_attorneys?.email || "",
            ccEmails: [],
            locationOverride: apt.medical_experts?.practice_address || "",
            appointments: [],
          };
        }
        attGroups[key].appointments.push(apt);
      });
      Object.values(attGroups).forEach(g => {
        g.appointments.sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());
      });
      setAttorneyGroups(Object.values(attGroups));

      // Group by expert
      const expGroups: Record<string, ExpertGroup> = {};
      (data || []).forEach((apt: any) => {
        const expertName = `${apt.medical_experts?.first_name || ""} ${apt.medical_experts?.last_name || ""}`.trim();
        const key = expertName;
        if (!expGroups[key]) {
          expGroups[key] = {
            expertName,
            expertEmail: apt.medical_experts?.email || "",
            ccEmails: [],
            expertType: apt.medical_experts?.expert_type || "",
            locationOverride: apt.medical_experts?.practice_address || "",
            appointments: [],
            selectedDocuments: [],
            availableDocuments: [],
          };
        }
        expGroups[key].appointments.push(apt);
      });
      Object.values(expGroups).forEach(g => {
        g.appointments.sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());
      });
      const expertGroupsList = Object.values(expGroups);

      // Fetch available documents for each expert group (by claimant IDs)
      for (const group of expertGroupsList) {
        const claimantIds = group.appointments.map(a => a.claimants?.auto_id ? a.id : a.id).filter(Boolean);
        const claimantRealIds = group.appointments.map(a => {
          // Get claimant ID from appointment - we need to re-query
          return null;
        }).filter(Boolean);
        
        // Fetch documents for all claimants in this group
        const allClaimantNames = group.appointments.map(a => `${a.claimants?.first_name} ${a.claimants?.last_name}`);
        const appointmentIds = group.appointments.map(a => a.id);
        
        const { data: docs } = await supabase
          .from("documents")
          .select("id, file_name, document_type, created_at")
          .in("appointment_id", appointmentIds)
          .order("created_at", { ascending: false });
        
        if (docs && docs.length > 0) {
          group.availableDocuments = docs;
        }
      }

      setExpertGroups(expertGroupsList);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast({ title: "Error", description: "Failed to load appointment details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateAttorneyEmail = (idx: number, email: string) => setAttorneyGroups(prev => prev.map((g, i) => i === idx ? { ...g, attorneyEmail: email } : g));
  const updateAttorneyLocation = (idx: number, location: string) => setAttorneyGroups(prev => prev.map((g, i) => i === idx ? { ...g, locationOverride: location } : g));
  const addAttorneyCc = (idx: number) => setAttorneyGroups(prev => prev.map((g, i) => i === idx ? { ...g, ccEmails: [...g.ccEmails, ""] } : g));
  const updateAttorneyCc = (groupIdx: number, ccIdx: number, email: string) => setAttorneyGroups(prev => prev.map((g, i) => i === groupIdx ? { ...g, ccEmails: g.ccEmails.map((e, j) => j === ccIdx ? email : e) } : g));
  const removeAttorneyCc = (groupIdx: number, ccIdx: number) => setAttorneyGroups(prev => prev.map((g, i) => i === groupIdx ? { ...g, ccEmails: g.ccEmails.filter((_, j) => j !== ccIdx) } : g));

  const updateExpertEmail = (idx: number, email: string) => setExpertGroups(prev => prev.map((g, i) => i === idx ? { ...g, expertEmail: email } : g));
  const updateExpertLocation = (idx: number, location: string) => setExpertGroups(prev => prev.map((g, i) => i === idx ? { ...g, locationOverride: location } : g));
  const addExpertCc = (idx: number) => setExpertGroups(prev => prev.map((g, i) => i === idx ? { ...g, ccEmails: [...g.ccEmails, ""] } : g));
  const updateExpertCc = (groupIdx: number, ccIdx: number, email: string) => setExpertGroups(prev => prev.map((g, i) => i === groupIdx ? { ...g, ccEmails: g.ccEmails.map((e, j) => j === ccIdx ? email : e) } : g));
  const removeExpertCc = (groupIdx: number, ccIdx: number) => setExpertGroups(prev => prev.map((g, i) => i === groupIdx ? { ...g, ccEmails: g.ccEmails.filter((_, j) => j !== ccIdx) } : g));

  // Document selection helpers for expert groups
  const toggleExpertDocument = (groupIdx: number, docId: string) => {
    setExpertGroups(prev => prev.map((g, i) => {
      if (i !== groupIdx) return g;
      const selected = g.selectedDocuments.includes(docId)
        ? g.selectedDocuments.filter(id => id !== docId)
        : [...g.selectedDocuments, docId];
      return { ...g, selectedDocuments: selected };
    }));
  };

  // Multi-file upload for expert group
  const [uploadingGroupIdx, setUploadingGroupIdx] = useState<number | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Record<number, File[]>>({});
  const fileInputRefs = React.useRef<Record<number, HTMLInputElement | null>>({});

  const handleBulkFileSelect = (groupIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f => {
      if (f.size > 50 * 1024 * 1024) {
        toast({ title: "File too large", description: `${f.name} exceeds 50MB.`, variant: "destructive" });
        return false;
      }
      return true;
    });
    setPendingFiles(prev => ({ ...prev, [groupIdx]: [...(prev[groupIdx] || []), ...validFiles] }));
  };

  const removePendingFile = (groupIdx: number, fileIdx: number) => {
    setPendingFiles(prev => ({ ...prev, [groupIdx]: (prev[groupIdx] || []).filter((_, i) => i !== fileIdx) }));
  };

  const handleBulkUpload = async (groupIdx: number) => {
    const files = pendingFiles[groupIdx];
    if (!files || files.length === 0) return;
    setUploadingGroupIdx(groupIdx);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const group = expertGroups[groupIdx];
      // Use first appointment's claimant for document association
      const firstApt = group.appointments[0];
      const uploadedIds: string[] = [];

      for (const file of files) {
        const fileName = `${Date.now()}-supporting-${file.name}`;
        const filePath = `documents/supporting/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("attorney-documents")
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const now = new Date();
        const { data: newDoc, error: dbError } = await supabase
          .from("documents")
          .insert({
            document_type: "Supporting Document",
            appointment_id: firstApt.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: user.id,
            upload_date: now.toISOString(),
            upload_time: now.toTimeString().split(" ")[0],
            notes: "Uploaded via bulk email preview",
          })
          .select("id, file_name, document_type, created_at")
          .single();

        if (dbError) throw dbError;
        if (newDoc) {
          uploadedIds.push(newDoc.id);
          // Add to available docs
          setExpertGroups(prev => prev.map((g, i) => i === groupIdx ? {
            ...g,
            availableDocuments: [...g.availableDocuments, newDoc],
            selectedDocuments: [...g.selectedDocuments, newDoc.id],
          } : g));
        }
      }

      toast({ title: "Uploaded", description: `${uploadedIds.length} file(s) uploaded and attached.` });
      setPendingFiles(prev => ({ ...prev, [groupIdx]: [] }));
      if (fileInputRefs.current[groupIdx]) fileInputRefs.current[groupIdx]!.value = "";
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploadingGroupIdx(null);
    }
  };

  const handleSendBulk = async () => {
    if (!sendToAttorney && !sendToExpert) {
      toast({ title: "Select recipient", description: "Please select at least one recipient (Expert or Attorney).", variant: "destructive" });
      return;
    }
    try {
      setSending(true);

      // Send grouped attorney emails if enabled
      if (sendToAttorney) {
        for (const group of attorneyGroups) {
          const ccList = group.ccEmails.filter(e => e.trim());
          const { error } = await supabase.functions.invoke("send-appointment-confirmation", {
            body: {
              appointmentId: group.appointments[0].id,
              attorneyEmail: group.attorneyEmail,
              attorneyCc: ccList.length > 0 ? ccList.join(', ') : undefined,
              bulkAppointmentIds: group.appointments.map((a) => a.id),
              locationOverride: group.locationOverride || undefined,
            },
          });
          if (error) console.error("Error sending attorney group email:", error);
        }
      }

      // Send grouped expert emails if enabled
      if (sendToExpert) {
        for (const group of expertGroups) {
          const ccList = group.ccEmails.filter(e => e.trim());
          const { error } = await supabase.functions.invoke("send-appointment-confirmation", {
            body: {
              appointmentId: group.appointments[0].id,
              expertEmail: group.expertEmail,
              expertCc: ccList.length > 0 ? ccList.join(', ') : undefined,
              bulkExpertMode: true,
              bulkAppointmentIds: group.appointments.map((a) => a.id),
              locationOverride: group.locationOverride || undefined,
              attachmentDocumentIds: group.selectedDocuments.length > 0 ? group.selectedDocuments : undefined,
            },
          });
          if (error) console.error("Error sending expert group email:", error);
        }
      }

      const sent = [sendToAttorney && `${attorneyGroups.length} attorney group(s)`, sendToExpert && `${expertGroups.length} expert group(s)`].filter(Boolean).join(" and ");
      toast({ title: "Bulk Emails Sent", description: `Sent ${sent} successfully.` });

      onConfirmSend?.();
      onClose();
    } catch (error) {
      console.error("Error sending bulk emails:", error);
      toast({ title: "Error", description: "Failed to send bulk emails", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const formatDate = (d: string) => format(new Date(d), "EEEE, dd MMMM yyyy 'at' HH:mm");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Bulk Confirmation Preview – {appointmentIds.length} Appointments
          </DialogTitle>
          <DialogDescription>
            Appointments are grouped by referring attorney and by expert. Each group receives one consolidated email and PDF.
          </DialogDescription>
        </DialogHeader>

        {/* Send To Selector */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Send To:</p>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={sendToAttorney} onCheckedChange={(v) => setSendToAttorney(!!v)} />
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Attorneys</span>
              <Badge variant="secondary" className="text-xs">{attorneyGroups.length} group{attorneyGroups.length !== 1 ? "s" : ""}</Badge>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={sendToExpert} onCheckedChange={(v) => setSendToExpert(!!v)} />
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Experts</span>
              <Badge variant="secondary" className="text-xs">{expertGroups.length} group{expertGroups.length !== 1 ? "s" : ""}</Badge>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="attorney" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="attorney" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Attorney Groups ({attorneyGroups.length})
              </TabsTrigger>
              <TabsTrigger value="expert" className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                Expert Groups ({expertGroups.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="attorney" className="space-y-4 mt-4">
              {attorneyGroups.map((group, idx) => {
                // Check if any appointment in this group is for med neg
                const hasNegligence = group.appointments.some(a => (a.matter_type || "").toLowerCase().includes("neg"));
                return (
                  <div key={idx} className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground" style={{ fontSize: 13 }}>{group.attorneyName}</h3>
                      <div className="text-right">
                        {(() => {
                          const dates = [...new Set(group.appointments.map(a => format(new Date(a.appointment_date), "dd MMM yyyy")))];
                          return dates.length === 1
                            ? <Badge variant="secondary">{dates[0]}</Badge>
                            : <Badge variant="secondary">{dates[0]} – {dates[dates.length - 1]}</Badge>;
                        })()}
                        <p className="text-xs text-muted-foreground mt-1">{group.appointments.length} claimant{group.appointments.length > 1 ? "s" : ""}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">To</Label>
                        <Input value={group.attorneyEmail} onChange={(e) => updateAttorneyEmail(idx, e.target.value)} placeholder="Attorney email" className="h-8" style={{ fontSize: 11 }} />
                      </div>
                      <div>
                        <Label className="text-xs">📍 Location (editable)</Label>
                        <Input value={group.locationOverride} onChange={(e) => updateAttorneyLocation(idx, e.target.value)} placeholder="Practice address / location" className="h-8" style={{ fontSize: 11 }} />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">CC</Label>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => addAttorneyCc(idx)}>
                            <Plus className="h-3 w-3 mr-1" /> Add CC
                          </Button>
                        </div>
                        {group.ccEmails.map((cc, ccIdx) => (
                          <div key={ccIdx} className="flex gap-1 mt-1">
                            <Input value={cc} onChange={(e) => updateAttorneyCc(idx, ccIdx, e.target.value)} placeholder="CC email" className="h-8" style={{ fontSize: 11 }} />
                            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => removeAttorneyCc(idx, ccIdx)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-md p-3" style={{ backgroundColor: "#f0fcff", border: "1px solid #1fb6ce" }}>
                      <p className="font-semibold mb-2" style={{ fontSize: 12, color: "#1fb6ce" }}>Selected appointments ({group.appointments.length}):</p>
                      <table className="w-full" style={{ fontSize: 10 }}>
                        <thead>
                          <tr className="border-b border-border" style={{ color: "#1fb6ce" }}>
                            <th className="pb-1 font-semibold text-left">#</th>
                            <th className="pb-1 font-semibold text-left">Auto ID</th>
                            <th className="pb-1 font-semibold text-left">Claimant</th>
                            <th className="pb-1 font-semibold text-left">Matter Type</th>
                            <th className="pb-1 font-semibold text-left">Expert Type</th>
                            <th className="pb-1 font-semibold text-left">Date</th>
                            <th className="pb-1 font-semibold text-left">Time</th>
                            <th className="pb-1 font-semibold text-left">Location</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.appointments.map((apt, i) => (
                            <tr key={apt.id} className="border-b border-border/50" style={{ backgroundColor: i % 2 === 1 ? "#f0fcff" : undefined }}>
                              <td className="py-1">{i + 1}</td>
                              <td className="py-1"><Badge variant="outline" className="text-xs">{apt.claimants?.auto_id}</Badge></td>
                              <td className="py-1">{apt.claimants?.first_name} {apt.claimants?.last_name}</td>
                              <td className="py-1" style={{ color: "#000000", fontWeight: "normal" }}>{apt.matter_type || "General"}</td>
                              <td className="py-1">{apt.medical_experts?.expert_type}</td>
                              <td className="py-1">{format(new Date(apt.appointment_date), "dd MMM yyyy")}</td>
                              <td className="py-1">{format(new Date(apt.appointment_date), "HH:mm")}</td>
                              <td className="py-1" style={{ color: "#000000", fontWeight: "normal" }}>{group.locationOverride || apt.medical_experts?.practice_address || "TBD"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                     {/* Attorney Required Docs preview */}
                    <div className="rounded-md p-3" style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", fontSize: 11 }}>
                      <p className="font-bold mb-1" style={{ fontSize: 12, color: "#92400e" }}>📄 Required Documents:</p>
                      <ul style={{ color: "#78350f", paddingLeft: 18, lineHeight: 1.7 }}>
                        <li>Instruction letter, complete medical records, ID copy, previous reports, imaging results</li>
                        {hasNegligence && <li><strong>Med Neg:</strong> Summons (particulars of claim) + Section 3 notice (Act 40 of 2002)</li>}
                      </ul>
                      <p className="font-bold mb-1 mt-2" style={{ fontSize: 12, color: "#92400e" }}>💰 Payment & Fee Information:</p>
                      <ul style={{ color: "#78350f", paddingLeft: 18, lineHeight: 1.7 }}>
                        <li>Payment terms as per agreement.</li>
                        <li>Invoice will be provided upon completion.</li>
                        <li>Outstanding fees must be settled before report is released.</li>
                        <li><strong>X-rays are NOT included in our fee charged.</strong></li>
                        <li>We offer AOD's for Referring Attorneys.</li>
                      </ul>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span>One consolidated PDF with all {group.appointments.length} appointment(s) will be attached</span>
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="expert" className="space-y-4 mt-4">
              {expertGroups.map((group, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground" style={{ fontSize: 13 }}>Dr. {group.expertName || group.expertType}</h3>
                    <div className="text-right">
                      {(() => {
                        const dates = [...new Set(group.appointments.map(a => format(new Date(a.appointment_date), "dd MMM yyyy")))];
                        return dates.length === 1
                          ? <Badge variant="secondary">{dates[0]}</Badge>
                          : <Badge variant="secondary">{dates[0]} – {dates[dates.length - 1]}</Badge>;
                      })()}
                      <p className="text-xs text-muted-foreground mt-1">{group.appointments.length} patient{group.appointments.length > 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">To</Label>
                      <Input value={group.expertEmail} onChange={(e) => updateExpertEmail(idx, e.target.value)} placeholder="Expert email" className="h-8" style={{ fontSize: 11 }} />
                    </div>
                    <div>
                      <Label className="text-xs">📍 Location (editable)</Label>
                      <Input value={group.locationOverride} onChange={(e) => updateExpertLocation(idx, e.target.value)} placeholder="Practice address / location" className="h-8" style={{ fontSize: 11 }} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">CC</Label>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => addExpertCc(idx)}>
                          <Plus className="h-3 w-3 mr-1" /> Add CC
                        </Button>
                      </div>
                      {group.ccEmails.map((cc, ccIdx) => (
                        <div key={ccIdx} className="flex gap-1 mt-1">
                          <Input value={cc} onChange={(e) => updateExpertCc(idx, ccIdx, e.target.value)} placeholder="CC email" className="h-8" style={{ fontSize: 11 }} />
                          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => removeExpertCc(idx, ccIdx)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md p-3" style={{ backgroundColor: "#f0fcff", border: "1px solid #1fb6ce" }}>
                    <p className="font-semibold mb-2" style={{ fontSize: 12, color: "#1fb6ce" }}>Patients in this PDF:</p>
                    <table className="w-full" style={{ fontSize: 10 }}>
                      <thead>
                        <tr className="border-b border-border" style={{ color: "#1fb6ce" }}>
                          <th className="pb-1 font-semibold text-left">#</th>
                          <th className="pb-1 font-semibold text-left">Patient</th>
                          <th className="pb-1 font-semibold text-left">Referring Attorney</th>
                          <th className="pb-1 font-semibold text-left">Matter Type</th>
                          <th className="pb-1 font-semibold text-left">Date</th>
                          <th className="pb-1 font-semibold text-left">Time</th>
                          <th className="pb-1 font-semibold text-left">Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.appointments.map((apt, i) => (
                          <tr key={apt.id} className="border-b border-border/50" style={{ backgroundColor: i % 2 === 1 ? "#f0fcff" : undefined }}>
                            <td className="py-1">{i + 1}</td>
                            <td className="py-1">{apt.claimants?.first_name} {apt.claimants?.last_name}</td>
                            <td className="py-1">{apt.referring_attorneys?.name}</td>
                            <td className="py-1" style={{ color: "#000000", fontWeight: "normal" }}>{apt.matter_type || "General"}</td>
                            <td className="py-1">{format(new Date(apt.appointment_date), "dd MMM yyyy")}</td>
                            <td className="py-1">{format(new Date(apt.appointment_date), "HH:mm")}</td>
                            <td className="py-1" style={{ color: "#000000", fontWeight: "normal" }}>{group.locationOverride || apt.medical_experts?.practice_address || "TBD"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Supporting Document Attachments */}
                  <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">Supporting Documents</span>
                      {group.selectedDocuments.length > 0 && (
                        <Badge variant="secondary" className="text-xs">{group.selectedDocuments.length} attached</Badge>
                      )}
                    </div>

                    {group.availableDocuments.length > 0 && (
                      <div className="max-h-28 overflow-y-auto space-y-1">
                        {group.availableDocuments.map((doc: any) => (
                          <label key={doc.id} className="flex items-center gap-2 p-1.5 hover:bg-muted/50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={group.selectedDocuments.includes(doc.id)}
                              onChange={() => toggleExpertDocument(idx, doc.id)}
                              className="rounded"
                            />
                            <span className="text-xs text-foreground truncate">{doc.file_name}</span>
                            <span className="text-xs text-muted-foreground">({doc.document_type})</span>
                          </label>
                        ))}
                      </div>
                    )}

                    <div className="border-t border-border pt-2 space-y-1">
                      <p className="text-xs text-muted-foreground">Upload documents (multiple files):</p>
                      <div className="flex items-center gap-2">
                        <input
                          ref={(el) => { fileInputRefs.current[idx] = el; }}
                          type="file"
                          multiple
                          onChange={(e) => handleBulkFileSelect(idx, e)}
                          className="hidden"
                        />
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileInputRefs.current[idx]?.click()} disabled={uploadingGroupIdx === idx}>
                          <Upload className="h-3 w-3 mr-1" />
                          Choose Files
                        </Button>
                        {(pendingFiles[idx]?.length || 0) > 0 && (
                          <Button size="sm" className="h-7 text-xs" onClick={() => handleBulkUpload(idx)} disabled={uploadingGroupIdx === idx}>
                            {uploadingGroupIdx === idx ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                            Upload {pendingFiles[idx].length} file(s)
                          </Button>
                        )}
                      </div>
                      {(pendingFiles[idx]?.length || 0) > 0 && (
                        <div className="space-y-1">
                          {pendingFiles[idx].map((file, fIdx) => (
                            <div key={fIdx} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1">
                              <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate flex-1">{file.name}</span>
                              <span className="text-muted-foreground shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                              <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => removePendingFile(idx, fIdx)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>Single PDF with all {group.appointments.length} patient(s) data will be attached</span>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mr-auto">
            <Badge variant="secondary">
              {[sendToAttorney && `${attorneyGroups.length} attorney group${attorneyGroups.length !== 1 ? "s" : ""}`, sendToExpert && `${expertGroups.length} expert group${expertGroups.length !== 1 ? "s" : ""}`].filter(Boolean).join(" + ") || "No recipients selected"}
            </Badge>
          </div>
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button onClick={handleSendBulk} disabled={sending || loading || (!sendToAttorney && !sendToExpert)}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending Groups...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send to {[sendToAttorney && "Attorneys", sendToExpert && "Experts"].filter(Boolean).join(" & ") || "..."}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkConfirmationPreviewDialog;
