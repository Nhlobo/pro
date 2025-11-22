import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from "npm:zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Comprehensive Zod validation schema for appointment request record
const AppointmentRequestRecordSchema = z.object({
  id: z.string().uuid({ message: "Invalid request ID format" }),
  claimant_first_name: z.string()
    .min(1, { message: "Claimant first name is required" })
    .max(100, { message: "First name must be less than 100 characters" })
    .trim(),
  claimant_last_name: z.string()
    .min(1, { message: "Claimant last name is required" })
    .max(100, { message: "Last name must be less than 100 characters" })
    .trim(),
  expert_type_requested: z.string()
    .min(1, { message: "Expert type is required" })
    .max(100, { message: "Expert type must be less than 100 characters" })
    .trim(),
  matter_type: z.string()
    .min(1, { message: "Matter type is required" })
    .max(100, { message: "Matter type must be less than 100 characters" })
    .trim(),
  province: z.string()
    .min(1, { message: "Province is required" })
    .max(100, { message: "Province must be less than 100 characters" })
    .trim(),
  law_firm_id: z.string().uuid({ message: "Invalid law firm ID format" }),
  referring_attorney_name: z.string()
    .min(1, { message: "Referring attorney name is required" })
    .max(200, { message: "Attorney name must be less than 200 characters" })
    .trim(),
  suggested_date: z.string()
    .max(50, { message: "Suggested date must be less than 50 characters" })
    .trim()
    .optional()
    .nullable(),
  additional_notes: z.string()
    .max(1000, { message: "Additional notes must be less than 1000 characters" })
    .trim()
    .optional()
    .nullable()
}).passthrough(); // Allow other fields but validate these critical ones

const NotifyAppointmentRequestSchema = z.object({
  record: AppointmentRequestRecordSchema
}).strict();

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

    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = NotifyAppointmentRequestSchema.safeParse(rawBody);

    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.format());
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Validation failed',
          details: validationResult.error.flatten()
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { record } = validationResult.data;
    console.log('New appointment request:', record);

    // Send all notifications to noreply@kamedico-legal.co.za
    const notificationEmail = 'noreply@kamedico-legal.co.za';

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
            <p>Kutlwano & Associate - Medical Expert Assessment System</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </div>
    `;

    // Queue email for review
    try {
      console.log(`Queueing notification for: ${notificationEmail}`);
      
      const { error: queueError } = await supabaseClient
        .from('email_queue')
        .insert({
          email_type: 'appointment_request',
          recipient_email: notificationEmail,
          recipient_name: 'System Administrator',
          subject: emailSubject,
          html_content: emailBody,
          metadata: {
            appointment_request_id: record.id,
            claimant_name: `${record.claimant_first_name} ${record.claimant_last_name}`,
            expert_type: record.expert_type_requested
          },
          related_record_id: record.id,
          related_table: 'appointment_requests',
          status: 'pending'
        });
      
      if (queueError) {
        console.error(`Failed to queue email:`, queueError);
        throw new Error(`Queue error: ${queueError.message}`);
      }
      
      console.log(`Successfully queued notification for ${notificationEmail}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          queued: true,
          message: `Notification queued for review - will be sent to ${notificationEmail}`
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    } catch (error) {
      console.error(`Failed to send notification to ${notificationEmail}:`, error);
      throw error;
    }

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