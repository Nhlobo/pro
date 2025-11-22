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

    // Generate PDF HTML
    const pdfHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #333; }
          .page { max-width: 210mm; margin: 0 auto; padding: 20mm; background: white; }
          .header { text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #1fb6ce 0%, #159baf 100%); color: white; }
          .header h1 { font-size: 24pt; margin-bottom: 5px; }
          .header .tagline { font-size: 10pt; font-style: italic; }
          .header .registration { font-size: 9pt; margin-top: 5px; }
          .doc-title { text-align: center; font-size: 18pt; font-weight: bold; margin: 30px 0; color: #1fb6ce; }
          .section { margin: 20px 0; }
          .section-title { font-size: 12pt; font-weight: bold; color: #1fb6ce; margin: 20px 0 10px 0; padding-bottom: 5px; border-bottom: 2px solid #1fb6ce; }
          .party-box { border: 1px solid #ddd; padding: 15px; margin: 10px 0; background: #f9f9f9; }
          .party-box h3 { font-size: 11pt; margin-bottom: 10px; color: #1fb6ce; }
          .info-row { margin: 5px 0; }
          .info-label { font-weight: bold; display: inline-block; width: 150px; }
          .financial-summary { background: #f0f8ff; border: 2px solid #1fb6ce; padding: 15px; margin: 20px 0; }
          .financial-summary table { width: 100%; border-collapse: collapse; }
          .financial-summary td { padding: 8px; border-bottom: 1px solid #ddd; }
          .financial-summary td:first-child { font-weight: bold; width: 60%; }
          .financial-summary td:last-child { text-align: right; }
          .terms-list { margin-left: 20px; }
          .terms-list li { margin: 10px 0; }
          .signature-section { margin-top: 40px; }
          .signature-block { display: inline-block; width: 45%; margin: 20px 0; vertical-align: top; }
          .signature-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 5px; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #1fb6ce; text-align: center; font-size: 9pt; color: #666; }
          ${previewMode ? '.page::before { content: "DRAFT"; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 120pt; color: rgba(255, 0, 0, 0.1); font-weight: bold; z-index: 9999; }' : ''}
        </style>
      </head>
      <body>
        <div class="page">
          <!-- Header -->
          <div class="header">
            <h1>KUTLWANO & ASSOCIATES (PTY) LTD</h1>
            <div class="registration">Registration: 2016/461385/07</div>
            <div class="tagline">"We touch a file, We change a life, We are Kutlwano and Associate"</div>
          </div>
          
          <!-- Document Title -->
          <div class="doc-title">AGREEMENT OF DEBT (AOD)</div>
          
          <!-- Agreement Reference -->
          <div class="section">
            <div class="info-row"><span class="info-label">Reference:</span> ${aodDocumentId.substring(0, 8).toUpperCase()}</div>
            <div class="info-row"><span class="info-label">Date:</span> ${new Date().toLocaleDateString('en-ZA')}</div>
          </div>

          <!-- Party 1 -->
          <div class="section">
            <div class="section-title">PARTY 1: SERVICE PROVIDER</div>
            <div class="party-box">
              <div class="info-row"><span class="info-label">Company:</span> Kutlwano & Associates (Pty) Ltd</div>
              <div class="info-row"><span class="info-label">Registration:</span> 2016/461385/07</div>
              <div class="info-row"><span class="info-label">Contact:</span> info@kamedico-legal.co.za</div>
            </div>
          </div>

          <!-- Party 2 -->
          <div class="section">
            <div class="section-title">PARTY 2: REFERRING ATTORNEY</div>
            <div class="party-box">
              <div class="info-row"><span class="info-label">Firm:</span> ${attorney?.name || 'N/A'}</div>
              <div class="info-row"><span class="info-label">Contact Person:</span> ${attorney?.contact_person || 'N/A'}</div>
              <div class="info-row"><span class="info-label">Email:</span> ${attorney?.email || 'N/A'}</div>
              <div class="info-row"><span class="info-label">Phone:</span> ${attorney?.phone || 'N/A'}</div>
              <div class="info-row"><span class="info-label">Code:</span> ${attorney?.code || 'N/A'}</div>
            </div>
          </div>

          <!-- Financial Summary -->
          <div class="section">
            <div class="section-title">FINANCIAL SUMMARY</div>
            <div class="financial-summary">
              <table>
                <tr>
                  <td>Total Contract Value:</td>
                  <td>R ${totalDebt.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Deposit Paid:</td>
                  <td>R ${depositAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Outstanding Balance:</td>
                  <td>R ${remainingBalance.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Payments Made:</td>
                  <td>R ${paymentsMade.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Current Balance:</td>
                  <td><strong>R ${currentBalance.toFixed(2)}</strong></td>
                </tr>
                <tr>
                  <td>Payment Term:</td>
                  <td>${termDescription}</td>
                </tr>
                <tr>
                  <td>Quarterly Payment:</td>
                  <td>R ${quarterlyPayment}</td>
                </tr>
              </table>
            </div>
          </div>

          <!-- Payment Terms -->
          <div class="section">
            <div class="section-title">PAYMENT TERMS AND CONDITIONS</div>
            <ol class="terms-list">
              <li>The Referring Attorney acknowledges and agrees to the debt amount stated above.</li>
              <li>Payment shall be made according to the agreed payment schedule outlined in this agreement.</li>
              <li>Quarterly payments of R ${quarterlyPayment} are due at the beginning of each quarter.</li>
              <li>Late payments may incur interest at a rate of ${data.interest_rate_1_3_months || 10}% per annum.</li>
              <li>This agreement is binding upon both parties and their successors.</li>
              <li>Any disputes arising from this agreement shall be resolved through mediation.</li>
            </ol>
          </div>

          <!-- Signature Section -->
          <div class="signature-section">
            <div class="signature-block">
              <div class="signature-line">
                <div><strong>For Kutlwano & Associates</strong></div>
                <div>Authorized Signatory</div>
                <div>Date: _________________</div>
              </div>
            </div>
            <div class="signature-block" style="float: right;">
              <div class="signature-line">
                <div><strong>For ${attorney?.name || 'Referring Attorney'}</strong></div>
                <div>Authorized Signatory</div>
                <div>Date: _________________</div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div>This document was generated electronically and is valid without signature</div>
            <div>For queries, contact: info@kamedico-legal.co.za</div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Return HTML for now (can be converted to PDF on client side or using a PDF service)
    const htmlBase64 = btoa(unescape(encodeURIComponent(pdfHtml)));

    // Log the generation (only if not preview mode)
    if (!previewMode) {
      await supabaseClient.from('audit_logs').insert({
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
        pdfData: htmlBase64,
        htmlContent: pdfHtml,
        metadata: {
          attorneyName: attorney?.name,
          attorneyEmail: attorney?.email,
          totalDebt,
          depositAmount,
          remainingBalance,
          currentBalance,
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
