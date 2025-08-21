import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AppointmentEmailRequest {
  appointmentData: {
    id: string;
    claimant_name: string;
    expert_name: string;
    expert_email?: string;
    attorney_name: string;
    attorney_email?: string;
    appointment_date: string;
    appointment_time: string;
    matter_type: string;
    service_fee: number;
    location?: string;
    notes?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Appointment confirmation email function called");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appointmentData }: AppointmentEmailRequest = await req.json();
    console.log("Processing appointment confirmation for:", appointmentData.id);

    // Format the appointment date and time
    const appointmentDateTime = new Date(appointmentData.appointment_date);
    const formattedDate = appointmentDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    });
    const formattedTime = appointmentData.appointment_time || appointmentDateTime.toLocaleTimeString('en-US', {
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
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Service Fee:</td>
              <td style="padding: 8px 0; color: #374151;">$${appointmentData.service_fee}</td>
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

        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
          <p style="color: #4b5563; margin: 0; font-size: 14px;">
            Please confirm your availability for this appointment. If you have any questions or need to reschedule, 
            please contact the referring attorney directly.
          </p>
        </div>
      </div>
    `;

    // Email template for referring attorney
    const attorneyEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #2563eb; margin: 0 0 10px 0;">Appointment Confirmation</h1>
          <p style="color: #6b7280; margin: 0;">Your medical assessment appointment has been successfully scheduled.</p>
        </div>
        
        <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #374151; margin-top: 0;">Appointment Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Patient:</td>
              <td style="padding: 8px 0; color: #374151;">${appointmentData.claimant_name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Medical Expert:</td>
              <td style="padding: 8px 0; color: #374151;">Dr. ${appointmentData.expert_name}</td>
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
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Service Fee:</td>
              <td style="padding: 8px 0; color: #374151;">$${appointmentData.service_fee}</td>
            </tr>
            ${appointmentData.location ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Location:</td>
              <td style="padding: 8px 0; color: #374151;">${appointmentData.location}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <div style="background-color: #dcfce7; border: 1px solid #22c55e; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
          <h3 style="color: #166534; margin-top: 0;">Next Steps:</h3>
          <ul style="color: #166534; margin-bottom: 0; padding-left: 20px;">
            <li>The medical expert will be notified of this appointment</li>
            <li>You will receive appointment confirmations from the expert's office</li>
            <li>Please ensure your client is aware of the scheduled appointment</li>
          </ul>
        </div>

        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
          <p style="color: #4b5563; margin: 0; font-size: 14px;">
            This is an automated confirmation. If you need to make any changes to this appointment, 
            please log into the system or contact our office directly.
          </p>
        </div>
      </div>
    `;

    const emailPromises = [];

    // Send email to expert if email provided
    if (appointmentData.expert_email) {
      console.log("Sending email to expert:", appointmentData.expert_email);
      emailPromises.push(
        sendEmailViaSendGrid({
          to: appointmentData.expert_email,
          subject: `New Medical Assessment - ${appointmentData.claimant_name} on ${formattedDate}`,
          html: expertEmailHtml,
        })
      );
    }

    // Send email to attorney if email provided
    if (appointmentData.attorney_email) {
      console.log("Sending email to attorney:", appointmentData.attorney_email);
      emailPromises.push(
        sendEmailViaSendGrid({
          to: appointmentData.attorney_email,
          subject: `Appointment Confirmed - ${appointmentData.claimant_name} with Dr. ${appointmentData.expert_name}`,
          html: attorneyEmailHtml,
        })
      );
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
    let errors = [];

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

async function sendEmailViaSendGrid(emailData: { to: string; subject: string; html: string }) {
  const response = await fetch(SENDGRID_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: emailData.to }],
        },
      ],
      from: {
        email: "appointments@yourdomain.com",
        name: "Medical Assessment System",
      },
      subject: emailData.subject,
      content: [
        {
          type: "text/html",
          value: emailData.html,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SendGrid API error: ${response.status} ${error}`);
  }

  return { id: response.headers.get("x-message-id") };
}

serve(handler);