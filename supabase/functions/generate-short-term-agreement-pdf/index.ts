import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShortTermAgreementRequest {
  agreementId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { agreementId }: ShortTermAgreementRequest = await req.json();

    // Fetch agreement details
    const { data: agreement, error: agreementError } = await supabase
      .from('short_term_agreements')
      .select('*')
      .eq('id', agreementId)
      .single();

    if (agreementError || !agreement) {
      throw new Error('Agreement not found');
    }

    // Fetch referring attorney details
    const { data: attorney, error: attorneyError } = await supabase
      .from('referring_attorneys')
      .select('*')
      .eq('id', agreement.referring_attorney_id)
      .single();

    if (attorneyError || !attorney) {
      throw new Error('Referring attorney not found');
    }

    // Fetch related appointments and claimants
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select(`
        *,
        claimants(first_name, last_name, auto_id),
        medical_experts(first_name, last_name, expert_type)
      `)
      .eq('referring_attorney_id', agreement.referring_attorney_id)
      .gte('appointment_date', agreement.contract_start_date)
      .lte('appointment_date', agreement.contract_end_date);

    const claimants = appointments?.map(apt => ({
      name: `${apt.claimants?.first_name} ${apt.claimants?.last_name}`,
      autoId: apt.claimants?.auto_id,
      expert: `${apt.medical_experts?.first_name} ${apt.medical_experts?.last_name}`,
      expertType: apt.medical_experts?.expert_type
    })) || [];

    // Calculate totals
    const totalReports = agreement.total_reports_agreed || claimants.length;
    const totalCost = agreement.total_contract_value || 0;
    const depositAmount = agreement.deposit_amount || (totalCost * 0.5);
    const remainingBalance = totalCost - depositAmount;

    // Determine payment term description
    const startDate = new Date(agreement.contract_start_date);
    const endDate = new Date(agreement.contract_end_date);
    const monthsDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    let termDescription = '';
    if (monthsDiff <= 3) {
      termDescription = '90 Days (3 months)';
    } else if (monthsDiff <= 4) {
      termDescription = '120 Days (4 months)';
    } else if (monthsDiff <= 6) {
      termDescription = '6 Months';
    } else {
      termDescription = '11-12 Months';
    }

    // Calculate installments
    const numInstallments = Math.max(1, monthsDiff - 2); // Excluding grace period
    const installmentAmount = remainingBalance / numInstallments;

    // Generate PDF HTML
    const pdfHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
    }
    .header h1 {
      color: #2563eb;
      margin: 0;
      font-size: 24px;
    }
    .header p {
      color: #666;
      margin: 5px 0;
    }
    .section {
      margin: 20px 0;
    }
    .section-title {
      background: #2563eb;
      color: white;
      padding: 10px;
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .info-row {
      display: flex;
      padding: 8px;
      border-bottom: 1px solid #eee;
    }
    .info-label {
      font-weight: bold;
      width: 200px;
    }
    .info-value {
      flex: 1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 10px;
      text-align: left;
    }
    th {
      background: #f0f0f0;
      font-weight: bold;
    }
    .highlight-box {
      background: #f8f9fa;
      border-left: 4px solid #2563eb;
      padding: 15px;
      margin: 15px 0;
    }
    .payment-terms {
      background: #fff3cd;
      border: 2px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .amount {
      font-weight: bold;
      color: #2563eb;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>SHORT-TERM AGREEMENT</h1>
    <p>Kutlwano & Associates</p>
    <p>Medical-Legal Services</p>
  </div>

  <div class="section">
    <div class="section-title">ATTORNEY INFORMATION</div>
    <div class="info-row">
      <div class="info-label">Attorney Name:</div>
      <div class="info-value">${attorney.contact_person || 'N/A'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Firm:</div>
      <div class="info-value">${attorney.name}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Email:</div>
      <div class="info-value">${attorney.email || 'N/A'}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Agreement Reference:</div>
      <div class="info-value">${agreement.agreement_reference || agreementId.substring(0, 8)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">AGREEMENT DETAILS</div>
    <div class="info-row">
      <div class="info-label">Agreement Type:</div>
      <div class="info-value">Short-Term Agreement (${termDescription})</div>
    </div>
    <div class="info-row">
      <div class="info-label">Agreement Method:</div>
      <div class="info-value">${agreement.agreement_method.toUpperCase()}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Contract Period:</div>
      <div class="info-value">${new Date(agreement.contract_start_date).toLocaleDateString()} - ${new Date(agreement.contract_end_date).toLocaleDateString()}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Duration:</div>
      <div class="info-value">${monthsDiff} months</div>
    </div>
  </div>

  ${claimants.length > 0 ? `
  <div class="section">
    <div class="section-title">CLAIMANTS & ASSESSMENTS</div>
    <table>
      <thead>
        <tr>
          <th>Claimant ID</th>
          <th>Claimant Name</th>
          <th>Expert</th>
          <th>Discipline</th>
        </tr>
      </thead>
      <tbody>
        ${claimants.map(c => `
          <tr>
            <td>${c.autoId}</td>
            <td>${c.name}</td>
            <td>${c.expert}</td>
            <td>${c.expertType}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">FINANCIAL SUMMARY</div>
    <div class="highlight-box">
      <div class="info-row">
        <div class="info-label">Number of Assessments:</div>
        <div class="info-value amount">${totalReports}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Total Cost of Reports:</div>
        <div class="info-value amount">R ${totalCost.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Discount Applied:</div>
        <div class="info-value amount">10%</div>
      </div>
      <div class="info-row">
        <div class="info-label">Deposit (50%):</div>
        <div class="info-value amount">R ${depositAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Remaining Balance:</div>
        <div class="info-value amount">R ${remainingBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="payment-terms">
      <h3 style="margin-top: 0; color: #333;">OPTION 2: PAYMENT TERMS</h3>
      <p><strong>We will apply a 10% discount.</strong></p>
      
      <p><strong>Deposit:</strong> 50% (R ${depositAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) of total report cost due before assessments are done.</p>
      
      <p><strong>Payment Plan:</strong></p>
      <ul>
        <li><strong>Payment Period:</strong> ${monthsDiff} months (Monthly installments)</li>
        <li>All reports will be furnished when they are ready.</li>
        <li>Remaining balance of R ${remainingBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to be paid within agreed time frames below.</li>
        ${monthsDiff > 6 ? '<li><strong>Grace period:</strong> November and December 2025.</li>' : ''}
        <li><strong>Installment Amount:</strong> R ${installmentAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per month</li>
        <li><strong>Number of Installments:</strong> ${numInstallments}</li>
        <li><strong>No interest will be charged.</strong></li>
      </ul>
      
      ${agreement.payment_plan_structure ? `<p><strong>Additional Details:</strong> ${agreement.payment_plan_structure}</p>` : ''}
    </div>
  </div>

  ${agreement.notes ? `
  <div class="section">
    <div class="section-title">ADDITIONAL NOTES</div>
    <p>${agreement.notes}</p>
  </div>
  ` : ''}

  <div class="footer">
    <p><strong>Kutlwano & Associates</strong></p>
    <p>Medical-Legal Services | ${new Date().toLocaleDateString()}</p>
    <p>This is an automatically generated document.</p>
  </div>
</body>
</html>
    `;

    // Log to audit trail
    await supabase.from('audit_logs').insert({
      user_id: agreement.created_by,
      action_type: 'PDF_GENERATED',
      table_name: 'short_term_agreements',
      record_id: agreementId,
      function_area: 'Short-Term Agreement',
      description: 'Generated Short-Term Agreement PDF',
      new_values: {
        agreement_id: agreementId,
        attorney_name: attorney.name,
        total_cost: totalCost
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdfHtml,
        metadata: {
          attorneyName: attorney.name,
          attorneyEmail: attorney.email,
          totalCost,
          totalReports,
          agreementReference: agreement.agreement_reference || agreementId.substring(0, 8)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error generating short-term agreement PDF:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
