import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AODGenerationRequest {
  aodDocumentId: string;
  previewMode?: boolean;
  customData?: any;
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

    const { aodDocumentId, previewMode = false, customData }: AODGenerationRequest = await req.json();

    // Fetch AOD document details with attorney and company info
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
          registration_number
        )
      `)
      .eq('id', aodDocumentId)
      .single();

    if (aodError || !aodDoc) {
      throw new Error('AOD document not found');
    }

    const attorney = aodDoc.referring_attorneys;
    
    // Use custom data if provided (for preview edits), otherwise use AOD data
    const data = customData || aodDoc;
    
    // Calculate payment details
    const totalDebt = parseFloat(data.total_contract_value || aodDoc.total_contract_value || '0');
    const depositAmount = parseFloat(data.deposit_amount || aodDoc.deposit_amount || '0');
    const remainingBalance = totalDebt - depositAmount;
    const paymentsMade = parseFloat(data.payments_made || aodDoc.payments_made || '0');
    const currentBalance = remainingBalance - paymentsMade;
    
    // Determine term description
    const termMonths = data.agreement_duration_months || aodDoc.agreement_duration_months || 0;
    let termDescription = '';
    if (termMonths <= 1) termDescription = '30 Days';
    else if (termMonths <= 2) termDescription = '60 Days';
    else if (termMonths <= 3) termDescription = '90 Days';
    else if (termMonths <= 6) termDescription = '6 Months';
    else if (termMonths <= 12) termDescription = '12 Months';
    else termDescription = '24 Months';

    // Calculate quarterly payment amount
    const quarters = Math.ceil(termMonths / 3);
    const quarterlyPayment = quarters > 0 ? (remainingBalance / quarters).toFixed(2) : '0.00';

    // Generate PDF content as HTML (to be converted to PDF)
    const pdfHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          ${previewMode ? '.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 120px; color: rgba(255, 0, 0, 0.1); z-index: -1; }' : ''}
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #1FB6CE;
            margin: 0;
          }
          .header .tagline {
            color: #16A085;
            font-style: italic;
            font-size: 12px;
            margin-top: 5px;
          }
          .section {
            margin: 20px 0;
          }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #333;
            margin: 15px 0 10px 0;
            border-bottom: 2px solid #1FB6CE;
            padding-bottom: 5px;
          }
          .party-info {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            margin: 10px 0;
          }
          .terms {
            margin: 20px 0;
          }
          .terms li {
            margin: 10px 0;
          }
          .signature-section {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            width: 45%;
            border-top: 1px solid #333;
            padding-top: 10px;
          }
          .footer {
            position: fixed;
            bottom: 20px;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px solid #1FB6CE;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        ${previewMode ? '<div class="watermark">DRAFT</div>' : ''}
        <div class="header">
          <h1>KUTLWANO & ASSOCIATE MEDICO LEGAL</h1>
          <p class="tagline">"We touch a file, We change a life, We are Kutlwano and Associate"</p>
          <h2>ACKNOWLEDGEMENT OF DEBT</h2>
          ${previewMode ? '<p style="color: red; font-weight: bold; text-align: center;">DRAFT - FOR REVIEW ONLY</p>' : ''}
        </div>

        <div class="section">
          <p>The parties to this Acknowledgement of Debt are listed below as follows:</p>
        </div>

        <div class="party-info">
          <div class="section-title">KUTLWANO & ASSOCIATES (PTY) LTD</div>
          <p><strong>REGISTRATION NUMBER:</strong> 2016/461385/07</p>
          <p>Herein referred to as <strong>"the Creditor"</strong></p>
        </div>

        <div class="party-info">
          <div class="section-title">${attorney?.name || 'ATTORNEY FIRM'}</div>
          <p><strong>REGISTRATION NUMBER:</strong> ${attorney?.registration_number || '_________________'}</p>
          <p><strong>CONTACT PERSON:</strong> ${attorney?.contact_person || '_________________'}</p>
          <p><strong>EMAIL:</strong> ${attorney?.email || '_________________'}</p>
          <p><strong>PHONE:</strong> ${attorney?.phone || '_________________'}</p>
          <p>Herein referred to as <strong>"the Debtor"</strong></p>
        </div>

        <div class="section">
          <p>The Creditor, Kutlwano and Associates (Pty) Ltd, who for purposes of this agreement is duly represented by the company's Managing Director <strong>Mr. Moleka Boshomane</strong>.</p>
          <p>The Debtor, <strong>${attorney?.name || '_________________'}</strong>, who for purposes of this agreement is duly represented by the company's ${attorney?.contact_person || '_________________'}.</p>
        </div>

        <div class="section">
          <p>The parties have entered into this agreement in good faith and for the purposes of safeguarding the interests of the Creditor for the payment of money/monies that are due to the Creditor by the Debtor, in respect of medico-legal assessments.</p>
        </div>

        <div class="section-title">SCOPE OF SERVICES</div>
        <div class="section">
          <p>Kutlwano & Associate PTY LTD shall provide medico-legal assessment services which may include but are not limited to:</p>
          <ol>
            <li>Road Accident Fund (RAF);</li>
            <li>Personal injury;</li>
            <li>Medical negligence;</li>
            <li>Related specialist reports;</li>
            <li>Preparation of joint minutes and expert testimony, where required;</li>
            <li>Kutlwano & Associate PTY LTD shall ensure that all assessments are undertaken by duly qualified and registered medical experts.</li>
          </ol>
        </div>

        <div class="section-title">TERMS OF THE AGREEMENT</div>
        <div class="terms">
          <ol>
            <li>The Creditor has rendered services and provided medico legal reports to the Debtor which are to the value/amount of <strong>R${totalDebt.toFixed(2)}</strong> (${this.numberToWords(totalDebt)} Rand).</li>
            
            <li>The Debtor agrees to the amount in paragraph 1 above, the parties confirm that the Debtor:
              <ul>
                <li>Has paid a deposit on <strong>${new Date(aodDoc.contract_start_date).toLocaleDateString()}</strong>, to the Creditor, in the amount of <strong>R${depositAmount.toFixed(2)}</strong> (${this.numberToWords(depositAmount)} Rand)</li>
                <li>With outstanding confirmed balance of <strong>R${remainingBalance.toFixed(2)}</strong> (${this.numberToWords(remainingBalance)} Rand)</li>
              </ul>
            </li>
            
            <li>The Debtor further confirms and agrees to pay the outstanding balance to the Creditor:
              <ul>
                <li>Over a period of <strong>${quarters} quarters</strong> (${termDescription}),</li>
                <li>With quarterly payments of <strong>R${quarterlyPayment}</strong> (${this.numberToWords(parseFloat(quarterlyPayment))} Rand).</li>
                <li>The first quarter payment by the Debtor will be due on <strong>${new Date(aodDoc.next_payment_date).toLocaleDateString()}</strong></li>
                <li>The last quarter payment will be due on <strong>${new Date(aodDoc.contract_end_date).toLocaleDateString()}</strong></li>
              </ul>
            </li>

            <li>The parties, more specifically the Debtor, agree and confirm that the amounts stated above are agreed and not in dispute.</li>

            <li>A minimum of ten (10) assessments referred by the Referring Attorney to Kutlwano & Associate shall constitute and activate this Agreement.</li>

            <li>Any further assessments referred beyond the initial ten (10) shall be governed by the same terms and conditions herein.</li>
          </ol>
        </div>

        <div class="section">
          <p><strong>Agreement Date:</strong> ${new Date(aodDoc.contract_start_date).toLocaleDateString()}</p>
          <p><strong>Reference Number:</strong> ${aodDoc.file_name || aodDoc.id}</p>
          <p><strong>Authorized By:</strong> System Admin / Kutlwano & Associates</p>
          <p><strong>Payment Status:</strong> ${aodDoc.payment_status || 'pending'}</p>
          <p><strong>Current Balance:</strong> R${currentBalance.toFixed(2)}</p>
        </div>

        <div class="signature-section">
          <div class="signature-box">
            <p><strong>Creditor:</strong> Kutlwano & Associates (Pty) Ltd</p>
            <p>Signature: ${data.company_signature || '_____________________'}</p>
            <p>Date: ${data.company_signature_date || '_____________________'}</p>
          </div>
          <div class="signature-box">
            <p><strong>Debtor:</strong> ${attorney?.name || '_________________'}</p>
            <p>Signature: ${data.attorney_signature || '_____________________'}</p>
            <p>Date: ${data.attorney_signature_date || '_____________________'}</p>
          </div>
        </div>

        <div class="footer">
          <p>Kutlwano & Associates (Pty) Ltd | "We touch a file, We change a life, We are Kutlwano and Associate"</p>
          ${previewMode ? '<p style="color: red; font-weight: bold;">DRAFT DOCUMENT - NOT FOR OFFICIAL USE</p>' : ''}
        </div>
      </body>
      </html>
    `;

    // Store the HTML content for now (PDF generation would need additional library)
    // In production, you'd use a PDF generation library or service
    const pdfData = {
      html: pdfHtml,
      aodDocumentId,
      attorneyName: attorney?.name,
      generatedAt: new Date().toISOString()
    };

    // Log the generation (only if not preview mode)
    if (!previewMode) {
      await supabaseClient.from('audit_logs').insert({
        user_id: (await supabaseClient.auth.getUser()).data.user?.id,
        action_type: 'CREATE',
        table_name: 'aod_documents',
        record_id: aodDocumentId,
        description: `Generated AOD PDF for ${attorney?.name}`,
        function_area: 'AOD Management',
        new_values: { generated: true }
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdfData: pdfHtml,
        metadata: {
          attorneyName: attorney?.name,
          attorneyEmail: attorney?.email,
          totalDebt,
          depositAmount,
          remainingBalance,
          reference: aodDocumentId.substring(0, 8).toUpperCase()
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

// Helper function to convert numbers to words (simplified)
function numberToWords(num: number): string {
  // Simplified implementation - returns formatted number
  return num.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
