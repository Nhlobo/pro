import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ServiceRequestType = 'addendum' | 'affidavit' | 'joint_minutes';

const LABELS: Record<ServiceRequestType, string> = {
  addendum: 'Addendum',
  affidavit: 'Affidavit',
  joint_minutes: 'Joint Minute',
};

const DESCRIPTION_HINT: Record<ServiceRequestType, string> = {
  addendum: 'Describe what the addendum should address (e.g. a specific finding, updated records, or a point requiring clarification).',
  affidavit: 'Describe the purpose of the affidavit and what it needs to confirm.',
  joint_minutes: 'Describe the matter and the other expert(s) involved, if known.',
};

interface RequestServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceType: ServiceRequestType | null;
  accessCode: string;
  claimantName: string;
  caseReference?: string; // appointment id, verified server-side against this attorney
}

/**
 * Submits Addendum / Affidavit / Joint Minute requests to
 * public.litigation_service_requests (via the submit-litigation-service-request
 * edge function), NOT to appointment_requests. These are case-management
 * service requests against an existing case, not new expert bookings, and
 * must not be picked up by the appointment_requests -> appointments sync.
 *
 * Staff review these on the existing "Litigation Service Requests" admin
 * page (AdminLitigationRequests.tsx), which already handles joint_minutes
 * and now also addendum / affidavit.
 */
export default function RequestServiceDialog({
  open,
  onOpenChange,
  serviceType,
  accessCode,
  claimantName,
  caseReference,
}: RequestServiceDialogProps) {
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
