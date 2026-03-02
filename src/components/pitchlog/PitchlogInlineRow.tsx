import React, { useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Edit, Trash2, Save, X, CalendarDays, Mail, Phone, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'
];
const ATTORNEY_TYPES = ['Plaintiff', 'Defendant', 'State Attorney'];
const PRACTICE_AREAS = ['RAF', 'Medical Negligence', 'Both RAF & Med Neg', 'Dont do RAF or Med Neg'];
const PITCH_STATUSES = ['Pitched', 'Re-pitched', 'Followed Up', 'Interested', 'Not Interested'];
const COMMENT_OPTIONS = [
  'Interested', 'Potential', 'Not Interested', 'Not dealing with RAF',
  'Not dealing Med Neg', 'Not Sure', 'Others'
];
const MEETING_STATUSES = ['Meeting Proposed', 'No Meeting Proposed', 'Meeting Held', 'Meeting Cancelled'];

export interface PitchEntry {
  id: string;
  month_year: string;
  province: string;
  law_firm_name: string;
  attorney_type: string;
  practice_area: string;
  contact_person: string;
  email: string | null;
  telephone: string | null;
  sales_person: string;
  pitch_status: string;
  follow_up_date: string | null;
  comment: string | null;
  comment_2: string | null;
  identified_challenge: string | null;
  meeting_function: string | null;
  created_at: string;
}

interface Props {
  entry: PitchEntry;
  onSave: (id: string, data: Partial<PitchEntry>) => void;
  onDelete: (id: string) => void;
  statusColor: (status: string) => string;
}

const PitchlogInlineRow: React.FC<Props> = ({ entry, onSave, onDelete, statusColor }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry);

  const startEdit = () => {
    setDraft(entry);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(entry);
    setEditing(false);
  };

  const save = () => {
    onSave(entry.id, {
      province: draft.province,
      law_firm_name: draft.law_firm_name,
      attorney_type: draft.attorney_type,
      practice_area: draft.practice_area,
      contact_person: draft.contact_person,
      email: draft.email,
      telephone: draft.telephone,
      sales_person: draft.sales_person,
      pitch_status: draft.pitch_status,
      follow_up_date: draft.follow_up_date,
      comment: draft.comment,
      comment_2: draft.comment_2,
      identified_challenge: draft.identified_challenge,
      meeting_function: draft.meeting_function,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <TableRow className="bg-muted/30">
        <TableCell className="text-sm">{format(new Date(entry.created_at), 'dd MMM yyyy')}</TableCell>
        <TableCell>
          <Select value={draft.province} onValueChange={v => setDraft(d => ({ ...d, province: v }))}>
            <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </TableCell>
        <TableCell><Input className="h-8 text-xs w-[130px]" value={draft.law_firm_name} onChange={e => setDraft(d => ({ ...d, law_firm_name: e.target.value }))} /></TableCell>
        <TableCell>
          <Select value={draft.attorney_type} onValueChange={v => setDraft(d => ({ ...d, attorney_type: v }))}>
            <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>{ATTORNEY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Select value={draft.practice_area} onValueChange={v => setDraft(d => ({ ...d, practice_area: v }))}>
            <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>{PRACTICE_AREAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </TableCell>
        <TableCell><Input className="h-8 text-xs w-[120px]" value={draft.contact_person} onChange={e => setDraft(d => ({ ...d, contact_person: e.target.value }))} placeholder="Name" /></TableCell>
        <TableCell><Input className="h-8 text-xs w-[140px]" value={draft.email || ''} onChange={e => setDraft(d => ({ ...d, email: e.target.value || null }))} placeholder="Email" /></TableCell>
        <TableCell><Input className="h-8 text-xs w-[110px]" value={draft.telephone || ''} onChange={e => setDraft(d => ({ ...d, telephone: e.target.value || null }))} placeholder="Phone" /></TableCell>
        <TableCell><Input className="h-8 text-xs w-[100px]" value={draft.sales_person} onChange={e => setDraft(d => ({ ...d, sales_person: e.target.value }))} /></TableCell>
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
                onSelect={(date) => setDraft(d => ({ ...d, follow_up_date: date ? format(date, 'yyyy-MM-dd') : null }))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </TableCell>
        <TableCell>
          <Select value={draft.comment || ''} onValueChange={v => setDraft(d => ({ ...d, comment: v || null }))}>
            <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{COMMENT_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Input className="h-8 text-xs w-[150px]" value={draft.comment_2 || ''} onChange={e => setDraft(d => ({ ...d, comment_2: e.target.value || null }))} placeholder="Additional notes..." />
        </TableCell>
        <TableCell>
          <Select value={draft.meeting_function || ''} onValueChange={v => setDraft(d => ({ ...d, meeting_function: v || null }))}>
            <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{MEETING_STATUSES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={save} className="text-emerald-600"><Save className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="sm" onClick={cancel}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow key={entry.id}>
      <TableCell className="text-sm">{format(new Date(entry.created_at), 'dd MMM yyyy')}</TableCell>
      <TableCell className="text-sm">{entry.province}</TableCell>
      <TableCell className="text-sm font-medium">{entry.law_firm_name}</TableCell>
      <TableCell><Badge variant="outline" className="text-xs">{entry.attorney_type}</Badge></TableCell>
      <TableCell><Badge variant="secondary" className="text-xs">{entry.practice_area}</Badge></TableCell>
      <TableCell className="text-sm">{entry.contact_person}</TableCell>
      <TableCell className="text-sm">
        {entry.email ? <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" />{entry.email}</span> : '—'}
      </TableCell>
      <TableCell className="text-sm">
        {entry.telephone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" />{entry.telephone}</span> : '—'}
      </TableCell>
      <TableCell className="text-sm">{entry.sales_person}</TableCell>
      <TableCell><Badge className={statusColor(entry.pitch_status)}>{entry.pitch_status}</Badge></TableCell>
      <TableCell className="text-sm">
        {entry.follow_up_date ? (
          <span className={`flex items-center gap-1 ${new Date(entry.follow_up_date) <= new Date() ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            <CalendarDays className="h-3 w-3" />
            {format(new Date(entry.follow_up_date), 'dd MMM')}
          </span>
        ) : '—'}
      </TableCell>
      <TableCell className="text-xs max-w-[120px] truncate">{entry.comment || '—'}</TableCell>
      <TableCell className="text-xs max-w-[150px] truncate">{entry.comment_2 || '—'}</TableCell>
      <TableCell className="text-xs max-w-[130px] truncate">{entry.meeting_function || '—'}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={startEdit}><Edit className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(entry.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export default PitchlogInlineRow;
export { PROVINCES, ATTORNEY_TYPES, PRACTICE_AREAS, PITCH_STATUSES, COMMENT_OPTIONS, MEETING_STATUSES };
