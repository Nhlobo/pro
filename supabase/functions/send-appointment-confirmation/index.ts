import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
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
  
  // Header
  doc.setFillColor(37, 99, 235); // Blue header
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont(undefined, 'bold');
  doc.text('Appointment Confirmation', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  doc.text('Assessment Summary', 105, 30, { align: 'center' });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Referring Attorney Info
  let yPos = 55;
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
  
  // Footer section with important notes
  yPos += 10;
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  // Important notes box
  doc.setFillColor(220, 252, 231); // Light green
  doc.setDrawColor(34, 197, 94); // Green border
  doc.rect(15, yPos, 180, 30, 'FD');
  
  yPos += 8;
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.text('Important Requirements:', 20, yPos);
  
  yPos += 7;
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text('• Please send the instruction letter, medical records, and ID copy of the claimant', 20, yPos);
  yPos += 5;
  doc.text('• Confirm claimants are informed of their appointment details', 20, yPos);
  
  // Footer
  yPos = 280;
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('Kutlwano & Associates', 105, yPos, { align: 'center' });
  doc.text('Medico-Legal Assessment Coordination Team', 105, yPos + 4, { align: 'center' });
  
  // Generate PDF as Uint8Array
  const pdfOutput = doc.output('arraybuffer');
  return new Uint8Array(pdfOutput);
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
      attachmentDocumentIds
    }: AppointmentEmailRequest = await req.json();
    console.log("Processing appointment confirmation for:", appointmentId);

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
      case_status: appointment.case_status,
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

    // Email template for medical expert
    const expertEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #2563eb; margin: 0 0 10px 0;">New Medical Assessment Appointment</h1>
          <p style="color: #6b7280; margin: 0;">You have been scheduled for a new medical assessment.</p>
        </div>
        
        <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #374151; margin-top: 0;">Appointment Details</h2>
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
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Consultation Fee:</td>
              <td style="padding: 8px 0; color: #374151;">R${appointmentData.consultation_fees}</td>
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

        ${appointmentData.notes ? `
        <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
          <h3 style="color: #92400e; margin-top: 0;">Special Instructions:</h3>
          <p style="color: #92400e; margin-bottom: 0;">${appointmentData.notes}</p>
        </div>
        ` : ''}

        <div style="background-color: #dbeafe; border: 1px solid #3b82f6; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <p style="color: #1e40af; margin: 0; font-size: 14px; font-weight: bold;">
            📋 Important: This appointment was scheduled by Kutlwano & Associate. For any rescheduling requests or queries, please contact us directly.
          </p>
        </div>

        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
          <p style="color: #4b5563; margin: 0; font-size: 14px;">
            Please confirm your availability for this appointment.
          </p>
        </div>
      </div>
    `;

    // Prepare appointment list for attorney email
    const appointmentsList: AppointmentInfo[] = (allAppointments || [appointment]).map(apt => {
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
        location: apt.medical_experts.practice_address || 'TBD',
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
          
          <div style="background-color: #dcfce7; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0;">
            <p style="color: #166534; margin: 0; font-size: 14px;">
              <strong>Required Documents:</strong><br>
              • Instruction letter<br>
              • Medical records<br>
              • ID copy of the claimant${appointmentsList.length > 1 ? 's' : ''}
            </p>
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
      </div>
    `;

    const emailPromises = [];

    // Fetch claimant documents if IDs provided
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

          // Download file from storage
          const { data: fileData, error: fileError } = await supabase
            .storage
            .from('documents')
            .download(docData.file_path);
          
          if (fileError || !fileData) {
            console.error(`Error downloading file ${docData.file_path}:`, fileError);
            continue;
          }

          // Convert to base64
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
            subject: `Appointment Confirmation – Assessment${appointmentsList.length > 1 ? 's' : ''} Scheduled`,
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

    // Send simpler email to expert
    if (expertEmails.length > 0) {
      try {
        console.log("Sending email to experts:", expertEmails.join(', '));

        // Send to each expert individually
        for (const expertEmail of expertEmails) {
          const emailResult = await sendEmail({
            to: expertEmail,
            cc: expertCcEmails.length > 0 ? expertCcEmails : undefined,
            subject: `New Medical Assessment - ${appointmentData.claimant_name} on ${formattedDate}`,
            html: expertEmailHtml,
          });

          if (!emailResult.success) {
            throw new Error(emailResult.error || 'Failed to send email');
          }
        }

        emailPromises.push(Promise.resolve({ success: true, recipient: 'experts', count: expertEmails.length }));
        console.log(`Expert email sent successfully to ${expertEmails.length} recipient(s)`);
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