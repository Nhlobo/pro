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

    const { aodDocumentId, regenerate = false }: AODEmailRequest = await req.json();

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
    
    if (!attorney?.email) {
      throw new Error('Attorney email not found');
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
    const emailHtml = `
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

    // Send email
    const emailResult = await sendEmail({
      to: attorney.email,
      subject: `Agreement of Debt – Payment Terms Confirmation ${regenerate ? '(Updated)' : ''}`,
      html: emailHtml,
      replyTo: 'accounts@kamedico-legal.co.za'
    });

    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Failed to send email');
    }

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
      description: `AOD email ${regenerate ? 'resent' : 'sent'} to ${attorney.name}`,
      function_area: 'AOD Management',
      new_values: {
        email: attorney.email,
        regenerate,
        messageId: emailResult.messageId
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `AOD email sent successfully to ${attorney.email}`,
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
