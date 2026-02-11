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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, FileText, Users, Stethoscope, Plus, X } from "lucide-react";
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
  date: string;
  appointments: AppointmentDetail[];
}

interface ExpertGroup {
  expertName: string;
  expertEmail: string;
  ccEmails: string[];
  expertType: string;
  date: string;
  appointments: AppointmentDetail[];
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

      // Group by attorney + date
      const attGroups: Record<string, AttorneyGroup> = {};
      (data || []).forEach((apt: any) => {
        const dateKey = format(new Date(apt.appointment_date), "yyyy-MM-dd");
        const key = `${apt.referring_attorney_id}_${dateKey}`;
        if (!attGroups[key]) {
          attGroups[key] = {
            attorneyName: apt.referring_attorneys?.name || apt.referring_attorney,
            attorneyEmail: apt.referring_attorneys?.email || "",
            ccEmails: [],
            date: dateKey,
            appointments: [],
          };
        }
        attGroups[key].appointments.push(apt);
      });
      setAttorneyGroups(Object.values(attGroups));

      // Group by expert + date
      const expGroups: Record<string, ExpertGroup> = {};
      (data || []).forEach((apt: any) => {
        const dateKey = format(new Date(apt.appointment_date), "yyyy-MM-dd");
        const expertName = `${apt.medical_experts?.first_name || ""} ${apt.medical_experts?.last_name || ""}`.trim();
        const key = `${expertName}_${dateKey}`;
        if (!expGroups[key]) {
          expGroups[key] = {
            expertName,
            expertEmail: apt.medical_experts?.email || "",
            ccEmails: [],
            expertType: apt.medical_experts?.expert_type || "",
            date: dateKey,
            appointments: [],
          };
        }
        expGroups[key].appointments.push(apt);
      });
      setExpertGroups(Object.values(expGroups));
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast({ title: "Error", description: "Failed to load appointment details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateAttorneyEmail = (idx: number, email: string) => {
    setAttorneyGroups(prev => prev.map((g, i) => i === idx ? { ...g, attorneyEmail: email } : g));
  };

  const addAttorneyCc = (idx: number) => {
    setAttorneyGroups(prev => prev.map((g, i) => i === idx ? { ...g, ccEmails: [...g.ccEmails, ""] } : g));
  };

  const updateAttorneyCc = (groupIdx: number, ccIdx: number, email: string) => {
    setAttorneyGroups(prev => prev.map((g, i) => i === groupIdx ? { ...g, ccEmails: g.ccEmails.map((e, j) => j === ccIdx ? email : e) } : g));
  };

  const removeAttorneyCc = (groupIdx: number, ccIdx: number) => {
    setAttorneyGroups(prev => prev.map((g, i) => i === groupIdx ? { ...g, ccEmails: g.ccEmails.filter((_, j) => j !== ccIdx) } : g));
  };

  const updateExpertEmail = (idx: number, email: string) => {
    setExpertGroups(prev => prev.map((g, i) => i === idx ? { ...g, expertEmail: email } : g));
  };

  const addExpertCc = (idx: number) => {
    setExpertGroups(prev => prev.map((g, i) => i === idx ? { ...g, ccEmails: [...g.ccEmails, ""] } : g));
  };

  const updateExpertCc = (groupIdx: number, ccIdx: number, email: string) => {
    setExpertGroups(prev => prev.map((g, i) => i === groupIdx ? { ...g, ccEmails: g.ccEmails.map((e, j) => j === ccIdx ? email : e) } : g));
  };

  const removeExpertCc = (groupIdx: number, ccIdx: number) => {
    setExpertGroups(prev => prev.map((g, i) => i === groupIdx ? { ...g, ccEmails: g.ccEmails.filter((_, j) => j !== ccIdx) } : g));
  };

  const handleSendBulk = async () => {
    try {
      setSending(true);

      // Send grouped attorney emails
      for (const group of attorneyGroups) {
        const ccList = group.ccEmails.filter(e => e.trim());
        const { error } = await supabase.functions.invoke("send-appointment-confirmation", {
          body: {
            appointmentId: group.appointments[0].id,
            attorneyEmail: group.attorneyEmail,
            attorneyCc: ccList.length > 0 ? ccList.join(', ') : undefined,
            bulkAppointmentIds: group.appointments.map((a) => a.id),
          },
        });
        if (error) {
          console.error("Error sending attorney group email:", error);
        }
      }

      // Send grouped expert emails
      for (const group of expertGroups) {
        const ccList = group.ccEmails.filter(e => e.trim());
        const { error } = await supabase.functions.invoke("send-appointment-confirmation", {
          body: {
            appointmentId: group.appointments[0].id,
            expertEmail: group.expertEmail,
            expertCc: ccList.length > 0 ? ccList.join(', ') : undefined,
            bulkExpertMode: true,
            bulkAppointmentIds: group.appointments.map((a) => a.id),
          },
        });
        if (error) {
          console.error("Error sending expert group email:", error);
        }
      }

      toast({
        title: "Bulk Emails Sent",
        description: `Sent ${attorneyGroups.length} attorney group(s) and ${expertGroups.length} expert group(s) successfully.`,
      });

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
            Appointments are grouped by referring attorney + date and by expert + date. Each group receives one consolidated email with a single PDF listing all patients.
          </DialogDescription>
        </DialogHeader>

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
              {attorneyGroups.map((group, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">{group.attorneyName}</h3>
                    <div className="text-right">
                      <Badge variant="secondary">{format(new Date(group.date), "dd MMM yyyy")}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {group.appointments.length} claimant{group.appointments.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">To</Label>
                      <Input value={group.attorneyEmail} onChange={(e) => updateAttorneyEmail(idx, e.target.value)} placeholder="Attorney email" className="h-8 text-sm" />
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
                          <Input value={cc} onChange={(e) => updateAttorneyCc(idx, ccIdx, e.target.value)} placeholder="CC email address" className="h-8 text-sm" />
                          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => removeAttorneyCc(idx, ccIdx)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Claimants in this letter:</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="pb-1 font-medium">#</th>
                          <th className="pb-1 font-medium">Auto ID</th>
                          <th className="pb-1 font-medium">Claimant</th>
                          <th className="pb-1 font-medium">Expert Type</th>
                          <th className="pb-1 font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.appointments.map((apt, i) => (
                          <tr key={apt.id} className="border-b border-border/50">
                            <td className="py-1">{i + 1}</td>
                            <td className="py-1">
                              <Badge variant="outline" className="text-xs">{apt.claimants?.auto_id}</Badge>
                            </td>
                            <td className="py-1">{apt.claimants?.first_name} {apt.claimants?.last_name}</td>
                            <td className="py-1">{apt.medical_experts?.expert_type}</td>
                            <td className="py-1">{format(new Date(apt.appointment_date), "HH:mm")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>One consolidated PDF with all {group.appointments.length} appointment(s) will be attached</span>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="expert" className="space-y-4 mt-4">
              {expertGroups.map((group, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Dr. {group.expertName || group.expertType}</h3>
                    <div className="text-right">
                      <Badge variant="secondary">{format(new Date(group.date), "dd MMM yyyy")}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {group.appointments.length} patient{group.appointments.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">To</Label>
                      <Input value={group.expertEmail} onChange={(e) => updateExpertEmail(idx, e.target.value)} placeholder="Expert email" className="h-8 text-sm" />
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
                          <Input value={cc} onChange={(e) => updateExpertCc(idx, ccIdx, e.target.value)} placeholder="CC email address" className="h-8 text-sm" />
                          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => removeExpertCc(idx, ccIdx)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Patients in this PDF:</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="pb-1 font-medium">#</th>
                          <th className="pb-1 font-medium">Patient</th>
                          <th className="pb-1 font-medium">Attorney</th>
                          <th className="pb-1 font-medium">Matter Type</th>
                          <th className="pb-1 font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.appointments.map((apt, i) => (
                          <tr key={apt.id} className="border-b border-border/50">
                            <td className="py-1">{i + 1}</td>
                            <td className="py-1">{apt.claimants?.first_name} {apt.claimants?.last_name}</td>
                            <td className="py-1">{apt.referring_attorneys?.name}</td>
                            <td className="py-1">{apt.matter_type || "General"}</td>
                            <td className="py-1">{format(new Date(apt.appointment_date), "HH:mm")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
              {attorneyGroups.length} attorney group{attorneyGroups.length !== 1 ? "s" : ""} + {expertGroups.length} expert group{expertGroups.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button onClick={handleSendBulk} disabled={sending || loading}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending Groups...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send All Groups
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
