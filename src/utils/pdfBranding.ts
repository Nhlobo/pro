import { jsPDF } from 'jspdf';

export const COMPANY_LOGO_PATH = '/lovable-uploads/d45f27ec-34bf-470c-bc47-015dff5748e0.png';
export const COMPANY_SLOGAN = '"We tough a file, We change a life, We are Kutlwano and Associate"';
export const COMPANY_NAME = 'Kutlwano & Associate (Pty) Ltd';

export const addBrandingToPDF = (doc: jsPDF, title: string, subtitle?: string): number => {
  // Add logo (centered)
  try {
    // Note: In a real implementation, you would need to convert the image to base64
    // For now, we'll add a placeholder for the logo space
    doc.setFontSize(12);
    doc.setTextColor(31, 182, 206); // Company primary color
    doc.text(COMPANY_NAME, 105, 15, { align: 'center' });
  } catch (error) {
    console.warn('Could not add logo to PDF:', error);
  }

  // Add title
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text(title, 105, 30, { align: 'center' });

  // Add subtitle if provided
  let currentY = 40;
  if (subtitle) {
    doc.setFontSize(14);
    doc.setTextColor(22, 160, 133); // Secondary color
    doc.text(subtitle, 105, currentY, { align: 'center' });
    currentY += 10;
  }

  // Add generation date
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, currentY + 5, { align: 'center' });

  return currentY + 15; // Return the Y position for content to start
};

export const addBrandingFooter = (doc: jsPDF) => {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer background line
    doc.setLineWidth(0.3);
    doc.setDrawColor(31, 182, 206);
    doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);
    
    // Company name on the left
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text(COMPANY_NAME, 20, pageHeight - 12);
    
    // Company slogan in the center (same line)
    doc.setFontSize(6);
    doc.setTextColor(31, 182, 206);
    doc.text(COMPANY_SLOGAN, pageWidth / 2, pageHeight - 12, { align: 'center' });
    
    // Page number on the right (same line)
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, pageHeight - 12, { align: 'right' });
  }
};

export const getStyledTableOptions = () => ({
  headStyles: {
    fillColor: [31, 182, 206] as [number, number, number], // Company primary color
    textColor: 255,
    fontSize: 9,
    fontStyle: 'bold' as const,
  },
  alternateRowStyles: {
    fillColor: [245, 245, 245] as [number, number, number],
  },
  styles: {
    fontSize: 8,
    cellPadding: 2,
  },
});

export const addPrintBranding = (): string => `
  <style>
    .branded-header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #1FB6CE;
      padding-bottom: 15px;
    }
    .logo-section {
      margin-bottom: 20px;
    }
    .logo-section img {
      height: 60px;
      margin: 0 auto;
      display: block;
    }
    .company-title {
      color: #1FB6CE;
      margin: 10px 0;
      font-size: 24px;
    }
    .report-title {
      color: #16A085;
      margin: 10px 0;
      font-size: 20px;
    }
    .branded-footer {
      margin-top: 40px;
      padding-top: 10px;
      border-top: 2px solid #1FB6CE;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #1FB6CE, #16A085);
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 8px;
      min-height: 40px;
    }
    .footer-left {
      text-align: left;
      font-size: 8px;
      flex: 1;
      padding-right: 10px;
    }
    .footer-center {
      text-align: center;
      flex: 2;
      padding: 0 10px;
    }
    .footer-right {
      text-align: right;
      font-size: 8px;
      flex: 1;
      padding-left: 10px;
    }
    .slogan {
      margin: 0;
      font-style: italic;
      font-size: 8px;
      line-height: 1.2;
    }
    @media print {
      .branded-footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
        margin: 0;
      }
    }
  </style>
`;