import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarClock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BRAND_TEAL } from '@/components/admin/ui/AdminUI';

/**
 * Client request (#2): "All AOD must allow extension of Agreement with new
 * date when the contract is ending, and new extension must have option of
 * extension with new Appointment (this means the value of the contract will
 * change), just an Extension of Payment only, or both reason."
 *
 * Every extension is written to agreement_extensions first (permanent
 * record of what changed and why — an AOD is a legal debt instrument, so
 * the original terms and every amendment need to stay on record) and only
 * then applied to the parent aod_documents/short_term_agreements row.
 */

interface AgreementExtensionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agreementId: string;
  agreementType: 'aod' | 'short_term';
  attorneyName: string;
  referringAttorneyId: string;
  onExtended: () => void;
}

interface AppointmentOption {
  id: string;
  claimantName: string;
  expertType: string;
  appointmentDate: string;
  serviceFee: number;
}

type ExtensionType = 'payment_only' | 'new_appointment' | 'both';

export const AgreementExtensionDialog: React.FC<AgreementExtensionDialogProps> = ({
  open,
  onOpenChange,
  agreementId,
  agreementType,
  attorneyName,
  referringAttorneyId,
  onExtended,
}) => {
  const table = agreementType === 'aod' ? 'aod_documents' : 'short_term_agreements';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentEndDate, setCurrentEndDate] = useState<string | null>(null);
  const [currentValue, setCurrentValue] = useState(0);
  const [existingAppointmentIds, setExistingAppointmentIds] = useState<string[]>([]);
  const [appointmentOptions, setAppointmentOptions] = useState<AppointmentOption[]>([]);
  const [history, setHistory] = useState<Array<{
    id: string; extension_type: string; previous_end_date: string | null;
    new_end_date: string; value_change_amount: number; created_at: string;
  }>>([]);

  const [extensionType, setExtensionType] = useState<ExtensionType>('payment_only');
  const [newEndDate, setNewEndDate] = useState('');
  const [valueChangeAmount, setValueChangeAmount] = useState('');
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open || !agreementId) return;

    const load = async () => {
      setLoading(true);
      try {
        const { data: agreement } = await supabase
          .from(table)
          .select('contract_end_date, total_contract_value, linked_appointment_ids')
          .eq('id', agreementId)
          .single();

        setCurrentEndDate(agreement?.contract_end_date || null);
        setCurrentValue(Number(agreement?.total_contract_value) || 0);
        const linkedIds = ((agreement as any)?.linked_appointment_ids || []) as string[];
        setExistingAppointmentIds(linkedIds);

        // Appointments for this attorney not already linked to this
        // agreement — candidates for the "new appointment" extension type.
        const { data: appointments } = await supabase
          .from('appointments')
          .select('id, appointment_date, service_fee, claimants (first_name, last_name), medical_experts (expert_type)')
          .eq('referring_attorney_id', referringAttorneyId)
          .is('deleted_at', null)
          .order('appointment_date', { ascending: false })
          .limit(100);

        const options: AppointmentOption[] = (appointments || [])
          .filter(a => !linkedIds.includes(a.id))
          .map(a => {
            const claimant = a.claimants as any;
            const expert = a.medical_experts as any;
            return {
              id: a.id,
              claimantName: claimant ? `${claimant.first_name} ${claimant.last_name}` : 'Unknown claimant',
              expertType: expert?.expert_type || 'N/A',
              appointmentDate: a.appointment_date,
              serviceFee: a.service_fee || 0,
            };
          });
        setAppointmentOptions(options);

        const { data: pastExtensions } = await supabase
          .from('agreement_extensions')
          .select('id, extension_type, previous_end_date, new_end_date, value_change_amount, created_at')
          .eq('agreement_type', agreementType)
          .eq('agreement_id', agreementId)
          .order('created_at', { ascending: false });
        setHistory(pastExtensions || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, agreementId, agreementType, referringAttorneyId, table]);

  const toggleAppointment = (id: string) => {
    setSelectedAppointmentIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedAppointments = appointmentOptions.filter(a => selectedAppointmentIds.has(a.id));
  const selectedAppointmentsFeeTotal = selectedAppointments.reduce((s, a) => s + a.serviceFee, 0);

  // When appointments are selected, their combined fee is the natural
  // starting point for the value change — staff can still override it
  // manually (e.g. a negotiated rate different from the standard fee).
  useEffect(() => {
    if (extensionType !== 'payment_only' && selectedAppointments.length > 0) {
      setValueChangeAmount(String(selectedAppointmentsFeeTotal));
    }
  }, [selectedAppointmentIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const isValid = () => {
    if (!newEndDate) return false;
    if (extensionType !== 'payment_only') {
      const amount = parseFloat(valueChangeAmount);
      if (!amount || amount <= 0) return false;
    }
    return true;
  };

  const resetForm = () => {
    setExtensionType('payment_only');
    setNewEndDate('');
    setValueChangeAmount('');
    setSelectedAppointmentIds(new Set());
    setReason('');
  };

  const handleSubmit = async () => {
    if (!isValid()) {
      toast.error(extensionType === 'payment_only'
        ? 'Enter the new end date'
        : 'Enter the new end date and the value being added');
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const valueChange = extensionType === 'payment_only' ? 0 : parseFloat(valueChangeAmount) || 0;
      const newAppointmentIds = extensionType === 'payment_only' ? [] : Array.from(selectedAppointmentIds);

      const { error: extError } = await supabase.from('agreement_extensions').insert({
        agreement_id: agreementId,
        agreement_type: agreementType,
        extension_type: extensionType,
        previous_end_date: currentEndDate,
        new_end_date: newEndDate,
        value_change_amount: valueChange,
        new_appointment_ids: newAppointmentIds,
        reason: reason.trim() || null,
        created_by: userData.user?.id || null,
      });
      if (extError) throw extError;

      const updatePayload: Record<string, unknown> = {
        contract_end_date: newEndDate,
        updated_at: new Date().toISOString(),
      };
      if (valueChange > 0) {
        updatePayload.total_contract_value = currentValue + valueChange;
      }
      if (newAppointmentIds.length > 0) {
        updatePayload.linked_appointment_ids = [...new Set([...existingAppointmentIds, ...newAppointmentIds])];
      }

      const { error: updateError } = await supabase.from(table).update(updatePayload).eq('id', agreementId);
      if (updateError) throw updateError;

      toast.success(
        extensionType === 'payment_only'
          ? `Agreement extended to ${format(new Date(newEndDate), 'dd MMM yyyy')}`
          : `Agreement extended to ${format(new Date(newEndDate), 'dd MMM yyyy')} — value increased by R${valueChange.toLocaleString()}`
      );
      window.dispatchEvent(new CustomEvent('agreement-data-updated', { detail: { agreementId, agreementType } }));
      resetForm();
      onExtended();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Extension error:', error);
      toast.error(error.message || 'Failed to extend agreement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-2xl"
      >
        <SheetHeader className="border-b border-black/10 px-4 py-4 text-left sm:px-6">
          <SheetTitle className="flex items-center gap-2 text-black">
            <CalendarClock className="h-5 w-5" style={{ color: BRAND_TEAL }} />
            Extend Agreement — {attorneyName}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Current end date: {currentEndDate ? format(new Date(currentEndDate), 'dd MMM yyyy') : 'Not set'} • Current value: R{currentValue.toLocaleString()}
          </p>
        </SheetHeader>

        <div className="flex-1 px-4 py-4 sm:px-6">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading agreement details...</div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs">Reason for extension</Label>
                <Select value={extensionType} onValueChange={(v) => setExtensionType(v as ExtensionType)}>
                  <SelectTrigger className="h-9 rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment_only">Extension of payment only (value unchanged)</SelectItem>
                    <SelectItem value="new_appointment">New appointment added (value increases)</SelectItem>
                    <SelectItem value="both">Both — new appointment and more time to pay</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">New end date *</Label>
                <Input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              {extensionType !== 'payment_only' && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs">Link the new appointment(s) (optional)</Label>
                    <p className="text-[10px] text-muted-foreground">
                      Selecting appointments below auto-fills the value added from their service fees — appointments
                      not yet booked can be left unselected and the value entered manually.
                    </p>
                    {appointmentOptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No unlinked appointments found for this attorney.</p>
                    ) : (
                      <div className="max-h-48 overflow-auto border rounded-none divide-y">
                        {appointmentOptions.map(a => (
                          <label key={a.id} className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-black/[0.02]">
                            <Checkbox checked={selectedAppointmentIds.has(a.id)} onCheckedChange={() => toggleAppointment(a.id)} />
                            <span className="flex-1 truncate">{a.claimantName} — {a.expertType}</span>
                            <span className="text-muted-foreground whitespace-nowrap">{format(new Date(a.appointmentDate), 'dd MMM yyyy')}</span>
                            <Badge variant="outline" className="text-[9px] rounded-none">R{a.serviceFee.toLocaleString()}</Badge>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">Value being added to the contract (R) *</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={valueChangeAmount}
                      onChange={(e) => setValueChangeAmount(e.target.value)}
                      placeholder="e.g. 8500"
                      className="mt-1"
                    />
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      New total contract value will be R{(currentValue + (parseFloat(valueChangeAmount) || 0)).toLocaleString()}
                    </p>
                  </div>
                </>
              )}

              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this agreement being extended?"
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !isValid()}
                  size="sm"
                  className="gradient-teal rounded-none border"
                >
                  {submitting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CalendarClock className="h-3 w-3 mr-1" />}
                  {submitting ? 'Extending...' : 'Extend Agreement'}
                </Button>
              </div>

              {history.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Extension history</p>
                    <div className="space-y-1.5">
                      {history.map(h => (
                        <div key={h.id} className="flex items-center justify-between text-[11px] border rounded-none px-2 py-1.5">
                          <span>
                            {h.extension_type === 'payment_only' ? 'Payment only' : h.extension_type === 'new_appointment' ? 'New appointment' : 'Both'}
                            {' → '}{format(new Date(h.new_end_date), 'dd MMM yyyy')}
                            {h.value_change_amount > 0 && ` (+R${h.value_change_amount.toLocaleString()})`}
                          </span>
                          <span className="text-muted-foreground">{format(new Date(h.created_at), 'dd MMM yyyy')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AgreementExtensionDialog;
