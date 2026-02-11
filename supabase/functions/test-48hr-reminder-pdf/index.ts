import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AppointmentReminder {
  attorney_id: string;
  attorney_name: string;
  attorney_email: string;
  attorney_phone: string;
  appointments: Array<{
    claimant_name: string;
    expert_type: string;
    appointment_date: string;
    appointment_time: string;
  }>;
}

function generatePdfSummary(reminder: AppointmentReminder): Uint8Array {
  const doc = new jsPDF();
  
  // Header
  doc.setFillColor(37, 99, 235); // Blue header
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont(undefined, 'bold');
  doc.text('Assessment Summary', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  doc.text('48 Hour Reminder', 105, 30, { align: 'center' });
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  // Referring Attorney Info
  let yPos = 55;
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('Referring Attorney:', 20, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(reminder.attorney_name, 20, yPos + 7);
  
  yPos += 20;
  
  // Appointments Header
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('Scheduled Assessments', 20, yPos);
  
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
  
  reminder.appointments.forEach((apt, index) => {
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
    
    yPos += 8;
  });
  
  // Footer section with important notes
  yPos += 10;
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  // Important notes box
  doc.setFillColor(254, 243, 199); // Light yellow
  doc.setDrawColor(251, 191, 36); // Yellow border
  doc.rect(15, yPos, 180, 35, 'FD');
  
  yPos += 8;
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.text('Important Reminders:', 20, yPos);
  
  yPos += 7;
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text('• Ensure all required documents have been submitted', 20, yPos);
  yPos += 5;
  doc.text('• Confirm claimants are informed of appointment details', 20, yPos);
  yPos += 5;
  doc.text('• Communicate any special requirements to our team', 20, yPos);
  
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
  console.log("Test 48hr reminder PDF generation called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create sample data for testing
    const sampleReminder: AppointmentReminder = {
      attorney_id: "test-123",
      attorney_name: "Smith & Associates Law Firm",
      attorney_email: "test@example.com",
      attorney_phone: "+27123456789",
      appointments: [
        {
          claimant_name: "John Doe",
          expert_type: "Orthopedic Surgeon",
          appointment_date: "Jan 15, 2025",
          appointment_time: "09:00 AM"
        },
        {
          claimant_name: "Jane Smith",
          expert_type: "Neurologist",
          appointment_date: "Jan 15, 2025",
          appointment_time: "11:30 AM"
        },
        {
          claimant_name: "Robert Johnson",
          expert_type: "Clinical Psychologist",
          appointment_date: "Jan 15, 2025",
          appointment_time: "02:00 PM"
        },
        {
          claimant_name: "Sarah Williams",
          expert_type: "Occupational Therapist",
          appointment_date: "Jan 15, 2025",
          appointment_time: "03:30 PM"
        }
      ]
    };

    // Generate the PDF
    const pdfBytes = generatePdfSummary(sampleReminder);
    
    console.log("Sample PDF generated successfully");

    // Return the PDF directly for preview
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=Test_48Hr_Reminder_Summary.pdf"
      },
    });
  } catch (error: any) {
    console.error("Error generating test PDF:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
