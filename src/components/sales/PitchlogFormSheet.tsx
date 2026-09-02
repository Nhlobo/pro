import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  PitchlogEntry,
  PitchlogFormInput,
  PITCH_STATUSES,
  PRACTICE_AREAS,
  ATTORNEY_TYPES,
  PROVINCES,
} from '@/hooks/useAttorneyPitchlog';
import type { SalesConsultant } from '@/hooks/useSalesIncentives';

interface PitchlogFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingEntry: PitchlogEntry | null;
  saving: boolean;
  onSave: (id: string | null, input: PitchlogFormInput) => Promise<boolean>;
  referringAttorneys: { id: string; name: string }[];
  /** Sales consultants only ever log against themselves (matches the RLS
   *  insert/update policies), so the field is locked and pre-filled rather
   *  than shown as a selector. Admins pick from the full team. */
  isAdmin: boolean;
  ownConsultant: SalesConsultant | null;
  allConsultants: SalesConsultant[];
}

const emptyForm = (ownConsultant: SalesConsultant | null): PitchlogFormInput => ({
  law_firm_name: '',
  contact_person: '',
  email: '',
  telephone: '',
  province: '',
  practice_area: '',
  attorney_type: '',
  pitch_status: 'Pitched',
  follow_up_date: null,
  identified_challenge: '',
  meeting_function: '',
  comment: '',
  deal_closed: false,
  deal_closed_date: null,
  matched_referring_attorney_id: null,
  consultant_id: ownConsultant?.id || null,
  sales_person: ownConsultant?.name || '',
});

const PitchlogFormSheet: React.FC<PitchlogFormSheetProps> = ({
  open,
  onOpenChange,
  editingEntry,
  saving,
  onSave,
  referringAttorneys,
  isAdmin,
  ownConsultant,
  allConsultants,
}) => {
  const [form, setForm] = useState<PitchlogFormInput>(() => emptyForm(ownConsultant));

  useEffect(() => {
    if (!open) return;
    if (editingEntry) {
      setForm({
        law_firm_name: editingEntry.law_firm_name || '',
        contact_person: editingEntry.contact_person || '',
        email: editingEntry.email || '',
        telephone: editingEntry.telephone || '',
        province: editingEntry.province || '',
        practice_area: editingEntry.practice_area || '',
        attorney_type: editingEntry.attorney_type || '',
        pitch_status: editingEntry.pitch_status || 'Pitched',
        follow_up_date: editingEntry.follow_up_date,
        identified_challenge: editingEntry.identified_challenge || '',
        meeting_function: editingEntry.meeting_function || '',
        comment: editingEntry.comment || '',
        deal_closed: !!editingEntry.deal_closed,
        deal_closed_date: editingEntry.deal_closed_date,
        matched_referring_attorney_id: editingEntry.matched_referring_attorney_id,
        consultant_id: editingEntry.consultant_id,
        sales_person: editingEntry.sales_person,
      });
    } else {
      setForm(emptyForm(ownConsultant));
    }
  }, [open, editingEntry, ownConsultant]);

  const set = <K extends keyof PitchlogFormInput>(key: K, value: PitchlogFormInput[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleConsultantChange = (consultantId: string) => {
    const c = allConsultants.find(c => c.id === consultantId);
    set('consultant_id', consultantId);
    set('sales_person', c?.name || '');
  };

  const isValid =
    form.law_firm_name.trim() &&
    form.contact_person.trim() &&
    form.province &&
    form.practice_area &&
    form.attorney_type &&
    form.sales_person.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    const ok = await onSave(editingEntry?.id || null, form);
    if (ok) onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editingEntry ? 'Edit Pitch' : 'Log New Pitch'}</SheetTitle>
          <SheetDescription>
            {editingEntry
              ? `Update the pitch record for ${editingEntry.law_firm_name}.`
              : 'Record a new attorney pitch and track it through follow-up.'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {isAdmin && (
            <div className="space-y-1.5">
              <Label>Consultant</Label>
              <Select value={form.consultant_id || ''} onValueChange={handleConsultantChange}>
                <SelectTrigger className="rounded-none">
                  <SelectValue placeholder="Select consultant" />
                </SelectTrigger>
                <SelectContent>
                  {allConsultants.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="law_firm_name">Law firm name *</Label>
            <Input
              id="law_firm_name"
              className="rounded-none"
              value={form.law_firm_name}
              onChange={e => set('law_firm_name', e.target.value)}
              placeholder="e.g. Smith & Associates"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact_person">Contact person *</Label>
              <Input
                id="contact_person"
                className="rounded-none"
                value={form.contact_person}
                onChange={e => set('contact_person', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meeting_function">Their role</Label>
              <Input
                id="meeting_function"
                className="rounded-none"
                value={form.meeting_function || ''}
                onChange={e => set('meeting_function', e.target.value)}
                placeholder="e.g. Managing Partner"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                className="rounded-none"
                value={form.email || ''}
                onChange={e => set('email', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telephone">Telephone</Label>
              <Input
                id="telephone"
                className="rounded-none"
                value={form.telephone || ''}
                onChange={e => set('telephone', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Province *</Label>
              <Select value={form.province} onValueChange={v => set('province', v)}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="Select province" /></SelectTrigger>
                <SelectContent>
                  {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Practice area *</Label>
              <Select value={form.practice_area} onValueChange={v => set('practice_area', v)}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="Select area" /></SelectTrigger>
                <SelectContent>
                  {PRACTICE_AREAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Attorney type *</Label>
              <Select value={form.attorney_type} onValueChange={v => set('attorney_type', v)}>
                <SelectTrigger className="rounded-none"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {ATTORNEY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pitch status</Label>
              <Select value={form.pitch_status} onValueChange={v => set('pitch_status', v)}>
                <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PITCH_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Follow-up date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start rounded-none text-left font-normal', !form.follow_up_date && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.follow_up_date ? format(new Date(form.follow_up_date), 'PPP') : 'No follow-up scheduled'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={form.follow_up_date ? new Date(form.follow_up_date) : undefined}
                  onSelect={d => set('follow_up_date', d ? format(d, 'yyyy-MM-dd') : null)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Link to existing referring attorney</Label>
            <Select
              value={form.matched_referring_attorney_id || 'none'}
              onValueChange={v => set('matched_referring_attorney_id', v === 'none' ? null : v)}
            >
              <SelectTrigger className="rounded-none"><SelectValue placeholder="Not linked" /></SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="none">Not linked</SelectItem>
                {referringAttorneys.map(ra => (
                  <SelectItem key={ra.id} value={ra.id}>{ra.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Linking lets closed deals from this firm count toward your stats automatically.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="identified_challenge">Identified challenge</Label>
            <Textarea
              id="identified_challenge"
              className="rounded-none"
              rows={2}
              value={form.identified_challenge || ''}
              onChange={e => set('identified_challenge', e.target.value)}
              placeholder="What problem is this firm looking to solve?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comment">Notes</Label>
            <Textarea
              id="comment"
              className="rounded-none"
              rows={3}
              value={form.comment || ''}
              onChange={e => set('comment', e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between border border-black/10 p-3">
            <div>
              <Label htmlFor="deal_closed" className="cursor-pointer">Deal closed</Label>
              <p className="text-[11px] text-muted-foreground">Mark this pitch as a won deal</p>
            </div>
            <Switch
              id="deal_closed"
              checked={form.deal_closed}
              onCheckedChange={v => set('deal_closed', v)}
            />
          </div>

          {form.deal_closed && (
            <div className="space-y-1.5">
              <Label>Closed date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start rounded-none text-left font-normal', !form.deal_closed_date && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.deal_closed_date ? format(new Date(form.deal_closed_date), 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.deal_closed_date ? new Date(form.deal_closed_date) : undefined}
                    onSelect={d => set('deal_closed_date', d ? format(d, 'yyyy-MM-dd') : null)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        <SheetFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="rounded-none" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="rounded-none" onClick={handleSubmit} disabled={!isValid || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editingEntry ? 'Save changes' : 'Log pitch'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default PitchlogFormSheet;
