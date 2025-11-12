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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, FileText } from "lucide-react";
import { format } from "date-fns";

interface AppointmentEmailPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  onConfirmSend?: () => void;
}

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

  useEffect(() => {
    if (isOpen && appointmentId) {
      fetchAppointmentDetails();
    }
  }, [isOpen, appointmentId]);

  const fetchAppointmentDetails = async () => {
    try {
      setLoading(true);
      
      const { data: appointment, error } = await supabase
        .from('appointments')
        .select(`
          *,
          claimants (
            auto_id,
            first_name,
            last_name,
            date_of_birth
          ),
          medical_experts (
            first_name,
            last_name,
            email,
            practice_address,
            expert_type
          ),
          referring_attorneys (
            name,
            email,
            contact_person
          )
        `)
        .eq('id', appointmentId)
        .single();

      if (error) throw error;
      setAppointmentDetails(appointment);
    } catch (error) {
      console.error('Error fetching appointment details:', error);
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
      
      const { error } = await supabase.functions.invoke('send-appointment-confirmation', {
        body: { appointmentId }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Appointment confirmation emails sent successfully",
      });

      onConfirmSend?.();
      onClose();
    } catch (error) {
      console.error('Error sending emails:', error);
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
    return format(new Date(date), "EEEE, dd MMMM yyyy 'at' HH:mm");
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

  // Parse multiple emails if provided
  const parseEmails = (emailField: string | string[] | undefined): string[] => {
    if (!emailField) return [];
    if (typeof emailField === 'string') {
      return emailField
        .split(/[,;|]/)
        .map(email => email.trim())
        .filter(email => email && email.includes('@'));
    }
    if (Array.isArray(emailField)) {
      return emailField.filter(email => email && email.includes('@'));
    }
    return [];
  };

  const attorneyEmails = parseEmails(attorney?.email);
  const expertEmails = parseEmails(expert?.email);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Preview - Appointment Confirmation
          </DialogTitle>
          <DialogDescription>
            Review the email content before sending to the attorney and medical expert
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="attorney" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="attorney">Attorney Email</TabsTrigger>
            <TabsTrigger value="expert">Expert Email</TabsTrigger>
          </TabsList>

          <TabsContent value="attorney" className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">To:</p>
                {attorneyEmails.length > 0 ? (
                  <div className="space-y-1">
                    {attorneyEmails.map((email, index) => (
                      <p key={index} className="text-sm">{email}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-destructive">No email provided</p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Subject:</p>
                <p className="text-sm font-semibold">Appointment Confirmation - {claimant?.first_name} {claimant?.last_name}</p>
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
                <p className="text-sm text-foreground">
                  This is to confirm the scheduled assessment appointment:
                </p>
                
                <div className="bg-muted/50 rounded-md p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="font-medium text-foreground">Claimant:</span>
                    <span className="text-foreground">{claimant?.first_name} {claimant?.last_name} ({claimant?.auto_id})</span>
                    
                    <span className="font-medium text-foreground">Date & Time:</span>
                    <span className="text-foreground">{formatAppointmentDate(appointmentDetails.appointment_date)}</span>
                    
                    <span className="font-medium text-foreground">Expert:</span>
                    <span className="text-foreground">Dr. {expert?.first_name} {expert?.last_name}</span>
                    
                    <span className="font-medium text-foreground">Expert Type:</span>
                    <span className="text-foreground">{expert?.expert_type}</span>
                    
                    <span className="font-medium text-foreground">Location:</span>
                    <span className="text-foreground">{expert?.practice_address}</span>
                    
                    {appointmentDetails.matter_type && (
                      <>
                        <span className="font-medium text-foreground">Matter Type:</span>
                        <span className="text-foreground">{appointmentDetails.matter_type}</span>
                      </>
                    )}
                    
                    {appointmentDetails.service_fee && (
                      <>
                        <span className="font-medium text-foreground">Service Fee:</span>
                        <span className="text-foreground">R {appointmentDetails.service_fee}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-4">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2">Important Requirements:</p>
                <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1 list-disc list-inside">
                  <li>Please ensure the claimant arrives 15 minutes before the appointment</li>
                  <li>Bring all relevant medical records and documentation</li>
                  <li>Valid ID is required</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-sm text-foreground">Best regards,</p>
                <p className="text-sm font-medium text-foreground">Kutlwano & Associate Team</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                <FileText className="h-3 w-3" />
                <span>PDF attachment with full appointment details will be included</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="expert" className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">To:</p>
                {expertEmails.length > 0 ? (
                  <div className="space-y-1">
                    {expertEmails.map((email, index) => (
                      <p key={index} className="text-sm">{email}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-destructive">No email provided</p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Subject:</p>
                <p className="text-sm font-semibold">New Assessment Appointment - {claimant?.first_name} {claimant?.last_name}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="border-b border-border pb-4">
                <h3 className="text-lg font-semibold text-foreground">Kutlwano & Associate</h3>
                <p className="text-sm text-muted-foreground">Medico-Legal Assessment Services</p>
              </div>

              <div>
                <p className="text-sm text-foreground">Dear Dr. {expert?.last_name},</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-foreground">
                  You have been assigned a new assessment appointment:
                </p>
                
                <div className="bg-muted/50 rounded-md p-4 space-y-2">
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
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Please Note:</p>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                  <li>Confirm your availability for this appointment</li>
                  <li>Notify us immediately if you need to reschedule</li>
                  <li>Review any case materials provided in advance</li>
                </ul>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-sm text-foreground">Best regards,</p>
                <p className="text-sm font-medium text-foreground">Kutlwano & Associate Team</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
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
