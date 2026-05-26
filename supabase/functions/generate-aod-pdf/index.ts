import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { z } from "npm:zod@3.22.4";
import { withErrorHandler } from "../_shared/errors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AODGenerationSchema = z.object({
  aodDocumentId: z.string().uuid({ message: "Invalid document ID" }),
  previewMode: z.boolean().optional().default(false),
  customData: z.record(z.unknown()).optional(),
  templateData: z.object({
    sections: z.array(z.unknown()).optional(),
    creditorInfo: z.record(z.unknown()).optional(),
    paymentStages: z.array(z.unknown()).optional(),
    paymentSchedule: z.array(z.unknown()).optional(),
  }).optional(),
});

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

serve(withErrorHandler(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Validate input
    const rawBody = await req.json();
    const validationResult = AODGenerationSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: validationResult.error.flatten() }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { aodDocumentId, previewMode, customData, templateData } = validationResult.data;

    // Use service role for data access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    // Tenant-ownership check: only admins/employees or the owning attorney's users can render the PDF
    const { data: isAdminOrEmployee } = await userClient.rpc('is_admin_or_employee');
    if (!isAdminOrEmployee) {
      const { data: profile } = await userClient
        .from('profiles')
        .select('referring_attorney_id')
        .eq('id', user.id)
        .maybeSingle();
      if (!profile?.referring_attorney_id || profile.referring_attorney_id !== aodDoc.referring_attorney_id) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
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
    const primaryColor = rgb(0.12, 0.71, 0.81);
    const darkColor = rgb(0.1, 0.1, 0.1);
    const grayColor = rgb(0.4, 0.4, 0.4);
    const lightGrayColor = rgb(0.9, 0.9, 0.9);
    const whiteColor = rgb(1, 1, 1);

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;

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

    const companyName = (CREDITOR_INFO as any).companyName?.toUpperCase() || DEFAULT_CREDITOR_INFO.companyName.toUpperCase();
    const companyNameWidth = timesRomanBold.widthOfTextAtSize(companyName, 18);
    currentPage.drawText(companyName, {
      x: margin + (contentWidth - companyNameWidth) / 2,
      y: yPosition - 30,
      size: 18,
      font: timesRomanBold,
      color: whiteColor,
    });

    const regNumber = (CREDITOR_INFO as any).registrationNumber || DEFAULT_CREDITOR_INFO.registrationNumber;
    const regText = `Registration Number: ${regNumber}`;
    const regWidth = timesRoman.widthOfTextAtSize(regText, 9);
    currentPage.drawText(regText, {
      x: margin + (contentWidth - regWidth) / 2,
      y: yPosition - 48,
      size: 9,
      font: timesRoman,
      color: whiteColor,
    });

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

    const docTitle = "ACKNOWLEDGEMENT OF DEBT AGREEMENT";
    const titleWidth = timesRomanBold.widthOfTextAtSize(docTitle, 16);
    currentPage.drawText(docTitle, {
      x: margin + (contentWidth - titleWidth) / 2,
      y: yPosition,
      size: 16,
      font: timesRomanBold,
      color: darkColor,
    });

    currentPage.drawRectangle({
      x: margin + (contentWidth - titleWidth) / 2,
      y: yPosition - 5,
      width: titleWidth,
      height: 2,
      color: primaryColor,
    });

    yPosition -= 40;

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

    const drawSection = (number: string, title: string) => {
      ensureSpace(40);
      currentPage.drawRectangle({
        x: margin,
        y: yPosition - 5,
        width: contentWidth,
        height: 22,
        color: rgb(0.94, 0.98, 0.98),
      });
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

    drawSection('1.1', 'THE CREDITOR (Service Provider)');
    drawPartyBox([
      { label: 'Company Name:', value: (CREDITOR_INFO as any).companyName || DEFAULT_CREDITOR_INFO.companyName },
      { label: 'Registration Number:', value: regNumber },
      { label: 'Managing Director:', value: (CREDITOR_INFO as any).managingDirector || DEFAULT_CREDITOR_INFO.managingDirector },
      { label: 'Domicilium Address:', value: (CREDITOR_INFO as any).domiciliumAddress || DEFAULT_CREDITOR_INFO.domiciliumAddress },
    ]);
    drawClause(null, `The Creditor, ${(CREDITOR_INFO as any).companyName || DEFAULT_CREDITOR_INFO.companyName}, who for purposes of this agreement is duly represented by the company's Managing Director ${(CREDITOR_INFO as any).managingDirector || DEFAULT_CREDITOR_INFO.managingDirector}.`);

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

    drawSection('1.3', 'PURPOSE OF AGREEMENT');
    drawClause(null, 'The parties have entered into this agreement in good faith and for the purposes of safeguarding the interests of the Creditor for the payment of money/monies that are due to the Creditor by the Debtor, in respect of medico-legal assessments, as per the amount stated herein and as per the terms and conditions stipulated below.');
    drawClause(null, `The Debtor is entitled to ${totalReportsAgreed} (${numberToWords(totalReportsAgreed)}) medico-legal assessments and reports as covered under this Agreement. The contract period is for ${agreementDuration} months, commencing on ${formatDate(startDate)} and ending on ${formatDate(endDate)}.`);

    drawSection('2.', 'ACKNOWLEDGEMENT OF DEBT');
    drawClause(null, `The Debtor hereby unconditionally and irrevocably acknowledges and admits that they are truly and lawfully indebted to the Creditor in the total sum of R ${totalDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${numberToWords(totalDebt)}) for medico-legal services rendered.`);
    
    if (discountRate > 0) {
      drawClause('Discount Applied', `A discount of ${discountRate}% (R ${discountAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) has been applied to the original contract value of R ${originalContractValue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
    }

    ensureSpace(200);
    drawSection('3.', 'FINANCIAL SUMMARY');

    const financialItems = [
      { label: 'Original Contract Value:', value: `R ${originalContractValue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    ];
    
    if (discountRate > 0) {
      financialItems.push(
        { label: `Discount (${discountRate}%):`, value: `- R ${discountAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { label: 'Debt After Discount:', value: `R ${totalDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      );
    }
    
    financialItems.push(
      { label: 'Deposit Amount:', value: `R ${depositAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      { label: 'Remaining Balance:', value: `R ${remainingBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      { label: 'Payment Frequency:', value: paymentFrequencyLabel },
      { label: 'Number of Payments:', value: `${numberOfPayments}` },
      { label: 'Payment Amount:', value: `R ${paymentAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    );

    drawPartyBox(financialItems);

    drawClause('Amount in Words:', `${numberToWords(totalDebt)}`);

    // Payment Schedule
    ensureSpace(100);
    drawSection('4.', 'PAYMENT SCHEDULE');

    const scheduleData = templateData?.paymentSchedule || [];
    if (Array.isArray(scheduleData) && scheduleData.length > 0) {
      for (const payment of scheduleData as any[]) {
        drawClause(null, `Payment ${payment.installment || ''}: R ${parseFloat(payment.amount || '0').toLocaleString('en-ZA', { minimumFractionDigits: 2 })} due on ${payment.dueDate || 'TBD'}`);
      }
    } else {
      for (let i = 1; i <= numberOfPayments; i++) {
        const paymentDate = new Date(startDate);
        if (paymentFrequencyLabel === 'monthly') {
          paymentDate.setMonth(paymentDate.getMonth() + i);
        } else if (paymentFrequencyLabel === 'quarterly') {
          paymentDate.setMonth(paymentDate.getMonth() + (i * 3));
        } else {
          paymentDate.setMonth(paymentDate.getMonth() + (i * 6));
        }
        drawClause(null, `Installment ${i}: R ${paymentAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} due on ${formatDate(paymentDate)}`);
      }
    }

    // Interest
    ensureSpace(80);
    drawSection('5.', 'INTEREST AND DEFAULT');
    drawClause(null, `In the event of default, interest at the rate of ${interestRate}% per annum will be charged on the outstanding balance from the date of default until the date of full payment.`);
    drawClause(null, 'Should the Debtor fail to make any payment on the due date, the full outstanding balance shall become immediately due and payable, and the Creditor shall be entitled to institute legal proceedings without further notice.');

    // Payment Stages
    ensureSpace(100);
    drawSection('6.', 'SERVICE DELIVERY STAGES');
    for (const stage of PAYMENT_STAGES as any[]) {
      drawClause(`Stage ${stage.stage}: ${stage.description}`, `${stage.percentagePayable} - ${stage.actionOutcome}`);
    }

    // Banking Details
    ensureSpace(120);
    drawSection('7.', 'BANKING DETAILS');
    const bankName = (CREDITOR_INFO as any).bankName || DEFAULT_CREDITOR_INFO.bankName;
    const accountName = (CREDITOR_INFO as any).accountName || DEFAULT_CREDITOR_INFO.accountName;
    const accountNumber = (CREDITOR_INFO as any).accountNumber || DEFAULT_CREDITOR_INFO.accountNumber;
    const branchName = (CREDITOR_INFO as any).branchName || DEFAULT_CREDITOR_INFO.branchName;
    const branchCode = (CREDITOR_INFO as any).branchCode || DEFAULT_CREDITOR_INFO.branchCode;
    
    drawPartyBox([
      { label: 'Bank:', value: bankName },
      { label: 'Account Name:', value: accountName },
      { label: 'Account Number:', value: accountNumber },
      { label: 'Branch:', value: branchName },
      { label: 'Branch Code:', value: branchCode },
    ]);

    // Domicilium
    ensureSpace(100);
    drawSection('8.', 'DOMICILIUM CITANDI ET EXECUTANDI');
    drawClause('Creditor:', (CREDITOR_INFO as any).domiciliumAddress || DEFAULT_CREDITOR_INFO.domiciliumAddress);
    drawClause('Debtor:', debtorAddress);

    // Signatures
    ensureSpace(200);
    drawSection('9.', 'SIGNATURES');

    drawClause('FOR AND ON BEHALF OF THE CREDITOR:', '');
    drawClause(null, '___________________________________');
    drawClause(null, `Name: ${(CREDITOR_INFO as any).managingDirector || DEFAULT_CREDITOR_INFO.managingDirector}`);
    drawClause(null, `Title: Managing Director`);
    drawClause(null, `Date: _______________`);

    yPosition -= 20;

    drawClause('FOR AND ON BEHALF OF THE DEBTOR:', '');
    drawClause(null, '___________________________________');
    drawClause(null, `Name: ${debtorRep}`);
    drawClause(null, `Title: Authorized Representative`);
    drawClause(null, `Date: _______________`);

    yPosition -= 20;

    // Witnesses
    drawClause('WITNESSES:', '');
    drawClause(null, '1. ___________________________________');
    drawClause(null, '   Name: _______________');
    drawClause(null, '   Date: _______________');
    yPosition -= 10;
    drawClause(null, '2. ___________________________________');
    drawClause(null, '   Name: _______________');
    drawClause(null, '   Date: _______________');

    // Footer on all pages
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      page.drawText(
        `Page ${i + 1} of ${pages.length} | ${(CREDITOR_INFO as any).companyName || DEFAULT_CREDITOR_INFO.companyName} | Confidential`,
        { x: margin, y: 25, size: 7, font: timesRoman, color: grayColor }
      );
      page.drawRectangle({
        x: margin,
        y: 35,
        width: contentWidth,
        height: 1,
        color: primaryColor,
      });
    }

    const pdfBytes = await pdfDoc.save();
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));

    return new Response(
      JSON.stringify({
        success: true,
        pdf: base64Pdf,
        fileName: `AOD_${debtorLawFirm.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error) {
    console.error('Error generating AOD PDF:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate PDF' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}));
