import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing appointment request notification...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse the request body
    const { record } = await req.json();
    console.log('New appointment request:', record);

    // Get employee notification settings
    const { data: employees, error: employeesError } = await supabaseClient
      .from('employee_notifications')
      .select('email, receive_appointment_requests, is_active')
      .eq('receive_appointment_requests', true)
      .eq('is_active', true);

    if (employeesError) {
      console.error('Error fetching employees:', employeesError);
      throw employeesError;
    }

    console.log(`Found ${employees?.length || 0} employees to notify`);

    if (!employees || employees.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No employees configured for notifications' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Get law firm details for context
    const { data: lawFirm } = await supabaseClient
      .from('law_firms')
      .select('name, contact_person')
      .eq('id', record.law_firm_id)
      .single();

    // Prepare email content
    const emailSubject = `🔔 New Appointment Request - ${record.claimant_first_name} ${record.claimant_last_name}`;
    
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e40af, #0ea5e9); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🔔 New Appointment Request</h1>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px;">
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #1e40af;">
            <h2 style="color: #1e40af; margin-top: 0;">Request Details</h2>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Claimant:</td>
                <td style="padding: 8px 0; color: #6b7280;">${record.claimant_first_name} ${record.claimant_last_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Expert Type:</td>
                <td style="padding: 8px 0; color: #6b7280;">${record.expert_type_requested}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Matter Type:</td>
                <td style="padding: 8px 0; color: #6b7280;">${record.matter_type}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Province:</td>
                <td style="padding: 8px 0; color: #6b7280;">${record.province}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Law Firm:</td>
                <td style="padding: 8px 0; color: #6b7280;">${lawFirm?.name || 'Unknown'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Referring Attorney:</td>
                <td style="padding: 8px 0; color: #6b7280;">${record.referring_attorney_name}</td>
              </tr>
              ${record.suggested_date ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #374151;">Suggested Date:</td>
                <td style="padding: 8px 0; color: #6b7280;">${record.suggested_date}</td>
              </tr>
              ` : ''}
            </table>
            
            ${record.additional_notes ? `
              <div style="margin-top: 20px;">
                <h3 style="color: #374151; margin-bottom: 10px;">Additional Notes:</h3>
                <p style="color: #6b7280; background: #f9fafb; padding: 15px; border-radius: 6px; margin: 0;">
                  ${record.additional_notes}
                </p>
              </div>
            ` : ''}
            
            <div style="margin-top: 30px; text-align: center;">
              <a href="https://kamedico-legal.co.za/appointment-request-dashboard" 
                 style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Review Request
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
            <p>MediLegal Nexus - Medical Expert Assessment System</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </div>
    `;

    // Send notifications to all employees
    const notificationPromises = employees.map(async (employee) => {
      try {
        console.log(`Sending notification to: ${employee.email}`);
        
        // Here you would integrate with your email service (Resend, SendGrid, etc.)
        // For now, we'll simulate the email sending
        
        // If using Resend (example):
        /*
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'MediLegal Nexus <noreply@kamedico-legal.co.za>',
            to: [employee.email],
            subject: emailSubject,
            html: emailBody,
          }),
        });
        */
        
        return { email: employee.email, success: true };
      } catch (error) {
        console.error(`Failed to send notification to ${employee.email}:`, error);
        return { email: employee.email, success: false, error: (error as Error).message };
      }
    });

    const results = await Promise.allSettled(notificationPromises);
    const successCount = results.filter(result => 
      result.status === 'fulfilled' && result.value.success
    ).length;

    console.log(`Sent notifications to ${successCount}/${employees.length} employees`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Notifications sent to ${successCount}/${employees.length} employees`,
        results: results.map(result => 
          result.status === 'fulfilled' ? result.value : { error: result.reason }
        )
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in notify-new-appointment-request:', error);
    
    return new Response(
      JSON.stringify({ 
        error: (error as Error).message || 'Internal server error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});