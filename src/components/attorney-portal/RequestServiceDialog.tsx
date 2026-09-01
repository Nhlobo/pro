import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type ServiceRequestType = 'appointment' | 'addendum' | 'affidavit' | 'joint_minutes';

const LABELS: Record<ServiceRequestType, string> = {
  appointment: 'Appointment',
  addendum: 'Addendum',
  affidavit: 'Affidavit',
  joint_minutes: 'Joint Minute',
};

const DESCRIPTION_HINT: Record<ServiceRequestType, string> = {
  appointment: 'Any preferences or additional information for scheduling this appointment (e.g. preferred dates, urgency).',
  addendum: 'Describe what the addendum should address (e.g. a specific finding, updated records, or a point requiring clarification).',
  affidavit: 'Describe the purpose of the affidavit and what it needs to confirm.',
  joint_minutes: 'Describe the matter and the other expert(s) involved, if known.',
};

interface RequestServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceType: ServiceRequestType | null;
  claimantName: string;
  caseReference?: string; // appointment id
  /**
   * 'guest': submitted via an access-code link (no auth.users row) — only
   *   supports addendum / affidavit / joint_minutes, via the
   *   submit-litigation-service-request edge function. Request Appointment
   *   in guest contexts has its own existing flow
   *   (ProfileRequestAppointment.tsx) and does not use this dialog.
   * 'authenticated': submitted by a logged-in attorney-portal user — inserts
   *   directly (RLS already allows this: requested_by = auth.uid()).
   *   Supports all four service types, including 'appointment'.
   */
  mode: 'guest' | 'authenticated';
  accessCode?: string; // required when mode === 'guest'
}

/**
 * Submits Appointment / Addendum / Affidavit / Joint Minute requests against
 * an existing case.
 *
 * Addendum / Affidavit / Joint Minute go to public.litigation_service_requests
 * (case-management service requests), NOT appointment_requests — they must
 * not be picked up by the appointment_requests -> appointments sync, which
 * is reserved for actual new expert bookings.
 *
 * Appointment requests (authenticated mode only) go to
 * public.appointment_requests, the same table/flow used elsewhere in the
 * portal.
 *
 * Staff review service requests on the existing "Litigation Service
 * Requests" admin page (AdminLitigationRequests.tsx).
 */
export default function RequestServiceDialog({
  open,
  onOpenChange,
  serviceType,
  claimantName,
  caseReference,
  mode,
  accessCode,
}: RequestServiceDialogProps) {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('standard');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDescription('');
      setUrgency('standard');
    }
  }, [open, serviceType]);

  if (!serviceType) return null;
  const label = LABELS[serviceType];

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (mode === 'guest') {
        if (serviceType === 'appointment') {
          throw new Error('Use the existing Request Appointment flow for guest access.');
        }
        if (!accessCode) throw new Error('Missing access code.');

        const { data, error } = await supabase.functions.invoke('submit-litigation-service-request', {
          body: {
            access_code: accessCode,
            service_type: serviceType,
            claimant_name: claimantName,
            case_reference: caseReference || null,
            description: description.trim() || null,
            urgency,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } else {
        if (!user) throw new Error('You must be signed in to submit this request.');

        const { data: profile } = await supabase
          .from('profiles')
          .select('referring_attorney_id')
          .eq('id', user.id)
          .single();

        if (!profile?.referring_attorney_id) {
          throw new Error('No referring attorney linked to your profile.');
        }

        if (serviceType === 'appointment') {
          const { data: attorney } = await supabase
            .from('referring_attorneys')
            .select('name')
            .eq('id', profile.referring_attorney_id)
            .single();

          const { error } = await supabase.from('appointment_requests').insert({
            claimant_first_name: claimantName.split(' ')[0] || claimantName,
            claimant_last_name: claimantName.split(' ').slice(1).join(' ') || '—',
            matter_type: 'other',
            expert_type_requested: 'Follow-up / to be confirmed',
            province: 'Gauteng',
            preferred_date_type: 'any',
            additional_notes: `[Requested against existing case${caseReference ? ` ${caseReference}` : ''}] ${description.trim()}`,
            referring_attorney_id: profile.referring_attorney_id,
            referring_attorney_name: attorney?.name || 'Unknown',
            requested_by: user.id,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.from('litigation_service_requests').insert({
            service_type: serviceType,
            claimant_name: claimantName,
            case_reference: caseReference || null,
            urgency,
            description: description.trim() || null,
            referring_attorney_id: profile.referring_attorney_id,
            requested_by: user.id,
            status: 'pending',
          });
          if (error) throw error;
        }
      }

      toast.success(`${label} request submitted`, {
        description: 'Our team has been notified and will action this shortly.',
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Failed to submit request', {
        description: err.message || 'Please try again or contact us directly.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request {label}</DialogTitle>
          <DialogDescription>
            {claimantName ? `For claimant: ${claimantName}` : 'Please provide details for this request.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {serviceType !== 'appointment' && (
            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (5-7 business days)</SelectItem>
                  <SelectItem value="urgent">Urgent (2-3 business days)</SelectItem>
                  <SelectItem value="critical">Critical (24-48 hours)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Details</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={DESCRIPTION_HINT[serviceType]}
              rows={5}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
