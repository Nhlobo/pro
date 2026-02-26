import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface Props {
  onUpload: (rows: Record<string, string>[]) => void;
}

const PitchlogExcelUpload: React.FC<Props> = ({ onUpload }) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (jsonRows.length === 0) {
          toast({ title: 'Empty file', description: 'No data rows found in the Excel file.', variant: 'destructive' });
          return;
        }

        const rows: Record<string, string>[] = [];

        for (const row of jsonRows) {
          // Normalize keys to lowercase with underscores
          const normalized: Record<string, string> = {};
          Object.entries(row).forEach(([key, val]) => {
            const k = key.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
            normalized[k] = String(val ?? '').trim();
          });

          const mapped: Record<string, string> = {
            month_year: normalized.month || normalized.month_year || format(new Date(), 'yyyy-MM'),
            province: normalized.province || '',
            law_firm_name: normalized.law_firm_name || normalized.law_firm || normalized.firm || '',
            attorney_type: normalized.attorney_type || normalized.type || 'Plaintiff',
            practice_area: normalized.practice_area || normalized.practice || 'RAF',
            contact_person: normalized.contact_person || normalized.contact || '',
            email: normalized.email || '',
            telephone: normalized.telephone || normalized.phone || normalized.cell || '',
            sales_person: normalized.sales_person || normalized.salesperson || '',
            pitch_status: normalized.pitch_status || normalized.status || 'Pitched',
            follow_up_date: normalized.follow_up_date || normalized.followup || '',
            comment: normalized.comment || normalized.notes || '',
            identified_challenge: normalized.identified_challenge || normalized.challenge || '',
          };

          if (!mapped.law_firm_name || !mapped.contact_person || !mapped.sales_person) continue;
          rows.push(mapped);
        }

        if (rows.length === 0) {
          toast({ title: 'No valid rows', description: 'Ensure columns: law_firm_name, contact_person, sales_person are present.', variant: 'destructive' });
          return;
        }

        onUpload(rows);
        toast({ title: 'Excel Imported', description: `${rows.length} planned pitch(es) ready to save.` });
      } catch {
        toast({ title: 'Parse Error', description: 'Could not read Excel file. Ensure it is a valid .xlsx file.', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
      <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20" onClick={() => fileRef.current?.click()}>
        <Upload className="h-4 w-4 mr-2" />Upload Planned Pitches (.xlsx)
      </Button>
    </>
  );
};

export default PitchlogExcelUpload;
