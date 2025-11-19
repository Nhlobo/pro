import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface BulkAppointmentEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: Array<{
    id: string;
    claimant_name: string;
    expert_name: string;
    appointment_date: string;
    referring_attorney: string;
    referring_attorney_id: string;
  }>;
  onSuccess?: () => void;
}

export const BulkAppointmentEmailDialog: React.FC<BulkAppointmentEmailDialogProps> = ({
  isOpen,
  onClose,
  appointments,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [selectedAppointments, setSelectedAppointments] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [attorneyEmail, setAttorneyEmail] = useState("");
  const [attorneyCc, setAttorneyCc] = useState("");

  // Group appointments by referring attorney
  const groupedAppointments = React.useMemo(() => {
    const groups: Record<string, typeof appointments> = {};
    appointments.forEach(apt => {
      if (!groups[apt.referring_attorney_id]) {
        groups[apt.referring_attorney_id] = [];
      }
      groups[apt.referring_attorney_id].push(apt);
    });
    return groups;
  }, [appointments]);

  const handleToggleAppointment = (appointmentId: string) => {
    setSelectedAppointments(prev =>
      prev.includes(appointmentId)
        ? prev.filter(id => id !== appointmentId)
        : [...prev, appointmentId]
    );
  };

  const handleToggleAttorneyGroup = (attorneyId: string) => {
    const attorneyAppointments = groupedAppointments[attorneyId].map(a => a.id);
    const allSelected = attorneyAppointments.every(id => selectedAppointments.includes(id));
    
    if (allSelected) {
      setSelectedAppointments(prev => prev.filter(id => !attorneyAppointments.includes(id)));
    } else {
      setSelectedAppointments(prev => [...new Set([...prev, ...attorneyAppointments])]);
    }
  };

  const handleSendEmails = async () => {
    if (selectedAppointments.length === 0) {
      toast({
        title: "No Appointments Selected",
        description: "Please select at least one appointment to send confirmation.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSending(true);
      
      // Send confirmation for each selected appointment
      const results = await Promise.allSettled(
        selectedAppointments.map(appointmentId =>
          supabase.functions.invoke('send-appointment-confirmation', {
            body: {
              appointmentId,
              attorneyEmail: attorneyEmail.trim() || undefined,
              attorneyCc: attorneyCc.trim() || undefined,
            }
          })
        )
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (succeeded > 0) {
        toast({
          title: "Success",
          description: `${succeeded} appointment confirmation${succeeded > 1 ? 's' : ''} sent successfully${failed > 0 ? `. ${failed} failed.` : ''}`,
        });
      }

      if (failed === results.length) {
        throw new Error('All emails failed to send');
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error sending bulk emails:', error);
      toast({
        title: "Error",
        description: "Failed to send confirmation emails",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Bulk Appointment Confirmations
          </DialogTitle>
          <DialogDescription>
            Select appointments to send confirmation emails. Appointments are grouped by referring attorney.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Attorney Email (optional - override):</label>
            <Input
              type="email"
              value={attorneyEmail}
              onChange={(e) => setAttorneyEmail(e.target.value)}
              placeholder="Leave empty to use attorney's default email"
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">CC (optional):</label>
            <Input
              type="text"
              value={attorneyCc}
              onChange={(e) => setAttorneyCc(e.target.value)}
              placeholder="Additional emails (comma-separated)"
              className="w-full"
            />
          </div>

          {Object.entries(groupedAppointments).map(([attorneyId, attorneyAppts]) => {
            const allSelected = attorneyAppts.every(apt => selectedAppointments.includes(apt.id));
            const someSelected = attorneyAppts.some(apt => selectedAppointments.includes(apt.id));

            return (
              <div key={attorneyId} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => handleToggleAttorneyGroup(attorneyId)}
                    className={someSelected && !allSelected ? "opacity-50" : ""}
                  />
                  <div>
                    <h3 className="font-semibold text-foreground">{attorneyAppts[0].referring_attorney}</h3>
                    <p className="text-sm text-muted-foreground">{attorneyAppts.length} appointment(s)</p>
                  </div>
                </div>

                <div className="ml-6 space-y-2">
                  {attorneyAppts.map(apt => (
                    <div key={apt.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                      <Checkbox
                        checked={selectedAppointments.includes(apt.id)}
                        onCheckedChange={() => handleToggleAppointment(apt.id)}
                      />
                      <div className="flex-1 text-sm">
                        <span className="font-medium">{apt.claimant_name}</span>
                        <span className="text-muted-foreground"> - {apt.expert_name}</span>
                        <span className="text-muted-foreground"> ({new Date(apt.appointment_date).toLocaleDateString()})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSendEmails} disabled={sending || selectedAppointments.length === 0}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              `Send ${selectedAppointments.length} Confirmation${selectedAppointments.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
