import React, { useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { PROVINCES, ATTORNEY_TYPES, PRACTICE_AREAS, PITCH_STATUSES, COMMENT_OPTIONS, MEETING_STATUSES } from './PitchlogInlineRow';

interface Props {
  onAdd: (data: Record<string, string>) => void;
  isPending?: boolean;
  defaultSalesPerson?: string;
  salesPersonReadOnly?: boolean;
}

const emptyRow = {
  province: '',
  law_firm_name: '',
  attorney_type: '',
  practice_area: '',
  contact_person: '',
  email: '',
  telephone: '',
  sales_person: '',
  pitch_status: 'Pitched',
  follow_up_date: '',
  identified_challenge: '',
  comment_2: '',
  meeting_function: '',
};

const PitchlogAddRow: React.FC<Props> = ({ onAdd, isPending, defaultSalesPerson, salesPersonReadOnly }) => {
  const draftStorageKey = `pitchlog-add-draft::${defaultSalesPerson || 'shared'}`;

  const loadDraft = (): typeof emptyRow => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(draftStorageKey) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...emptyRow, ...parsed, sales_person: defaultSalesPerson || parsed.sales_person || '' };
      }
    } catch { /* ignore */ }
    return { ...emptyRow, sales_person: defaultSalesPerson || '' };
  };

  const [draft, setDraft] = useState<typeof emptyRow>(loadDraft);

  // Persist draft to localStorage on every change so data is never lost
  // when switching tabs, opening another browser window, or refreshing.
  React.useEffect(() => {
    try {
      const hasContent = Object.entries(draft).some(
        ([k, v]) => k !== 'sales_person' && k !== 'pitch_status' && v
      );
      if (hasContent) {
        localStorage.setItem(draftStorageKey, JSON.stringify(draft));
      } else {
        localStorage.removeItem(draftStorageKey);
      }
    } catch { /* ignore */ }
  }, [draft, draftStorageKey]);

  // Update draft when defaultSalesPerson changes
  React.useEffect(() => {
    if (defaultSalesPerson) {
      setDraft(d => ({ ...d, sales_person: defaultSalesPerson }));
    }
  }, [defaultSalesPerson]);

  const canSave = draft.law_firm_name && draft.contact_person && draft.sales_person && draft.province && draft.attorney_type && draft.practice_area;

  const handleAdd = () => {
    if (!canSave) return;
    onAdd({
      ...draft,
      month_year: format(new Date(), 'yyyy-MM'),
    });
    setDraft({ ...emptyRow, sales_person: defaultSalesPerson || '' });
    try { localStorage.removeItem(draftStorageKey); } catch { /* ignore */ }
  };

  return (
    <TableRow className="bg-primary/5 border-t-2 border-primary/20">
      <TableCell className="text-sm text-muted-foreground font-medium">
        {format(new Date(), 'dd MMM yyyy')}
      </TableCell>
      <TableCell>
        <Select value={draft.province} onValueChange={v => setDraft(d => ({ ...d, province: v }))}>
          <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue placeholder="Province" /></SelectTrigger>
          <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input className="h-8 text-xs w-[130px]" value={draft.law_firm_name} onChange={e => setDraft(d => ({ ...d, law_firm_name: e.target.value }))} placeholder="Law Firm *" />
      </TableCell>
      <TableCell>
        <Select value={draft.attorney_type} onValueChange={v => setDraft(d => ({ ...d, attorney_type: v }))}>
          <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>{ATTORNEY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={draft.practice_area} onValueChange={v => setDraft(d => ({ ...d, practice_area: v }))}>
          <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue placeholder="Area" /></SelectTrigger>
          <SelectContent>{PRACTICE_AREAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell><Input className="h-8 text-xs w-[120px]" value={draft.contact_person} onChange={e => setDraft(d => ({ ...d, contact_person: e.target.value }))} placeholder="Contact *" /></TableCell>
      <TableCell><Input className="h-8 text-xs w-[140px]" value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} placeholder="Email" /></TableCell>
      <TableCell><Input className="h-8 text-xs w-[110px]" value={draft.telephone} onChange={e => setDraft(d => ({ ...d, telephone: e.target.value }))} placeholder="Phone" /></TableCell>
      <TableCell>
        <Input 
          className={cn("h-8 text-xs w-[100px]", salesPersonReadOnly && "bg-muted cursor-not-allowed")} 
          value={draft.sales_person} 
          onChange={e => !salesPersonReadOnly && setDraft(d => ({ ...d, sales_person: e.target.value }))} 
          placeholder="Sales *" 
          readOnly={salesPersonReadOnly}
        />
      </TableCell>
      <TableCell>
        <Select value={draft.pitch_status} onValueChange={v => setDraft(d => ({ ...d, pitch_status: v }))}>
          <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>{PITCH_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-8 text-xs w-[130px] justify-start text-left font-normal", !draft.follow_up_date && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-3 w-3" />
                {draft.follow_up_date ? format(new Date(draft.follow_up_date), 'dd MMM yyyy') : <span>Pick date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={draft.follow_up_date ? new Date(draft.follow_up_date) : undefined}
                onSelect={(date) => setDraft(d => ({ ...d, follow_up_date: date ? format(date, 'yyyy-MM-dd') : '' }))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
      </TableCell>
      <TableCell>
        <Select value={draft.identified_challenge} onValueChange={v => setDraft(d => ({ ...d, identified_challenge: v }))}>
          <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>{COMMENT_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input className="h-8 text-xs w-[150px]" value={draft.comment_2} onChange={e => setDraft(d => ({ ...d, comment_2: e.target.value }))} placeholder="Comment Sec 2" />
      </TableCell>
      <TableCell>
        <Select value={draft.meeting_function} onValueChange={v => setDraft(d => ({ ...d, meeting_function: v }))}>
          <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>{MEETING_STATUSES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Button variant="default" size="sm" onClick={handleAdd} disabled={!canSave || isPending} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default PitchlogAddRow;
