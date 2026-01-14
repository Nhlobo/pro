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

// Creditor Info - Master Template Data
const CREDITOR_INFO = {
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

// Default Payment Stages - Master Template Data
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
    const originalContractValue = parseFloat(data.original_contract_value || data.total_contract_value || '0');
    const discountRate = parseFloat(data.discount_rate || '0');
    const discountAmount = (originalContractValue * discountRate) / 100;
    const totalDebt = discountRate > 0 ? originalContractValue - discountAmount : parseFloat(data.total_contract_value || '0');
    const depositAmount = parseFloat(data.deposit_amount || '0');
    const remainingBalance = totalDebt - depositAmount;
    const paymentsMade = parseFloat(data.payments_made || '0');
    const currentBalance = remainingBalance - paymentsMade;
    
    // Get agreement duration
    const agreementDuration = parseInt(data.agreement_duration_term || '12');
    
    // Calculate payment frequency and amounts
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
    
    // Calculate dates
    const startDate = new Date(data.contract_start_date || new Date());
    const endDate = new Date(data.contract_end_date || new Date());
    endDate.setMonth(startDate.getMonth() + agreementDuration);
    
    const firstPaymentDate = new Date(startDate);
    firstPaymentDate.setMonth(firstPaymentDate.getMonth() + (agreementDuration <= 3 ? 1 : 3));
    
    const lastPaymentDate = new Date(endDate);
    
    // Format dates
    const formatDate = (date: Date) => date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // Interest rate
    const interestRate = parseFloat(data.interest_rate_1_3_months || data.interest_rate_6_months || data.interest_rate_12_months || '7.25');
    
    // Total reports agreed
    const totalReportsAgreed = parseInt(data.total_reports_agreed || '10');
    
    // Debtor info
    const debtorLawFirm = data.debtor_law_firm_name || attorney?.name || 'N/A';
    const debtorRep = data.debtor_authorized_rep || attorney?.contact_person || 'N/A';
    const debtorAddress = data.debtor_domicilium_address || attorney?.address || 'N/A';
    const debtorRegNo = data.debtor_registration_number || 'N/A';
    
    // Generate PDF HTML using Master Template Structure
    const pdfHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.6; color: #333; }
          .page { max-width: 210mm; margin: 0 auto; padding: 25mm 20mm; background: white; }
          .header { text-align: center; margin-bottom: 30px; padding: 25px; background: linear-gradient(135deg, #1fb6ce 0%, #0d8ba0 100%); color: white; border-radius: 4px; }
          .header h1 { font-size: 22pt; margin-bottom: 5px; font-weight: bold; letter-spacing: 1px; }
          .header .tagline { font-size: 10pt; font-style: italic; margin-top: 8px; opacity: 0.9; }
          .header .registration { font-size: 9pt; margin-top: 5px; }
          .doc-title { text-align: center; font-size: 16pt; font-weight: bold; margin: 30px 0 20px 0; color: #1a1a1a; text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px solid #1fb6ce; padding-bottom: 10px; }
          .section { margin: 25px 0; page-break-inside: avoid; }
          .section-title { font-size: 13pt; font-weight: bold; color: #1fb6ce; margin: 25px 0 15px 0; padding: 8px 12px; background: #f0f9fa; border-left: 4px solid #1fb6ce; }
          .section-number { font-size: 11pt; color: #666; margin-right: 10px; }
          .party-box { border: 1px solid #ddd; padding: 18px; margin: 15px 0; background: #fafafa; border-radius: 4px; }
          .party-box h3 { font-size: 12pt; margin-bottom: 12px; color: #1fb6ce; font-weight: bold; }
          .info-row { margin: 8px 0; display: flex; }
          .info-label { font-weight: bold; display: inline-block; min-width: 180px; color: #555; }
          .info-value { flex: 1; }
          .clause { margin: 15px 0; padding: 12px 15px; background: #fff; border-left: 3px solid #e0e0e0; }
          .clause:hover { border-left-color: #1fb6ce; }
          .clause-title { font-weight: bold; color: #333; margin-bottom: 8px; font-size: 11pt; }
          .clause-content { text-align: justify; line-height: 1.7; }
          .financial-summary { background: linear-gradient(135deg, #f0f9fa 0%, #e6f4f7 100%); border: 2px solid #1fb6ce; padding: 20px; margin: 25px 0; border-radius: 6px; }
          .financial-summary h3 { color: #1fb6ce; margin-bottom: 15px; font-size: 13pt; text-align: center; }
          .financial-summary table { width: 100%; border-collapse: collapse; }
          .financial-summary td { padding: 10px 12px; border-bottom: 1px solid #d0e8ec; }
          .financial-summary td:first-child { font-weight: bold; width: 55%; color: #555; }
          .financial-summary td:last-child { text-align: right; font-size: 11pt; }
          .financial-summary tr:last-child td { border-bottom: none; font-weight: bold; }
          .discount-row { background: #fff3cd !important; }
          .discount-row td { color: #856404 !important; }
          .payment-stages { margin: 20px 0; }
          .payment-stage { display: flex; margin: 10px 0; padding: 12px; background: #fff; border: 1px solid #e0e0e0; border-radius: 4px; }
          .stage-number { background: #1fb6ce; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0; }
          .stage-content { flex: 1; }
          .stage-title { font-weight: bold; color: #333; margin-bottom: 5px; }
          .stage-details { font-size: 10pt; color: #666; }
          .signature-section { margin-top: 50px; page-break-inside: avoid; }
          .signature-grid { display: flex; justify-content: space-between; gap: 40px; }
          .signature-block { flex: 1; padding: 20px; border: 1px solid #ddd; border-radius: 4px; background: #fafafa; }
          .signature-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 8px; }
          .signature-label { font-size: 10pt; color: #666; margin-top: 5px; }
          .witness-section { margin-top: 30px; }
          .witness-grid { display: flex; gap: 30px; }
          .witness-block { flex: 1; }
          .bank-details { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .bank-details h4 { color: #1fb6ce; margin-bottom: 10px; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #1fb6ce; text-align: center; font-size: 9pt; color: #666; }
          .footer .contact { margin-top: 10px; }
          .annexure { page-break-before: always; }
          .annexure-title { font-size: 14pt; font-weight: bold; text-align: center; color: #1fb6ce; margin: 30px 0; padding: 15px; border: 2px solid #1fb6ce; background: #f0f9fa; }
          .schedule-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .schedule-table th { background: #1fb6ce; color: white; padding: 12px; text-align: left; font-weight: bold; }
          .schedule-table td { padding: 10px 12px; border-bottom: 1px solid #ddd; }
          .schedule-table tr:nth-child(even) { background: #f9f9f9; }
          ${previewMode ? '.page::before { content: "DRAFT"; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 100pt; color: rgba(255, 0, 0, 0.08); font-weight: bold; z-index: 9999; pointer-events: none; }' : ''}
          @media print {
            .page { padding: 15mm; }
            .section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <!-- Header -->
          <div class="header">
            <h1>${CREDITOR_INFO.companyName.toUpperCase()}</h1>
            <div class="registration">Registration Number: ${CREDITOR_INFO.registrationNumber}</div>
            <div class="tagline">"We touch a file, We change a life, We are Kutlwano and Associate"</div>
          </div>
          
          <!-- Document Title -->
          <div class="doc-title">Acknowledgement of Debt Agreement</div>
          
          <!-- Agreement Reference -->
          <div class="section">
            <div class="info-row"><span class="info-label">Agreement Reference:</span> <span class="info-value">AOD-${aodDocumentId.substring(0, 8).toUpperCase()}</span></div>
            <div class="info-row"><span class="info-label">Date of Agreement:</span> <span class="info-value">${formatDate(new Date())}</span></div>
            <div class="info-row"><span class="info-label">Contract Period:</span> <span class="info-value">${formatDate(startDate)} to ${formatDate(endDate)}</span></div>
          </div>

          <!-- Section 1: Introduction -->
          <div class="section">
            <div class="section-title"><span class="section-number">1.</span> INTRODUCTION</div>
            
            <div class="clause">
              <div class="clause-content">
                The parties to this Acknowledgement of Debt are listed below as follows:
              </div>
            </div>
          </div>

          <!-- Party 1: Creditor -->
          <div class="section">
            <div class="section-title"><span class="section-number">1.1</span> THE CREDITOR (Service Provider)</div>
            <div class="party-box">
              <div class="info-row"><span class="info-label">Company Name:</span> <span class="info-value">${CREDITOR_INFO.companyName}</span></div>
              <div class="info-row"><span class="info-label">Registration Number:</span> <span class="info-value">${CREDITOR_INFO.registrationNumber}</span></div>
              <div class="info-row"><span class="info-label">Managing Director:</span> <span class="info-value">${CREDITOR_INFO.managingDirector}</span></div>
              <div class="info-row"><span class="info-label">Domicilium Address:</span> <span class="info-value">${CREDITOR_INFO.domiciliumAddress}</span></div>
            </div>
            
            <div class="clause">
              <div class="clause-content">
                The Creditor, ${CREDITOR_INFO.companyName}, who for purposes of this agreement is duly represented by the company's Managing Director ${CREDITOR_INFO.managingDirector}.
              </div>
            </div>
          </div>

          <!-- Party 2: Debtor -->
          <div class="section">
            <div class="section-title"><span class="section-number">1.2</span> THE DEBTOR (Referring Attorney)</div>
            <div class="party-box">
              <div class="info-row"><span class="info-label">Law Firm Name:</span> <span class="info-value">${debtorLawFirm}</span></div>
              <div class="info-row"><span class="info-label">Registration Number:</span> <span class="info-value">${debtorRegNo}</span></div>
              <div class="info-row"><span class="info-label">Authorized Representative:</span> <span class="info-value">${debtorRep}</span></div>
              <div class="info-row"><span class="info-label">Contact Email:</span> <span class="info-value">${attorney?.email || 'N/A'}</span></div>
              <div class="info-row"><span class="info-label">Contact Phone:</span> <span class="info-value">${attorney?.phone || 'N/A'}</span></div>
              <div class="info-row"><span class="info-label">Attorney Code:</span> <span class="info-value">${attorney?.code || 'N/A'}</span></div>
              <div class="info-row"><span class="info-label">Domicilium Address:</span> <span class="info-value">${debtorAddress}</span></div>
            </div>
            
            <div class="clause">
              <div class="clause-content">
                The Debtor, ${debtorLawFirm}, who for purposes of this agreement is duly represented by ${debtorRep}.
              </div>
            </div>
          </div>

          <!-- Purpose Statement -->
          <div class="section">
            <div class="section-title"><span class="section-number">1.3</span> PURPOSE OF AGREEMENT</div>
            <div class="clause">
              <div class="clause-content">
                The parties have entered into this agreement in good faith and for the purposes of safeguarding the interests of the Creditor for the payment of money/monies that are due to the Creditor by the Debtor, in respect of medico-legal assessments, as per the amount stated herein and as per the terms and conditions stipulated below.
              </div>
            </div>
            <div class="clause">
              <div class="clause-content">
                The parties will hereunder, confirm the terms of payment are applicable as per the agreement of a deposit payment with the balance to be paid in ${paymentFrequencyLabel} instalments.
              </div>
            </div>
          </div>

          <!-- Section 2: Agreement Activation -->
          <div class="section">
            <div class="section-title"><span class="section-number">2.</span> AGREEMENT ACTIVATION</div>
            <div class="clause">
              <div class="clause-title">2.1 Minimum Assessments</div>
              <div class="clause-content">
                A minimum of ${totalReportsAgreed} (${numberToWords(totalReportsAgreed)}) assessments referred by the Referring Attorney to ${CREDITOR_INFO.companyName} shall constitute and activate this Agreement.
              </div>
            </div>
            <div class="clause">
              <div class="clause-title">2.2 Additional Assessments</div>
              <div class="clause-content">
                Any further assessments referred beyond the initial ${totalReportsAgreed} shall be governed by the same terms and conditions herein.
              </div>
            </div>
          </div>

          <!-- Section 3: Scope of Services -->
          <div class="section">
            <div class="section-title"><span class="section-number">3.</span> SCOPE OF SERVICES</div>
            <div class="clause">
              <div class="clause-title">3.1 Services Provided</div>
              <div class="clause-content">
                ${CREDITOR_INFO.companyName} shall provide medico-legal assessment services which may include but are not limited to:
                <ul style="margin-top: 10px; margin-left: 20px;">
                  <li>Road Accident Fund (RAF);</li>
                  <li>Personal injury;</li>
                  <li>Medical negligence;</li>
                  <li>Related specialist reports;</li>
                  <li>Preparation of joint minutes and expert testimony, where required.</li>
                </ul>
              </div>
            </div>
            <div class="clause">
              <div class="clause-title">3.2 Expert Qualification</div>
              <div class="clause-content">
                ${CREDITOR_INFO.companyName} shall ensure that all assessments are undertaken by duly qualified and registered medical experts.
              </div>
            </div>
          </div>

          <!-- Section 4: Financial Summary -->
          <div class="section">
            <div class="section-title"><span class="section-number">4.</span> TERMS OF THE AGREEMENT - FINANCIAL SUMMARY</div>
            <div class="financial-summary">
              <h3>Financial Terms</h3>
              <table>
                ${discountRate > 0 ? `
                <tr>
                  <td>Original Contract Value:</td>
                  <td>R ${originalContractValue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr class="discount-row">
                  <td>Discount Applied (${discountRate}%):</td>
                  <td>- R ${discountAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                </tr>
                ` : ''}
                <tr>
                  <td>Total Contract Value${discountRate > 0 ? ' (After Discount)' : ''}:</td>
                  <td>R ${totalDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${numberToWords(totalDebt)})</td>
                </tr>
                <tr>
                  <td>Deposit Paid:</td>
                  <td>R ${depositAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${numberToWords(depositAmount)})</td>
                </tr>
                <tr>
                  <td>Outstanding Balance:</td>
                  <td>R ${remainingBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${numberToWords(remainingBalance)})</td>
                </tr>
                <tr>
                  <td>Payments Made to Date:</td>
                  <td>R ${paymentsMade.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>Current Balance Due:</td>
                  <td><strong>R ${currentBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</strong></td>
                </tr>
                <tr>
                  <td>Number of ${paymentFrequencyLabel.charAt(0).toUpperCase() + paymentFrequencyLabel.slice(1)} Payments:</td>
                  <td>${numberOfPayments}</td>
                </tr>
                <tr>
                  <td>Payment Amount per Instalment:</td>
                  <td>R ${paymentAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${numberToWords(paymentAmount)})</td>
                </tr>
                <tr>
                  <td>First Payment Due:</td>
                  <td>${formatDate(firstPaymentDate)}</td>
                </tr>
                <tr>
                  <td>Final Payment Due:</td>
                  <td>${formatDate(lastPaymentDate)}</td>
                </tr>
                <tr>
                  <td>Interest Rate (on overdue amounts):</td>
                  <td>${interestRate}% per annum</td>
                </tr>
                <tr>
                  <td>Total Assessments Agreed:</td>
                  <td>${totalReportsAgreed} reports</td>
                </tr>
              </table>
            </div>
            
            <div class="clause">
              <div class="clause-title">4.1 Total Amount Due</div>
              <div class="clause-content">
                The Creditor has rendered services and provided medico legal reports to the Debtor which are to the value/amount of R${totalDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${numberToWords(totalDebt)}).
              </div>
            </div>
            
            <div class="clause">
              <div class="clause-title">4.2 Deposit Paid</div>
              <div class="clause-content">
                The Debtor agrees to the amount in paragraph 4.1 above, the parties confirm that the Debtor will/has pay/paid: A deposit on the ${formatDate(startDate)}, to the Creditor, in the amount of R${depositAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${numberToWords(depositAmount)}).
              </div>
            </div>
            
            <div class="clause">
              <div class="clause-title">4.3 Outstanding Balance</div>
              <div class="clause-content">
                With outstanding confirmed balance of R${remainingBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${numberToWords(remainingBalance)}).
              </div>
            </div>
            
            <div class="clause">
              <div class="clause-title">4.4 Payment Schedule</div>
              <div class="clause-content">
                The Debtor further confirms and agrees to pay the outstanding balance to the Creditor, over a period of ${numberOfPayments} ${paymentFrequencyLabel} instalments, with ${paymentFrequencyLabel} payments of R${paymentAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} (${numberToWords(paymentAmount)}). The first payment by the Debtor will be due on the ${formatDate(firstPaymentDate)}. The last payment will be due on the ${formatDate(lastPaymentDate)}.
              </div>
            </div>
            
            <div class="clause">
              <div class="clause-title">4.5 Amount Confirmation</div>
              <div class="clause-content">
                The parties, more specifically the Debtor, agree and confirm that the amounts stated above are as agreed and are not in dispute (roll out plan of reports will be found in Annexure A below).
              </div>
            </div>
            
            <div class="clause">
              <div class="clause-title">4.6 Payment Deadline</div>
              <div class="clause-content">
                The parties, more specifically the Debtor, agrees and confirms that the amount stated above is subject to payment by the Debtor and that the ${paymentFrequencyLabel} payment shall be made no later than the close of business on the last day of the stated months.
              </div>
            </div>
            
            <div class="clause">
              <div class="clause-title">4.7 Late Payment Notice</div>
              <div class="clause-content">
                In the event that the Debtor is unable to effect the required payment by the date stipulated above, the Debtor shall advise the Creditor, in writing, immediately and no later than 7 (seven) days of the payment becoming due, advising and providing the Creditor with reason for the late payment and officially request an extension if necessary.
              </div>
            </div>
          </div>

          <!-- Section 5: Duration -->
          <div class="section">
            <div class="section-title"><span class="section-number">5.</span> DURATION OF THE AGREEMENT</div>
            <div class="clause">
              <div class="clause-title">5.1 Agreement Term</div>
              <div class="clause-content">
                The parties agree that the agreement will remain in place and in effect from date of signature up to the Debtor making the full payment of the amount stipulated above. This Agreement shall commence on the Effective Date and shall remain in force for a fixed term of ${agreementDuration} months, as agreed in writing by the Parties. This Agreement shall terminate automatically upon expiry of the agreed term, unless renewed in writing and signed by both Parties.
              </div>
            </div>
            
            <div class="clause">
              <div class="clause-title">5.2 Default Consequences</div>
              <div class="clause-content">
                In the event of the Debtor failing to effect the necessary payments as per the agreed terms, the Creditor reserves the right to:
                <ul style="margin-top: 10px; margin-left: 20px;">
                  <li>Charge an interest on overdue amounts at the prevailing legal rate of ${interestRate}% per annum;</li>
                  <li>Suspend any further services until payment is received in full; or</li>
                  <li>Pursue legal action to recover all amounts owing as per the agreement, including the expenses to be incurred in the recovery of the outstanding monies.</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Section 6: Domicilium -->
          <div class="section">
            <div class="section-title"><span class="section-number">6.</span> DOMICILIUM CITANDI ET EXECUTANDI</div>
            <div class="clause">
              <div class="clause-content">
                The parties agree and state that in the event of a dispute arising in terms of this agreement, the parties choose to have legal processes served on them at the address stated below.
              </div>
            </div>
            <div class="clause">
              <div class="clause-title">6.1 Creditor's Domicilium</div>
              <div class="clause-content">${CREDITOR_INFO.domiciliumAddress}</div>
            </div>
            <div class="clause">
              <div class="clause-title">6.2 Debtor's Domicilium</div>
              <div class="clause-content">${debtorAddress}</div>
            </div>
          </div>

          <!-- Section 7: Confidentiality -->
          <div class="section">
            <div class="section-title"><span class="section-number">7.</span> CONFIDENTIALITY</div>
            <div class="clause">
              <div class="clause-content">
                Both Parties shall treat all information exchanged in connection with this Agreement as strictly confidential. Neither Party shall disclose or use any such information for purposes other than the execution of this Agreement, except as required by law or with the prior written consent of the other Party.
              </div>
            </div>
          </div>

          <!-- Section 8: Dispute Resolution -->
          <div class="section">
            <div class="section-title"><span class="section-number">8.</span> DISPUTE RESOLUTION</div>
            <div class="clause">
              <div class="clause-content">
                Any dispute arising from or in connection with this Agreement shall be resolved as follows:
                <ul style="margin-top: 10px; margin-left: 20px;">
                  <li>Firstly, through good-faith negotiation between the Parties;</li>
                  <li>Failing settlement, the dispute shall be referred to mediation; and</li>
                  <li>If unresolved, the matter shall be submitted to a competent court of law in the Republic of South Africa having jurisdiction.</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Section 9: Declaration -->
          <div class="section">
            <div class="section-title"><span class="section-number">9.</span> DECLARATION BY DEBTOR</div>
            <div class="clause">
              <div class="clause-content">
                I, the undersigned Debtor, having confirmed that I am duly authorised to enter in this agreement, do hereby acknowledge and confirm that the entity that I represent herein, confirm that we are truly and lawfully indebted to a favour of the creditor in the amount stipulated above.
              </div>
            </div>
            <div class="clause">
              <div class="clause-content">
                I further state that the amount of R${totalDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}, as stated herein, refers to the amount owing to the Creditor, which has arisen as a result of the services rendered and/or providing of medico legal reports by the Creditor. I further confirm that the services rendered were as per my instructions and at my special instance and request.
              </div>
            </div>
            <div class="clause">
              <div class="clause-content">
                In the event of the Debtor, failing to make the necessary and required payment as per dates stated above, the Debtor shall be liable for the outstanding payments which will include interest calculated at the rate of ${interestRate}%.
              </div>
            </div>
          </div>

          <!-- Section 10: General Provisions -->
          <div class="section">
            <div class="section-title"><span class="section-number">10.</span> GENERAL PROVISIONS</div>
            <div class="clause">
              <div class="clause-title">10.1 Entire Agreement</div>
              <div class="clause-content">
                This Agreement constitutes the entire understanding between the Parties and supersedes all prior discussions or agreements.
              </div>
            </div>
            <div class="clause">
              <div class="clause-title">10.2 Amendment Requirements</div>
              <div class="clause-content">
                No amendment, variation, or waiver shall be valid unless reduced to writing and signed by both Parties.
              </div>
            </div>
            <div class="clause">
              <div class="clause-title">10.3 Transfer Restrictions</div>
              <div class="clause-content">
                Neither Party may cede, assign, or transfer its rights or obligations without the prior written consent of the other Party.
              </div>
            </div>
          </div>

          <!-- Banking Details -->
          <div class="section">
            <div class="section-title"><span class="section-number">11.</span> BANKING DETAILS</div>
            <div class="bank-details">
              <h4>Payment to be made to:</h4>
              <div class="info-row"><span class="info-label">Bank:</span> <span class="info-value">${CREDITOR_INFO.bankName}</span></div>
              <div class="info-row"><span class="info-label">Account Name:</span> <span class="info-value">${CREDITOR_INFO.accountName}</span></div>
              <div class="info-row"><span class="info-label">Account Number:</span> <span class="info-value">${CREDITOR_INFO.accountNumber}</span></div>
              <div class="info-row"><span class="info-label">Branch Name:</span> <span class="info-value">${CREDITOR_INFO.branchName}</span></div>
              <div class="info-row"><span class="info-label">Branch Code:</span> <span class="info-value">${CREDITOR_INFO.branchCode}</span></div>
              <div class="info-row"><span class="info-label">Reference:</span> <span class="info-value">${attorney?.code || 'Attorney Code'} / ${attorney?.name || 'Firm Name'}</span></div>
            </div>
          </div>

          <!-- Signature Section -->
          <div class="signature-section">
            <div class="section-title">SIGNATURES</div>
            <p style="margin-bottom: 20px; font-style: italic;">Thus done and signed at the respective places and on the dates indicated below.</p>
            
            <div class="signature-grid">
              <div class="signature-block">
                <h4 style="color: #1fb6ce; margin-bottom: 15px;">FOR THE CREDITOR</h4>
                <div class="info-row"><span class="info-label">Company:</span></div>
                <div style="padding: 5px 0;">${CREDITOR_INFO.companyName}</div>
                <div class="signature-line">
                  <div class="signature-label">Signature</div>
                </div>
                <div style="margin-top: 15px;">
                  <div class="info-row"><span class="info-label">Name:</span> <span class="info-value">${CREDITOR_INFO.managingDirector}</span></div>
                  <div class="info-row"><span class="info-label">Capacity:</span> <span class="info-value">Managing Director</span></div>
                  <div class="info-row"><span class="info-label">Date:</span> <span class="info-value">____________________</span></div>
                  <div class="info-row"><span class="info-label">Place:</span> <span class="info-value">____________________</span></div>
                </div>
              </div>
              
              <div class="signature-block">
                <h4 style="color: #1fb6ce; margin-bottom: 15px;">FOR THE DEBTOR</h4>
                <div class="info-row"><span class="info-label">Law Firm:</span></div>
                <div style="padding: 5px 0;">${debtorLawFirm}</div>
                <div class="signature-line">
                  <div class="signature-label">Signature</div>
                </div>
                <div style="margin-top: 15px;">
                  <div class="info-row"><span class="info-label">Name:</span> <span class="info-value">${debtorRep}</span></div>
                  <div class="info-row"><span class="info-label">Capacity:</span> <span class="info-value">____________________</span></div>
                  <div class="info-row"><span class="info-label">Date:</span> <span class="info-value">____________________</span></div>
                  <div class="info-row"><span class="info-label">Place:</span> <span class="info-value">____________________</span></div>
                </div>
              </div>
            </div>
            
            <div class="witness-section">
              <h4 style="color: #666; margin-bottom: 15px;">WITNESSES</h4>
              <div class="witness-grid">
                <div class="witness-block">
                  <div class="signature-line">
                    <div class="signature-label">Witness 1</div>
                  </div>
                  <div class="info-row" style="margin-top: 10px;"><span class="info-label">Name:</span> <span class="info-value">____________________</span></div>
                  <div class="info-row"><span class="info-label">Date:</span> <span class="info-value">____________________</span></div>
                </div>
                <div class="witness-block">
                  <div class="signature-line">
                    <div class="signature-label">Witness 2</div>
                  </div>
                  <div class="info-row" style="margin-top: 10px;"><span class="info-label">Name:</span> <span class="info-value">____________________</span></div>
                  <div class="info-row"><span class="info-label">Date:</span> <span class="info-value">____________________</span></div>
                </div>
              </div>
            </div>
          </div>

          <!-- ANNEXURE A -->
          <div class="annexure">
            <div class="annexure-title">ANNEXURE A – PAYMENT & REPORT RELEASE SCHEDULE</div>
            
            <div class="clause">
              <div class="clause-content">
                This annexure sets out the agreed payment schedule and corresponding report release plan for the services rendered under this Agreement.
              </div>
            </div>

            <h4 style="color: #1fb6ce; margin: 20px 0 15px 0;">Payment Schedule Overview</h4>
            <table class="schedule-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${discountRate > 0 ? `
                <tr>
                  <td>Original Contract Value</td>
                  <td style="text-align: right;">R ${originalContractValue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr style="background: #fff3cd;">
                  <td>Discount Applied (${discountRate}%)</td>
                  <td style="text-align: right; color: #856404;">- R ${discountAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                </tr>
                ` : ''}
                <tr>
                  <td>Total Contract Value${discountRate > 0 ? ' (After Discount)' : ''}</td>
                  <td style="text-align: right;">R ${totalDebt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>Deposit Amount</td>
                  <td style="text-align: right;">R ${depositAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>Outstanding Balance</td>
                  <td style="text-align: right;">R ${remainingBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>Number of Instalments</td>
                  <td style="text-align: right;">${numberOfPayments} ${paymentFrequencyLabel} payments</td>
                </tr>
                <tr>
                  <td>Payment per Instalment</td>
                  <td style="text-align: right;">R ${paymentAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>First Payment Due</td>
                  <td style="text-align: right;">${formatDate(firstPaymentDate)}</td>
                </tr>
                <tr>
                  <td>Final Payment Due</td>
                  <td style="text-align: right;">${formatDate(lastPaymentDate)}</td>
                </tr>
              </tbody>
            </table>

            <h4 style="color: #1fb6ce; margin: 30px 0 15px 0;">Report Release Schedule</h4>
            <div class="payment-stages">
              ${DEFAULT_PAYMENT_STAGES.map(stage => `
                <div class="payment-stage">
                  <div class="stage-number">${stage.stage}</div>
                  <div class="stage-content">
                    <div class="stage-title">${stage.description}</div>
                    <div class="stage-details">
                      <strong>Payment Required:</strong> ${stage.percentagePayable}<br/>
                      <strong>Action/Outcome:</strong> ${stage.actionOutcome}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="clause" style="margin-top: 30px;">
              <div class="clause-title">Number of Assessments and Reports</div>
              <div class="clause-content">
                The Debtor is entitled to ${totalReportsAgreed} (${numberToWords(totalReportsAgreed)}) medico-legal assessments as covered under this Agreement. Reports released will be tracked and recorded against payments received. Additional assessments beyond the agreed number will be subject to separate invoicing and payment terms.
              </div>
            </div>

            <div class="clause">
              <div class="clause-title">Report Withholding</div>
              <div class="clause-content">
                The Creditor reserves the right to withhold the release of any reports, affidavits, or joint minutes where payment has not been received as per this schedule. Services may be suspended until outstanding amounts are settled.
              </div>
            </div>

            <div class="clause">
              <div class="clause-title">Payment Tracking</div>
              <div class="clause-content">
                All payments made shall be recorded and reconciled against the schedule above. The Debtor will receive a statement reflecting payments made and reports released upon request.
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div><strong>${CREDITOR_INFO.companyName}</strong></div>
            <div>Registration: ${CREDITOR_INFO.registrationNumber}</div>
            <div class="contact">
              <div>Address: ${CREDITOR_INFO.domiciliumAddress}</div>
              <div>Email: info@kamedico-legal.co.za | Website: www.kamedico-legal.co.za</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Return HTML for now (can be converted to PDF on client side or using a PDF service)
    const htmlBase64 = btoa(unescape(encodeURIComponent(pdfHtml)));

    // Update the AOD document with generated status
    await supabaseClient
      .from('aod_documents')
      .update({
        document_status: 'generated',
        updated_at: new Date().toISOString()
      })
      .eq('id', aodDocumentId);

    // Log the generation (only if not preview mode)
    if (!previewMode) {
      await supabaseClient.from('audit_logs').insert({
        action_type: 'CREATE',
        table_name: 'aod_documents',
        record_id: aodDocumentId,
        description: `Generated AOD PDF for ${attorney?.name} using master template`,
        function_area: 'AOD Management',
        new_values: { 
          generated: true,
          template: 'master_aod_template',
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
        pdfData: htmlBase64,
        htmlContent: pdfHtml,
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
