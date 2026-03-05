import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from '@/utils/pdfBranding';
import { format } from 'date-fns';
import type { PitchEntry } from './PitchlogInlineRow';

export const downloadPitchlogPdf = (entries: PitchEntry[], monthLabel: string) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  const startY = addBrandingToPDF(doc, 'Monthly Pitchlog Report', monthLabel);

  const headers = ['Date', 'Province', 'Law Firm', 'Type', 'Practice', 'Contact', 'Email', 'Phone', 'Sales Person', 'Status', 'Follow-Up', 'Comment', 'Comment 2', 'Meeting'];

  const body = entries.map(e => [
    format(new Date(e.created_at), 'dd MMM yyyy'),
    e.province,
    e.law_firm_name,
    e.attorney_type,
    e.practice_area,
    e.contact_person,
    e.email || '',
    e.telephone || '',
    e.sales_person,
    e.pitch_status,
    e.follow_up_date ? format(new Date(e.follow_up_date), 'dd MMM yyyy') : '',
    e.identified_challenge || e.comment || '',
    e.comment_2 || '',
    e.meeting_function || '',
  ]);

  const tableOptions = getStyledTableOptions();

  autoTable(doc, {
    startY: startY + 5,
    head: [headers],
    body,
    ...tableOptions,
    styles: { ...tableOptions.styles, fontSize: 7, cellPadding: 1.5 },
    headStyles: { ...tableOptions.headStyles, fontSize: 7 },
    margin: { left: 10, right: 10 },
    didDrawPage: () => {
      // Footer added after all pages
    },
  });

  addBrandingFooter(doc);

  const safeName = monthLabel.replace(/\s+/g, '_');
  doc.save(`Pitchlog_${safeName}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
