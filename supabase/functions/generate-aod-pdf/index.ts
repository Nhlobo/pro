import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AODGenerationRequest {
  aodDocumentId: string;
  previewMode?: boolean;
  customData?: any;
  templateData?: {
    sections?: any[];
    creditorInfo?: any;
    paymentStages?: any[];
    paymentSchedule?: any[];
  };
}

// Default Creditor Info
const DEFAULT_CREDITOR_INFO = {
  companyName: "Kutlwano & Associates (Pty) Ltd",
  registrationNumber: "2016/461385/07",
  managingDirector: "Mr. Moleka Boshomane",
  domiciliumAddress: "52 Quatar Crescent, Cosmo City, Ext 10, Roodepoort, 2188",
  bankName: "First National Bank",
  accountName: "Kutlwano and Associate (Pty) Ltd",
  accountNumber: "62770592270",
  branchName: "Middestad",
  branchCode: "260448",
};

// Default Payment Stages
const DEFAULT_PAYMENT_STAGES = [
  {
    stage: 1,
    description: "Confirmation of Assessment Booking",
    percentagePayable: "30% – 50% deposit (depending on volume)",
    actionOutcome: "Booking confirmed and assessment date secured.",
  },
  {
    stage: 2,
    description: "Assessment Conducted",
    percentagePayable: "–",
    actionOutcome: "Expert examination and data collection completed.",
  },
  {
    stage: 3,
    description: "Draft Report Ready",
    percentagePayable: "Partial payment due upon report delivery",
    actionOutcome: "Report released to the referring attorney upon receipt of partial payment.",
  },
  {
    stage: 4,
    description: "Post-Report Clarification (if required)",
    percentagePayable: "No additional fee unless further expert work is requested",
    actionOutcome: "Clarifications or additional notes provided after settlement of all fees.",
  },
  {
    stage: 5,
    description: "Affidavits and Joint Minutes",
    percentagePayable: "Full payment",
    actionOutcome: "Issued out within 3-7 days",
  },
];

// Number to words converter
const numberToWords = (num: number): string => {
  if (num === 0) return 'zero';
  
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  
  const convertHundreds = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + convertHundreds(n % 100) : '');
  };
  
  const convertThousands = (n: number): string => {
    if (n < 1000) return convertHundreds(n);
    if (n < 1000000) return convertHundreds(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + convertHundreds(n % 1000) : '');
    if (n < 1000000000) return convertHundreds(Math.floor(n / 1000000)) + ' million' + (n % 1000000 ? ' ' + convertThousands(n % 1000000) : '');
    return convertHundreds(Math.floor(n / 1000000000)) + ' billion' + (n % 1000000000 ? ' ' + convertThousands(n % 1000000000) : '');
  };
  
  const rands = Math.floor(num);
  const cents = Math.round((num - rands) * 100);
  
  let result = convertThousands(rands) + ' rand';
  if (cents > 0) {
    result += ' and ' + convertThousands(cents) + ' cents';
  }
  
  return result;
};

// Helper function to wrap text
const wrapText = (text: string, maxWidth: number, fontSize: number, font: any): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { aodDocumentId, previewMode = false, customData, templateData }: AODGenerationRequest = await req.json();

    // Use template data from frontend if provided
    const CREDITOR_INFO = templateData?.creditorInfo || DEFAULT_CREDITOR_INFO;
    const PAYMENT_STAGES = templateData?.paymentStages || DEFAULT_PAYMENT_STAGES;

    // Fetch AOD document details with attorney info
    const { data: aodDoc, error: aodError } = await supabaseClient
      .from('aod_documents')
      .select(`
        *,
        referring_attorneys:referring_attorney_id (
          id,
          name,
          contact_person,
          email,
          phone,
          code,
          address,
          province
        )
      `)
      .eq('id', aodDocumentId)
      .single();

    if (aodError || !aodDoc) {
      throw new Error('AOD document not found');
    }

    const attorney = aodDoc.referring_attorneys;
    const data = customData || aodDoc;
    
    // Calculate payment details
    const originalContractValue = parseFloat(data.original_contract_value || data.total_contract_value || '0');
    const discountRate = parseFloat(data.discount_rate || '0');
    const discountAmount = (originalContractValue * discountRate) / 100;
    const totalDebt = discountRate > 0 ? originalContractValue - discountAmount : parseFloat(data.total_contract_value || '0');
    const depositAmount = parseFloat(data.deposit_amount || '0');
    const remainingBalance = totalDebt - depositAmount;
    const paymentsMade = parseFloat(data.payments_made || '0');
    const currentBalance = remainingBalance - paymentsMade;
    
    const agreementDuration = parseInt(data.agreement_duration_term || '12');
    
    let numberOfPayments = 4;
    let paymentFrequencyLabel = 'quarterly';
    
    if (agreementDuration <= 3) {
      numberOfPayments = agreementDuration;
      paymentFrequencyLabel = 'monthly';
    } else if (agreementDuration <= 6) {
      numberOfPayments = Math.ceil(agreementDuration / 3);
      paymentFrequencyLabel = 'quarterly';
    } else if (agreementDuration <= 12) {
      numberOfPayments = Math.ceil(agreementDuration / 3);
      paymentFrequencyLabel = 'quarterly';
    } else {
      numberOfPayments = Math.ceil(agreementDuration / 6);
      paymentFrequencyLabel = 'bi-annually';
    }
    
    const paymentAmount = numberOfPayments > 0 ? remainingBalance / numberOfPayments : 0;
    
    const startDate = new Date(data.contract_start_date || new Date());
    const endDate = new Date(data.contract_end_date || new Date());
    endDate.setMonth(startDate.getMonth() + agreementDuration);
    
    const formatDate = (date: Date) => date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const interestRate = parseFloat(data.interest_rate_1_3_months || data.interest_rate_6_months || data.interest_rate_12_months || '7.25');
    const totalReportsAgreed = parseInt(data.total_reports_agreed || '10');
    
    const debtorLawFirm = data.debtor_law_firm_name || attorney?.name || 'N/A';
    const debtorRep = data.debtor_authorized_rep || attorney?.contact_person || 'N/A';
    const debtorAddress = data.debtor_domicilium_address || attorney?.address || 'N/A';
    const debtorRegNo = data.debtor_registration_number || 'N/A';

    // Create PDF Document
    const pdfDoc = await PDFDocument.create();
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const timesRomanItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

    // Page dimensions (A4)
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 50;
    const contentWidth = pageWidth - (margin * 2);

    // Colors
    const primaryColor = rgb(0.12, 0.71, 0.81); // #1fb6ce
    const darkColor = rgb(0.1, 0.1, 0.1);
    const grayColor = rgb(0.4, 0.4, 0.4);
    const lightGrayColor = rgb(0.9, 0.9, 0.9);
    const whiteColor = rgb(1, 1, 1);

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;

    // Helper to add new page when needed
    const ensureSpace = (requiredHeight: number) => {
      if (yPosition - requiredHeight < margin + 50) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      }
    };

    // Draw Header with background
    const headerHeight = 80;
    currentPage.drawRectangle({
      x: margin,
      y: yPosition - headerHeight,
      width: contentWidth,
      height: headerHeight,
      color: primaryColor,
    });

    // Company Name
    const companyName = CREDITOR_INFO.companyName.toUpperCase();
    const companyNameWidth = timesRomanBold.widthOfTextAtSize(companyName, 18);
    currentPage.drawText(companyName, {
      x: margin + (contentWidth - companyNameWidth) / 2,
      y: yPosition - 30,
      size: 18,
      font: timesRomanBold,
      color: whiteColor,
    });

    // Registration Number
    const regText = `Registration Number: ${CREDITOR_INFO.registrationNumber}`;
    const regWidth = timesRoman.widthOfTextAtSize(regText, 9);
    currentPage.drawText(regText, {
      x: margin + (contentWidth - regWidth) / 2,
      y: yPosition - 48,
      size: 9,
      font: timesRoman,
      color: whiteColor,
    });

    // Tagline
    const tagline = '"We touch a file, We change a life, We are Kutlwano and Associate"';
    const taglineWidth = timesRomanItalic.widthOfTextAtSize(tagline, 9);
    currentPage.drawText(tagline, {
      x: margin + (contentWidth - taglineWidth) / 2,
      y: yPosition - 65,
      size: 9,
      font: timesRomanItalic,
      color: whiteColor,
    });

    yPosition -= headerHeight + 30;

    // Document Title
    const docTitle = "ACKNOWLEDGEMENT OF DEBT AGREEMENT";
    const titleWidth = timesRomanBold.widthOfTextAtSize(docTitle, 16);
    currentPage.drawText(docTitle, {
      x: margin + (contentWidth - titleWidth) / 2,
      y: yPosition,
      size: 16,
      font: timesRomanBold,
      color: darkColor,
    });

    // Underline
    currentPage.drawRectangle({
      x: margin + (contentWidth - titleWidth) / 2,
      y: yPosition - 5,
      width: titleWidth,
      height: 2,
      color: primaryColor,
    });

    yPosition -= 40;

    // DRAFT watermark if preview mode
    if (previewMode) {
      currentPage.drawText('DRAFT', {
        x: 150,
        y: 400,
        size: 100,
        font: timesRomanBold,
        color: rgb(1, 0, 0),
        opacity: 0.1,
        rotate: { type: 'degrees', angle: -45 } as any,
      });
    }

    // Agreement Reference Section
    const drawInfoRow = (label: string, value: string) => {
      currentPage.drawText(label, {
        x: margin,
        y: yPosition,
        size: 10,
        font: timesRomanBold,
        color: grayColor,
      });
      currentPage.drawText(value, {
        x: margin + 150,
        y: yPosition,
        size: 10,
        font: timesRoman,
        color: darkColor,
      });
      yPosition -= 16;
    };

    drawInfoRow('Agreement Reference:', `AOD-${aodDocumentId.substring(0, 8).toUpperCase()}`);
    drawInfoRow('Date of Agreement:', formatDate(new Date()));
    drawInfoRow('Contract Period:', `${formatDate(startDate)} to ${formatDate(endDate)}`);

    yPosition -= 20;

    // Section helper
    const drawSection = (number: string, title: string) => {
      ensureSpace(40);
      
      // Background bar
      currentPage.drawRectangle({
        x: margin,
        y: yPosition - 5,
        width: contentWidth,
        height: 22,
        color: rgb(0.94, 0.98, 0.98),
      });
      
      // Left accent
      currentPage.drawRectangle({
        x: margin,
        y: yPosition - 5,
        width: 4,
        height: 22,
        color: primaryColor,
      });
      
      currentPage.drawText(`${number}`, {
        x: margin + 10,
        y: yPosition,
        size: 11,
        font: timesRoman,
        color: grayColor,
      });
      
      currentPage.drawText(title, {
        x: margin + 35,
        y: yPosition,
        size: 12,
        font: timesRomanBold,
        color: primaryColor,
      });
      
      yPosition -= 35;
    };

    // Draw party box
    const drawPartyBox = (info: { label: string; value: string }[]) => {
      ensureSpace(info.length * 18 + 30);
      
      const boxHeight = info.length * 18 + 20;
      currentPage.drawRectangle({
        x: margin,
        y: yPosition - boxHeight + 10,
        width: contentWidth,
        height: boxHeight,
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 1,
        color: rgb(0.98, 0.98, 0.98),
      });
      
      yPosition -= 5;
      
      for (const item of info) {
        currentPage.drawText(item.label, {
          x: margin + 15,
          y: yPosition,
          size: 10,
          font: timesRomanBold,
          color: grayColor,
        });
        currentPage.drawText(item.value, {
          x: margin + 180,
          y: yPosition,
          size: 10,
          font: timesRoman,
          color: darkColor,
        });
        yPosition -= 18;
      }
      
      yPosition -= 15;
    };

    // Draw clause
    const drawClause = (title: string | null, content: string) => {
      const lines = wrapText(content, contentWidth - 30, 10, timesRoman);
      ensureSpace((lines.length + 2) * 14);
      
      if (title) {
        currentPage.drawText(title, {
          x: margin + 15,
          y: yPosition,
          size: 10,
          font: timesRomanBold,
          color: darkColor,
        });
        yPosition -= 16;
      }
      
      for (const line of lines) {
        currentPage.drawText(line, {
          x: margin + 15,
          y: yPosition,
          size: 10,
          font: timesRoman,
          color: darkColor,
        });
        yPosition -= 14;
      }
      
      yPosition -= 10;
    };

    // Section 1: Introduction
    drawSection('1.', 'INTRODUCTION');
    drawClause(null, 'The parties to this Acknowledgement of Debt are listed below as follows:');

    // Section 1.1: Creditor
    drawSection('1.1', 'THE CREDITOR (Service Provider)');
    drawPartyBox([
      { label: 'Company Name:', value: CREDITOR_INFO.companyName },
      { label: 'Registration Number:', value: CREDITOR_INFO.registrationNumber },
      { label: 'Managing Director:', value: CREDITOR_INFO.managingDirector },
      { label: 'Domicilium Address:', value: CREDITOR_INFO.domiciliumAddress },
    ]);
    drawClause(null, `The Creditor, ${CREDITOR_INFO.companyName}, who for purposes of this agreement is duly represented by the company's Managing Director ${CREDITOR_INFO.managingDirector}.`);

    // Section 1.2: Debtor
    drawSection('1.2', 'THE DEBTOR (Referring Attorney)');
    drawPartyBox([
      { label: 'Law Firm Name:', value: debtorLawFirm },
      { label: 'Registration Number:', value: debtorRegNo },
      { label: 'Authorized Representative:', value: debtorRep },
      { label: 'Contact Email:', value: attorney?.email || 'N/A' },
      { label: 'Contact Phone:', value: attorney?.phone || 'N/A' },
      { label: 'Attorney Code:', value: attorney?.code || 'N/A' },
      { label: 'Domicilium Address:', value: debtorAddress },
    ]);
    drawClause(null, `The Debtor, ${debtorLawFirm}, who for purposes of this agreement is duly represented by ${debtorRep}.`);

    // Section 1.3: Purpose
    drawSection('1.3', 'PURPOSE OF AGREEMENT');
    drawClause(null, 'The parties have entered into this agreement in good faith and for the purposes of safeguarding the interests of the Creditor for the payment of money/monies that are due to the Creditor by the Debtor, in respect of medico-legal assessments, as per the amount stated herein and as per the terms and conditions stipulated below.');
    drawClause(null, `The Debtor is entitled to ${totalReportsAgreed} (${numberToWords(totalReportsAgreed)}) medico-legal assessments and reports as covered under this Agreement. The contract period is for ${agreementDuration} months, commencing on ${formatDate(startDate)} and ending on ${formatDate(endDate)}.`);

    // Section 2: Acknowledgement of Debt
    drawSection('2.', 'ACKNOWLEDGEMENT OF DEBT');
    drawClause(null, `The Debtor hereby unconditionally and irrevocably acknowledges and admits that they are truly and lawfully indebted to the Creditor in the total sum of R ${totalDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${numberToWords(totalDebt)}) for medico-legal services rendered.`);
    
    if (discountRate > 0) {
      drawClause('Discount Applied', `A discount of ${discountRate}% (R ${discountAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) has been applied to the original contract value of R ${originalContractValue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
    }

    // Financial Summary
    ensureSpace(200);
    drawSection('3.', 'FINANCIAL SUMMARY');
    
    // Financial box
    const financialItems = [
      { label: 'Original Contract Value:', value: `R ${originalContractValue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` },
    ];
    
    if (discountRate > 0) {
      financialItems.push({ label: `Discount Applied (${discountRate}%):`, value: `- R ${discountAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` });
    }
    
    financialItems.push(
      { label: 'Total Debt Acknowledged:', value: `R ${totalDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` },
      { label: 'Initial Deposit Paid:', value: `- R ${depositAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` },
      { label: 'Remaining Balance:', value: `R ${remainingBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` },
      { label: 'Payments Made to Date:', value: `- R ${paymentsMade.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` },
      { label: 'Current Outstanding Balance:', value: `R ${currentBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` }
    );

    const boxHeight = financialItems.length * 22 + 40;
    currentPage.drawRectangle({
      x: margin,
      y: yPosition - boxHeight + 10,
      width: contentWidth,
      height: boxHeight,
      borderColor: primaryColor,
      borderWidth: 2,
      color: rgb(0.94, 0.98, 0.98),
    });
    
    yPosition -= 15;
    currentPage.drawText('FINANCIAL BREAKDOWN', {
      x: margin + (contentWidth - timesRomanBold.widthOfTextAtSize('FINANCIAL BREAKDOWN', 12)) / 2,
      y: yPosition,
      size: 12,
      font: timesRomanBold,
      color: primaryColor,
    });
    yPosition -= 25;

    for (let i = 0; i < financialItems.length; i++) {
      const item = financialItems[i];
      const isLast = i === financialItems.length - 1;
      
      currentPage.drawText(item.label, {
        x: margin + 20,
        y: yPosition,
        size: 10,
        font: isLast ? timesRomanBold : timesRoman,
        color: grayColor,
      });
      currentPage.drawText(item.value, {
        x: margin + contentWidth - 120,
        y: yPosition,
        size: 10,
        font: isLast ? timesRomanBold : timesRoman,
        color: darkColor,
      });
      yPosition -= 22;
    }
    yPosition -= 20;

    // Section 4: Terms of Repayment
    drawSection('4.', 'TERMS OF REPAYMENT');
    drawClause(null, `The Debtor undertakes to repay the remaining balance of R ${remainingBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} in ${numberOfPayments} ${paymentFrequencyLabel} installments of approximately R ${paymentAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} each, commencing within 30 days of signing this agreement.`);
    drawClause('Interest Rate', `In the event of default, interest will accrue at the rate of ${interestRate}% per annum on any outstanding amounts.`);
    drawClause('Payment Method', `All payments shall be made via electronic funds transfer (EFT) into the Creditor's designated bank account.`);

    // Bank Details
    ensureSpace(120);
    yPosition -= 10;
    currentPage.drawRectangle({
      x: margin,
      y: yPosition - 100,
      width: contentWidth,
      height: 110,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 1,
      color: rgb(0.98, 0.98, 0.98),
    });
    
    currentPage.drawText('BANK DETAILS FOR PAYMENT', {
      x: margin + 15,
      y: yPosition - 5,
      size: 11,
      font: timesRomanBold,
      color: primaryColor,
    });
    
    const bankDetails = [
      { label: 'Bank Name:', value: CREDITOR_INFO.bankName },
      { label: 'Account Name:', value: CREDITOR_INFO.accountName },
      { label: 'Account Number:', value: CREDITOR_INFO.accountNumber },
      { label: 'Branch Name:', value: CREDITOR_INFO.branchName },
      { label: 'Branch Code:', value: CREDITOR_INFO.branchCode },
    ];
    
    let bankY = yPosition - 25;
    for (const detail of bankDetails) {
      currentPage.drawText(detail.label, {
        x: margin + 15,
        y: bankY,
        size: 10,
        font: timesRomanBold,
        color: grayColor,
      });
      currentPage.drawText(detail.value, {
        x: margin + 150,
        y: bankY,
        size: 10,
        font: timesRoman,
        color: darkColor,
      });
      bankY -= 16;
    }
    yPosition -= 130;

    // Section 5: Default and Consequences
    drawSection('5.', 'DEFAULT AND CONSEQUENCES');
    drawClause(null, 'In the event that the Debtor fails to make payment as agreed, the Creditor shall be entitled to take the following actions:');
    drawClause('5.1', 'Withhold the release of any completed reports, affidavits, or joint minutes until payment is received.');
    drawClause('5.2', 'Charge interest on any outstanding amounts at the agreed rate.');
    drawClause('5.3', 'Suspend all services until the account is brought up to date.');
    drawClause('5.4', 'Institute legal proceedings for the recovery of outstanding amounts plus legal costs on an attorney-client scale.');
    drawClause('5.5', 'Refer the matter to debt collection agencies where necessary.');

    // Section 6: Payment Stages
    ensureSpace(50);
    drawSection('6.', 'PAYMENT STAGES AND DELIVERABLES');
    
    for (const stage of PAYMENT_STAGES) {
      ensureSpace(80);
      
      // Stage number circle
      currentPage.drawRectangle({
        x: margin,
        y: yPosition - 50,
        width: contentWidth,
        height: 60,
        borderColor: rgb(0.9, 0.9, 0.9),
        borderWidth: 1,
        color: whiteColor,
      });
      
      // Circle for stage number
      currentPage.drawRectangle({
        x: margin + 10,
        y: yPosition - 35,
        width: 25,
        height: 25,
        color: primaryColor,
      });
      
      currentPage.drawText(String(stage.stage), {
        x: margin + 18,
        y: yPosition - 28,
        size: 12,
        font: timesRomanBold,
        color: whiteColor,
      });
      
      currentPage.drawText(stage.description, {
        x: margin + 45,
        y: yPosition - 15,
        size: 10,
        font: timesRomanBold,
        color: darkColor,
      });
      
      currentPage.drawText(`Payment: ${stage.percentagePayable}`, {
        x: margin + 45,
        y: yPosition - 30,
        size: 9,
        font: timesRoman,
        color: grayColor,
      });
      
      currentPage.drawText(`Outcome: ${stage.actionOutcome}`, {
        x: margin + 45,
        y: yPosition - 44,
        size: 9,
        font: timesRoman,
        color: grayColor,
      });
      
      yPosition -= 70;
    }

    // Section 7: General Provisions
    drawSection('7.', 'GENERAL PROVISIONS');
    drawClause('7.1 Entire Agreement', 'This document constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, or agreements.');
    drawClause('7.2 Amendment', 'No amendment or variation of this agreement shall be valid unless reduced to writing and signed by both parties.');
    drawClause('7.3 Governing Law', 'This agreement shall be governed by and construed in accordance with the laws of the Republic of South Africa.');
    drawClause('7.4 Jurisdiction', 'The parties hereby consent to the jurisdiction of the Magistrate\'s Court, notwithstanding that the claim may exceed the jurisdiction of such court.');
    drawClause('7.5 Costs', 'The Debtor shall be liable for all costs incurred by the Creditor in enforcing the terms of this agreement, including legal costs on an attorney-and-own-client scale.');

    // Signature Section - New Page
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    yPosition = pageHeight - margin;

    drawSection('8.', 'SIGNATURES');
    drawClause(null, 'The parties hereby confirm that they have read and understood the terms of this agreement and sign in acceptance thereof.');

    yPosition -= 20;

    // Creditor Signature Block
    currentPage.drawRectangle({
      x: margin,
      y: yPosition - 130,
      width: (contentWidth - 20) / 2,
      height: 130,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 1,
      color: rgb(0.98, 0.98, 0.98),
    });
    
    currentPage.drawText('FOR THE CREDITOR:', {
      x: margin + 15,
      y: yPosition - 20,
      size: 11,
      font: timesRomanBold,
      color: primaryColor,
    });
    
    currentPage.drawText(CREDITOR_INFO.companyName, {
      x: margin + 15,
      y: yPosition - 40,
      size: 10,
      font: timesRoman,
      color: darkColor,
    });
    
    currentPage.drawText('Signature: ______________________', {
      x: margin + 15,
      y: yPosition - 70,
      size: 10,
      font: timesRoman,
      color: grayColor,
    });
    
    currentPage.drawText(`Name: ${CREDITOR_INFO.managingDirector}`, {
      x: margin + 15,
      y: yPosition - 90,
      size: 10,
      font: timesRoman,
      color: grayColor,
    });
    
    currentPage.drawText('Date: ______________________', {
      x: margin + 15,
      y: yPosition - 110,
      size: 10,
      font: timesRoman,
      color: grayColor,
    });

    // Debtor Signature Block
    currentPage.drawRectangle({
      x: margin + (contentWidth + 20) / 2,
      y: yPosition - 130,
      width: (contentWidth - 20) / 2,
      height: 130,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 1,
      color: rgb(0.98, 0.98, 0.98),
    });
    
    currentPage.drawText('FOR THE DEBTOR:', {
      x: margin + (contentWidth + 20) / 2 + 15,
      y: yPosition - 20,
      size: 11,
      font: timesRomanBold,
      color: primaryColor,
    });
    
    currentPage.drawText(debtorLawFirm, {
      x: margin + (contentWidth + 20) / 2 + 15,
      y: yPosition - 40,
      size: 10,
      font: timesRoman,
      color: darkColor,
    });
    
    currentPage.drawText('Signature: ______________________', {
      x: margin + (contentWidth + 20) / 2 + 15,
      y: yPosition - 70,
      size: 10,
      font: timesRoman,
      color: grayColor,
    });
    
    currentPage.drawText(`Name: ${debtorRep}`, {
      x: margin + (contentWidth + 20) / 2 + 15,
      y: yPosition - 90,
      size: 10,
      font: timesRoman,
      color: grayColor,
    });
    
    currentPage.drawText('Date: ______________________', {
      x: margin + (contentWidth + 20) / 2 + 15,
      y: yPosition - 110,
      size: 10,
      font: timesRoman,
      color: grayColor,
    });

    yPosition -= 160;

    // Witnesses Section
    currentPage.drawText('WITNESSES:', {
      x: margin,
      y: yPosition,
      size: 11,
      font: timesRomanBold,
      color: darkColor,
    });
    yPosition -= 30;

    // Witness 1
    currentPage.drawText('Witness 1:', {
      x: margin,
      y: yPosition,
      size: 10,
      font: timesRomanBold,
      color: grayColor,
    });
    currentPage.drawText('Signature: ______________________', {
      x: margin + 80,
      y: yPosition,
      size: 10,
      font: timesRoman,
      color: grayColor,
    });
    currentPage.drawText('Name: ______________________', {
      x: margin + 300,
      y: yPosition,
      size: 10,
      font: timesRoman,
      color: grayColor,
    });
    yPosition -= 25;

    // Witness 2
    currentPage.drawText('Witness 2:', {
      x: margin,
      y: yPosition,
      size: 10,
      font: timesRomanBold,
      color: grayColor,
    });
    currentPage.drawText('Signature: ______________________', {
      x: margin + 80,
      y: yPosition,
      size: 10,
      font: timesRoman,
      color: grayColor,
    });
    currentPage.drawText('Name: ______________________', {
      x: margin + 300,
      y: yPosition,
      size: 10,
      font: timesRoman,
      color: grayColor,
    });

    yPosition -= 60;

    // Footer
    currentPage.drawRectangle({
      x: margin,
      y: yPosition - 2,
      width: contentWidth,
      height: 2,
      color: primaryColor,
    });
    yPosition -= 20;

    const footerText1 = CREDITOR_INFO.companyName;
    const footerText2 = `Registration: ${CREDITOR_INFO.registrationNumber}`;
    const footerText3 = `Address: ${CREDITOR_INFO.domiciliumAddress}`;
    const footerText4 = 'Email: info@kamedico-legal.co.za | Website: www.kamedico-legal.co.za';

    currentPage.drawText(footerText1, {
      x: margin + (contentWidth - timesRomanBold.widthOfTextAtSize(footerText1, 9)) / 2,
      y: yPosition,
      size: 9,
      font: timesRomanBold,
      color: grayColor,
    });
    yPosition -= 12;

    currentPage.drawText(footerText2, {
      x: margin + (contentWidth - timesRoman.widthOfTextAtSize(footerText2, 8)) / 2,
      y: yPosition,
      size: 8,
      font: timesRoman,
      color: grayColor,
    });
    yPosition -= 12;

    currentPage.drawText(footerText3, {
      x: margin + (contentWidth - timesRoman.widthOfTextAtSize(footerText3, 8)) / 2,
      y: yPosition,
      size: 8,
      font: timesRoman,
      color: grayColor,
    });
    yPosition -= 12;

    currentPage.drawText(footerText4, {
      x: margin + (contentWidth - timesRoman.widthOfTextAtSize(footerText4, 8)) / 2,
      y: yPosition,
      size: 8,
      font: timesRoman,
      color: grayColor,
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    // Update the AOD document with generated status
    await supabaseClient
      .from('aod_documents')
      .update({
        document_status: 'generated',
        updated_at: new Date().toISOString()
      })
      .eq('id', aodDocumentId);

    // Log the generation
    if (!previewMode) {
      await supabaseClient.from('audit_logs').insert({
        action_type: 'CREATE',
        table_name: 'aod_documents',
        record_id: aodDocumentId,
        description: `Generated AOD PDF for ${attorney?.name} using native PDF generation`,
        function_area: 'AOD Management',
        new_values: { 
          generated: true,
          template: 'native_pdf',
          totalDebt,
          depositAmount,
          remainingBalance,
          discountApplied: discountRate > 0,
          discountRate,
          discountAmount
        }
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdfData: pdfBase64,
        isPdf: true,
        metadata: {
          attorneyName: attorney?.name,
          attorneyEmail: attorney?.email,
          attorneyCode: attorney?.code,
          totalDebt,
          originalContractValue,
          discountRate,
          discountAmount,
          depositAmount,
          remainingBalance,
          currentBalance,
          agreementDuration,
          numberOfPayments,
          paymentAmount,
          totalReportsAgreed,
          reference: `AOD-${aodDocumentId.substring(0, 8).toUpperCase()}`,
          generatedAt: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error generating AOD PDF:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
