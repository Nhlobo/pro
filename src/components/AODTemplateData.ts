// Master AOD Agreement Template - Structured and Editable
// Based on Kutlwano & Associates Medico Legal AOD Agreement

export interface AODClause {
  id: string;
  title: string;
  content: string;
  isEditable: boolean;
  order: number;
}

export interface AODTemplateSection {
  id: string;
  name: string;
  clauses: AODClause[];
}

export interface AODCreditorInfo {
  companyName: string;
  registrationNumber: string;
  managingDirector: string;
  domiciliumAddress: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchName: string;
  branchCode: string;
}

export interface AODDebtorInfo {
  lawFirmName: string;
  registrationNumber: string;
  authorizedRepName: string;
  authorizedRepCapacity: string;
  domiciliumAddress: string;
}

export interface AODFinancialTerms {
  totalAmount: number;
  totalAmountWords: string;
  depositAmount: number;
  depositAmountWords: string;
  depositDate: string;
  outstandingBalance: number;
  outstandingBalanceWords: string;
  numberOfQuarters: number;
  quarterlyPayment: number;
  quarterlyPaymentWords: string;
  firstPaymentDate: string;
  lastPaymentDate: string;
  interestRate: number;
}

export interface AODServiceScope {
  matterTypes: string[];
  numberOfAssessments: number;
  expertTypes: string[];
}

export interface PaymentStage {
  stage: number;
  description: string;
  percentagePayable: string;
  actionOutcome: string;
}

export interface PaymentScheduleItem {
  paymentAmount: number;
  equivalentReports: number;
  outcome: string;
}

export const CREDITOR_INFO: AODCreditorInfo = {
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

export const DEFAULT_PAYMENT_STAGES: PaymentStage[] = [
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

export const DEFAULT_PAYMENT_SCHEDULE: PaymentScheduleItem[] = [
  { paymentAmount: 50000, equivalentReports: 11, outcome: "Initial instalment or first batch payment" },
  { paymentAmount: 50000, equivalentReports: 15, outcome: "Second instalment after first batch completion" },
  { paymentAmount: 75000, equivalentReports: 20, outcome: "Optional additional payment for extended work or high volume" },
];

export const AOD_TEMPLATE_SECTIONS: AODTemplateSection[] = [
  {
    id: "introduction",
    name: "Introduction",
    clauses: [
      {
        id: "intro-1",
        title: "Parties to Agreement",
        content: "The parties to this Acknowledgement of Debt are listed below as follows:",
        isEditable: false,
        order: 1,
      },
      {
        id: "intro-2",
        title: "Creditor Declaration",
        content: "The Creditor, Kutlwano and Associates (Pty) Ltd, who for purposes of this agreement is duly represented by the company's Managing Director Mr. Moleka Boshomane.",
        isEditable: false,
        order: 2,
      },
      {
        id: "intro-3",
        title: "Debtor Declaration",
        content: "The Debtor, {{DEBTOR_LAW_FIRM}}, who for purposes of this agreement is duly represented by the company's {{DEBTOR_CAPACITY}} {{DEBTOR_REP_NAME}}.",
        isEditable: true,
        order: 3,
      },
      {
        id: "intro-4",
        title: "Purpose Statement",
        content: "The parties have entered into this agreement in good faith and for the purposes of safeguarding the interests of the Creditor for the payment of money/monies that are due to the Creditor by the Debtor, in respect of medico-legal assessments, as per the amount stated herein and as per the terms and conditions stipulated below.",
        isEditable: false,
        order: 4,
      },
      {
        id: "intro-5",
        title: "Payment Terms Confirmation",
        content: "The parties will hereunder, confirm the terms of payment are applicable as per the agreement of a deposit payment with the balance to be paid in {{PAYMENT_FREQUENCY}} instalments.",
        isEditable: true,
        order: 5,
      },
    ],
  },
  {
    id: "activation",
    name: "Agreement Activation",
    clauses: [
      {
        id: "activation-1",
        title: "Minimum Assessments",
        content: "A minimum of ten (10) assessments referred by the Referring Attorney to the Kutlwano & Associates shall constitute and activate this Agreement.",
        isEditable: true,
        order: 1,
      },
      {
        id: "activation-2",
        title: "Additional Assessments",
        content: "Any further assessments referred beyond the initial ten (10) shall be governed by the same terms and conditions herein.",
        isEditable: false,
        order: 2,
      },
    ],
  },
  {
    id: "scope",
    name: "Scope of Services",
    clauses: [
      {
        id: "scope-1",
        title: "Services Provided",
        content: "Kutlwano & Associate PTY LTD shall provide medico-legal assessment services which may include but are not limited to:\n1. Road Accident Fund (RAF);\n2. Personal injury;\n3. Medical negligence;\n4. Related specialist reports;\n5. Preparation of joint minutes and expert testimony, where required.",
        isEditable: true,
        order: 1,
      },
      {
        id: "scope-2",
        title: "Expert Qualification",
        content: "Kutlwano & Associate PTY LTD shall ensure that all assessments are undertaken by duly qualified and registered medical experts.",
        isEditable: false,
        order: 2,
      },
    ],
  },
  {
    id: "terms",
    name: "Terms of the Agreement",
    clauses: [
      {
        id: "terms-1",
        title: "Total Amount Due",
        content: "The Creditor has rendered services and provided medico legal reports to the Debtor which are to the value/amount of R{{TOTAL_AMOUNT}} ({{TOTAL_AMOUNT_WORDS}}).",
        isEditable: true,
        order: 1,
      },
      {
        id: "terms-2",
        title: "Deposit Paid",
        content: "The Debtor agrees to the amount in paragraph 1.1 above, the parties confirm that the Debtor will/has pay/paid: A deposit on the {{DEPOSIT_DATE}}, to the Creditor, in the amount of R{{DEPOSIT_AMOUNT}} ({{DEPOSIT_AMOUNT_WORDS}}).",
        isEditable: true,
        order: 2,
      },
      {
        id: "terms-3",
        title: "Outstanding Balance",
        content: "With outstanding confirmed balance of R{{OUTSTANDING_BALANCE}} ({{OUTSTANDING_BALANCE_WORDS}}).",
        isEditable: true,
        order: 3,
      },
      {
        id: "terms-4",
        title: "Payment Schedule",
        content: "The Debtor further confirms and agrees to pay the outstanding balance to the Creditor, over a period of {{NUMBER_OF_QUARTERS}} quarters, with quarterly payments of R{{QUARTERLY_PAYMENT}} ({{QUARTERLY_PAYMENT_WORDS}}). The first quarter payment by the Debtor will be due on the {{FIRST_PAYMENT_DATE}}. The last quarter payment will be due on the {{LAST_PAYMENT_DATE}}.",
        isEditable: true,
        order: 4,
      },
      {
        id: "terms-5",
        title: "Amount Confirmation",
        content: "The parties, more specifically the Debtor, agree and confirm that the amounts stated above are as agreed and are not in dispute (roll out plan of reports will be found in Annexure A below).",
        isEditable: false,
        order: 5,
      },
      {
        id: "terms-6",
        title: "Payment Deadline",
        content: "The parties, more specifically the Debtor, agrees and confirms that the amount stated above is subject to payment by the Debtor and that the quarterly payment shall be made no later than the close of business on the last day of the stated months.",
        isEditable: false,
        order: 6,
      },
      {
        id: "terms-7",
        title: "Late Payment Notice",
        content: "In the event that the Debtor is unable to effect the required payment by the date stipulated above, the Debtor shall advise the Creditor, in writing, immediately and no later than 7(seven) days of the payment becoming due, advising and providing the Creditor with reason for the late payment and officially request an extension if necessary.",
        isEditable: true,
        order: 7,
      },
      {
        id: "terms-8",
        title: "Indulgence Discretion",
        content: "The Debtor is aware that any indulgence granted is strictly within the sole discretion of the Creditor and the Creditor if amenable to granting the extension, will provide the Debtor with written and state in writing the duration of the granted indulgence.",
        isEditable: false,
        order: 8,
      },
      {
        id: "terms-9",
        title: "Extension Request",
        content: "The Debtor acknowledges and agrees that any request for an extension/indulgence being sought, is subject to approval and granting by the Creditor. The Creditor has sole discretion to either grant or deny the request made by the Debtor. In the event of same being granted, the Creditor will confirm in writing, the duration of the extension/indulgence permitted.",
        isEditable: false,
        order: 9,
      },
      {
        id: "terms-10",
        title: "Extension Denial",
        content: "In the event of the Creditor denying to grant any indulgence and/or extension, the Debtor confirms and agrees that the Creditor shall immediately, upon advising the Debtor of such rejection, be at liberty to take up any necessary action to recover any outstanding money as due to the Creditor.",
        isEditable: false,
        order: 10,
      },
    ],
  },
  {
    id: "duration",
    name: "Duration of the Agreement",
    clauses: [
      {
        id: "duration-1",
        title: "Agreement Term",
        content: "The parties agree that the agreement will remain in place and in effect from date of signature up to the Debtor making the full payment of the amount stipulated above. This Agreement shall commence on the Effective Date and shall remain in force for a fixed term of {{AGREEMENT_DURATION}} months, as agreed in writing by the Parties. This Agreement shall terminate automatically upon expiry of the agreed term, unless renewed in writing and signed by both Parties.",
        isEditable: true,
        order: 1,
      },
      {
        id: "duration-2",
        title: "Default Consequences",
        content: "In the event of the Debtor failing to effect the necessary payments as per the agreed terms, the Creditor reserves the right to charge an interest on overdue amounts at the prevailing legal rate; suspend any further services until payment is received in full; or pursue legal action to recover all amounts owing as per the agreement, including the expenses to be incurred in the recovery of the outstanding monies.",
        isEditable: true,
        order: 2,
      },
      {
        id: "duration-3",
        title: "Agreement Continuation",
        content: "The agreement shall remain in place and in force until such a time that the Debtor satisfies the terms of the agreement and has paid over the full amount as stated above.",
        isEditable: false,
        order: 3,
      },
      {
        id: "duration-4",
        title: "Dispute Resolution Rights",
        content: "The parties agree that should a dispute arise, due to the Debtor failing to make the necessary and required payments, the Creditor reserves the right to take up the necessary legal remedies to ensure the recovery of the outstanding balance, including any interest due and calculated from date of default by the Debtor and the legal fees incurred in the recovery of the amount(s) due.",
        isEditable: false,
        order: 4,
      },
      {
        id: "duration-5",
        title: "Default Action",
        content: "The Creditor shall immediately upon the lapsing of the agreed period and/or the Debtor being in default of the terms of the agreement, be fully entitled to take up the necessary steps (i.e. institute legal proceedings) against the Debtor to seek the necessary relief to ensure the recovery of the outstanding monies from the Debtor.",
        isEditable: false,
        order: 5,
      },
    ],
  },
  {
    id: "governing",
    name: "Governing Agreement",
    clauses: [
      {
        id: "governing-1",
        title: "Binding Terms",
        content: "The parties confirm that the Debtor is bound by the terms of agreement and is indebted to the Creditor as per clauses above. The Debtor will be bound to make and effect the specific payments as per the agreement.",
        isEditable: false,
        order: 1,
      },
      {
        id: "governing-2",
        title: "Agreement Selection",
        content: "The Debtor confirms that they have selected the above-mentioned agreement to bind and govern their terms of agreement with the Creditor.",
        isEditable: false,
        order: 2,
      },
      {
        id: "governing-3",
        title: "Amendment Restrictions",
        content: "The parties further agree that the provisions of the selected agreement shall apply and will not be amended without any written consent from the Creditor this includes the terms of payment or otherwise, and shall remain binding to the parties until the Debtor has satisfied all the terms of the agreement in full.",
        isEditable: false,
        order: 3,
      },
    ],
  },
  {
    id: "domicilium",
    name: "Domicilium Citandi Et Executandi",
    clauses: [
      {
        id: "domicilium-1",
        title: "Legal Process Address",
        content: "The parties agree and state that in the event of a dispute arising in terms of this agreement, the parties choose to have legal processes served on them at the address stated below.",
        isEditable: false,
        order: 1,
      },
      {
        id: "domicilium-2",
        title: "Creditor Domicilium",
        content: "The Creditor's chosen domicilium is 52 Quatar Crescent, Cosmo City, Ext 10, Roodepoort, 2188",
        isEditable: false,
        order: 2,
      },
      {
        id: "domicilium-3",
        title: "Debtor Domicilium",
        content: "The Debtor's chosen domicilium is {{DEBTOR_DOMICILIUM}}",
        isEditable: true,
        order: 3,
      },
      {
        id: "domicilium-4",
        title: "Jurisdiction",
        content: "The parties' consent to any dispute that may arise out of this agreement, to be referred and be heard to the appropriate Court that has Jurisdiction over where the Creditor is domiciled, with due consideration of the monetary jurisdiction of the appropriate Court.",
        isEditable: false,
        order: 4,
      },
    ],
  },
  {
    id: "confidentiality",
    name: "Confidentiality",
    clauses: [
      {
        id: "confidentiality-1",
        title: "Information Handling",
        content: "Both Parties shall treat all information exchanged in connection with this Agreement as strictly confidential.",
        isEditable: false,
        order: 1,
      },
      {
        id: "confidentiality-2",
        title: "Disclosure Restrictions",
        content: "Neither Party shall disclose or use any such information for purposes other than the execution of this Agreement, except as required by law or with the prior written consent of the other Party.",
        isEditable: false,
        order: 2,
      },
    ],
  },
  {
    id: "dispute",
    name: "Dispute Resolution",
    clauses: [
      {
        id: "dispute-1",
        title: "Resolution Process",
        content: "Any dispute arising from or in connection with this Agreement shall be resolved as follows:\n• Firstly, through good-faith negotiation between the Parties;\n• Failing settlement, the dispute shall be referred to mediation; and\n• If unresolved, the matter shall be submitted to a competent court of law in the Republic of South Africa having jurisdiction.",
        isEditable: false,
        order: 1,
      },
    ],
  },
  {
    id: "declaration",
    name: "Declaration by Debtor",
    clauses: [
      {
        id: "declaration-1",
        title: "Authorization Confirmation",
        content: "I, the undersigned Debtor, having confirmed that I am duly authorised to enter in this agreement, do hereby acknowledge and confirm that the entity that I represent herein, confirm that we are truly and lawfully indebted to a favour of the creditor in the amount stipulated above.",
        isEditable: false,
        order: 1,
      },
      {
        id: "declaration-2",
        title: "Services Acknowledgement",
        content: "I further state that the amount of R{{TOTAL_AMOUNT}}, as stated herein, refers to the amount owing to the Creditor, which has arisen as a result of the services rendered and/or providing of medico legal reports by the Creditor. I further confirm that the services rendered were as per my instructions and at my special instance and request (roll out plan of reports will be found in Annexure A below).",
        isEditable: true,
        order: 2,
      },
      {
        id: "declaration-3",
        title: "Payment Undertaking",
        content: "The capital amount due is for services rendered by the Creditor with an undertaking that the agreed amount will be paid to the Creditor, by the Debtor within the agreed time frames as tabled above.",
        isEditable: false,
        order: 3,
      },
      {
        id: "declaration-4",
        title: "Interest Liability",
        content: "In the event of the Debtor, failing to make the necessary and required payment as per dates stated above, the Debtor shall be liable for the outstanding payments which will include interest calculated at the rate of {{INTEREST_RATE}}%.",
        isEditable: true,
        order: 4,
      },
      {
        id: "declaration-5",
        title: "Interest Calculation",
        content: "I, as the Debtor, acknowledge that the interest will be calculated from the date of default and continue to be calculated until date of full payment of the capital amount.",
        isEditable: false,
        order: 5,
      },
      {
        id: "declaration-6",
        title: "Legal Action Acknowledgement",
        content: "I, as the Debtor, agree that should I/we fail to effect the necessary and agreed payment timeously and being in default of the terms of the agreement, we are aware that the Creditor bears the right to engage and take on the necessary legal steps and approach the necessary Court to ensure the recovery of the outstanding monies as due by the Debtor.",
        isEditable: false,
        order: 6,
      },
      {
        id: "declaration-7",
        title: "Binding Commitment",
        content: "I as the Debtor bind myself and the entity that I represent to be liable to the Creditor up to date of full payment of the money/funds due to the Creditor.",
        isEditable: false,
        order: 7,
      },
    ],
  },
  {
    id: "general",
    name: "General Provisions",
    clauses: [
      {
        id: "general-1",
        title: "Entire Agreement",
        content: "This Agreement constitutes the entire understanding between the Parties and supersedes all prior discussions or agreements.",
        isEditable: false,
        order: 1,
      },
      {
        id: "general-2",
        title: "Amendment Requirements",
        content: "No amendment, variation, or waiver shall be valid unless reduced to writing and signed by both Parties.",
        isEditable: false,
        order: 2,
      },
      {
        id: "general-3",
        title: "Transfer Restrictions",
        content: "Neither Party may cede, assign, or transfer its rights or obligations without the prior written consent of the other Party.",
        isEditable: false,
        order: 3,
      },
      {
        id: "general-4",
        title: "Force Majeure",
        content: "In the event of a force majeure or circumstances beyond the Parties' control, performance shall be suspended for the duration of such event without penalty.",
        isEditable: true,
        order: 4,
      },
    ],
  },
];

// Helper function to replace template variables
export const populateTemplate = (
  content: string,
  debtor: AODDebtorInfo,
  financial: AODFinancialTerms,
  scope: AODServiceScope,
  agreementDuration: number
): string => {
  return content
    .replace(/\{\{DEBTOR_LAW_FIRM\}\}/g, debtor.lawFirmName)
    .replace(/\{\{DEBTOR_CAPACITY\}\}/g, debtor.authorizedRepCapacity)
    .replace(/\{\{DEBTOR_REP_NAME\}\}/g, debtor.authorizedRepName)
    .replace(/\{\{DEBTOR_DOMICILIUM\}\}/g, debtor.domiciliumAddress)
    .replace(/\{\{PAYMENT_FREQUENCY\}\}/g, agreementDuration >= 12 ? 'quarterly (every three months)' : 'monthly')
    .replace(/\{\{TOTAL_AMOUNT\}\}/g, financial.totalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 }))
    .replace(/\{\{TOTAL_AMOUNT_WORDS\}\}/g, financial.totalAmountWords)
    .replace(/\{\{DEPOSIT_AMOUNT\}\}/g, financial.depositAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 }))
    .replace(/\{\{DEPOSIT_AMOUNT_WORDS\}\}/g, financial.depositAmountWords)
    .replace(/\{\{DEPOSIT_DATE\}\}/g, financial.depositDate)
    .replace(/\{\{OUTSTANDING_BALANCE\}\}/g, financial.outstandingBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 }))
    .replace(/\{\{OUTSTANDING_BALANCE_WORDS\}\}/g, financial.outstandingBalanceWords)
    .replace(/\{\{NUMBER_OF_QUARTERS\}\}/g, financial.numberOfQuarters.toString())
    .replace(/\{\{QUARTERLY_PAYMENT\}\}/g, financial.quarterlyPayment.toLocaleString('en-ZA', { minimumFractionDigits: 2 }))
    .replace(/\{\{QUARTERLY_PAYMENT_WORDS\}\}/g, financial.quarterlyPaymentWords)
    .replace(/\{\{FIRST_PAYMENT_DATE\}\}/g, financial.firstPaymentDate)
    .replace(/\{\{LAST_PAYMENT_DATE\}\}/g, financial.lastPaymentDate)
    .replace(/\{\{INTEREST_RATE\}\}/g, financial.interestRate.toString())
    .replace(/\{\{AGREEMENT_DURATION\}\}/g, agreementDuration.toString())
    .replace(/\{\{NUMBER_OF_ASSESSMENTS\}\}/g, scope.numberOfAssessments.toString())
    .replace(/\{\{MATTER_TYPES\}\}/g, scope.matterTypes.join(', '))
    .replace(/\{\{EXPERT_TYPES\}\}/g, scope.expertTypes.join(', '));
};

// Number to words converter
export const numberToWords = (num: number): string => {
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
