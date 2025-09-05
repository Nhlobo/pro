import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AppointmentRequestData {
  referring_attorney_name: string;
  claimant_first_name: string;
  claimant_last_name: string;
  is_minor: boolean;
  guardian_name?: string;
  expert_type_requested: string;
  matter_type: string;
  special_requests: string[];
  province: string;
  preferred_date_type: string;
  suggested_date?: string;
  suggested_month?: string;
  additional_notes?: string;
}

interface RequestBody {
  requestData: AppointmentRequestData;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { requestData }: RequestBody = await req.json();

    // Format the email content
    const emailContent = `
      <h2>New Appointment Request</h2>
      
      <h3>Referring Attorney Information</h3>
      <p><strong>Attorney/Law Firm:</strong> ${requestData.referring_attorney_name}</p>
      
      <h3>Claimant Information</h3>
      <p><strong>Name:</strong> ${requestData.claimant_first_name} ${requestData.claimant_last_name}</p>
      <p><strong>Is Minor:</strong> ${requestData.is_minor ? 'Yes' : 'No'}</p>
      ${requestData.guardian_name ? `<p><strong>Guardian:</strong> ${requestData.guardian_name}</p>` : ''}
      
      <h3>Case Details</h3>
      <p><strong>Matter Type:</strong> ${requestData.matter_type}</p>
      <p><strong>Expert Type Requested:</strong> ${requestData.expert_type_requested}</p>
      ${requestData.special_requests.length > 0 ? `<p><strong>Special Requests:</strong> ${requestData.special_requests.join(', ')}</p>` : ''}
      
      <h3>Location & Timing</h3>
      <p><strong>Province:</strong> ${requestData.province}</p>
      <p><strong>Date Preference:</strong> ${requestData.preferred_date_type}</p>
      ${requestData.suggested_date ? `<p><strong>Suggested Date:</strong> ${requestData.suggested_date}</p>` : ''}
      ${requestData.suggested_month ? `<p><strong>Preferred Month:</strong> ${requestData.suggested_month}</p>` : ''}
      
      ${requestData.additional_notes ? `
      <h3>Additional Notes</h3>
      <p>${requestData.additional_notes}</p>
      ` : ''}
      
      <hr>
      <p><em>This request was submitted through the Medico-Legal Assessment System.</em></p>
    `;

    // Send to admin and referring attorney
    const recipients = ["info@kutlwanoassociate.com"];
    
    // Try to get attorney email from the request data
    if (requestData.referring_attorney_name) {
      try {
        const { data: attorneyData } = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/law_firms?select=email&contact_person=ilike.*${requestData.referring_attorney_name}*`, {
          headers: {
            'apikey': Deno.env.get("SUPABASE_ANON_KEY") || '',
            'authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            'content-type': 'application/json'
          }
        }).then(res => res.json());
        
        if (attorneyData && attorneyData.length > 0 && attorneyData[0].email) {
          recipients.push(attorneyData[0].email);
        }
      } catch (error) {
        console.error("Could not fetch attorney email:", error);
      }
    }

    const emailResponse = await resend.emails.send({
      from: "Medico-Legal System <noreply@kutlwanoassociate.com>",
      to: recipients,
      subject: `New Appointment Request - ${requestData.claimant_first_name} ${requestData.claimant_last_name}`,
      html: emailContent,
    });

    console.log("Email sent successfully:", emailResponse);
    console.log("Email details:", {
      from: "Medico-Legal System <noreply@kutlwanoassociate.com>",
      to: recipients,
      subject: `New Appointment Request - ${requestData.claimant_first_name} ${requestData.claimant_last_name}`,
      emailId: emailResponse.id
    });

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.id,
      troubleshooting: {
        message: "Email sent successfully. If not received, check spam folder and domain verification.",
        resendDashboard: "https://resend.com/emails",
        domainVerification: "https://resend.com/domains"
      }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-appointment-request function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);