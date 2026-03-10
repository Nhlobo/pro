// ─── TYPES ────────────────────────────────────────────────────────────────────
export type FirmRole = 'PLAINTIFF' | 'DEFENDANT';

export interface TrialCase {
  id: string;
  claimant: string;
  defendant: string;
  expertType: string;
  date: string;
  matterType: string;
  caseType: 'RAF' | 'Medical Negligence';
  subtype: string;
  caseStatus: string;
  payment: string;
  report: string;
  court: string;
  actNo: string;
  trialDate: string;
  daysToTrial: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  fileRef: string;
  accidentDate: string;
  description: string;
  documents: string[];
  milestones: { label: string; done: boolean; date: string }[];
}

export interface RoleColors {
  primary: string;
  light: string;
  border: string;
  label: string;
  icon: string;
  badge: string;
}

export interface ExpertImportance {
  type: string;
  imp: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  icon: string;
  reason: string;
}

export interface AnalysisResult {
  summary: string;
  keyFindings: string[];
  riskFactors: string[];
  outcome: { verdict: string; confidence: number; strategy: string };
  legalPoints: Record<string, string>;
}

export interface LegalNote {
  h: string;
  b: string;
}

// ─── ROLE COLORS ──────────────────────────────────────────────────────────────
export const getRoleColors = (role: FirmRole): RoleColors =>
  role === 'PLAINTIFF'
    ? { primary: 'hsl(var(--kutlwano-teal))', light: 'hsl(var(--kutlwano-teal) / 0.08)', border: 'hsl(var(--kutlwano-teal) / 0.25)', label: 'Plaintiff Attorney', icon: '⚖️', badge: 'hsl(var(--kutlwano-teal))' }
    : { primary: 'hsl(var(--kutlwano-blue))', light: 'hsl(var(--kutlwano-blue) / 0.08)', border: 'hsl(var(--kutlwano-blue) / 0.25)', label: 'Defendant / State Attorney', icon: '🏛️', badge: 'hsl(var(--kutlwano-blue))' };

// ─── DEMO CASES ───────────────────────────────────────────────────────────────
export const DEMO_CASES: TrialCase[] = [
  {
    id: 'KA-2026-001', claimant: 'Londeka Nene', defendant: 'Road Accident Fund',
    expertType: 'Maxillofacial Surgeon', date: '11 Mar 2026',
    matterType: 'MVA', caseType: 'RAF', subtype: 'Facial Injuries / Maxillofacial',
    caseStatus: 'scheduled', payment: 'deposit', report: 'Pending',
    court: 'Gauteng High Court, Johannesburg', actNo: 'Road Accident Fund Act 56 of 1996',
    trialDate: '2026-09-15', daysToTrial: 188, priority: 'HIGH',
    fileRef: 'NN2603100', accidentDate: '2024-08-22',
    description: 'MVA — severe facial injuries. Maxillofacial surgery required. Permanent scarring and functional impairment to jaw confirmed.',
    documents: ['Police Report (AH 217)', 'Hospital Records – Charlotte Maxeke', 'Maxillofacial Surgeon Report'],
    milestones: [
      { label: 'RAF Claim Lodged', done: true, date: '2024-10-01' },
      { label: 'Expert Appointed', done: true, date: '2025-03-11' },
      { label: 'Report Delivered', done: false, date: '2026-04-30' },
      { label: 'Joint Minutes', done: false, date: '2026-06-15' },
      { label: 'Trial', done: false, date: '2026-09-15' },
    ],
  },
  {
    id: 'KA-2026-002', claimant: 'Sipho Dlamini', defendant: 'Road Accident Fund',
    expertType: 'Neurosurgeon', date: '05 Feb 2026',
    matterType: 'MVA', caseType: 'RAF', subtype: 'TBI / Severe Head Injury',
    caseStatus: 'trial-prep', payment: 'paid', report: 'Delivered',
    court: 'Gauteng High Court, Johannesburg', actNo: 'Road Accident Fund Act 56 of 1996',
    trialDate: '2026-07-14', daysToTrial: 125, priority: 'CRITICAL',
    fileRef: 'SD2602050', accidentDate: '2023-11-12',
    description: 'Rear-end collision on N1 Highway. Severe TBI. Permanent cognitive and physical sequelae. Cannot return to work as civil engineer.',
    documents: ['Police Report', 'Hospital Records – Milpark', 'Neurosurgeon Report', 'Industrial Psychologist Report', 'Actuarial Report'],
    milestones: [
      { label: 'RAF Claim Lodged', done: true, date: '2024-01-10' },
      { label: 'Expert Appointed', done: true, date: '2024-06-01' },
      { label: 'Report Delivered', done: true, date: '2025-01-15' },
      { label: 'Joint Minutes', done: true, date: '2025-09-10' },
      { label: 'Trial', done: false, date: '2026-07-14' },
    ],
  },
  {
    id: 'KA-2026-003', claimant: 'Fatima Essop', defendant: 'MEC for Health — KZN (SAMLIP)',
    expertType: 'General Practitioner', date: '20 Jan 2026',
    matterType: 'Med Neg', caseType: 'Medical Negligence', subtype: 'Surgical Error — Bile Duct',
    caseStatus: 'pending', payment: 'deposit', report: 'Pending',
    court: 'KZN High Court, Durban', actNo: 'National Health Act 61 of 2003',
    trialDate: '2026-10-20', daysToTrial: 223, priority: 'HIGH',
    fileRef: 'FE2601200', accidentDate: '2021-07-03',
    description: 'Bile duct injury during laparoscopic cholecystectomy at Netcare. Hepaticojejunostomy required. Chronic pain and permanent sequelae. SAMLIP defending.',
    documents: ['Summons', 'Particulars of Claim', 'Hospital Theatre Records', 'GP Medico-Legal Report'],
    milestones: [
      { label: 'Letter of Demand', done: true, date: '2022-01-15' },
      { label: 'Summons Issued', done: true, date: '2022-06-01' },
      { label: 'Expert Appointed', done: true, date: '2024-01-20' },
      { label: 'Report Delivered', done: false, date: '2026-03-30' },
      { label: 'Joint Minutes', done: false, date: '2026-07-01' },
      { label: 'Trial', done: false, date: '2026-10-20' },
    ],
  },
  {
    id: 'KA-2026-004', claimant: 'Thandi Mokoena', defendant: 'Road Accident Fund',
    expertType: 'Orthopaedic Surgeon', date: '28 Feb 2026',
    matterType: 'MVA', caseType: 'RAF', subtype: 'Fractured Femur / Pelvis',
    caseStatus: 'scheduled', payment: 'deposit', report: 'Pending',
    court: 'Gauteng High Court, Pretoria', actNo: 'Road Accident Fund Act 56 of 1996',
    trialDate: '2026-09-03', daysToTrial: 176, priority: 'HIGH',
    fileRef: 'TM2602280', accidentDate: '2024-02-08',
    description: 'Multiple orthopaedic injuries — fractured femur and pelvis. Partial return to light nursing duties only. Quantum case requires full expert team.',
    documents: ['Police Report', 'Hospital Records – Steve Biko', 'Orthopaedic Surgeon Report', 'OT Assessment'],
    milestones: [
      { label: 'RAF Claim Lodged', done: true, date: '2024-04-01' },
      { label: 'Expert Appointed', done: true, date: '2024-09-15' },
      { label: 'Report Delivered', done: false, date: '2026-04-15' },
      { label: 'Joint Minutes', done: false, date: '2026-06-20' },
      { label: 'Trial', done: false, date: '2026-09-03' },
    ],
  },
];

// ─── EXPERT TYPES ─────────────────────────────────────────────────────────────
export const EXPERT_TYPES: Record<FirmRole, Record<string, string[]>> = {
  PLAINTIFF: {
    RAF: ['Neurosurgeon', 'Orthopaedic Surgeon', 'Clinical Psychologist', 'Industrial Psychologist', 'Occupational Therapist', 'Actuarial Scientist', 'General Practitioner'],
    'Medical Negligence': ['General Practitioner', 'Specialist (Relevant Field)', 'Radiologist', 'Clinical Psychologist', 'Actuarial Scientist'],
  },
  DEFENDANT: {
    RAF: ['Orthopaedic Surgeon (Defence)', 'Neurosurgeon (Defence)', 'Industrial Psychologist (Defence)', 'Actuarial Scientist (Defence)', 'General Practitioner (Defence)'],
    'Medical Negligence': ['General Practitioner (Defence)', 'Specialist — Peer Review', 'Radiologist (Defence)', 'Forensic Medical Expert'],
  },
};

// ─── EXPERT IMPORTANCE ────────────────────────────────────────────────────────
export const EXPERT_IMPORTANCE: Record<FirmRole, ExpertImportance[]> = {
  PLAINTIFF: [
    { type: 'Actuarial Scientist', imp: 'CRITICAL', icon: '📊', reason: 'Quantifies future loss of earnings and future medical costs. Without actuarial evidence, courts cannot award loss of earnings.' },
    { type: 'Industrial Psychologist', imp: 'CRITICAL', icon: '🧠', reason: 'Establishes career trajectory and vocational impact. SA courts will not make loss of earnings findings without an industrial psychologist.' },
    { type: 'Neurosurgeon', imp: 'HIGH', icon: '🧬', reason: 'Establishes neurological sequelae, WPI rating and permanent disability. Key to meeting the serious injury threshold under Regulation 3.' },
    { type: 'Orthopaedic Surgeon', imp: 'HIGH', icon: '🦴', reason: 'AMA Guides WPI rating for musculoskeletal injuries. Required for RAF orthopaedic matters and surgical negligence cases.' },
    { type: 'Clinical Psychologist', imp: 'HIGH', icon: '💭', reason: 'Documents PTSD and MDD. Supports general damages and reinforces Industrial Psychologist findings on reduced work capacity.' },
    { type: 'Radiologist', imp: 'HIGH', icon: '🩻', reason: 'In medical negligence: confirms iatrogenic injury on imaging — cornerstone of causation evidence.' },
    { type: 'Occupational Therapist', imp: 'MEDIUM', icon: '🔧', reason: 'Functional capacity assessment confirming work restrictions — used by Industrial Psychologist and Actuarial Scientist.' },
    { type: 'General Practitioner', imp: 'MEDIUM', icon: '👨‍⚕️', reason: 'Initial medico-legal report and continuity of care. In Med Neg: establishes standard of care deviation.' },
  ],
  DEFENDANT: [
    { type: 'Orthopaedic Surgeon (Defence)', imp: 'CRITICAL', icon: '🦴', reason: 'Provides IME to challenge plaintiff WPI rating. Can reduce or negate the serious injury threshold finding.' },
    { type: 'Industrial Psychologist (Defence)', imp: 'CRITICAL', icon: '🧠', reason: 'Challenges plaintiff loss of earnings and career trajectory. Argues residual work capacity — can significantly reduce quantum.' },
    { type: 'Actuarial Scientist (Defence)', imp: 'CRITICAL', icon: '📊', reason: 'Provides counter-actuarial report with higher contingency deductions and alternative loss calculations to reduce quantum.' },
    { type: 'Neurosurgeon (Defence)', imp: 'HIGH', icon: '🧬', reason: 'IME to contest plaintiff TBI sequelae and WPI rating. Can argue pre-existing conditions or exaggeration.' },
    { type: 'General Practitioner (Defence)', imp: 'HIGH', icon: '👨‍⚕️', reason: 'In Med Neg: provides peer review of plaintiff standard of care opinion — essential for Bolitho defence.' },
    { type: 'Specialist — Peer Review', imp: 'HIGH', icon: '🔬', reason: 'Challenges causation in medical negligence. Argues pre-existing condition or alternative cause of injury.' },
    { type: 'Radiologist (Defence)', imp: 'MEDIUM', icon: '🩻', reason: 'Provides alternative interpretation of imaging — challenges plaintiff radiological causation evidence.' },
    { type: 'Forensic Medical Expert', imp: 'MEDIUM', icon: '🔍', reason: 'Reviews all medical evidence to identify inconsistencies, exaggeration or malingering.' },
  ],
};

// ─── CHECKLISTS ───────────────────────────────────────────────────────────────
export const CHECKLISTS: Record<FirmRole, Record<string, [string, string][]>> = {
  PLAINTIFF: {
    RAF: [
      ['r36a', 'Rule 36(9)(a) Expert Notices Served on RAF'],
      ['r36b', 'Rule 36(9)(b) Expert Summaries Filed with Court'],
      ['discovery', 'Discovery Affidavit Filed & Exchanged with RAF'],
      ['bundle', 'Trial Bundle Compiled, Paginated & Indexed'],
      ['serious', 'Serious Injury Assessment (Regulation 3) Finalised'],
      ['s17', 'Section 17(1)(a) Undertaking Sought from RAF'],
      ['heads', 'Heads of Argument Filed with Registrar & Served on RAF'],
      ['witnesses', 'Witness List Served on RAF at Least 15 Days Before Trial'],
      ['exhibits', 'Exhibit List Agreed with RAF Counsel'],
      ['pretrial', 'Pre-Trial Conference Minute Signed by Both Parties'],
      ['jm_signed', 'Joint Minutes — All Plaintiff Experts Signed'],
      ['jm_actuarial', 'Actuarial Calculations Confirmed Post Joint Minutes'],
      ['merits', 'Merits Evidence Bundle Ready (if liability disputed)'],
      ['opening', 'Opening Address Prepared — Merits & Quantum Structure'],
    ],
    'Medical Negligence': [
      ['summons', 'Summons Issued & Served on Defendant / Hospital'],
      ['plea', "Defendant's Plea Received & Analysed"],
      ['discovery', 'Discovery Affidavit Filed — Medical Records Obtained'],
      ['r36_pl', 'Plaintiff Expert Reports Served (Rule 36(9)(a))'],
      ['r36_def', 'Defendant Expert Reports Received & Reviewed'],
      ['jm_all', 'Joint Minutes — All Experts Signed'],
      ['bundle', 'Trial Bundle Compiled (Judge + Witness + Expert + Hospital Records)'],
      ['heads', 'Heads of Argument Filed — Liability & Quantum'],
      ['witnesses', 'Witness List Served on Defendant'],
      ['exhibits', "Exhibit List Agreed with Defendant's Counsel"],
      ['pretrial', 'Pre-Trial Conference Minute Signed'],
      ['res_ipsa', 'Res Ipsa Loquitur Argument Prepared (if applicable)'],
      ['spoliation', 'Spoliation Application Filed (if hospital records incomplete)'],
      ['opening', 'Opening Address Prepared — Standard of Care & Causation'],
    ],
  },
  DEFENDANT: {
    RAF: [
      ['plea', "Defendant's Plea Filed — Merits & Quantum Disputed"],
      ['r36_recvd', 'Plaintiff Rule 36(9)(a)/(b) Expert Notices Received & Reviewed'],
      ['ime_neuro', 'IME — Neurosurgeon/Orthopaedic Arranged'],
      ['ime_report', 'IME Report Received & Served on Plaintiff'],
      ['r36_def', 'Defence Expert Notices Served on Plaintiff'],
      ['discovery', 'Discovery Affidavit Filed — RAF Records Disclosed'],
      ['jm_requested', 'Joint Minutes Meeting Requested from Plaintiff Experts'],
      ['jm_signed', 'Joint Minutes — Defence Experts Signed'],
      ['actuarial_def', 'Counter-Actuarial Report Obtained & Served'],
      ['serious_challenge', 'Serious Injury — Regulation 3 Challenge Filed (if applicable)'],
      ['bundle', 'Trial Bundle Reviewed — Defence Paginated Additions Filed'],
      ['heads', 'Defence Heads of Argument Filed — Quantum Reduction & Merits'],
      ['witnesses', 'Defence Witness List Served on Plaintiff'],
      ['pretrial', 'Pre-Trial Conference Minute Signed — Issues Narrowed'],
      ['opening', 'Defence Opening Address Prepared'],
    ],
    'Medical Negligence': [
      ['plea', "Defendant's Plea Filed — Standard of Care & Causation Denied"],
      ['r36_recvd', 'Plaintiff Expert Reports Received & Briefed to Defence Experts'],
      ['ime_arranged', 'Peer Review / IME Expert Appointed for Standard of Care'],
      ['defence_reports', 'Defence Expert Reports Obtained & Served'],
      ['r36_def', 'Defence Expert Notices Filed with Court'],
      ['discovery', 'Hospital Records Disclosed in Discovery'],
      ['jm_requested', 'Joint Minutes Meeting Requested from Plaintiff Experts'],
      ['jm_signed', 'Joint Minutes — All Defence Experts Signed'],
      ['bundle', 'Trial Bundle — Defence Bundle Compiled & Paginated'],
      ['heads', 'Defence Heads of Argument Filed — Causation & Standard of Care'],
      ['witnesses', 'Defence Witness List Served'],
      ['pretrial', 'Pre-Trial Conference Minute Signed'],
      ['bolitho', 'Bolitho Defence — Body of Medical Opinion Supporting Conduct Established'],
      ['opening', 'Defence Opening Address — Causation Denial & Alternative Cause'],
    ],
  },
};

// ─── DOCUMENTS ────────────────────────────────────────────────────────────────
export interface DocTemplate {
  label: string;
  desc: string;
  variant: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive';
}

export const DOCUMENTS: Record<FirmRole, Record<string, DocTemplate[]>> = {
  PLAINTIFF: {
    RAF: [
      { label: '📋 Rule 36(9)(a) Expert Notice', desc: 'Formal notice to RAF of plaintiff expert witnesses', variant: 'primary' },
      { label: '📜 Heads of Argument — Quantum & Merits', desc: 'Structured heads on loss of earnings, general damages', variant: 'secondary' },
      { label: '📁 Trial Bundle Index', desc: 'Paginated index per Uniform Rules', variant: 'success' },
      { label: '⚖ Opening Address — RAF Plaintiff', desc: 'SA High Court compliant plaintiff opening', variant: 'warning' },
      { label: '✍ Joint Minutes Request Letter', desc: 'Formal letter to RAF expert requesting joint minutes', variant: 'primary' },
      { label: '🏥 Serious Injury Motivation (Reg 3)', desc: 'Motivation for serious injury threshold', variant: 'secondary' },
      { label: '📊 Actuarial Evidence Summary', desc: 'Plain-language actuarial summary for court', variant: 'success' },
      { label: '🔍 Merits Argument Bundle', desc: 'Police docket, dashcam evidence, eyewitness statements', variant: 'destructive' },
    ],
    'Medical Negligence': [
      { label: '📋 Particulars of Claim', desc: 'Full particulars per Uniform Rules Rule 18(10)', variant: 'warning' },
      { label: '📜 Heads of Argument — Liability', desc: 'Standard of care, causation (but-for test)', variant: 'primary' },
      { label: '⚖ Res Ipsa Loquitur Argument', desc: 'Inference of negligence argument — case law and factual basis', variant: 'secondary' },
      { label: '📁 Trial Bundle Index', desc: 'Judges bundle, witness bundle, expert medical bundle', variant: 'success' },
      { label: '✍ Joint Minutes Request Letter', desc: 'Requesting joint minutes between opposing experts', variant: 'primary' },
      { label: '🏛 Opening Address — High Court', desc: 'SA High Court plaintiff opening — standard of care breach', variant: 'warning' },
      { label: '🔍 Expert Examination-in-Chief Guide', desc: 'Structured question guide for each plaintiff expert', variant: 'secondary' },
      { label: '📜 Spoliation Application', desc: 'Application to compel production of incomplete hospital records', variant: 'destructive' },
    ],
  },
  DEFENDANT: {
    RAF: [
      { label: '📋 Defence Expert Notice', desc: 'Formal notice to plaintiff of RAF defence expert witnesses', variant: 'primary' },
      { label: '📜 Defence Heads — Quantum', desc: 'Counter-heads on contingency deductions, residual earning capacity', variant: 'primary' },
      { label: '📁 Defence Trial Bundle Additions', desc: 'Defence paginated additions to joint trial bundle', variant: 'primary' },
      { label: '⚖ Defence Opening Address — RAF', desc: 'Defence opening — contest merits and/or quantum', variant: 'primary' },
      { label: '✍ Joint Minutes Agenda — Defence', desc: 'Defence expert proposed joint minutes agenda', variant: 'primary' },
      { label: '🏥 Serious Injury Challenge (Reg 3)', desc: 'Formal challenge to plaintiff serious injury assessment', variant: 'destructive' },
      { label: '📊 Counter-Actuarial Summary', desc: 'RAF actuarial counter — higher contingency', variant: 'primary' },
      { label: '🔍 Merits Defence Bundle', desc: 'Defence merits evidence — insured driver version', variant: 'destructive' },
    ],
    'Medical Negligence': [
      { label: "📋 Defendant's Plea", desc: 'Full plea — denies negligence, disputes causation', variant: 'primary' },
      { label: '📜 Defence Heads — Standard of Care', desc: 'Bolitho defence heads — responsible body of medical opinion', variant: 'primary' },
      { label: '⚖ Causation Counter-Argument', desc: 'But-for causation denial — pre-existing condition', variant: 'primary' },
      { label: '📁 Defence Trial Bundle', desc: 'Treating surgeon notes, anaesthetic chart, nursing records', variant: 'primary' },
      { label: '✍ Joint Minutes — Defence Position', desc: 'Defence expert joint minutes agenda', variant: 'primary' },
      { label: '🏛 Defence Opening Address', desc: 'Alternative standard of care narrative and causation denial', variant: 'primary' },
      { label: '🔍 Treating Surgeon Exam Guide', desc: 'Examination-in-chief for treating surgeon', variant: 'primary' },
      { label: '📜 Counter to Spoliation Application', desc: 'Response to plaintiff spoliation application', variant: 'destructive' },
    ],
  },
};

// ─── AI ANALYSIS ──────────────────────────────────────────────────────────────
export const ANALYSIS: Record<string, Record<FirmRole, AnalysisResult>> = {
  'KA-2026-001': {
    PLAINTIFF: {
      summary: 'Londeka Nene sustained severe facial injuries in an MVA. Maxillofacial surgery required. Expert appointment confirmed. Report pending.',
      keyFindings: ['Permanent facial scarring confirmed by treating surgeon', 'Functional jaw impairment documented in clinical notes', 'Expert scheduled — report expected by April 2026'],
      riskFactors: ['No actuarial or industrial psychologist appointed — quantum incomplete', 'WPI rating from Maxillofacial Surgeon not yet established'],
      outcome: { verdict: 'Moderate Plaintiff', confidence: 62, strategy: 'Appoint Clinical Psychologist and Industrial Psychologist urgently. Ensure the Maxillofacial Surgeon specifically addresses AMA Guides WPI rating.' },
      legalPoints: { section: 'Section 17 — General damages', merits: 'Third-party negligence apparent', threshold: 'Regulation 3 WPI rating critical — report pending' },
    },
    DEFENDANT: {
      summary: 'Only one plaintiff expert appointed. Report is still pending. No actuarial or quantum experts retained — quantum case incomplete.',
      keyFindings: ['Plaintiff has only ONE expert appointed', 'Report not yet delivered', 'No actuarial or industrial psychologist on record'],
      riskFactors: ['If plaintiff obtains full expert team, liability exposure increases', 'Police report may support plaintiff merits version'],
      outcome: { verdict: 'Defend — Quantum Contested', confidence: 71, strategy: 'Arrange IME with defence Orthopaedic Surgeon and Maxillofacial peer reviewer immediately.' },
      legalPoints: { merits: 'Contest insured driver liability', threshold: 'Challenge Regulation 3 proactively', quantum: 'High contingency deductions warranted' },
    },
  },
  'KA-2026-002': {
    PLAINTIFF: {
      summary: 'Sipho Dlamini suffered severe TBI. Full expert team in place. Joint minutes signed. Trial Prep stage — trial 14 July 2026.',
      keyFindings: ['Permanent 35% WPI — serious injury threshold met', 'Total loss of earning capacity — R4.8M actuarial', 'Joint minutes signed — neurosurgeons agree', 'RAF merits defence weak — dashcam footage available'],
      riskFactors: ['No Clinical Psychologist retained', 'RAF merits defence must be defeated first'],
      outcome: { verdict: 'Strong Plaintiff', confidence: 84, strategy: 'Retain Clinical Psychologist immediately. Lead with neurological evidence on Day 1. Seek Section 17(1)(a) undertaking for future medical costs.' },
      legalPoints: { section: 'Section 17 — General damages & loss of earnings', merits: 'Dashcam counters RAF defence', threshold: 'Serious Injury CONFIRMED — WPI 35%' },
    },
    DEFENDANT: {
      summary: 'Well-prepared plaintiff expert team. Joint minutes signed favourably to plaintiff. Dashcam footage undermines RAF merits defence.',
      keyFindings: ['Joint minutes signed — 35% WPI agreed', 'Dashcam contradicts insured driver version', 'Plaintiff actuarial quantum R4.8M', 'No Clinical Psychologist — only gap'],
      riskFactors: ['RAF merits defence very weak', 'Joint minutes difficult to re-open', 'Counter-actuarial must apply higher contingencies'],
      outcome: { verdict: 'Defend — Quantum Only', confidence: 68, strategy: 'Consider conceding merits and focusing on quantum reduction. Obtain counter-actuarial report with 20–25% general contingency.' },
      legalPoints: { merits: 'WEAK — dashcam supports plaintiff', quantum: 'Challenge actuarial assumptions', threshold: 'WPI 35% confirmed — threshold not viable' },
    },
  },
  'KA-2026-003': {
    PLAINTIFF: {
      summary: 'Fatima Essop suffered bile duct injury during laparoscopic cholecystectomy. GP expert appointed. Hospital records have gaps.',
      keyFindings: ['GP expert appointed — report expected March 2026', 'Hospital records contain gaps — spoliation risk', 'SAMLIP actively denies causation'],
      riskFactors: ['No Radiologist retained', 'No actuarial expert', 'Hospital records may be incomplete'],
      outcome: { verdict: 'Moderate Plaintiff', confidence: 67, strategy: 'Retain Radiologist immediately — MRCP imaging is cornerstone of causation. Subpoena hospital records. Invoke spoliation doctrine.' },
      legalPoints: { legislation: 'National Health Act 61 of 2003', defence: 'Pre-existing biliary disease disputed', resIpsa: 'Applicable — bile duct injury during routine procedure' },
    },
    DEFENDANT: {
      summary: 'Plaintiff expert team incomplete. Hospital records have gaps. SAMLIP causation defence available.',
      keyFindings: ['Only ONE expert (GP) appointed', 'Hospital records have gaps', 'Causation defence viable'],
      riskFactors: ['MRCP imaging may be difficult to counter', 'Spoliation application risk', 'Res ipsa loquitur risk'],
      outcome: { verdict: 'Defend — Causation Dispute', confidence: 74, strategy: 'Appoint Specialist Peer Reviewer immediately. Ensure hospital records are complete. Develop Bolitho defence.' },
      legalPoints: { bolitho: 'Appoint hepatobiliary specialist', resIpsa: 'Counter with expert evidence', records: 'Full discovery essential', causation: 'Pre-existing biliary disease argument' },
    },
  },
  'KA-2026-004': {
    PLAINTIFF: {
      summary: 'Thandi Mokoena has orthopaedic injuries — fractured femur and pelvis. Partial return to light nursing duties.',
      keyFindings: ['Orthopaedic report confirmed WPI for lower limbs', 'Returned to light duties — argues reduced earning capacity', 'OT Assessment supports physical restrictions'],
      riskFactors: ['No Industrial Psychologist retained — career impact not formally established', 'No actuarial report — quantum incomplete', 'RAF may argue full return to pre-accident occupation possible'],
      outcome: { verdict: 'Moderate Plaintiff', confidence: 65, strategy: 'Retain Industrial Psychologist and Actuarial Scientist urgently. The loss of earnings claim cannot succeed without them.' },
      legalPoints: { section: 'Section 17 — General damages', merits: 'Liability straightforward', threshold: 'WPI exceeds 30% — Regulation 3 met' },
    },
    DEFENDANT: {
      summary: 'Plaintiff has returned to work in a reduced capacity. Quantum team incomplete — only orthopaedic expert and OT retained.',
      keyFindings: ['Plaintiff returned to light nursing duties', 'No Industrial Psychologist or Actuarial Scientist appointed', 'OT confirms restrictions but these are manageable'],
      riskFactors: ['If plaintiff retains full quantum team, exposure increases', 'WPI rating may exceed Regulation 3 threshold'],
      outcome: { verdict: 'Defend — Quantum Contested', confidence: 70, strategy: 'Arrange defence IME — challenge WPI rating and argue return to work demonstrates residual capacity. Counter-actuarial must exploit return to work.' },
      legalPoints: { merits: 'Liability conceded — focus on quantum', quantum: 'Return to work is strongest defence point', threshold: 'WPI rating to be challenged via IME' },
    },
  },
};

// ─── LEGAL NOTES ──────────────────────────────────────────────────────────────
export const getLegalNotes = (role: FirmRole, isRAF: boolean): LegalNote[] => {
  if (role === 'PLAINTIFF') {
    return isRAF
      ? [
          { h: 'Serious Injury — Regulation 3', b: 'Claimant must meet Narrative Test OR AMA Guides 30%+ WPI to claim general damages.' },
          { h: 'Rule 36(9) Expert Notices', b: 'File before close of pleadings. RAF strictly enforces — failure to serve results in expert exclusion.' },
          { h: 'Joint Minutes', b: 'Signed joint minutes bind both experts at trial. Cannot deviate without leave of court.' },
          { h: 'Section 17(1)(a) Undertaking', b: 'RAF may undertake to pay future medical costs in lieu of lump sum.' },
          { h: 'Contingency Deduction', b: 'SA courts apply 5–25% general contingency on actuarial future loss.' },
        ]
      : [
          { h: 'Standard of Care — Bolitho Test', b: "Defendant's conduct must be supported by a responsible body of medical opinion." },
          { h: 'Res Ipsa Loquitur', b: 'Where injury speaks for itself — raises inference of negligence.' },
          { h: 'Causation — But For Test', b: 'Combined with loss-of-a-chance doctrine where appropriate.' },
          { h: 'Section 22 — NHA Record Access', b: 'Defendant must provide full medical records.' },
        ];
  }
  return isRAF
    ? [
        { h: 'Challenge Regulation 3', b: 'Arrange defence IME before plaintiff report finalises.' },
        { h: 'Counter Joint Minutes Strategy', b: 'Brief defence expert to concede only what is scientifically incontrovertible.' },
        { h: 'Contingency Deduction (Defence)', b: 'Argue 20–25% general contingency where claimant has returned to work.' },
        { h: 'Section 17(4)(c) Earnings Cap', b: 'Apply RAF earnings cap where applicable.' },
      ]
    : [
        { h: 'Bolitho Defence', b: 'Appoint specialist for competing responsible body of medical opinion.' },
        { h: 'Causation Counter', b: 'Develop alternative causation argument: pre-existing pathology.' },
        { h: 'Counter Res Ipsa Loquitur', b: 'Rebut with expert evidence establishing known acceptable risk.' },
        { h: 'Full Discovery', b: 'Ensure complete disclosure of theatre records. Gaps create spoliation risk.' },
      ];
};
