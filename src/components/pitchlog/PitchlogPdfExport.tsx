import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from '@/utils/pdfBranding';
import { format } from 'date-fns';
import type { PitchEntry } from './PitchlogInlineRow';

export const downloadPitchlogPdf = (entries: PitchEntry[], monthLabel: string) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  const startY = addBrandingToPDF(doc, 'Monthly Pitchlog Report', monthLabel);

  const headers = [
    'Date',
    'Month',
    'Province',
    'Law Firm',
    'Type',
    'Practice',
    'Contact',
    'Email',
    'Phone',
    'Sales Person',
    'Status',
    'Follow-Up',
    'Comment',
    'Comment 2',
    'Meeting',
    'Deal Closed',
    'Deal Closed Date',
  ];

  const body = entries.map(e => [
    e.created_at ? format(new Date(e.created_at), 'dd MMM yyyy') : '',
    e.month_year || '',
    e.province || '',
    e.law_firm_name || '',
    e.attorney_type || '',
    e.practice_area || '',
    e.contact_person || '',
    e.email || '',
    e.telephone || '',
    e.sales_person || '',
    e.pitch_status || '',
    e.follow_up_date ? format(new Date(e.follow_up_date), 'dd MMM yyyy') : '',
    e.identified_challenge || e.comment || '',
    e.comment_2 || '',
    e.meeting_function || '',
    e.deal_closed ? 'Yes' : 'No',
    e.deal_closed_date ? format(new Date(e.deal_closed_date), 'dd MMM yyyy') : '',
  ]);

  const tableOptions = getStyledTableOptions();

  autoTable(doc, {
    startY: startY + 5,
    head: [headers],
    body,
    ...tableOptions,
    styles: { ...tableOptions.styles, fontSize: 6, cellPadding: 1.2, overflow: 'linebreak' },
    headStyles: { ...tableOptions.headStyles, fontSize: 6 },
    margin: { left: 6, right: 6 },
    didDrawPage: () => {
      // Footer added after all pages
    },
  });

  addBrandingFooter(doc);

  const safeName = monthLabel.replace(/\s+/g, '_');
  doc.save(`Pitchlog_${safeName}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
