import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { PROVINCES, ATTORNEY_TYPES, PRACTICE_AREAS, PITCH_STATUSES } from './PitchlogInlineRow';

interface Props {
  onUpload: (rows: Record<string, string>[]) => void;
}

const PitchlogCsvUpload: React.FC<Props> = ({ onUpload }) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          toast({ title: 'Invalid CSV', description: 'File must have a header row and at least one data row.', variant: 'destructive' });
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ''));
        const rows: Record<string, string>[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

          // Map and validate
          const mapped: Record<string, string> = {
            month_year: row.month || row.month_year || format(new Date(), 'yyyy-MM'),
            province: row.province || '',
            law_firm_name: row.law_firm_name || row.law_firm || row.firm || '',
            attorney_type: row.attorney_type || row.type || 'Plaintiff',
            practice_area: row.practice_area || row.practice || 'RAF',
            contact_person: row.contact_person || row.contact || '',
            email: row.email || '',
            telephone: row.telephone || row.phone || row.cell || '',
            sales_person: row.sales_person || row.salesperson || '',
            pitch_status: row.pitch_status || row.status || 'Pitched',
            follow_up_date: row.follow_up_date || row.followup || '',
            comment: row.comment || row.notes || '',
            identified_challenge: row.identified_challenge || row.challenge || '',
          };

          if (!mapped.law_firm_name || !mapped.contact_person || !mapped.sales_person) continue;
          rows.push(mapped);
        }

        if (rows.length === 0) {
          toast({ title: 'No valid rows', description: 'Could not parse any valid entries. Ensure columns: law_firm_name, contact_person, sales_person are present.', variant: 'destructive' });
          return;
        }

        onUpload(rows);
        toast({ title: 'CSV Imported', description: `${rows.length} planned pitch(es) ready to save.` });
      } catch {
        toast({ title: 'Parse Error', description: 'Could not read CSV file.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20" onClick={() => fileRef.current?.click()}>
        <Upload className="h-4 w-4 mr-2" />Upload Planned Pitches
      </Button>
    </>
  );
};

export default PitchlogCsvUpload;
