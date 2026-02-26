import React, { useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { PROVINCES, ATTORNEY_TYPES, PRACTICE_AREAS, PITCH_STATUSES, COMMON_CHALLENGES } from './PitchlogInlineRow';

interface Props {
  onAdd: (data: Record<string, string>) => void;
  isPending?: boolean;
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
};

const PitchlogAddRow: React.FC<Props> = ({ onAdd, isPending }) => {
  const [draft, setDraft] = useState(emptyRow);

  const canSave = draft.law_firm_name && draft.contact_person && draft.sales_person && draft.province && draft.attorney_type && draft.practice_area;

  const handleAdd = () => {
    if (!canSave) return;
    onAdd({
      ...draft,
      month_year: format(new Date(), 'yyyy-MM'),
    });
    setDraft(emptyRow);
  };

  return (
    <TableRow className="bg-primary/5 border-t-2 border-primary/20">
      <TableCell className="text-sm text-muted-foreground font-medium">
        {format(new Date(), 'MMM yyyy')}
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
      <TableCell>
        <div className="space-y-1">
          <Input className="h-8 text-xs" value={draft.contact_person} onChange={e => setDraft(d => ({ ...d, contact_person: e.target.value }))} placeholder="Contact *" />
          <Input className="h-8 text-xs" value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} placeholder="Email" />
          <Input className="h-8 text-xs" value={draft.telephone} onChange={e => setDraft(d => ({ ...d, telephone: e.target.value }))} placeholder="Phone" />
        </div>
      </TableCell>
      <TableCell>
        <Input className="h-8 text-xs w-[100px]" value={draft.sales_person} onChange={e => setDraft(d => ({ ...d, sales_person: e.target.value }))} placeholder="Sales *" />
      </TableCell>
      <TableCell>
        <Select value={draft.pitch_status} onValueChange={v => setDraft(d => ({ ...d, pitch_status: v }))}>
          <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>{PITCH_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input type="date" className="h-8 text-xs w-[120px]" value={draft.follow_up_date} onChange={e => setDraft(d => ({ ...d, follow_up_date: e.target.value }))} />
      </TableCell>
      <TableCell>
        <Select value={draft.identified_challenge} onValueChange={v => setDraft(d => ({ ...d, identified_challenge: v }))}>
          <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>{COMMON_CHALLENGES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
