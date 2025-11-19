import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
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
            
            <p>Please find your Agreement of Debt (AOD) confirming the approved payment terms for medico-legal services rendered by Kutlwano & Associates (Pty) Ltd.</p>
            
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
            From: ${new Date(aodDoc.contract_start_date).toLocaleDateString()}<br>
            To: ${new Date(aodDoc.contract_end_date).toLocaleDateString()}</p>

            <p><strong>Next Payment Due:</strong> ${new Date(aodDoc.next_payment_date).toLocaleDateString()}</p>

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

    // Get the PDF attachment if document_url exists
    let attachments: Array<{ filename: string; content: string }> | undefined;
    
    if (aodDoc.document_url && aodDoc.document_url !== 'pending') {
      try {
        console.log('Fetching AOD document for attachment:', aodDoc.document_url);
        
        // Check if document_url is a full URL or a storage path
        let pdfBlob: Blob;
        
        if (aodDoc.document_url.startsWith('http://') || aodDoc.document_url.startsWith('https://')) {
          // It's a full URL, fetch it directly
          const response = await fetch(aodDoc.document_url);
          if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.statusText}`);
          }
          pdfBlob = await response.blob();
        } else {
          // It's a storage path, download from Supabase storage
          const { data: pdfData, error: downloadError } = await supabaseClient
            .storage
            .from('documents')
            .download(aodDoc.document_url);
          
          if (downloadError) {
            console.error('Error downloading PDF from storage:', downloadError);
            throw downloadError;
          }
          
          pdfBlob = pdfData;
        }
        
        // Convert blob to base64
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );
        
        attachments = [{
          filename: aodDoc.file_name || `AOD-${aodDocumentId}.pdf`,
          content: base64
        }];
        
        console.log('PDF attachment prepared successfully');
      } catch (attachmentError) {
        console.error('Error preparing PDF attachment:', attachmentError);
        // Continue without attachment rather than failing the entire email
      }
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

    // Update AOD document status
    await supabaseClient
      .from('aod_documents')
      .update({
        payment_status: aodDoc.payment_status === 'pending' ? 'active' : aodDoc.payment_status,
        updated_at: new Date().toISOString()
      })
      .eq('id', aodDocumentId);

    // Log the email
    await supabaseClient.from('audit_logs').insert({
      user_id: (await supabaseClient.auth.getUser()).data.user?.id,
      action_type: 'EMAIL_SENT',
      table_name: 'aod_documents',
      record_id: aodDocumentId,
      description: `AOD email ${regenerate ? 'resent' : 'sent'} to ${attorneyEmails.join(', ')}${ccEmails.length > 0 ? ` (CC: ${ccEmails.join(', ')})` : ''}`,
      function_area: 'AOD Management',
      new_values: {
        emails: attorneyEmails,
        ccEmails: ccEmails,
        regenerate,
        messageId: emailResult.messageId,
        customEmail: customEmail ? true : false
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `AOD email sent successfully to ${attorneyEmails.length} recipient(s)`,
        recipients: attorneyEmails,
        messageId: emailResult.messageId
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
