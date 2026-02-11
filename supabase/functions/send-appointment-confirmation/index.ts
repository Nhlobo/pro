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
  attorney_email: string;
  expert_email?: string;
  appointments: AppointmentInfo[];
}

function generateAppointmentPdf(confirmation: AppointmentConfirmation): Uint8Array {
  const doc = new jsPDF();
  
  // Header with company branding
  doc.setFillColor(31, 182, 206); // Company teal color
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
  
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('Appointment Confirmation', 105, 40, { align: 'center' });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Referring Attorney Info
  let yPos = 60;
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('Referring Attorney:', 20, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(confirmation.attorney_name, 20, yPos + 7);
  
  yPos += 20;
  
  // Appointments Header
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(`Scheduled Assessment${confirmation.appointments.length > 1 ? 's' : ''}`, 20, yPos);
  
  yPos += 10;
  
  // Table header background
  doc.setFillColor(249, 250, 251);
  doc.rect(15, yPos - 5, 180, 10, 'F');
  
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text('#', 18, yPos);
  doc.text('Claimant Name', 28, yPos);
  doc.text('Discipline/Expert', 85, yPos);
  doc.text('Date & Time', 135, yPos);
  
  yPos += 8;
  
  // Draw line under header
  doc.setDrawColor(229, 231, 235);
  doc.line(15, yPos, 195, yPos);
  
  yPos += 5;
  
  // Appointments
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  
  confirmation.appointments.forEach((apt, index) => {
    // Check if we need a new page
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    
    // Alternating row background
    if (index % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(15, yPos - 4, 180, 12, 'F');
    }
    
    doc.setTextColor(0, 0, 0);
    doc.text(`${index + 1}.`, 18, yPos);
    doc.text(apt.claimant_name, 28, yPos);
    doc.text(apt.expert_type, 85, yPos);
    doc.text(`${apt.appointment_date} ${apt.appointment_time}`, 135, yPos);
    
    yPos += 5;
    
    // Location and Matter Type
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.text(`Location: ${apt.location}`, 28, yPos);
    yPos += 4;
    doc.text(`Matter Type: ${apt.matter_type}`, 28, yPos);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    
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
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(146, 64, 14);
  doc.text('IMPORTANT REQUIREMENTS', 105, yPos + 2, { align: 'center' });
  yPos += 15;

  // Section renderer
  const renderSection = (icon: string, title: string, items: string[]) => {
    checkPageBreak(10 + items.length * 6);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(146, 64, 14);
    doc.text(`${icon} ${title}`, 20, yPos);
    yPos += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 53, 15);
    items.forEach(item => {
      checkPageBreak(6);
      doc.text(`•  ${item}`, 25, yPos);
      yPos += 5;
    });
    yPos += 4;
  };

  renderSection('Required Documents (Must be provided before assessment):', '', [
    'Instruction letter from your office',
    'Complete medical records and reports',
    'ID copy of the claimants',
    'Any previous assessment reports (if applicable)',
    'Relevant imaging/diagnostic results',
  ]);

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
    'Payment terms as per agreement',
    'Invoice will be provided upon completion',
    'Outstanding fees must be settled before report release',
    'X-rays are NOT included in our fee charged – they are charged separately by a radiologist of your choice or our third-party partner (In-house)',
  ]);

  renderSection('Contact Information:', '', [
    'For queries: Contact Itebogeng for Med Neg & Virginia for MVA',
    'For document submission: info@kutlwanoassociate.com',
    'For emergencies: 011 027 6077 / 079 623 8064',
    'Expert rescheduling: Must go through our office',
  ]);

  // Footer with company info and disclaimer
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
  doc.text('RE: ASSESSMENT ROAD ACCIDENT FUND CLAIMS', 105, 40, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  let yPos = 55;

  // Body text - use custom body if provided
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');

  if (data.customBody) {
    // Render custom body paragraphs
    const paragraphs = data.customBody.split('\n').filter(p => p.trim());
    paragraphs.forEach(paragraph => {
      const lines = doc.splitTextToSize(paragraph.trim(), 170);
      doc.text(lines, 20, yPos);
      yPos += lines.length * 6 + 5;
    });
  } else {
    const bodyText = `We are appointed as Kutlwano and Associate Pty Ltd to request assessment on behalf of ${data.attorney_name}. We request the assessment, Report and RAF4 from Dr. ${data.expert_name} to assess the referred patient for a road accident claim.`;
    const bodyLines = doc.splitTextToSize(bodyText, 170);
    doc.text(bodyLines, 20, yPos);
    yPos += bodyLines.length * 6 + 5;

    const attachText = `We have attached the following information: ID copy, Summons, Medical records, Instruction letter${data.has_attachments ? ', and additional supporting documents' : ''}. Please allow us to upload additional supporting documents if any.`;
    const attachLines = doc.splitTextToSize(attachText, 170);
    doc.text(attachLines, 20, yPos);
    yPos += attachLines.length * 6 + 5;
  }

  yPos += 5;

  // Appointment Details table
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('Appointment Details', 20, yPos);
  yPos += 8;

  doc.setFillColor(249, 250, 251);
  doc.rect(15, yPos - 5, 180, 10, 'F');
  doc.setFontSize(10);
  doc.text('Field', 20, yPos);
  doc.text('Details', 90, yPos);
  yPos += 8;
  doc.setDrawColor(229, 231, 235);
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
  details.forEach(([label, value]) => {
    doc.setFont(undefined, 'bold');
    doc.text(label + ':', 20, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(value || 'N/A', 90, yPos);
    yPos += 7;
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
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(146, 64, 14);
  doc.text('IMPORTANT REQUIREMENTS', 105, yPos + 2, { align: 'center' });
  yPos += 15;

  const renderSection = (title: string, items: string[]) => {
    checkPageBreak(10 + items.length * 6);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(146, 64, 14);
    doc.text(title, 20, yPos);
    yPos += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 53, 15);
    items.forEach(item => {
      checkPageBreak(6);
      doc.text(`•  ${item}`, 25, yPos);
      yPos += 5;
    });
    yPos += 4;
  };

  renderSection('Please Note:', [
    'Confirm your availability for this appointment',
    'Notify us immediately if you need to reschedule',
    'Review any case materials provided in advance',
    'Expert rescheduling must go through our office',
    'X-rays are NOT included in our fee charged – they are charged separately by a radiologist of your choice or our third-party partner (In-house)',
  ]);

  renderSection('Contact Information:', [
    'For queries: Contact Itebogeng for Med Neg & Virginia for MVA',
    'For document submission: info@kutlwanoassociate.com',
    'For emergencies: 011 027 6077 / 079 623 8064',
    'Rescheduling: Must go through our office',
  ]);

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
  doc.text('RE: ASSESSMENT ROAD ACCIDENT FUND CLAIMS', 105, 40, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  let yPos = 55;

  const drTitle = `Dr. ${expertName || expertType}`;
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  const bodyText = `Dear ${drTitle},\n\nWe are appointed as Kutlwano and Associate Pty Ltd. Please find below the list of ${patients.length} patient(s) scheduled for assessment. We request the assessment, Report and RAF4 for each patient listed below.`;
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

  const renderSection = (title: string, items: string[]) => {
    checkPageBreak(10 + items.length * 6);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(146, 64, 14);
    doc.text(title, 20, yPos);
    yPos += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 53, 15);
    items.forEach(item => { checkPageBreak(6); doc.text(`•  ${item}`, 25, yPos); yPos += 5; });
    yPos += 4;
  };

  renderSection('Please Note:', [
    'Confirm your availability for each scheduled patient',
    'Notify us immediately if you need to reschedule any assessment',
    'Review any case materials provided in advance',
    'Expert rescheduling must go through our office',
    'X-rays are NOT included in our fee charged – they are charged separately by a radiologist of your choice or our third-party partner (In-house)',
  ]);

  renderSection('Contact Information:', [
    'For queries: Contact Itebogeng for Med Neg & Virginia for MVA',
    'For document submission: info@kutlwanoassociate.com',
    'For emergencies: 011 027 6077 / 079 623 8064',
    'Rescheduling: Must go through our office',
  ]);

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
          email
        )
      `)
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error("Error fetching appointment:", appointmentError);
      throw new Error("Appointment not found");
    }

    console.log("Appointment data fetched:", appointment);

    // Fetch all appointments for this attorney (to show multiple bookings if any)
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
      .eq('case_status', 'scheduled')
      .gte('appointment_date', new Date().toISOString())
      .is('deleted_at', null)
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
    const formattedDate = appointmentDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    });
    const formattedTime = appointmentDateTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
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

    const expertDisplayName = (appointmentData.expert_name && appointmentData.expert_name.trim()) 
      ? appointmentData.expert_name 
      : appointmentData.expert_type;
    const expertDrTitle = `Dr. ${appointmentData.expert_name && appointmentData.expert_name.trim() ? appointmentData.expert_name : appointmentData.expert_type}`;

    // Email template for medical expert
    const expertEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1fb6ce 0%, #159baf 100%); color: white; padding: 20px; text-align: center; margin-bottom: 20px; border-radius: 8px;">
          <h1 style="margin: 0; font-size: 24px;">KUTLWANO & ASSOCIATES (PTY) LTD</h1>
          <p style="margin: 5px 0; font-size: 10px;">Medico-Legal Service</p>
          <p style="margin: 5px 0; font-size: 10px; font-style: italic;">"We touch a file, We change a life, We are Kutlwano and Associate"</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #2563eb; margin: 0 0 10px 0;">RE: ASSESSMENT ROAD ACCIDENT FUND CLAIMS</h2>
        </div>
        
        <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p style="color: #374151; margin-bottom: 15px;">Dear ${expertDrTitle},</p>
          
          <p style="color: #374151; margin-bottom: 15px;">
            ${customExpertBody ? customExpertBody.replace(/\n/g, '<br/>') : `We are appointed as <strong>Kutlwano and Associate Pty Ltd</strong> to request assessment on behalf of <strong>${appointmentData.attorney_name}</strong>. We request the assessment, Report and RAF4 from <strong>${expertDrTitle}</strong> to assess the referred patient for a road accident claim.`}
          </p>
          
          ${!customExpertBody ? `<p style="color: #374151; margin-bottom: 15px;">
            We have attached the following information: ID copy, Summons, Medical records, Instruction letter${documentAttachments.length > 0 ? ', and additional supporting documents' : ''}. Please allow us to upload additional supporting documents if any.
          </p>` : ''}

          <h3 style="color: #374151; margin-top: 20px;">Appointment Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Patient:</td>
              <td style="padding: 8px 0; color: #374151;">${appointmentData.claimant_name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Date:</td>
              <td style="padding: 8px 0; color: #374151;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Time:</td>
              <td style="padding: 8px 0; color: #374151;">${formattedTime}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Assessment Type:</td>
              <td style="padding: 8px 0; color: #374151;">${appointmentData.matter_type}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Referring Attorney:</td>
              <td style="padding: 8px 0; color: #374151;">${appointmentData.attorney_name}</td>
            </tr>
            ${appointmentData.location ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Location:</td>
              <td style="padding: 8px 0; color: #374151;">${appointmentData.location}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <div style="background-color: #dbeafe; border: 1px solid #3b82f6; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <p style="color: #1e40af; margin: 0; font-size: 14px; font-weight: bold;">
            📋 Important: This appointment was scheduled by Kutlwano & Associate. For any rescheduling requests or queries, please contact us directly.
          </p>
        </div>

        <div style="background-color: #fef3c7; border: 2px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 16px;">⚠️ IMPORTANT REQUIREMENTS</h3>
          <div style="margin-bottom: 10px;">
            <p style="color: #92400e; margin: 0 0 5px 0; font-weight: bold;">📋 Please Note:</p>
            <ul style="color: #92400e; margin: 5px 0 0 20px; padding: 0; font-size: 14px; line-height: 1.6;">
              <li>Confirm your availability for this appointment</li>
              <li>Notify us immediately if you need to reschedule</li>
              <li>Review any case materials provided in advance</li>
              <li>Expert rescheduling must go through our office</li>
              <li><strong>X-rays are NOT included in our fee charged</strong> – they are charged separately by a radiologist of your choice or our third-party partner (In-house)</li>
            </ul>
          </div>
        </div>

        <p style="color: #374151; margin-bottom: 15px;">📎 A detailed PDF with appointment information and important requirements is attached.</p>
        
        <p style="color: #374151; margin-bottom: 5px;">Kindly,</p>
        <p style="color: #374151; font-weight: bold; margin-bottom: 0;">Kutlwano & Associates</p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 0;">Medico-Legal Assessment Coordination Team</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #1fb6ce; text-align: center; font-size: 10px; color: #666;">
          <p style="font-style: italic; margin: 5px 0;">This is an automated email. Please do not reply directly to this message.</p>
        </div>
      </div>
    `;

    // Prepare appointment list for attorney email
    // If bulkAppointmentIds provided, fetch those specific appointments
    let appointmentsForAttorney = allAppointments || [appointment];
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
        appointment_date: aptDateTime.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        appointment_time: aptDateTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        location: (apt.id === appointmentId && customLocation) ? customLocation : (apt.medical_experts.practice_address || 'TBD'),
        matter_type: apt.matter_type || 'General Assessment'
      };
    });

    // Generate PDF with all appointments
    const confirmationData: AppointmentConfirmation = {
      attorney_name: appointmentData.attorney_name,
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
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 8px; color: #374151; font-weight: 500;">${index + 1}.</td>
          <td style="padding: 12px 8px; color: #374151;">${apt.claimant_name}</td>
          <td style="padding: 12px 8px; color: #374151;">${apt.expert_type}</td>
          <td style="padding: 12px 8px; color: #374151;">${apt.appointment_date} ${apt.appointment_time}</td>
          <td style="padding: 12px 8px; color: #6b7280; font-size: 14px;">${apt.matter_type}</td>
        </tr>
      `)
      .join('');

    // Email template for referring attorney with PDF attachment
    const attorneyEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1fb6ce 0%, #159baf 100%); color: white; padding: 20px; text-align: center; margin-bottom: 20px; border-radius: 8px;">
          <h1 style="margin: 0; font-size: 24px;">KUTLWANO & ASSOCIATES (PTY) LTD</h1>
          <p style="margin: 5px 0; font-size: 10px;">Medico-Legal Service</p>
          <p style="margin: 5px 0; font-size: 10px; font-style: italic;">"We touch a file, We change a life, We are Kutlwano and Associate"</p>
        </div>
        
        <div style="background-color: #2563eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: white; margin: 0 0 10px 0;">✅ Appointment Confirmation – Assessment${appointmentsList.length > 1 ? 's' : ''} Scheduled</h1>
        </div>
        
        <div style="background-color: white; padding: 20px;">
          <p style="color: #374151; margin-bottom: 20px;">Dear ${appointmentData.attorney_name},</p>
          
          <p style="color: #374151; margin-bottom: 20px;">
            ${appointmentsList.length === 1 ? 'An assessment appointment has' : `${appointmentsList.length} assessment appointments have`} been successfully scheduled.
          </p>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
            <thead style="background-color: #f9fafb;">
              <tr>
                <th style="padding: 12px 8px; text-align: left; color: #6b7280; font-weight: 600;">#</th>
                <th style="padding: 12px 8px; text-align: left; color: #6b7280; font-weight: 600;">Claimant</th>
                <th style="padding: 12px 8px; text-align: left; color: #6b7280; font-weight: 600;">Expert Type</th>
                <th style="padding: 12px 8px; text-align: left; color: #6b7280; font-weight: 600;">Date & Time</th>
                <th style="padding: 12px 8px; text-align: left; color: #6b7280; font-weight: 600;">Matter Type</th>
              </tr>
            </thead>
            <tbody>
              ${appointmentListHtml}
            </tbody>
          </table>
          
          
          <div style="background-color: #dbeafe; border: 1px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 8px;">
            <p style="color: #1e40af; margin: 0; font-size: 14px; font-weight: bold;">
              📋 Important Note:
            </p>
            <p style="color: #1e40af; margin: 5px 0 0 0; font-size: 14px;">
              This appointment was scheduled by Kutlwano & Associate. For any rescheduling requests or queries regarding this appointment, the expert must contact us directly.
            </p>
          </div>
          
          <div style="background-color: #fef3c7; border: 2px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 8px;">
            <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 16px;">
              ⚠️ IMPORTANT REQUIREMENTS
            </h3>
            
            <div style="margin-bottom: 15px;">
              <p style="color: #92400e; margin: 0 0 8px 0; font-weight: bold; font-size: 14px;">
                📄 Required Documents (Must be provided before assessment):
              </p>
              <ul style="color: #92400e; margin: 5px 0 0 20px; padding: 0; font-size: 14px; line-height: 1.6;">
                <li>Instruction letter from your office</li>
                <li>Complete medical records and reports</li>
                <li>ID copy of the claimant${appointmentsList.length > 1 ? 's' : ''}</li>
                <li>Any previous assessment reports (if applicable)</li>
                <li>Relevant imaging/diagnostic results</li>
              </ul>
            </div>
            
            <div style="margin-bottom: 15px;">
              <p style="color: #92400e; margin: 0 0 8px 0; font-weight: bold; font-size: 14px;">
                ⏰ Appointment Preparation:
              </p>
              <ul style="color: #92400e; margin: 5px 0 0 20px; padding: 0; font-size: 14px; line-height: 1.6;">
                <li>Claimant${appointmentsList.length > 1 ? 's' : ''} must arrive 15 minutes early</li>
                <li>Bring valid identification</li>
                <li>Confirm appointment 24 hours in advance</li>
                <li>Notify us immediately if unable to attend</li>
              </ul>
            </div>
            
            <div style="margin-bottom: 15px;">
              <p style="color: #92400e; margin: 0 0 8px 0; font-weight: bold; font-size: 14px;">
                🔄 Cancellation & Rescheduling Policy:
              </p>
              <ul style="color: #92400e; margin: 5px 0 0 20px; padding: 0; font-size: 14px; line-height: 1.6;">
                <li>Minimum 48 hours notice required for cancellations</li>
                <li>Late cancellations may incur cancellation fees</li>
                <li>Contact Kutlwano & Associate directly for rescheduling</li>
                <li>No-shows will be charged the full assessment fee</li>
              </ul>
            </div>
            
            <div style="margin-bottom: 15px;">
              <p style="color: #92400e; margin: 0 0 8px 0; font-weight: bold; font-size: 14px;">
                💰 Payment & Fee Information:
              </p>
              <ul style="color: #92400e; margin: 5px 0 0 20px; padding: 0; font-size: 14px; line-height: 1.6;">
                <li>Payment terms as per agreement</li>
                <li>Invoice will be provided upon completion</li>
                <li>Outstanding fees must be settled before report release</li>
                <li><strong>X-rays are NOT included in our fee charged</strong> – they are charged separately by a radiologist of your choice or our third-party partner (In-house)</li>
              </ul>
            </div>
            
            <div>
              <p style="color: #92400e; margin: 0 0 8px 0; font-weight: bold; font-size: 14px;">
                📞 Contact Information:
              </p>
              <ul style="color: #92400e; margin: 5px 0 0 20px; padding: 0; font-size: 14px; line-height: 1.6;">
                <li>For queries: Contact Itebogeng for Med Neg &amp; Virginia for MVA</li>
                <li>For document submission: info@kutlwanoassociate.com</li>
                <li>For emergencies: 011 027 6077 / 079 623 8064</li>
                <li>Expert rescheduling: Must go through our office</li>
              </ul>
            </div>
          </div>
          
          <p style="color: #374151; margin-bottom: 20px;">
            📎 A detailed PDF summary of ${appointmentsList.length === 1 ? 'this appointment' : 'all scheduled appointments'} is attached to this email for your records.
          </p>
          
          <p style="color: #374151; margin-bottom: 20px;">
            Should you require changes or support, feel free to contact us.
          </p>
          
          <p style="color: #374151; margin-bottom: 5px;">Kind regards,</p>
          <p style="color: #374151; font-weight: bold; margin-bottom: 0;">Kutlwano & Associates</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 0;">Medico-Legal Assessment Coordination Team</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #1fb6ce; text-align: center; font-size: 10px; color: #666;">
          <p style="font-style: italic; margin: 5px 0;">This is an automated email. Please do not reply directly to this message.</p>
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
            <ul style="color: #92400e; margin: 5px 0 0 20px; padding: 0; font-size: 14px; line-height: 1.6;">
              <li>Confirm your availability for all scheduled patients</li>
              <li>Notify us immediately if you need to reschedule</li>
              <li>Review any case materials provided in advance</li>
              <li>Expert rescheduling must go through our office</li>
              <li><strong>X-rays are NOT included in our fee charged</strong> – they are charged separately by a radiologist of your choice or our third-party partner (In-house)</li>
            </ul>
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