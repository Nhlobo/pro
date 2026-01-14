import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AODEmailRequest {
  aodDocumentId: string;
  regenerate?: boolean;
  customEmail?: {
    to: string;
    cc?: string;
    subject: string;
    message: string;
  };
}

// Default Creditor Info for PDF generation
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

// Generate AOD PDF inline
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
      
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };
  
  const addText = (text: string, fontSize: number, isBold: boolean = false, color = rgb(0, 0, 0)) => {
    const selectedFont = isBold ? boldFont : font;
    const maxWidth = pageWidth - 2 * margin;
    const lines = wrapText(text, maxWidth, fontSize);
    
    for (const line of lines) {
      if (y < margin + 30) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      currentPage.drawText(line, { x: margin, y, size: fontSize, font: selectedFont, color });
      y -= lineHeight;
    }
  };
  
  const addSpace = (height: number = 10) => {
    y -= height;
    if (y < margin) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };
  
  // Calculate values
  const totalDebt = parseFloat(aodDoc.total_contract_value || '0');
  const depositAmount = parseFloat(aodDoc.deposit_amount || '0');
  const paymentsMade = parseFloat(aodDoc.payments_made || '0');
  const discountRate = parseFloat(aodDoc.discount_rate || '0');
  const discountAmount = totalDebt * (discountRate / 100);
  const finalDebt = totalDebt - discountAmount;
  const remainingBalance = finalDebt - depositAmount - paymentsMade;
  
  // Header
  addText('AGREEMENT OF DEBT (AOD)', 18, true, rgb(0.12, 0.71, 0.81));
  addSpace(5);
  addText('KUTLWANO & ASSOCIATES (PTY) LTD', 14, true);
  addText('Medico-Legal Experts', 10);
  addSpace(15);
  
  // Reference
  addText(`Reference: ${aodDoc.file_name || aodDoc.id}`, 10);
  addText(`Date: ${new Date().toLocaleDateString('en-ZA')}`, 10);
  addSpace(15);
  
  // Introduction
  addText('1. INTRODUCTION', 12, true);
  addSpace(5);
  addText('This Agreement of Debt ("the Agreement") is entered into by and between:', 10);
  addSpace(10);
  
  // Creditor Details
  addText('THE CREDITOR:', 11, true);
  addText(`Company: ${DEFAULT_CREDITOR_INFO.companyName}`, 10);
  addText(`Registration: ${DEFAULT_CREDITOR_INFO.registrationNumber}`, 10);
  addText(`Represented by: ${DEFAULT_CREDITOR_INFO.managingDirector}`, 10);
  addText(`Address: ${DEFAULT_CREDITOR_INFO.domiciliumAddress}`, 10);
  addSpace(10);
  
  // Debtor Details
  addText('THE DEBTOR:', 11, true);
  addText(`Law Firm: ${attorney?.name || aodDoc.debtor_law_firm_name || 'N/A'}`, 10);
  addText(`Represented by: ${attorney?.contact_person || aodDoc.debtor_authorized_rep || 'N/A'}`, 10);
  addSpace(15);
  
  // Financial Summary
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
  
  // Contract Period
  addText('3. CONTRACT PERIOD', 12, true);
  addSpace(5);
  if (aodDoc.contract_start_date) {
    addText(`Start Date: ${new Date(aodDoc.contract_start_date).toLocaleDateString('en-ZA')}`, 10);
  }
  if (aodDoc.contract_end_date) {
    addText(`End Date: ${new Date(aodDoc.contract_end_date).toLocaleDateString('en-ZA')}`, 10);
  }
  if (aodDoc.agreement_duration_term) {
    addText(`Duration: ${aodDoc.agreement_duration_term}`, 10);
  }
  addSpace(15);
  
  // Banking Details
  addText('4. BANKING DETAILS', 12, true);
  addSpace(5);
  addText(`Bank: ${DEFAULT_CREDITOR_INFO.bankName}`, 10);
  addText(`Account Name: ${DEFAULT_CREDITOR_INFO.accountName}`, 10);
  addText(`Account Number: ${DEFAULT_CREDITOR_INFO.accountNumber}`, 10);
  addText(`Branch: ${DEFAULT_CREDITOR_INFO.branchName}`, 10);
  addText(`Branch Code: ${DEFAULT_CREDITOR_INFO.branchCode}`, 10);
  addSpace(15);
  
  // Terms
  addText('5. TERMS AND CONDITIONS', 12, true);
  addSpace(5);
  addText('5.1 The Debtor acknowledges and admits indebtedness to the Creditor for the outstanding balance.', 10);
  addText('5.2 Payment must be made in accordance with the agreed payment schedule.', 10);
  addText('5.3 Failure to adhere to the payment terms constitutes a breach of this Agreement.', 10);
  addText('5.4 Upon default, the full outstanding balance becomes immediately due and payable.', 10);
  addSpace(20);
  
  // Signatures section
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
  
  // Footer on all pages
  const pages = pdfDoc.getPages();
  pages.forEach((page, index) => {
    page.drawText(
      `Page ${index + 1} of ${pages.length} | ${DEFAULT_CREDITOR_INFO.companyName}`,
      { x: margin, y: 30, size: 8, font, color: rgb(0.5, 0.5, 0.5) }
    );
  });
  
  const pdfBytes = await pdfDoc.save();
  return btoa(String.fromCharCode(...pdfBytes));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { aodDocumentId, regenerate = false, customEmail }: AODEmailRequest = await req.json();

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
          phone
        )
      `)
      .eq('id', aodDocumentId)
      .single();

    if (aodError || !aodDoc) {
      throw new Error('AOD document not found');
    }

    const attorney = aodDoc.referring_attorneys;
    
    // Parse attorney emails (support comma-separated or array)
    let attorneyEmails: string[] = [];
    let ccEmails: string[] = [];
    
    // Use custom email addresses if provided
    if (customEmail) {
      // Parse TO addresses
      if (customEmail.to) {
        attorneyEmails = customEmail.to
          .split(/[,;]/)
          .map(email => email.trim())
          .filter(email => email && email.includes('@'));
      }
      
      // Parse CC addresses
      if (customEmail.cc) {
        ccEmails = customEmail.cc
          .split(/[,;]/)
          .map(email => email.trim())
          .filter(email => email && email.includes('@'));
      }
    } else {
      // Use default attorney email
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

    // Calculate payment details
    const totalDebt = parseFloat(aodDoc.total_contract_value || '0');
    const depositAmount = parseFloat(aodDoc.deposit_amount || '0');
    const paymentsMade = parseFloat(aodDoc.payments_made || '0');
    const remainingBalance = totalDebt - depositAmount - paymentsMade;
    
    // Determine term description
    const termMonths = aodDoc.agreement_duration_months || 0;
    let termDescription = '';
    if (termMonths <= 1) termDescription = '30 Days';
    else if (termMonths <= 2) termDescription = '60 Days';
    else if (termMonths <= 3) termDescription = '90 Days';
    else if (termMonths <= 6) termDescription = '6 Months';
    else if (termMonths <= 12) termDescription = '12 Months';
    else termDescription = '24 Months';

    // Build email HTML
    let emailHtml: string;
    let subject: string;
    
    if (customEmail && customEmail.message) {
      // Use custom message with simple HTML formatting
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #1FB6CE, #16A085);
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .content {
              background: #ffffff;
              padding: 30px;
              border: 1px solid #e0e0e0;
              border-top: none;
              white-space: pre-wrap;
            }
            .footer {
              background: #f5f5f5;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #666;
              border-radius: 0 0 8px 8px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>KUTLWANO & ASSOCIATES</h1>
              <p class="tagline">Medico-Legal Experts</p>
            </div>
            
            <div class="content">
              ${customEmail.message}
            </div>
            
            <div class="footer">
              <p>Kutlwano & Associates (Pty) Ltd | Registration: 2016/461385/07</p>
              <p>"We touch a file, We change a life, We are Kutlwano and Associate"</p>
              <p style="font-size: 10px; margin-top: 10px;">
                This is an automated email. Please do not reply directly to this message.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
      subject = customEmail.subject || `Agreement of Debt – Payment Terms Confirmation ${regenerate ? '(Updated)' : ''}`;
    } else {
      // Use default template
      subject = `Agreement of Debt – Payment Terms Confirmation ${regenerate ? '(Updated)' : ''}`;
      emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #1FB6CE, #16A085);
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .header .tagline {
            font-style: italic;
            font-size: 12px;
            margin-top: 5px;
          }
          .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e0e0e0;
            border-top: none;
          }
          .summary-box {
            background: #f9f9f9;
            border-left: 4px solid #1FB6CE;
            padding: 15px;
            margin: 20px 0;
          }
          .summary-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          .summary-item:last-child {
            border-bottom: none;
            font-weight: bold;
            font-size: 16px;
          }
          .label {
            color: #666;
          }
          .value {
            color: #1FB6CE;
            font-weight: 600;
          }
          .footer {
            background: #f5f5f5;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-radius: 0 0 8px 8px;
          }
          .button {
            display: inline-block;
            background: #1FB6CE;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .alert {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>KUTLWANO & ASSOCIATES</h1>
            <p class="tagline">"We touch a file, We change a life, We are Kutlwano and Associate"</p>
          </div>
          
          <div class="content">
            <h2>Agreement of Debt – Payment Terms Confirmation</h2>
            
            <p>Dear <strong>${attorney.contact_person || attorney.name}</strong>,</p>
            
            ${regenerate ? '<div class="alert"><strong>Updated Agreement:</strong> This is an updated version of your AOD reflecting recent changes to the payment terms.</div>' : ''}
            
            <p>Please find attached your Agreement of Debt (AOD) confirming the approved payment terms for medico-legal services rendered by Kutlwano & Associates (Pty) Ltd.</p>
            
            <div class="summary-box">
              <h3 style="margin-top: 0; color: #1FB6CE;">Payment Summary</h3>
              
              <div class="summary-item">
                <span class="label">Total Debt:</span>
                <span class="value">R${totalDebt.toFixed(2)}</span>
              </div>
              
              <div class="summary-item">
                <span class="label">Deposit Made:</span>
                <span class="value">R${depositAmount.toFixed(2)}</span>
              </div>
              
              <div class="summary-item">
                <span class="label">Payments Made:</span>
                <span class="value">R${paymentsMade.toFixed(2)}</span>
              </div>
              
              <div class="summary-item">
                <span class="label">Term of Payment:</span>
                <span class="value">${termDescription}</span>
              </div>
              
              <div class="summary-item">
                <span class="label">Remaining Balance:</span>
                <span class="value">R${remainingBalance.toFixed(2)}</span>
              </div>
            </div>

            <p><strong>Contract Period:</strong><br>
            From: ${aodDoc.contract_start_date ? new Date(aodDoc.contract_start_date).toLocaleDateString() : 'N/A'}<br>
            To: ${aodDoc.contract_end_date ? new Date(aodDoc.contract_end_date).toLocaleDateString() : 'N/A'}</p>

            <p><strong>Next Payment Due:</strong> ${aodDoc.next_payment_date ? new Date(aodDoc.next_payment_date).toLocaleDateString() : 'N/A'}</p>

            <p><strong>Reference Number:</strong> ${aodDoc.file_name || aodDoc.id}</p>

            <p>Kindly review the terms and acknowledge receipt of this agreement.</p>

            <p>Should you have any questions or require clarification regarding this agreement, please do not hesitate to contact us.</p>

            <p style="margin-top: 30px;">
              <strong>Warm regards,</strong><br>
              Kutlwano & Associates<br>
              Medico-Legal Accounts Department<br>
              Email: accounts@kamedico-legal.co.za<br>
              Phone: +27 (0) 12 345 6789
            </p>
          </div>
          
          <div class="footer">
            <p>Kutlwano & Associates (Pty) Ltd | Registration: 2016/461385/07</p>
            <p>"We touch a file, We change a life, We are Kutlwano and Associate"</p>
            <p style="font-size: 10px; margin-top: 10px;">
              This is an automated email. Please do not reply directly to this message.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    }

    // Get or generate PDF attachment
    let attachments: Array<{ filename: string; content: string }> | undefined;
    let pdfBase64: string | null = null;
    
    // First, try to get existing PDF from storage
    if (aodDoc.document_url && aodDoc.document_url !== 'pending') {
      try {
        console.log('Fetching existing AOD document for attachment:', aodDoc.document_url);
        
        let pdfBlob: Blob;
        
        if (aodDoc.document_url.startsWith('http://') || aodDoc.document_url.startsWith('https://')) {
          const response = await fetch(aodDoc.document_url);
          if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.statusText}`);
          }
          pdfBlob = await response.blob();
        } else {
          const { data: pdfData, error: downloadError } = await supabaseClient
            .storage
            .from('documents')
            .download(aodDoc.document_url);
          
          if (downloadError) {
            throw downloadError;
          }
          pdfBlob = pdfData;
        }
        
        const arrayBuffer = await pdfBlob.arrayBuffer();
        pdfBase64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );
        
        console.log('Existing PDF attachment prepared successfully');
      } catch (attachmentError) {
        console.error('Error fetching existing PDF:', attachmentError);
        // Will generate new PDF below
      }
    }
    
    // If no existing PDF, generate one on the fly
    if (!pdfBase64) {
      console.log('Generating new AOD PDF for email attachment...');
      try {
        pdfBase64 = await generateAODPdf(aodDoc, attorney);
        console.log('PDF generated successfully for email attachment');
        
        // Update document status to indicate PDF was generated
        await supabaseClient
          .from('aod_documents')
          .update({
            document_status: 'generated',
            updated_at: new Date().toISOString()
          })
          .eq('id', aodDocumentId);
          
      } catch (pdfError) {
        console.error('Error generating PDF:', pdfError);
        // Continue without attachment
      }
    }
    
    // Prepare attachment if we have PDF
    if (pdfBase64) {
      const attorneyName = (attorney?.name || 'Attorney').replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      
      attachments = [{
        filename: aodDoc.file_name || `AOD_${attorneyName}_${dateStr}.pdf`,
        content: pdfBase64
      }];
    }

    // Send email
    const emailResult = await sendEmail({
      to: attorneyEmails,
      cc: ccEmails.length > 0 ? ccEmails : undefined,
      subject,
      html: emailHtml,
      replyTo: 'accounts@kamedico-legal.co.za',
      attachments
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Failed to send email');
    }

    console.log(`AOD email sent successfully to ${attorneyEmails.length} recipient(s): ${attorneyEmails.join(', ')}${ccEmails.length > 0 ? ` (CC: ${ccEmails.join(', ')})` : ''}`);
    console.log(`PDF attachment included: ${attachments ? 'Yes' : 'No'}`);

    // Update AOD document status
    await supabaseClient
      .from('aod_documents')
      .update({
        payment_status: aodDoc.payment_status === 'pending' ? 'active' : aodDoc.payment_status,
        document_status: 'sent',
        updated_at: new Date().toISOString()
      })
      .eq('id', aodDocumentId);

    // Log the email
    await supabaseClient.from('audit_logs').insert({
      user_id: (await supabaseClient.auth.getUser()).data.user?.id,
      action_type: 'EMAIL_SENT',
      table_name: 'aod_documents',
      record_id: aodDocumentId,
      description: `AOD email ${regenerate ? 'resent' : 'sent'} to ${attorneyEmails.join(', ')}${ccEmails.length > 0 ? ` (CC: ${ccEmails.join(', ')})` : ''} with PDF attachment`,
      function_area: 'AOD Management',
      new_values: {
        emails: attorneyEmails,
        ccEmails: ccEmails,
        regenerate,
        messageId: emailResult.messageId,
        customEmail: customEmail ? true : false,
        pdfAttached: !!attachments
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `AOD email sent successfully to ${attorneyEmails.length} recipient(s) with PDF attachment`,
        recipients: attorneyEmails,
        messageId: emailResult.messageId,
        pdfAttached: !!attachments
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error sending AOD email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
