import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";
import { sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AppointmentEmailRequest {
  appointmentId: string;
  attorneyEmail?: string;
  attorneyCc?: string;
  expertEmail?: string;
  expertCc?: string;
  attachmentDocumentIds?: string[];
  customLocation?: string;
  customExpertBody?: string;
  customAttorneyBody?: string;
  customExpertSubject?: string;
  customAttorneySubject?: string;
  bulkAppointmentIds?: string[];
  bulkExpertMode?: boolean;
}

interface AppointmentInfo {
  claimant_name: string;
  expert_type: string;
  appointment_date: string;
  appointment_time: string;
  location: string;
  matter_type: string;
}

interface AppointmentConfirmation {
  attorney_name: string;
  attorney_contact_person?: string;
  attorney_email: string;
  expert_email?: string;
  appointments: AppointmentInfo[];
}

function generateAppointmentPdf(confirmation: AppointmentConfirmation): Uint8Array {
  const doc = new jsPDF();
  
  // Header with company branding - teal gradient
  doc.setFillColor(31, 182, 206); // Company teal #1fb6ce
  doc.rect(0, 0, 210, 42, 'F');
  // Accent bottom stripe
  doc.setFillColor(21, 155, 175);
  doc.rect(0, 38, 210, 4, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('KUTLWANO & ASSOCIATES (PTY) LTD', 105, 13, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text('Medico-Legal Service', 105, 20, { align: 'center' });
  
  doc.setFont(undefined, 'italic');
  doc.setFontSize(7);
  doc.text('"We touch a file, We change a life, We are Kutlwano and Associate"', 105, 27, { align: 'center' });
  
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('APPOINTMENT CONFIRMATION', 105, 36, { align: 'center' });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  let yPos = 52;

  // Dear salutation
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Dear ${confirmation.attorney_contact_person || confirmation.attorney_name},`, 20, yPos);
  yPos += 10;

  // Referring Attorney Info box
  doc.setFillColor(240, 252, 255); // Light teal background
  doc.setDrawColor(31, 182, 206);
  doc.rect(15, yPos - 5, 180, 14, 'FD');
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(21, 100, 120);
  doc.text('Referring Attorney:', 20, yPos + 1);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(confirmation.attorney_name, 65, yPos + 1);
  
  yPos += 20;
  
  // Appointments Header
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(31, 182, 206);
  doc.text(`Scheduled Assessment${confirmation.appointments.length > 1 ? 's' : ''}`, 20, yPos);
  doc.setTextColor(0, 0, 0);
  
  yPos += 8;
  
  // Table header background - company teal
  doc.setFillColor(31, 182, 206);
  doc.rect(15, yPos - 5, 180, 10, 'F');
  
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('#', 18, yPos);
  doc.text('Claimant Name', 28, yPos);
  doc.text('Discipline/Expert', 85, yPos);
  doc.text('Date & Time', 135, yPos);
  
  yPos += 8;
  doc.setTextColor(0, 0, 0);
  
  // Draw line under header
  doc.setDrawColor(31, 182, 206);
  doc.line(15, yPos, 195, yPos);
  
  yPos += 5;
  
  // Appointments
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  
  confirmation.appointments.forEach((apt, index) => {
    // Check if we need a new page
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    
    // Alternating row background
    if (index % 2 === 1) {
      doc.setFillColor(240, 252, 255);
      doc.rect(15, yPos - 4, 180, 14, 'F');
    }
    
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text(`${index + 1}.`, 18, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(apt.claimant_name, 28, yPos);
    doc.text(apt.expert_type, 85, yPos);
    doc.text(`${apt.appointment_date} ${apt.appointment_time}`, 135, yPos);
    
    yPos += 5;
    
    // Location and Matter Type
    doc.setTextColor(31, 182, 206);
    doc.setFontSize(8);
    doc.text(`Location: ${apt.location}`, 28, yPos);
    yPos += 4;
    doc.text(`Matter Type: ${apt.matter_type}`, 28, yPos);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    
    yPos += 8;
  });
  
  // Helper to check page break
  const checkPageBreak = (needed: number) => {
    if (yPos + needed > 275) {
      doc.addPage();
      yPos = 20;
    }
  };

  // ⚠️ IMPORTANT REQUIREMENTS header
  yPos += 10;
  checkPageBreak(20);
  doc.setFillColor(254, 243, 199); // Amber background
  doc.setDrawColor(245, 158, 11); // Amber border
  doc.rect(15, yPos - 5, 180, 12, 'FD');
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(146, 64, 14);
  doc.text('IMPORTANT REQUIREMENTS', 105, yPos + 2, { align: 'center' });
  yPos += 15;

  // Section renderer
  const renderSection = (icon: string, title: string, items: string[]) => {
    checkPageBreak(10 + items.length * 6);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(31, 182, 206);
    doc.text(`${icon} ${title}`, 20, yPos);
    yPos += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    items.forEach(item => {
      checkPageBreak(6);
      doc.text(`•  ${item}`, 25, yPos);
      yPos += 5;
    });
    yPos += 4;
  };

  // Required Documents – dynamically add Med Neg extras
  const requiredDocs = [
    'Instruction letter from your office',
    'Complete medical records and reports',
    'ID copy of the claimants',
    'Any previous assessment reports (if applicable)',
    'Relevant imaging/diagnostic results',
  ];
  // Check if any appointment in the list is med neg
  const hasNegligence = confirmation.appointments.some(a => (a.matter_type || '').toLowerCase().includes('neg'));
  if (hasNegligence) {
    requiredDocs.push('Summons (particulars of claim)');
    requiredDocs.push('Section 3 notice in terms of Act 40 of 2002');
  }
  renderSection('Required Documents (Must be provided before assessment):', '', requiredDocs);

  renderSection('Appointment Preparation:', '', [
    'Claimants must arrive 15 minutes early',
    'Bring valid identification',
    'Confirm appointment 24 hours in advance',
    'Notify us immediately if unable to attend',
  ]);

  renderSection('Cancellation & Rescheduling Policy:', '', [
    'Minimum 48 hours notice required for cancellations',
    'Late cancellations may incur cancellation fees',
    'Contact Kutlwano & Associate directly for rescheduling',
    'No-shows will be charged the full assessment fee',
  ]);

  renderSection('Payment & Fee Information:', '', [
    'X-rays are not included in our fee charged.',
  ]);

  renderSection('Contact Information:', '', [
    'For queries: Contact Itebogeng for Med Neg & Virginia for MVA',
    'For document submission: info@kutlwanoassociate.com',
    'For emergencies: 011 027 6077 / 079 623 8064',
  ]);

  // Footer with company branding
  checkPageBreak(25);
  const footerY = Math.max(yPos + 10, 272);
  doc.setFillColor(31, 182, 206);
  doc.rect(0, footerY - 4, 210, 18, 'F');
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text('Kutlwano & Associates (Pty) Ltd | Medico-Legal Service', 105, footerY + 2, { align: 'center' });
  doc.setFont(undefined, 'italic');
  doc.text('"We touch a file, We change a life, We are Kutlwano and Associate"', 105, footerY + 7, { align: 'center' });
  doc.setFont(undefined, 'normal');
  doc.setFontSize(7);
  doc.text('This is an automated document. Please do not reply directly to this message.', 105, footerY + 12, { align: 'center' });
  
  // Generate PDF as Uint8Array
  const pdfOutput = doc.output('arraybuffer');
  return new Uint8Array(pdfOutput);
}

interface ExpertPdfData {
  expert_name: string;
  expert_type: string;
  attorney_name: string;
  claimant_name: string;
  appointment_date: string;
  appointment_time: string;
  matter_type: string;
  location: string;
  has_attachments: boolean;
  customBody?: string;
}

function generateExpertPdf(data: ExpertPdfData): Uint8Array {
  const doc = new jsPDF();
  
  // Header - company teal
  doc.setFillColor(31, 182, 206);
  doc.rect(0, 0, 210, 42, 'F');
  doc.setFillColor(21, 155, 175);
  doc.rect(0, 38, 210, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('KUTLWANO & ASSOCIATES (PTY) LTD', 105, 13, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text('Medico-Legal Service', 105, 20, { align: 'center' });
  doc.setFont(undefined, 'italic');
  doc.setFontSize(7);
  doc.text('"We touch a file, We change a life, We are Kutlwano and Associate"', 105, 27, { align: 'center' });
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('EXPERT APPOINTMENT LETTER', 105, 36, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  let yPos = 52;

  // Dear salutation
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  doc.text(`Dear Dr. ${data.expert_name || data.expert_type},`, 20, yPos);
  yPos += 10;

  // Body text - use custom body if provided
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');

  const claimType = (data.matter_type || '').toLowerCase().includes('neg') 
    ? 'Medical Negligence claim' 
    : "Road Accident Fund claim";

  if (data.customBody) {
    // Render custom body paragraphs
    const paragraphs = data.customBody.split('\n').filter(p => p.trim());
    paragraphs.forEach(paragraph => {
      const lines = doc.splitTextToSize(paragraph.trim(), 170);
      doc.text(lines, 20, yPos);
      yPos += lines.length * 6 + 5;
    });
  } else {
    const para1 = `We write to confirm that Kutlwano & Associates Pty Ltd has been duly appointed by ${data.attorney_name} to facilitate a medico-legal assessment.`;
    const lines1 = doc.splitTextToSize(para1, 170);
    doc.text(lines1, 20, yPos);
    yPos += lines1.length * 6 + 5;

    const para2 = `Accordingly, we kindly request that Dr. ${data.expert_name || data.expert_type} conduct an assessment of the referred patient and provide a comprehensive medico-legal report in relation to a ${claimType}.`;
    const lines2 = doc.splitTextToSize(para2, 170);
    doc.text(lines2, 20, yPos);
    yPos += lines2.length * 6 + 5;
  }

  yPos += 5;

  // Appointment Details table
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(31, 182, 206);
  doc.text('Appointment Details', 20, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 8;

  doc.setFillColor(31, 182, 206);
  doc.rect(15, yPos - 5, 180, 10, 'F');
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Field', 20, yPos);
  doc.text('Details', 90, yPos);
  yPos += 8;
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(31, 182, 206);
  doc.line(15, yPos, 195, yPos);
  yPos += 5;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  const details = [
    ['Patient', data.claimant_name],
    ['Date', data.appointment_date],
    ['Time', data.appointment_time],
    ['Assessment Type', data.matter_type],
    ['Referring Attorney', data.attorney_name],
  ];
  if (data.location) {
    details.push(['Location', data.location]);
  }
  details.forEach(([label, value], i) => {
    if (i % 2 === 1) {
      doc.setFillColor(240, 252, 255);
      doc.rect(15, yPos - 4, 180, 9, 'F');
    }
    doc.setFont(undefined, 'bold');
    doc.setTextColor(31, 100, 120);
    doc.text(label + ':', 20, yPos);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(value || 'N/A', 90, yPos);
    yPos += 8;
  });

  yPos += 10;

  // Important Requirements
  const checkPageBreak = (needed: number) => {
    if (yPos + needed > 275) {
      doc.addPage();
      yPos = 20;
    }
  };

  checkPageBreak(20);
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.rect(15, yPos - 5, 180, 12, 'FD');
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(146, 64, 14);
  doc.text('IMPORTANT REQUIREMENTS', 105, yPos + 2, { align: 'center' });
  yPos += 15;

  // Please Note section
  checkPageBreak(40);
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(31, 182, 206);
  doc.text('Please Note:', 20, yPos);
  yPos += 7;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const expertNotes = [
    'Kindly confirm your availability for this assessment in writing.',
    'Should you need to reschedule, notify our office immediately.',
    'All expert rescheduling arrangements must be processed strictly through Kutlwano and Associates (Pty) Ltd.',
    'Please review all case documentation provided prior to the assessment.',
    'All digital and physical records must be securely stored in compliance with applicable professional and POPIA requirements.',
    'Communication, queries must be directed to Kutlwano and Associate.',
    'The expert\'s office is prohibited from contacting or soliciting our referring attorneys.',
  ];
  expertNotes.forEach(item => {
    checkPageBreak(8);
    const lines = doc.splitTextToSize(`•  ${item}`, 160);
    doc.text(lines, 25, yPos);
    yPos += lines.length * 5;
  });
  yPos += 4;

  // Closing statement
  checkPageBreak(12);
  doc.setFont(undefined, 'italic');
  doc.setFontSize(10);
  doc.setTextColor(31, 182, 206);
  const closingText = 'We value professional integrity, independence, and structured coordination to ensure smooth case management for all parties involved.';
  const closingLines = doc.splitTextToSize(closingText, 160);
  doc.text(closingLines, 25, yPos);
  yPos += closingLines.length * 5 + 4;

  // Branded footer
  checkPageBreak(25);
  const footerY = Math.max(yPos + 10, 272);
  doc.setFillColor(31, 182, 206);
  doc.rect(0, footerY - 4, 210, 18, 'F');
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text('Kutlwano & Associates (Pty) Ltd | Medico-Legal Service', 105, footerY + 2, { align: 'center' });
  doc.setFont(undefined, 'italic');
  doc.text('"We touch a file, We change a life, We are Kutlwano and Associate"', 105, footerY + 7, { align: 'center' });
  doc.setFont(undefined, 'normal');
  doc.setFontSize(7);
  doc.text('This is an automated document. Please do not reply directly to this message.', 105, footerY + 12, { align: 'center' });

  const pdfOutput = doc.output('arraybuffer');
  return new Uint8Array(pdfOutput);
}

interface BulkExpertPatient {
  claimant_name: string;
  appointment_date: string;
  appointment_time: string;
  matter_type: string;
  attorney_name: string;
  location: string;
}

function generateBulkExpertPdf(expertName: string, expertType: string, patients: BulkExpertPatient[]): Uint8Array {
  const doc = new jsPDF();

  // Header
  doc.setFillColor(31, 182, 206);
  doc.rect(0, 0, 210, 45, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text('KUTLWANO & ASSOCIATES (PTY) LTD', 105, 15, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text('Medico-Legal Service', 105, 23, { align: 'center' });
  doc.setFont(undefined, 'italic');
  doc.setFontSize(8);
  doc.text('"We touch a file, We change a life, We are Kutlwano and Associate"', 105, 30, { align: 'center' });
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('Expert Appointment Letter', 105, 40, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  let yPos = 55;

  const drTitle = `Dr. ${expertName || expertType}`;

  // Dear salutation - standalone line
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  doc.text(`Dear ${drTitle},`, 20, yPos);
  yPos += 10;

  doc.setFontSize(11);
  // Determine claim types from patients
  const uniqueAttorneys = [...new Set(patients.map(p => p.attorney_name))].join(', ');
  const bodyText = `Kutlwano and Associates (Pty) Ltd has been appointed by ${uniqueAttorneys} to arrange medico-legal assessments in respect of their clients' claims.\n\nYou are hereby requested to assess the referred patients and to provide comprehensive medico-legal reports, including completion of the RAF 4 form Reports. We appreciate your assistance.\n\nPlease find below the list of ${patients.length} patient(s) scheduled for assessment.`;
  const bodyLines = doc.splitTextToSize(bodyText, 170);
  doc.text(bodyLines, 20, yPos);
  yPos += bodyLines.length * 6 + 10;

  // Patients table
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`Scheduled Patients (${patients.length})`, 20, yPos);
  yPos += 10;

  // Table header
  doc.setFillColor(249, 250, 251);
  doc.rect(15, yPos - 5, 180, 10, 'F');
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('#', 18, yPos);
  doc.text('Patient Name', 28, yPos);
  doc.text('Attorney', 85, yPos);
  doc.text('Date & Time', 130, yPos);
  doc.text('Matter', 170, yPos);
  yPos += 8;
  doc.setDrawColor(229, 231, 235);
  doc.line(15, yPos, 195, yPos);
  yPos += 5;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  patients.forEach((p, i) => {
    if (yPos > 265) { doc.addPage(); yPos = 20; }
    if (i % 2 === 1) { doc.setFillColor(249, 250, 251); doc.rect(15, yPos - 4, 180, 12, 'F'); }
    doc.setTextColor(0, 0, 0);
    doc.text(`${i + 1}.`, 18, yPos);
    doc.text(p.claimant_name, 28, yPos);
    doc.text(p.attorney_name.substring(0, 30), 85, yPos);
    doc.text(`${p.appointment_date} ${p.appointment_time}`, 130, yPos);
    doc.text((p.matter_type || 'General').substring(0, 15), 170, yPos);
    yPos += 5;
    doc.setTextColor(107, 114, 128);
    doc.text(`Location: ${p.location || 'TBD'}`, 28, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 8;
  });

  // Important requirements
  const checkPageBreak = (needed: number) => { if (yPos + needed > 275) { doc.addPage(); yPos = 20; } };
  yPos += 10;
  checkPageBreak(20);
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.rect(15, yPos - 5, 180, 12, 'FD');
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(146, 64, 14);
  doc.text('IMPORTANT REQUIREMENTS', 105, yPos + 2, { align: 'center' });
  yPos += 15;

  // Please Note section
  checkPageBreak(40);
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(146, 64, 14);
  doc.text('Please Note:', 20, yPos);
  yPos += 7;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 53, 15);
  const expertNotes = [
    'Kindly confirm your availability for this assessment in writing.',
    'Should you need to reschedule, notify our office immediately.',
    'All expert rescheduling arrangements must be processed strictly through Kutlwano and Associates (Pty) Ltd.',
    'Please review all case documentation provided prior to the assessment.',
    'All digital and physical records must be securely stored in compliance with applicable professional and POPIA requirements.',
    'Communication, queries must be directed to Kutlwano and Associate.',
    'The expert\'s office is prohibited from contacting or soliciting our referring attorneys.',
  ];
  expertNotes.forEach(item => { checkPageBreak(8); const lines = doc.splitTextToSize(`•  ${item}`, 160); doc.text(lines, 25, yPos); yPos += lines.length * 5; });
  yPos += 4;

  // Closing statement
  checkPageBreak(12);
  doc.setFont(undefined, 'italic');
  doc.setFontSize(9);
  const closingText = 'We value professional integrity, independence, and structured coordination to ensure smooth case management for all parties involved.';
  const closingLines = doc.splitTextToSize(closingText, 160);
  doc.text(closingLines, 25, yPos);
  yPos += closingLines.length * 5 + 4;

  // Footer
  checkPageBreak(20);
  yPos = Math.max(yPos + 10, 270);
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('Kutlwano & Associates (Pty) Ltd | Medico-Legal Service', 105, yPos, { align: 'center' });
  yPos += 5;
  doc.setFont(undefined, 'italic');
  doc.text('"We touch a file, We change a life, We are Kutlwano and Associate"', 105, yPos, { align: 'center' });
  yPos += 5;
  doc.text('This is an automated email. Please do not reply directly to this message.', 105, yPos, { align: 'center' });

  return new Uint8Array(doc.output('arraybuffer'));
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Appointment confirmation email function called");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      appointmentId, 
      attorneyEmail: customAttorneyEmail, 
      attorneyCc,
      expertEmail: customExpertEmail,
      expertCc,
      attachmentDocumentIds,
      customLocation,
      customExpertBody,
      customAttorneyBody,
      customExpertSubject,
      customAttorneySubject,
      bulkAppointmentIds,
      bulkExpertMode,
    }: AppointmentEmailRequest = await req.json();
    console.log("Processing appointment confirmation for:", appointmentId, "bulkExpertMode:", bulkExpertMode);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch appointment data with related information
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        claimants (
          first_name,
          last_name
        ),
        medical_experts (
          first_name,
          last_name,
          email,
          expert_type,
          practice_address,
          consultation_fees
        ),
        referring_attorneys (
          name,
          email,
          contact_person
        )
      `)
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error("Error fetching appointment:", appointmentError);
      throw new Error("Appointment not found");
    }

    console.log("Appointment data fetched:", appointment);

    // Fetch only THIS MONTH's new appointments for the attorney email PDF
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { data: allAppointments, error: allAppointmentsError } = await supabase
      .from('appointments')
      .select(`
        *,
        claimants (
          first_name,
          last_name
        ),
        medical_experts (
          first_name,
          last_name,
          expert_type,
          practice_address
        )
      `)
      .eq('referring_attorney_id', appointment.referring_attorney_id)
      .is('deleted_at', null)
      .gte('appointment_date', monthStart)
      .lte('appointment_date', monthEnd)
      .order('appointment_date', { ascending: true });

    if (allAppointmentsError) {
      console.error("Error fetching all appointments:", allAppointmentsError);
    }

    console.log(`Found ${allAppointments?.length || 0} total scheduled appointments for attorney`);

    const appointmentData = {
      id: appointment.id,
      claimant_name: `${appointment.claimants.first_name} ${appointment.claimants.last_name}`,
      expert_name: `${appointment.medical_experts.first_name} ${appointment.medical_experts.last_name}`,
      expert_type: appointment.medical_experts.expert_type,
      expert_email: appointment.medical_experts.email,
      attorney_name: appointment.referring_attorneys.name,
      attorney_contact_person: (appointment.referring_attorneys as any).contact_person || appointment.referring_attorneys.name,
      attorney_email: appointment.referring_attorneys.email,
      appointment_date: appointment.appointment_date,
      matter_type: appointment.matter_type,
      consultation_fees: appointment.medical_experts.consultation_fees || 0,
      service_fee: appointment.service_fee || 0,
      case_status: appointment.case_status,
      location: customLocation || appointment.medical_experts.practice_address,
    };

    // Format the appointment date and time
    const appointmentDateTime = new Date(appointmentData.appointment_date);
    const formattedDate = appointmentDateTime.toLocaleDateString('en-ZA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      timeZone: 'Africa/Johannesburg'
    });
    const formattedTime = appointmentDateTime.toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Johannesburg'
    });

    // Fetch claimant documents if IDs provided (needed before expert email template)
    let documentAttachments: Array<{ filename: string; content: string }> = [];
    if (attachmentDocumentIds && attachmentDocumentIds.length > 0) {
      console.log(`Fetching ${attachmentDocumentIds.length} claimant documents`);
      
      for (const docId of attachmentDocumentIds) {
        try {
          const { data: docData, error: docError } = await supabase
            .from('documents')
            .select('file_name, file_path')
            .eq('id', docId)
            .single();
          
          if (docError || !docData) {
            console.error(`Error fetching document ${docId}:`, docError);
            continue;
          }

          const { data: fileData, error: fileError } = await supabase
            .storage
            .from('documents')
            .download(docData.file_path);
          
          if (fileError || !fileData) {
            console.error(`Error downloading file ${docData.file_path}:`, fileError);
            continue;
          }

          const arrayBuffer = await fileData.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          
          documentAttachments.push({
            filename: docData.file_name,
            content: base64
          });
          
          console.log(`Added attachment: ${docData.file_name}`);
        } catch (error: any) {
          console.error(`Error processing document ${docId}:`, error);
        }
      }
      
      console.log(`Successfully prepared ${documentAttachments.length} attachments`);
    }

    // Generate access code for the referring attorney
    const generateAccessCode = (): string => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      let code = '';
      for (let i = 0; i < 12; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    let accessCode = '';
    let accessLink = '';
    try {
      // Check if an active access code already exists for this appointment
      const { data: existingCode } = await supabase
        .from('attorney_access_codes')
        .select('access_code')
        .eq('appointment_id', appointmentId)
        .eq('is_active', true)
        .single();

      if (existingCode) {
        accessCode = existingCode.access_code;
      } else {
        accessCode = generateAccessCode();
        await supabase
          .from('attorney_access_codes')
          .insert({
            access_code: accessCode,
            appointment_id: appointmentId,
            referring_attorney_id: appointment.referring_attorney_id,
            is_active: true,
          });
      }
      accessLink = `https://kamedico-legal.lovable.app/case-access?code=${accessCode}`;
      console.log('Access code generated/retrieved for appointment:', appointmentId);
    } catch (accessError: any) {
      console.error('Error generating access code:', accessError);
    }

    const expertDisplayName = (appointmentData.expert_name && appointmentData.expert_name.trim()) 
      ? appointmentData.expert_name 
      : appointmentData.expert_type;
    const expertDrTitle = `Dr. ${appointmentData.expert_name && appointmentData.expert_name.trim() ? appointmentData.expert_name : appointmentData.expert_type}`;

    // Email template for medical expert
    const expertEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; font-size: 11px; color: #374151;">
        <div style="background: linear-gradient(135deg, #1fb6ce 0%, #159baf 100%); color: white; padding: 20px; text-align: center; margin-bottom: 20px; border-radius: 8px;">
          <h1 style="margin: 0; font-size: 14px; font-weight: bold; letter-spacing: 0.5px;">KUTLWANO & ASSOCIATES (PTY) LTD</h1>
          <p style="margin: 5px 0; font-size: 10px;">Medico-Legal Service</p>
          <p style="margin: 5px 0; font-size: 10px; font-style: italic;">"We touch a file, We change a life, We are Kutlwano and Associate"</p>
        </div>
        
        <div style="background-color: #e0f7fa; border-left: 4px solid #1fb6ce; padding: 12px 20px; border-radius: 4px; margin-bottom: 20px;">
          <h2 style="color: #1fb6ce; margin: 0; font-size: 13px; font-weight: bold;">Expert Appointment Letter</h2>
        </div>
        
        <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p style="margin-bottom: 15px; font-size: 11px;">Dear ${expertDrTitle},</p>
          
          ${customExpertBody ? `<p style="margin-bottom: 15px; font-size: 11px; line-height: 1.6;">${customExpertBody.replace(/\n/g, '<br/>')}</p>` : `
          <p style="margin-bottom: 12px; font-size: 11px; line-height: 1.6;">
            We write to confirm that <strong>Kutlwano & Associates Pty Ltd</strong> has been duly appointed by <strong>${appointmentData.attorney_name}</strong> to facilitate a medico-legal assessment.
          </p>
          <p style="margin-bottom: 12px; font-size: 11px; line-height: 1.6;">
            Accordingly, we kindly request that <strong>${expertDrTitle}</strong> conduct an assessment of the referred patient and provide a comprehensive medico-legal report in relation to a <strong>${(appointmentData.matter_type || '').toLowerCase().includes('neg') ? 'Medical Negligence Claim' : 'Road Accident Fund claim'}</strong>.
          </p>`}

          <h3 style="color: #1fb6ce; margin-top: 20px; margin-bottom: 10px; font-size: 12px; border-bottom: 2px solid #1fb6ce; padding-bottom: 4px;">Appointment Details</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <tr style="background-color: #f0fcff;">
              <td style="padding: 7px 8px; color: #1fb6ce; font-weight: bold; width: 40%;">Patient:</td>
              <td style="padding: 7px 8px; color: #374151;">${appointmentData.claimant_name}</td>
            </tr>
            <tr>
              <td style="padding: 7px 8px; color: #1fb6ce; font-weight: bold;">Date:</td>
              <td style="padding: 7px 8px; color: #374151;">${formattedDate}</td>
            </tr>
            <tr style="background-color: #f0fcff;">
              <td style="padding: 7px 8px; color: #1fb6ce; font-weight: bold;">Time:</td>
              <td style="padding: 7px 8px; color: #374151;">${formattedTime}</td>
            </tr>
            <tr>
              <td style="padding: 7px 8px; color: #1fb6ce; font-weight: bold;">Assessment Type:</td>
              <td style="padding: 7px 8px; color: #374151;">${appointmentData.matter_type}</td>
            </tr>
            <tr style="background-color: #f0fcff;">
              <td style="padding: 7px 8px; color: #1fb6ce; font-weight: bold;">Referring Attorney:</td>
              <td style="padding: 7px 8px; color: #374151;">${appointmentData.attorney_name}</td>
            </tr>
            ${appointmentData.location ? `
            <tr>
              <td style="padding: 7px 8px; color: #1fb6ce; font-weight: bold;">Location:</td>
              <td style="padding: 7px 8px; color: #374151;">${appointmentData.location}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <div style="background-color: #e0f7fa; border: 1px solid #1fb6ce; padding: 12px 15px; border-radius: 8px; margin-bottom: 20px;">
          <p style="color: #0e7490; margin: 0; font-size: 11px; font-weight: bold;">
            📋 Important: This appointment was scheduled by Kutlwano & Associate. For any rescheduling requests or queries, please contact us directly.
          </p>
        </div>

        <div style="background-color: #fef3c7; border: 2px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 8px;">
          <h3 style="color: #92400e; margin: 0 0 12px 0; font-size: 13px;">⚠️ IMPORTANT REQUIREMENTS</h3>
          <div style="margin-bottom: 10px;">
            <p style="color: #92400e; margin: 0 0 5px 0; font-weight: bold; font-size: 12px;">📋 Please Note:</p>
            <ul style="color: #78350f; margin: 5px 0 0 20px; padding: 0; font-size: 10px; line-height: 1.7;">
              <li>Kindly confirm your availability for this assessment in writing.</li>
              <li>Should you need to reschedule, notify our office immediately.</li>
              <li>All expert rescheduling arrangements must be processed strictly through Kutlwano and Associates (Pty) Ltd.</li>
              <li>Please review all case documentation provided prior to the assessment.</li>
              <li>All digital and physical records must be securely stored in compliance with applicable professional and POPIA requirements.</li>
              <li>Communication, queries must be directed to Kutlwano and Associate.</li>
              <li>The expert's office is prohibited from contacting or soliciting our referring attorneys.</li>
            </ul>
            <p style="color: #78350f; margin: 10px 0 0 0; font-style: italic; font-size: 10px;">We value professional integrity, independence, and structured coordination to ensure smooth case management for all parties involved.</p>
          </div>
        </div>

        <p style="font-size: 11px; margin-bottom: 15px;">📎 A detailed PDF with appointment information and important requirements is attached.</p>
        
        <p style="margin-bottom: 5px; font-size: 11px;">Kindly,</p>
        <p style="font-weight: bold; margin-bottom: 0; font-size: 12px; color: #1fb6ce;">Kutlwano & Associates</p>
        <p style="color: #6b7280; font-size: 10px; margin-top: 0;">Medico-Legal Assessment Coordination Team</p>
        
        <div style="margin-top: 20px; padding: 12px 20px; background: linear-gradient(135deg, #1fb6ce, #159baf); border-radius: 6px; text-align: center; font-size: 9px; color: #fff;">
          <p style="font-style: italic; margin: 3px 0;">Kutlwano & Associates (Pty) Ltd | Medico-Legal Service</p>
          <p style="font-style: italic; margin: 3px 0;">"We touch a file, We change a life, We are Kutlwano and Associate"</p>
          <p style="margin: 3px 0; opacity: 0.8;">This is an automated email. Please do not reply directly to this message.</p>
        </div>
      </div>
    `;

    // Prepare appointment list for attorney email
    // Single send: only show the clicked appointment's claimant
    // Bulk send: use the provided bulk appointment IDs
    let appointmentsForAttorney: any[] = [appointment];
    if (bulkAppointmentIds && bulkAppointmentIds.length > 0 && !bulkExpertMode) {
      const { data: bulkApts } = await supabase
        .from('appointments')
        .select(`
          *,
          claimants (first_name, last_name),
          medical_experts (first_name, last_name, expert_type, practice_address)
        `)
        .in('id', bulkAppointmentIds)
        .order('appointment_date', { ascending: true });
      if (bulkApts && bulkApts.length > 0) {
        appointmentsForAttorney = bulkApts;
      }
    }

    const appointmentsList: AppointmentInfo[] = appointmentsForAttorney.map((apt: any) => {
      const aptDateTime = new Date(apt.appointment_date);
      return {
        claimant_name: `${apt.claimants.first_name} ${apt.claimants.last_name}`,
        expert_type: apt.medical_experts.expert_type,
        appointment_date: aptDateTime.toLocaleDateString('en-ZA', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          timeZone: 'Africa/Johannesburg'
        }),
        appointment_time: aptDateTime.toLocaleTimeString('en-ZA', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Africa/Johannesburg'
        }),
        location: (apt.id === appointmentId && customLocation) ? customLocation : (apt.medical_experts.practice_address || 'TBD'),
        matter_type: apt.matter_type || 'General Assessment'
      };
    });

    // Generate PDF with all appointments
    const confirmationData: AppointmentConfirmation = {
      attorney_name: appointmentData.attorney_name,
      attorney_contact_person: (appointmentData as any).attorney_contact_person || appointmentData.attorney_name,
      attorney_email: appointmentData.attorney_email,
      expert_email: appointmentData.expert_email,
      appointments: appointmentsList
    };

    const pdfBytes = generateAppointmentPdf(confirmationData);
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
    const pdfFilename = `Appointment_Confirmation_${appointmentData.attorney_name.replace(/[^a-zA-Z0-9]/g, '_')}_${formattedDate.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    // Build appointment list HTML for email
    const appointmentListHtml = appointmentsList
      .map((apt, index) => `
        <tr style="border-bottom: 1px solid #e5e7eb; ${index % 2 === 1 ? 'background-color: #f0fcff;' : ''}">
          <td style="padding: 9px 8px; color: #374151; font-weight: 500; font-size: 10px;">${index + 1}.</td>
          <td style="padding: 9px 8px; color: #374151; font-size: 10px;">${apt.claimant_name}</td>
          <td style="padding: 9px 8px; color: #374151; font-size: 10px;">${apt.expert_type}</td>
          <td style="padding: 9px 8px; color: #374151; font-size: 10px;">${apt.appointment_date} ${apt.appointment_time}</td>
          <td style="padding: 9px 8px; color: #6b7280; font-size: 10px;">${apt.matter_type}</td>
        </tr>
      `)
      .join('');

    // Email template for referring attorney with PDF attachment
    const attorneyEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; font-size: 11px; color: #374151;">
        <div style="background: linear-gradient(135deg, #1fb6ce 0%, #159baf 100%); color: white; padding: 20px; text-align: center; margin-bottom: 20px; border-radius: 8px;">
          <h1 style="margin: 0; font-size: 14px; font-weight: bold; letter-spacing: 0.5px;">KUTLWANO & ASSOCIATES (PTY) LTD</h1>
          <p style="margin: 5px 0; font-size: 10px;">Medico-Legal Service</p>
          <p style="margin: 5px 0; font-size: 10px; font-style: italic;">"We touch a file, We change a life, We are Kutlwano and Associate"</p>
        </div>
        
        <div style="background-color: #1fb6ce; padding: 14px 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: white; margin: 0; font-size: 13px; font-weight: bold;">✅ Appointment Confirmation – Assessment${appointmentsList.length > 1 ? 's' : ''} Scheduled</h2>
        </div>
        
        <div style="background-color: white; padding: 20px;">
          <p style="margin-bottom: 16px; font-size: 11px;">Dear ${(appointmentData as any).attorney_contact_person || appointmentData.attorney_name},</p>
          
          <p style="margin-bottom: 16px; font-size: 11px; line-height: 1.6;">
            ${appointmentsList.length === 1 ? 'An assessment appointment has' : `${appointmentsList.length} assessment appointments have`} been successfully scheduled.
          </p>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb; font-size: 10px;">
            <thead>
              <tr style="background: linear-gradient(135deg, #1fb6ce, #159baf);">
                <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; font-size: 11px;">#</th>
                <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; font-size: 11px;">Claimant</th>
                <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; font-size: 11px;">Expert Type</th>
                <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; font-size: 11px;">Date & Time</th>
                <th style="padding: 10px 8px; text-align: left; color: white; font-weight: 600; font-size: 11px;">Matter Type</th>
              </tr>
            </thead>
            <tbody>
              ${appointmentListHtml}
            </tbody>
          </table>
          
          
          <div style="background-color: #e0f7fa; border-left: 4px solid #1fb6ce; padding: 12px 15px; margin: 16px 0; border-radius: 4px;">
            <p style="color: #0e7490; margin: 0; font-size: 11px; font-weight: bold;">📋 Important Note:</p>
            <p style="color: #0e7490; margin: 5px 0 0 0; font-size: 10px; line-height: 1.5;">
              This appointment was scheduled by Kutlwano & Associate. For any rescheduling requests or queries regarding this appointment, the expert must contact us directly.
            </p>
          </div>
          
          <div style="background-color: #fef3c7; border: 2px solid #f59e0b; padding: 16px; margin: 16px 0; border-radius: 8px;">
            <h3 style="color: #92400e; margin: 0 0 12px 0; font-size: 13px; font-weight: bold;">⚠️ IMPORTANT REQUIREMENTS</h3>
            
            <div style="margin-bottom: 12px;">
              <p style="color: #92400e; margin: 0 0 6px 0; font-weight: bold; font-size: 12px;">📄 Required Documents (Must be provided before assessment):</p>
              <ul style="color: #78350f; margin: 4px 0 0 20px; padding: 0; font-size: 11px; line-height: 1.7;">
                <li>Instruction letter from your office</li>
                <li>Complete medical records and reports</li>
                <li>ID copy of the claimant${appointmentsList.length > 1 ? 's' : ''}</li>
                <li>Any previous assessment reports (if applicable)</li>
                <li>Relevant imaging/diagnostic results</li>
                ${(appointmentData.matter_type || '').toLowerCase().includes('neg') ? `
                <li><strong>Summons (particulars of claim)</strong></li>
                <li><strong>Section 3 notice in terms of Act 40 of 2002</strong></li>
                ` : ''}
              </ul>
            </div>
            
            <div style="margin-bottom: 12px;">
              <p style="color: #92400e; margin: 0 0 6px 0; font-weight: bold; font-size: 12px;">⏰ Appointment Preparation:</p>
              <ul style="color: #78350f; margin: 4px 0 0 20px; padding: 0; font-size: 11px; line-height: 1.7;">
                <li>Claimant${appointmentsList.length > 1 ? 's' : ''} must arrive 15 minutes early</li>
                <li>Bring valid identification</li>
                <li>Confirm appointment 24 hours in advance</li>
                <li>Notify us immediately if unable to attend</li>
              </ul>
            </div>
            
            <div style="margin-bottom: 12px;">
              <p style="color: #92400e; margin: 0 0 6px 0; font-weight: bold; font-size: 12px;">🔄 Cancellation & Rescheduling Policy:</p>
              <ul style="color: #78350f; margin: 4px 0 0 20px; padding: 0; font-size: 11px; line-height: 1.7;">
                <li>Minimum 48 hours notice required for cancellations</li>
                <li>Late cancellations may incur cancellation fees</li>
                <li>Contact Kutlwano & Associate directly for rescheduling</li>
                <li>No-shows will be charged the full assessment fee</li>
              </ul>
            </div>
            
            <div style="margin-bottom: 12px;">
              <p style="color: #92400e; margin: 0 0 6px 0; font-weight: bold; font-size: 12px;">💰 Payment & Fee Information:</p>
              <ul style="color: #78350f; margin: 4px 0 0 20px; padding: 0; font-size: 11px; line-height: 1.7;">
                <li><strong>X-rays are not included in our fee charged.</strong></li>
              </ul>
            </div>
            
            <div>
              <p style="color: #92400e; margin: 0 0 6px 0; font-weight: bold; font-size: 12px;">📞 Contact Information:</p>
              <ul style="color: #78350f; margin: 4px 0 0 20px; padding: 0; font-size: 11px; line-height: 1.7;">
                <li>For queries: Contact Itebogeng for Med Neg &amp; Virginia for MVA</li>
                <li>For document submission: info@kutlwanoassociate.com</li>
                <li>For emergencies: 011 027 6077 / 079 623 8064</li>
              </ul>
            </div>
          </div>
          
          ${accessCode ? `
          <div style="background-color: #ecfdf5; border: 2px solid #10b981; padding: 16px; margin: 16px 0; border-radius: 8px; text-align: center;">
            <h3 style="color: #065f46; margin: 0 0 10px 0; font-size: 13px;">🔑 Your Case Access Code</h3>
            <p style="color: #065f46; margin: 0 0 10px 0; font-size: 11px;">Use this secure code to track your case status online:</p>
            <div style="background-color: #d1fae5; padding: 10px 20px; border-radius: 6px; display: inline-block; margin-bottom: 10px;">
              <span style="font-family: monospace; font-size: 22px; font-weight: bold; color: #065f46; letter-spacing: 3px;">${accessCode}</span>
            </div>
            <p style="color: #065f46; margin: 8px 0 5px 0; font-size: 11px;">Or click the link below to access your case directly:</p>
            <a href="${accessLink}" style="display: inline-block; background-color: #1fb6ce; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 12px;">
              View Case Status
            </a>
            <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 10px; font-style: italic;">
              This access code will remain active until the case is completed and paid in full.
            </p>
          </div>
          ` : ''}
          
          <p style="margin-bottom: 16px; font-size: 11px;">
            📎 A detailed PDF summary of ${appointmentsList.length === 1 ? 'this appointment' : 'all scheduled appointments'} is attached to this email for your records.
          </p>
          
          <p style="margin-bottom: 16px; font-size: 11px;">Should you require changes or support, feel free to contact us.</p>
          
          <p style="margin-bottom: 5px; font-size: 11px;">Kind regards,</p>
          <p style="font-weight: bold; margin-bottom: 0; font-size: 12px; color: #1fb6ce;">Kutlwano & Associates</p>
          <p style="color: #6b7280; font-size: 10px; margin-top: 0;">Medico-Legal Assessment Coordination Team</p>
        </div>
        
        <div style="margin-top: 20px; padding: 12px 20px; background: linear-gradient(135deg, #1fb6ce, #159baf); border-radius: 6px; text-align: center; font-size: 9px; color: #fff;">
          <p style="font-style: italic; margin: 3px 0;">Kutlwano & Associates (Pty) Ltd | Medico-Legal Service</p>
          <p style="font-style: italic; margin: 3px 0;">"We touch a file, We change a life, We are Kutlwano and Associate"</p>
          <p style="margin: 3px 0; opacity: 0.8;">This is an automated email. Please do not reply directly to this message.</p>
        </div>
      </div>
    `;

    const emailPromises = [];

    // Documents already fetched above

    // Combine PDF and document attachments
    const allAttachments = [
      {
        filename: pdfFilename,
        content: pdfBase64
      },
      ...documentAttachments
    ];

    // Parse attorney emails (support comma-separated or array)
    // Helper function to parse emails
    const parseEmails = (emailField: string | string[] | undefined): string[] => {
      if (!emailField) return [];
      if (typeof emailField === 'string') {
        return emailField
          .split(/[,;|]/)
          .map(email => email.trim())
          .filter(email => email && email.includes('@'));
      }
      if (Array.isArray(emailField)) {
        return emailField.filter(email => email && email.includes('@'));
      }
      return [];
    };

    // Use custom email if provided, otherwise fall back to attorney's email
    let attorneyEmails: string[] = [];
    if (customAttorneyEmail) {
      attorneyEmails = [customAttorneyEmail];
    } else if (appointmentData.attorney_email) {
      attorneyEmails = parseEmails(appointmentData.attorney_email);
    }

    // Parse attorney CC emails
    const attorneyCcEmails = attorneyCc ? parseEmails(attorneyCc) : [];

    // Send email to attorney with PDF attachment
    if (attorneyEmails.length > 0) {
      try {
        console.log("Sending email with PDF to attorneys:", attorneyEmails.join(', '));

        // For multiple recipients, send individual emails
        for (const attorneyEmail of attorneyEmails) {
          const emailResult = await sendEmail({
            to: attorneyEmail,
            cc: attorneyCcEmails.length > 0 ? attorneyCcEmails : undefined,
            subject: customAttorneySubject || `New Appointment Confirmation – ${appointmentData.claimant_name}`,
            html: attorneyEmailHtml,
            attachments: allAttachments
          });

          if (!emailResult.success) {
            throw new Error(emailResult.error || 'Failed to send email');
          }
        }

        emailPromises.push(Promise.resolve({ success: true, recipient: 'attorneys', count: attorneyEmails.length }));
        console.log(`Attorney email with PDF sent successfully to ${attorneyEmails.length} recipient(s)`);
      } catch (error: any) {
        console.error("Failed to send attorney email:", error);
        emailPromises.push(Promise.reject({ error: error.message, recipient: 'attorney' }));
      }
    }

    // Parse expert emails (support comma-separated or array)
    // Use custom email if provided, otherwise fall back to expert's email
    let expertEmails: string[] = [];
    if (customExpertEmail) {
      expertEmails = [customExpertEmail];
    } else if (appointmentData.expert_email) {
      expertEmails = parseEmails(appointmentData.expert_email);
    }

    // Parse expert CC emails
    const expertCcEmails = expertCc ? parseEmails(expertCc) : [];

    // Generate expert PDF - bulk or single
    let expertPdfBytes: Uint8Array;
    let expertPdfFilename: string;
    let expertEmailHtmlFinal = expertEmailHtml;

    if (bulkExpertMode && bulkAppointmentIds && bulkAppointmentIds.length > 1) {
      // Fetch all bulk appointments for expert
      const { data: bulkApts } = await supabase
        .from('appointments')
        .select(`
          *,
          claimants (first_name, last_name),
          medical_experts (first_name, last_name, expert_type, practice_address),
          referring_attorneys (name)
        `)
        .in('id', bulkAppointmentIds)
        .order('appointment_date', { ascending: true });

      const patients: BulkExpertPatient[] = (bulkApts || []).map((apt: any) => {
        const dt = new Date(apt.appointment_date);
        return {
          claimant_name: `${apt.claimants.first_name} ${apt.claimants.last_name}`,
          appointment_date: dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
          appointment_time: dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          matter_type: apt.matter_type || 'General Assessment',
          attorney_name: apt.referring_attorneys?.name || '',
          location: apt.medical_experts?.practice_address || 'TBD',
        };
      });

      expertPdfBytes = generateBulkExpertPdf(expertDisplayName, appointmentData.expert_type, patients);
      expertPdfFilename = `Assessment_Request_Bulk_Dr_${expertDisplayName.replace(/[^a-zA-Z0-9]/g, '_')}_${formattedDate.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

      // Update email HTML for bulk
      const patientListHtml = patients.map((p, i) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px; color: #374151;">${i + 1}.</td>
          <td style="padding: 8px; color: #374151;">${p.claimant_name}</td>
          <td style="padding: 8px; color: #374151;">${p.attorney_name}</td>
          <td style="padding: 8px; color: #374151;">${p.appointment_date} ${p.appointment_time}</td>
          <td style="padding: 8px; color: #6b7280;">${p.matter_type}</td>
        </tr>
      `).join('');

      expertEmailHtmlFinal = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1fb6ce 0%, #159baf 100%); color: white; padding: 20px; text-align: center; margin-bottom: 20px; border-radius: 8px;">
            <h1 style="margin: 0; font-size: 24px;">KUTLWANO & ASSOCIATES (PTY) LTD</h1>
            <p style="margin: 5px 0; font-size: 10px;">Medico-Legal Service</p>
            <p style="margin: 5px 0; font-size: 10px; font-style: italic;">"We touch a file, We change a life, We are Kutlwano and Associate"</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #2563eb; margin: 0;">RE: ASSESSMENT ROAD ACCIDENT FUND CLAIMS</h2>
          </div>
          <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <p style="color: #374151; margin-bottom: 15px;">Dear Dr. ${expertDisplayName},</p>
            <p style="color: #374151; margin-bottom: 15px;">
              We are appointed as <strong>Kutlwano and Associate Pty Ltd</strong>. Please find below ${patients.length} patient(s) scheduled for assessment. We request the assessment, Report and RAF4 for each patient listed.
            </p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #e5e7eb;">
              <thead style="background-color: #f9fafb;">
                <tr>
                  <th style="padding: 10px 8px; text-align: left; color: #6b7280; font-weight: 600;">#</th>
                  <th style="padding: 10px 8px; text-align: left; color: #6b7280; font-weight: 600;">Patient</th>
                  <th style="padding: 10px 8px; text-align: left; color: #6b7280; font-weight: 600;">Attorney</th>
                  <th style="padding: 10px 8px; text-align: left; color: #6b7280; font-weight: 600;">Date & Time</th>
                  <th style="padding: 10px 8px; text-align: left; color: #6b7280; font-weight: 600;">Matter</th>
                </tr>
              </thead>
              <tbody>${patientListHtml}</tbody>
            </table>
          </div>
          <div style="background-color: #fef3c7; border: 2px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px;">
            <h3 style="color: #92400e; margin: 0 0 15px 0;">⚠️ IMPORTANT REQUIREMENTS</h3>
            <div style="margin-bottom: 10px;">
              <p style="color: #92400e; margin: 0 0 5px 0; font-weight: bold;">📋 Please Note:</p>
              <ul style="color: #92400e; margin: 5px 0 0 20px; padding: 0; font-size: 14px; line-height: 1.6;">
              <li>Kindly confirm your availability for this assessment in writing.</li>
                <li>Should you need to reschedule, notify our office immediately.</li>
                <li>All expert rescheduling arrangements must be processed strictly through Kutlwano and Associates (Pty) Ltd.</li>
                <li>Please review all case documentation provided prior to the assessment.</li>
                <li>All digital and physical records must be securely stored in compliance with applicable professional and POPIA requirements.</li>
                <li>Communication, queries must be directed to Kutlwano and Associate.</li>
                <li>The expert's office is prohibited from contacting or soliciting our referring attorneys.</li>
              </ul>
              <p style="color: #92400e; margin: 10px 0 0 0; font-style: italic; font-size: 13px;">We value professional integrity, independence, and structured coordination to ensure smooth case management for all parties involved.</p>
            </div>
          </div>
          <p style="color: #374151; margin-bottom: 15px;">📎 A detailed PDF with all patient information is attached.</p>
          <p style="color: #374151; margin-bottom: 5px;">Kindly,</p>
          <p style="color: #374151; font-weight: bold;">Kutlwano & Associates</p>
          <p style="color: #6b7280; font-size: 14px;">Medico-Legal Assessment Coordination Team</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #1fb6ce; text-align: center; font-size: 10px; color: #666;">
            <p style="font-style: italic;">This is an automated email. Please do not reply directly to this message.</p>
          </div>
        </div>
      `;

      console.log(`Generated bulk expert PDF with ${patients.length} patients`);
    } else {
      // Single expert PDF (original logic)
      const expertPdfData: ExpertPdfData = {
        expert_name: expertDisplayName,
        expert_type: appointmentData.expert_type,
        attorney_name: appointmentData.attorney_name,
        claimant_name: appointmentData.claimant_name,
        appointment_date: formattedDate,
        appointment_time: formattedTime,
        matter_type: appointmentData.matter_type || 'General Assessment',
        location: appointmentData.location || '',
        has_attachments: documentAttachments.length > 0,
        customBody: customExpertBody || undefined,
      };
      expertPdfBytes = generateExpertPdf(expertPdfData);
      expertPdfFilename = `Assessment_Request_${appointmentData.claimant_name.replace(/[^a-zA-Z0-9]/g, '_')}_${formattedDate.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    }

    const expertPdfBase64 = btoa(String.fromCharCode(...expertPdfBytes));
    const expertAttachments = [
      { filename: expertPdfFilename, content: expertPdfBase64 },
      ...documentAttachments
    ];

    // Send email to expert with PDF and documents
    if (expertEmails.length > 0) {
      try {
        console.log("Sending email to experts:", expertEmails.join(', '));

        for (const expertEmail of expertEmails) {
          const emailResult = await sendEmail({
            to: expertEmail,
            cc: expertCcEmails.length > 0 ? expertCcEmails : undefined,
            subject: customExpertSubject || (bulkExpertMode && bulkAppointmentIds && bulkAppointmentIds.length > 1 
              ? `Assessment Confirmation - ${bulkAppointmentIds.length} Patients Scheduled`
              : `New Appointment Confirmation - ${appointmentData.claimant_name}`),
            html: expertEmailHtmlFinal,
            attachments: expertAttachments
          });

          if (!emailResult.success) {
            throw new Error(emailResult.error || 'Failed to send email');
          }
        }

        emailPromises.push(Promise.resolve({ success: true, recipient: 'experts', count: expertEmails.length }));
        console.log(`Expert email with PDF sent successfully to ${expertEmails.length} recipient(s)`);
      } catch (error: any) {
        console.error("Failed to send expert email:", error);
        emailPromises.push(Promise.reject({ error: error.message, recipient: 'expert' }));
      }
    }

    if (emailPromises.length === 0) {
      console.log("No email addresses provided, skipping email notifications");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No email addresses provided",
          emailsSent: 0 
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Send all emails
    const results = await Promise.allSettled(emailPromises);
    
    let successCount = 0;
    let errors: any[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
        console.log(`Email ${index + 1} sent successfully:`, result.value);
      } else {
        errors.push(result.reason);
        console.error(`Email ${index + 1} failed:`, result.reason);
      }
    });

    console.log(`Email sending complete. Success: ${successCount}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent: successCount,
        totalAttempted: emailPromises.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-appointment-confirmation function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);