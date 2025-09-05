import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AssessmentChangeNotification {
  appointmentId: string;
  claimantName: string;
  expertName: string;
  oldStatus: string;
  newStatus: string;
  appointmentDate: string;
  attorneyName: string;
  attorneyEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Assessment change notification function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      appointmentId,
      claimantName,
      expertName,
      oldStatus,
      newStatus,
      appointmentDate,
      attorneyName,
      attorneyEmail
    }: AssessmentChangeNotification = await req.json();

    console.log("Processing assessment change notification for:", appointmentId);

    const formattedDate = new Date(appointmentDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #2563eb; margin: 0 0 10px 0;">Assessment Status Update</h1>
          <p style="color: #6b7280; margin: 0;">The status of your scheduled assessment has been updated.</p>
        </div>
        
        <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #374151; margin-top: 0;">Assessment Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Patient:</td>
              <td style="padding: 8px 0; color: #374151;">${claimantName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Medical Expert:</td>
              <td style="padding: 8px 0; color: #374151;">Dr. ${expertName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Date:</td>
              <td style="padding: 8px 0; color: #374151;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Previous Status:</td>
              <td style="padding: 8px 0; color: #ef4444;">${oldStatus}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Current Status:</td>
              <td style="padding: 8px 0; color: #22c55e; font-weight: bold;">${newStatus}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
          <h3 style="color: #1e40af; margin-top: 0;">Important Notice:</h3>
          <p style="color: #1e40af; margin-bottom: 0;">
            This is an automated notification to keep you informed of changes to your assessment. 
            Please log into the system for complete details or contact our office if you have any questions.
          </p>
        </div>

        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
          <p style="color: #4b5563; margin: 0; font-size: 14px;">
            This notification was sent to keep you updated on your case progress. 
            No action is required unless specified above.
          </p>
        </div>
      </div>
    `;

    if (!attorneyEmail) {
      console.log("No attorney email provided, skipping notification");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No attorney email provided",
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

    // Send to attorney and employees
    const recipients = [attorneyEmail];
    
    // Get employee notification emails for assessment changes
    try {
      const employeeResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/employee_notifications?select=email&is_active=eq.true&receive_assessment_changes=eq.true`, {
        headers: {
          'apikey': Deno.env.get("SUPABASE_ANON_KEY") || '',
          'authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          'content-type': 'application/json'
        }
      });
      
      if (employeeResponse.ok) {
        const employeeData = await employeeResponse.json();
        if (employeeData && employeeData.length > 0) {
          employeeData.forEach((emp: any) => {
            if (emp.email && !recipients.includes(emp.email)) {
              recipients.push(emp.email);
            }
          });
        }
      }
    } catch (error) {
      console.error("Could not fetch employee emails:", error);
    }

    const emailResults = await Promise.allSettled(
      recipients.map(email => sendEmailViaSendGrid({
        to: email,
        subject: `Assessment Status Updated - ${claimantName} (${newStatus})`,
        html: emailHtml,
      }))
    );

    const successfulEmails = emailResults.filter(result => result.status === 'fulfilled').length;

    console.log(`Assessment change notifications sent successfully to ${successfulEmails} recipients`);

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent: successfulEmails,
        totalRecipients: recipients.length
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
    console.error("Error in notify-attorney-assessment-change function:", error);
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
        email: "notifications@yourdomain.com",
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