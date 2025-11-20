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

    // Calculate installments and payment terms
    const balanceDue = totalCost - depositAmount;
    const depositPercentage = ((depositAmount / totalCost) * 100).toFixed(0);
    
    // Determine payment term from payment_plan_structure or calculate from contract duration
    let paymentTerm = '';
    if (monthsDiff <= 1) paymentTerm = '30 days';
    else if (monthsDiff <= 2) paymentTerm = '60 days';
    else if (monthsDiff <= 3) paymentTerm = '90 days';
    else if (monthsDiff <= 4) paymentTerm = '120 days';
    else if (monthsDiff <= 6) paymentTerm = '6 months';
    else if (monthsDiff <= 7) paymentTerm = '7 months';
    else if (monthsDiff <= 8) paymentTerm = '8 months';
    else if (monthsDiff <= 9) paymentTerm = '9 months';
    else if (monthsDiff <= 10) paymentTerm = '10 months';
    else if (monthsDiff <= 11) paymentTerm = '11 months';
    else paymentTerm = '12 months';

    const numberOfInstallments = Math.max(1, monthsDiff);
    const installmentAmount = balanceDue / numberOfInstallments;

    // Generate PDF HTML using AOD template structure
    const pdfHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 2cm; }
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      font-size: 11pt;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #2c5282;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .company-name {
      font-size: 18pt;
      font-weight: bold;
      color: #2c5282;
      margin: 0;
      text-transform: uppercase;
    }
    .company-tagline {
      font-size: 10pt;
      color: #4a5568;
      margin: 5px 0 15px 0;
    }
    h1 {
      font-size: 16pt;
      color: #2c5282;
      margin: 20px 0;
      text-align: center;
      text-transform: uppercase;
      border-bottom: 2px solid #2c5282;
      padding-bottom: 10px;
    }
    h2 {
      font-size: 12pt;
      color: #2c5282;
      margin-top: 25px;
      margin-bottom: 15px;
      text-transform: uppercase;
    }
    h3 {
      font-size: 11pt;
      color: #4a5568;
      margin-top: 15px;
      margin-bottom: 10px;
    }
    .section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    .parties-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 20px 0;
    }
    .party-box {
      border: 1px solid #cbd5e0;
      padding: 15px;
      border-radius: 5px;
      background: #f7fafc;
    }
    .party-box h3 {
      margin-top: 0;
      color: #2c5282;
      border-bottom: 1px solid #cbd5e0;
      padding-bottom: 8px;
    }
    .info-row {
      margin: 8px 0;
    }
    .info-row strong {
      color: #2d3748;
      display: inline-block;
      min-width: 140px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      border: 1px solid #cbd5e0;
      padding: 10px;
      text-align: left;
    }
    th {
      background-color: #2c5282;
      color: white;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f7fafc;
    }
    .financial-summary {
      background: #edf2f7;
      padding: 20px;
      border-radius: 5px;
      border-left: 4px solid #2c5282;
      margin: 20px 0;
    }
    .financial-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #cbd5e0;
    }
    .financial-row:last-child {
      border-bottom: none;
      font-weight: bold;
      font-size: 12pt;
      color: #2c5282;
    }
    .terms-list {
      margin: 15px 0;
      padding-left: 25px;
    }
    .terms-list li {
      margin: 10px 0;
      line-height: 1.8;
    }
    .clause {
      margin: 15px 0;
      padding-left: 20px;
    }
    .clause-number {
      font-weight: bold;
      color: #2c5282;
      margin-right: 10px;
    }
    .bank-details {
      background: #f7fafc;
      border: 2px solid #2c5282;
      padding: 20px;
      border-radius: 5px;
      margin: 20px 0;
    }
    .bank-details table {
      margin: 10px 0;
    }
    .bank-details th {
      background-color: #4a5568;
    }
    .signatures {
      margin-top: 50px;
      page-break-inside: avoid;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 30px;
    }
    .signature-block {
      border: 1px solid #cbd5e0;
      padding: 20px;
      border-radius: 5px;
      min-height: 200px;
    }
    .signature-block h4 {
      color: #2c5282;
      margin-top: 0;
      border-bottom: 2px solid #2c5282;
      padding-bottom: 10px;
    }
    .signature-line {
      margin-top: 60px;
      border-bottom: 2px solid #000;
      width: 100%;
    }
    .signature-label {
      margin-top: 5px;
      font-size: 9pt;
      color: #4a5568;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 9pt;
      color: #718096;
      border-top: 1px solid #cbd5e0;
      padding-top: 20px;
    }
    .highlight-box {
      background: #fff5f5;
      border-left: 4px solid #f56565;
      padding: 15px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <p class="company-name">KUTLWANO & ASSOCIATES</p>
    <p class="company-tagline">MEDICO LEGAL</p>
    <p style="margin: 5px 0;">Registration Number: 2016/461385/07</p>
  </div>

  <!-- Title -->
  <h1>SHORT-TERM SERVICE AGREEMENT</h1>

  <!-- Agreement Reference -->
  <div class="section">
    ${agreement.agreement_reference ? `
      <div class="info-row">
        <strong>Agreement Reference:</strong> ${agreement.agreement_reference}
      </div>
    ` : ''}
    <div class="info-row">
      <strong>Agreement Date:</strong> ${new Date().toLocaleDateString('en-ZA')}
    </div>
    <div class="info-row">
      <strong>Agreement Method:</strong> ${agreement.agreement_method.charAt(0).toUpperCase() + agreement.agreement_method.slice(1)}
    </div>
  </div>

  <!-- Parties -->
  <h2>PARTIES TO THIS AGREEMENT</h2>
  <div class="parties-section">
    <div class="party-box">
      <h3>THE CREDITOR</h3>
      <div class="info-row"><strong>Name:</strong> Kutlwano & Associates (Pty) Ltd</div>
      <div class="info-row"><strong>Registration:</strong> 2016/461385/07</div>
      <div class="info-row"><strong>Representative:</strong> Mr. Moleka Boshomane (Managing Director)</div>
    </div>
    
    <div class="party-box">
      <h3>THE DEBTOR</h3>
      <div class="info-row"><strong>Firm Name:</strong> ${attorney.name || 'N/A'}</div>
      ${attorney.contact_person ? `<div class="info-row"><strong>Contact Person:</strong> ${attorney.contact_person}</div>` : ''}
      ${attorney.email ? `<div class="info-row"><strong>Email:</strong> ${attorney.email}</div>` : ''}
      ${attorney.phone ? `<div class="info-row"><strong>Phone:</strong> ${attorney.phone}</div>` : ''}
      ${attorney.address ? `<div class="info-row"><strong>Address:</strong> ${attorney.address}</div>` : ''}
    </div>
  </div>

  <p style="margin: 20px 0; font-style: italic;">
    The parties have entered into this agreement in good faith for the purposes of safeguarding 
    the interests of the Creditor for payment of money/monies due in respect of medico-legal 
    assessments, as per the terms and conditions stipulated below.
  </p>

  <!-- Scope of Services -->
  <h2>SCOPE OF SERVICES</h2>
  <div class="section">
    <p>Kutlwano & Associate (Pty) Ltd shall provide medico-legal assessment services which may include but are not limited to:</p>
    <ul class="terms-list">
      <li>Road Accident Fund (RAF) assessments</li>
      <li>Personal injury evaluations</li>
      <li>Medical negligence assessments</li>
      <li>Related specialist reports</li>
      <li>Preparation of joint minutes and expert testimony, where required</li>
    </ul>
    <p>All assessments shall be undertaken by duly qualified and registered medical experts.</p>

    <h3>Contract Description:</h3>
    <p>${agreement.contract_description || 'Medico-legal assessment services'}</p>
    
    ${claimants.length > 0 ? `
    <h3>Claimants Covered Under This Agreement:</h3>
    <table>
      <thead>
        <tr>
          <th>Claimant ID</th>
          <th>Claimant Name</th>
          <th>Expert Type</th>
        </tr>
      </thead>
      <tbody>
        ${claimants.map(c => `
          <tr>
            <td>${c.autoId || 'N/A'}</td>
            <td>${c.name}</td>
            <td>${c.expertType || 'N/A'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
  </div>

  <!-- Financial Terms -->
  <h2>1. TERMS OF THE AGREEMENT</h2>
  <div class="section">
    <div class="clause">
      <span class="clause-number">1.1.</span>
      The Creditor has rendered/will render services and provide medico-legal reports to the Debtor 
      to the value of <strong>R ${totalCost.toFixed(2)}</strong>.
    </div>

    <div class="clause">
      <span class="clause-number">1.2.</span>
      The Debtor agrees to the amount in paragraph 1.1 above. The parties confirm that the Debtor will pay/has paid:
      <div class="financial-summary" style="margin: 15px 0 15px 40px;">
        <div class="financial-row">
          <span>Deposit Amount (${depositPercentage}%):</span>
          <strong>R ${depositAmount.toFixed(2)}</strong>
        </div>
        <div class="financial-row">
          <span>Outstanding Balance:</span>
          <strong>R ${balanceDue.toFixed(2)}</strong>
        </div>
      </div>
    </div>

    <div class="clause">
      <span class="clause-number">1.3.</span>
      The Debtor confirms and agrees to pay the outstanding balance to the Creditor over a period of 
      <strong>${paymentTerm}</strong>${installmentAmount > 0 ? `, with ${numberOfInstallments > 1 ? numberOfInstallments + ' installments' : 'payment'} 
      of R ${installmentAmount.toFixed(2)} each` : ''}.
    </div>

    <div class="clause">
      <span class="clause-number">1.4.</span>
      The parties, more specifically the Debtor, agree that the amounts stated above are as agreed and are not in dispute.
    </div>

    <div class="clause">
      <span class="clause-number">1.5.</span>
      The Debtor agrees that payment shall be made no later than the close of business on the last day of the agreed payment term.
    </div>

    <div class="clause">
      <span class="clause-number">1.6.</span>
      In the event that the Debtor is unable to effect the required payment by the date stipulated, 
      the Debtor shall advise the Creditor in writing immediately and no later than 7 (seven) days 
      of the payment becoming due, providing reason for late payment and officially requesting an extension if necessary.
    </div>

    <div class="clause">
      <span class="clause-number">1.7.</span>
      The Debtor acknowledges that any indulgence granted is strictly within the sole discretion of the Creditor.
    </div>

    <div class="clause">
      <span class="clause-number">1.8.</span>
      In the event of the Creditor denying any indulgence, the Creditor shall be at liberty to take 
      necessary action to recover outstanding money due.
    </div>
  </div>

  <!-- Duration -->
  <h2>2. DURATION OF THE AGREEMENT</h2>
  <div class="section">
    <div class="clause">
      <span class="clause-number">2.1.</span>
      This Agreement shall commence on <strong>${new Date(agreement.contract_start_date).toLocaleDateString('en-ZA')}</strong> 
      and remain in force until <strong>${new Date(agreement.contract_end_date).toLocaleDateString('en-ZA')}</strong>, 
      or until full payment is made, whichever comes first.
    </div>

    <div class="clause">
      <span class="clause-number">2.2.</span>
      In the event of the Debtor failing to effect necessary payments as per agreed terms, the Creditor reserves the right to:
      <ul class="terms-list">
        <li>Charge interest on overdue amounts at the prevailing legal rate</li>
        <li>Suspend any further services until payment is received in full</li>
        <li>Pursue legal action to recover all amounts owing, including recovery expenses</li>
      </ul>
    </div>
  </div>

  <!-- Governing Terms -->
  <h2>3. GOVERNING AGREEMENT</h2>
  <div class="section">
    <div class="clause">
      <span class="clause-number">3.1.</span>
      The Debtor is bound by the terms of this agreement and is indebted to the Creditor as per clauses 1-2.
    </div>

    <div class="clause">
      <span class="clause-number">3.2.</span>
      The provisions of this agreement shall not be amended without written consent from the Creditor.
    </div>

    <div class="clause">
      <span class="clause-number">3.3.</span>
      The Debtor shall make all required payments into the Creditor's bank account:
    </div>
  </div>

  <!-- Bank Details -->
  <div class="bank-details">
    <h3 style="margin-top: 0; color: #2c5282;">PAYMENT DETAILS</h3>
    <table>
      <tr>
        <th style="width: 40%;">Detail</th>
        <th>Information</th>
      </tr>
      <tr>
        <td><strong>Bank:</strong></td>
        <td>First National Bank</td>
      </tr>
      <tr>
        <td><strong>Account Name:</strong></td>
        <td>Kutlwano and Associate (Pty) Ltd</td>
      </tr>
      <tr>
        <td><strong>Account Number:</strong></td>
        <td>62770592270</td>
      </tr>
      <tr>
        <td><strong>Branch Name:</strong></td>
        <td>Middestad</td>
      </tr>
      <tr>
        <td><strong>Branch Code:</strong></td>
        <td>260448</td>
      </tr>
    </table>
  </div>

  <!-- Additional Sections -->
  <h2>4. CONFIDENTIALITY</h2>
  <div class="section">
    <div class="clause">
      <span class="clause-number">4.1.</span>
      Both Parties shall treat all information exchanged in connection with this Agreement as strictly confidential.
    </div>
    <div class="clause">
      <span class="clause-number">4.2.</span>
      Neither Party shall disclose or use any such information for purposes other than the execution of this Agreement, 
      except as required by law or with prior written consent.
    </div>
  </div>

  <h2>5. GENERAL PROVISIONS</h2>
  <div class="section">
    <ul class="terms-list">
      <li>This Agreement constitutes the entire understanding between the Parties and supersedes all prior discussions or agreements.</li>
      <li>No amendment, variation, or waiver shall be valid unless reduced to writing and signed by both Parties.</li>
      <li>Neither Party may cede, assign, or transfer its rights or obligations without prior written consent of the other Party.</li>
    </ul>
  </div>

  ${agreement.notes ? `
    <div class="highlight-box">
      <h3 style="margin-top: 0; color: #c53030;">ADDITIONAL NOTES</h3>
      <p>${agreement.notes}</p>
    </div>
  ` : ''}

  <!-- Signatures -->
  <div class="signatures">
    <h2>SIGNATURES</h2>
    <p style="margin: 20px 0;">
      SIGNED AT _____________________ ON THIS THE _____ DAY OF _____________________ 20___
    </p>

    <div class="signature-grid">
      <div class="signature-block">
        <h4>CREDITOR</h4>
        <p><strong>Kutlwano & Associates (Pty) Ltd</strong></p>
        <p>Duly authorised representative:</p>
        <p><strong>Mr. Moleka Boshomane</strong></p>
        <p style="font-size: 9pt; color: #718096;">Managing Director</p>
        
        <div class="signature-line"></div>
        <p class="signature-label">Signature</p>
        
        <div style="margin-top: 30px;">
          <strong>AS WITNESS:</strong>
          <div style="margin-top: 40px;">
            <div class="signature-line"></div>
            <p class="signature-label">Full Name & Signature</p>
          </div>
        </div>
      </div>

      <div class="signature-block">
        <h4>DEBTOR</h4>
        <p><strong>${attorney.name || '_____________________________'}</strong></p>
        <p>Duly authorised representative:</p>
        <p>_____________________________</p>
        <p style="font-size: 9pt; color: #718096;">(State capacity)</p>
        
        <div class="signature-line"></div>
        <p class="signature-label">Signature</p>
        
        <div style="margin-top: 30px;">
          <strong>AS WITNESS:</strong>
          <div style="margin-top: 40px;">
            <div class="signature-line"></div>
            <p class="signature-label">Full Name & Signature</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p><strong>Kutlwano & Associates (Pty) Ltd</strong></p>
    <p>52 Quatar Crescent, Cosmo City, Ext 10, Roodepoort, 2188</p>
    <p>WE MEDICO THE PLAINTIFF | WE REFER THE VICTIMS | WE ARE KUTLWANO AND ASSOCIATE</p>
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
