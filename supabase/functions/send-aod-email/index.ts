import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { sendEmail } from "../_shared/email.ts";
import { z } from "npm:zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AODEmailSchema = z.object({
  aodDocumentId: z.string().uuid({ message: "Invalid document ID" }),
  regenerate: z.boolean().optional().default(false),
  customEmail: z.object({
    to: z.string().max(1000),
    cc: z.string().max(1000).optional(),
    subject: z.string().min(1).max(500),
    message: z.string().min(1).max(10000),
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
  if (cents > 0) result += ' and ' + convertThousands(cents) + ' cents';
  return result;
};

async function generateAODPdf(aodDoc: any, attorney: any): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;
  const pageWidth = 595;
  const pageHeight = 842;
  const lineHeight = 14;
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > maxWidth && currentLine) { lines.push(currentLine); currentLine = word; }
      else { currentLine = testLine; }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };
  const addText = (text: string, fontSize: number, isBold = false, color = rgb(0, 0, 0)) => {
    const selectedFont = isBold ? boldFont : font;
    const maxWidth = pageWidth - 2 * margin;
    const lines = wrapText(text, maxWidth, fontSize);
    for (const line of lines) {
      if (y < margin + 30) { currentPage = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin; }
      currentPage.drawText(line, { x: margin, y, size: fontSize, font: selectedFont, color });
      y -= lineHeight;
    }
  };
  const addSpace = (height = 10) => { y -= height; if (y < margin) { currentPage = pdfDoc.addPage([pageWidth, pageHeight]); y = pageHeight - margin; } };

  const totalDebt = parseFloat(aodDoc.total_contract_value || '0');
  const depositAmount = parseFloat(aodDoc.deposit_amount || '0');
  const paymentsMade = parseFloat(aodDoc.payments_made || '0');
  const discountRate = parseFloat(aodDoc.discount_rate || '0');
  const discountAmount = totalDebt * (discountRate / 100);
  const finalDebt = totalDebt - discountAmount;
  const remainingBalance = finalDebt - depositAmount - paymentsMade;

  addText('AGREEMENT OF DEBT (AOD)', 18, true, rgb(0.12, 0.71, 0.81));
  addSpace(5);
  addText('KUTLWANO & ASSOCIATES (PTY) LTD', 14, true);
  addText('Medico-Legal Experts', 10);
  addSpace(15);
  addText(`Reference: ${aodDoc.file_name || aodDoc.id}`, 10);
  addText(`Date: ${new Date().toLocaleDateString('en-ZA')}`, 10);
  addSpace(15);
  addText('1. INTRODUCTION', 12, true);
  addSpace(5);
  addText('This Agreement of Debt (\\\"the Agreement\\\") is entered into by and between:', 10);
  addSpace(10);
  addText('THE CREDITOR:', 11, true);
  addText(`Company: ${DEFAULT_CREDITOR_INFO.companyName}`, 10);
  addText(`Registration: ${DEFAULT_CREDITOR_INFO.registrationNumber}`, 10);
  addText(`Represented by: ${DEFAULT_CREDITOR_INFO.managingDirector}`, 10);
  addText(`Address: ${DEFAULT_CREDITOR_INFO.domiciliumAddress}`, 10);
  addSpace(10);
  addText('THE DEBTOR:', 11, true);
  addText(`Law Firm: ${attorney?.name || aodDoc.debtor_law_firm_name || 'N/A'}`, 10);
  addText(`Represented by: ${attorney?.contact_person || aodDoc.debtor_authorized_rep || 'N/A'}`, 10);
  addSpace(15);
  addText('2. FINANCIAL SUMMARY', 12, true);
  addSpace(5);
  addText(`Original Contract Value: R ${totalDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 10);
  if (discountRate > 0) {
    addText(`Discount Applied (${discountRate}%): R ${discountAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 10);
    addText(`Total Debt After Discount: R ${finalDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 10);
  }
  addText(`Deposit Paid: R ${depositAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 10);
  addText(`Payments Made: R ${paymentsMade.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 10);
  addText(`Outstanding Balance: R ${remainingBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 10, true);
  addSpace(5);
  addText(`Amount in words: ${numberToWords(remainingBalance)}`, 9);
  addSpace(15);
  addText('3. CONTRACT PERIOD', 12, true);
  addSpace(5);
  if (aodDoc.contract_start_date) addText(`Start Date: ${new Date(aodDoc.contract_start_date).toLocaleDateString('en-ZA')}`, 10);
  if (aodDoc.contract_end_date) addText(`End Date: ${new Date(aodDoc.contract_end_date).toLocaleDateString('en-ZA')}`, 10);
  if (aodDoc.agreement_duration_term) addText(`Duration: ${aodDoc.agreement_duration_term}`, 10);
  addSpace(15);
  addText('4. BANKING DETAILS', 12, true);
  addSpace(5);
  addText(`Bank: ${DEFAULT_CREDITOR_INFO.bankName}`, 10);
  addText(`Account Name: ${DEFAULT_CREDITOR_INFO.accountName}`, 10);
  addText(`Account Number: ${DEFAULT_CREDITOR_INFO.accountNumber}`, 10);
  addText(`Branch: ${DEFAULT_CREDITOR_INFO.branchName}`, 10);
  addText(`Branch Code: ${DEFAULT_CREDITOR_INFO.branchCode}`, 10);
  addSpace(15);
  addText('5. TERMS AND CONDITIONS', 12, true);
  addSpace(5);
  addText('5.1 The Debtor acknowledges and admits indebtedness to the Creditor for the outstanding balance.', 10);
  addText('5.2 Payment must be made in accordance with the agreed payment schedule.', 10);
  addText('5.3 Failure to adhere to the payment terms constitutes a breach of this Agreement.', 10);
  addText('5.4 Upon default, the full outstanding balance becomes immediately due and payable.', 10);
  addSpace(20);
  addText('6. SIGNATURES', 12, true);
  addSpace(15);
  addText('FOR THE CREDITOR:', 10, true);
  addText('_______________________________', 10);
  addText(`Name: ${DEFAULT_CREDITOR_INFO.managingDirector}`, 9);
  addText('Date: _______________', 9);
  addSpace(20);
  addText('FOR THE DEBTOR:', 10, true);
  addText('_______________________________', 10);
  addText(`Name: ${attorney?.contact_person || '_______________'}`, 9);
  addText('Date: _______________', 9);
  addSpace(20);

  const pages = pdfDoc.getPages();
  pages.forEach((page, index) => {
    page.drawText(`Page ${index + 1} of ${pages.length} | ${DEFAULT_CREDITOR_INFO.companyName}`, { x: margin, y: 30, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  });

  const pdfBytes = await pdfDoc.save();
  return btoa(String.fromCharCode(...pdfBytes));
}

serve(async (req) => {
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
    const validationResult = AODEmailSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: validationResult.error.flatten() }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { aodDocumentId, regenerate, customEmail } = validationResult.data;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: aodDoc, error: aodError } = await supabaseClient
      .from('aod_documents')
      .select(`
        *,
        referring_attorneys:referring_attorney_id (
          id,
          name,
          contact_person,
          email,
          phone
        )
      `)
      .eq('id', aodDocumentId)
      .single();

    if (aodError || !aodDoc) {
      throw new Error('AOD document not found');
    }

    const attorney = aodDoc.referring_attorneys;
    
    let attorneyEmails: string[] = [];
    let ccEmails: string[] = [];
    
    if (customEmail) {
      if (customEmail.to) {
        attorneyEmails = customEmail.to
          .split(/[,;]/)
          .map(email => email.trim())
          .filter(email => email && email.includes('@'));
      }
      if (customEmail.cc) {
        ccEmails = customEmail.cc
          .split(/[,;]/)
          .map(email => email.trim())
          .filter(email => email && email.includes('@'));
      }
    } else {
      if (attorney?.email) {
        if (typeof attorney.email === 'string') {
          attorneyEmails = attorney.email
            .split(/[,;|]/)
            .map(email => email.trim())
            .filter(email => email && email.includes('@'));
        } else if (Array.isArray(attorney.email)) {
          attorneyEmails = attorney.email
            .filter(email => email && email.includes('@'));
        }
      }
    }
    
    if (attorneyEmails.length === 0) {
      throw new Error('No valid attorney email addresses found');
    }

    const totalDebt = parseFloat(aodDoc.total_contract_value || '0');
    const depositAmount = parseFloat(aodDoc.deposit_amount || '0');
    const paymentsMade = parseFloat(aodDoc.payments_made || '0');
    const remainingBalance = totalDebt - depositAmount - paymentsMade;
    
    const termMonths = aodDoc.agreement_duration_months || 0;
    let termDescription = '';
    if (termMonths <= 1) termDescription = '30 Days';
    else if (termMonths <= 2) termDescription = '60 Days';
    else if (termMonths <= 3) termDescription = '90 Days';
    else if (termMonths <= 6) termDescription = '6 Months';
    else if (termMonths <= 12) termDescription = '12 Months';
    else termDescription = '24 Months';

    // Sanitize HTML in custom messages
    const sanitizeHtml = (str: string) => str.replace(/[<>&\"']/g, (c) => {
      const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '\"': '&quot;', '\'': '&#39;' };
      return entities[c] || c;
    });

    let emailHtml: string;
    let subject: string;
    
    if (customEmail && customEmail.message) {
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1FB6CE, #16A085); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">KUTLWANO & ASSOCIATES</h1>
              <p style="font-style: italic; font-size: 12px; margin-top: 5px;">Medico-Legal Experts</p>
            </div>
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; white-space: pre-wrap;">
              ${sanitizeHtml(customEmail.message)}
            </div>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px;">
              <p>Kutlwano & Associates (Pty) Ltd | Registration: 2016/461385/07</p>
              <p style="font-size: 10px; margin-top: 10px;">This is an automated email.</p>
            </div>
          </div>
        </body>
        </html>
      `;
      subject = customEmail.subject || `Agreement of Debt – Payment Terms Confirmation ${regenerate ? '(Updated)' : ''}`;
    } else {
      subject = `Agreement of Debt – Payment Terms Confirmation ${regenerate ? '(Updated)' : ''}`;
      emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1FB6CE, #16A085); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">KUTLWANO & ASSOCIATES</h1>
            <p style="font-style: italic; font-size: 12px; margin-top: 5px;">Medico-Legal Experts</p>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
            <p>Dear ${sanitizeHtml(attorney?.contact_person || 'Attorney')},</p>
            <p>Please find attached the Acknowledgement of Debt agreement for your review and signature.</p>
            <div style="background: #f9f9f9; border-left: 4px solid #1FB6CE; padding: 15px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Law Firm:</strong> ${sanitizeHtml(attorney?.name || 'N/A')}</p>
              <p style="margin: 5px 0;"><strong>Total Debt:</strong> R ${totalDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
              <p style="margin: 5px 0;"><strong>Outstanding:</strong> R ${remainingBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
              <p style="margin: 5px 0;"><strong>Term:</strong> ${termDescription}</p>
            </div>
            <p>Please review, sign, and return at your earliest convenience.</p>
            <p>Kind regards,<br>Kutlwano & Associates</p>
          </div>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px;">
            <p>Kutlwano & Associates (Pty) Ltd | Registration: 2016/461385/07</p>
          </div>
        </div>
      </body>
      </html>
      `;
    }

    // Generate PDF
    const pdfBase64 = await generateAODPdf(aodDoc, attorney);

    // Send email
    const emailResult = await sendEmail({
      from: "noreply@kutlwanoassociate.com",
      to: attorneyEmails,
      cc: ccEmails.length > 0 ? ccEmails : undefined,
      subject,
      html: emailHtml,
      attachments: [{
        content: pdfBase64,
        filename: `AOD_${(attorney?.name || 'Agreement').replace(/\s+/g, '_')}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment',
      }],
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Failed to send email');
    }

    // Update document status
    await supabaseClient
      .from('aod_documents')
      .update({
        document_status: 'sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', aodDocumentId);

    return new Response(
      JSON.stringify({
        success: true,
        message: `AOD email sent to ${attorneyEmails.join(', ')}`,
        emailsSent: attorneyEmails.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error sending AOD email:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send AOD email' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
