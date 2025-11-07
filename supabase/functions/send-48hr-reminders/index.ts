import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/email.ts";

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
    appointment_time: string;
    location: string;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("48-hour reminder function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate the time window: 48 hours from now (±1 hour window)
    const now = new Date();
    const targetTime = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const windowStart = new Date(targetTime.getTime() - 30 * 60 * 1000); // 30 min before
    const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000); // 30 min after

    console.log("Checking appointments between:", windowStart.toISOString(), "and", windowEnd.toISOString());

    // Fetch appointments scheduled within the 48-hour window
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        case_status,
        referring_attorney_id,
        claimants (
          first_name,
          last_name
        ),
        medical_experts (
          first_name,
          last_name,
          expert_type,
          practice_address
        ),
        referring_attorneys (
          firm_name,
          email,
          phone
        )
      `)
      .eq('case_status', 'scheduled')
      .gte('appointment_date', windowStart.toISOString())
      .lte('appointment_date', windowEnd.toISOString())
      .is('deleted_at', null);

    if (appointmentsError) {
      console.error("Error fetching appointments:", appointmentsError);
      throw appointmentsError;
    }

    if (!appointments || appointments.length === 0) {
      console.log("No appointments found in the 48-hour window");
      return new Response(
        JSON.stringify({ success: true, message: "No appointments to remind", reminders_sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${appointments.length} appointments to remind about`);

    // Group appointments by referring attorney
    const remindersByAttorney = new Map<string, AppointmentReminder>();

    for (const appointment of appointments) {
      const attorneyId = appointment.referring_attorney_id;
      
      if (!remindersByAttorney.has(attorneyId)) {
        remindersByAttorney.set(attorneyId, {
          attorney_id: attorneyId,
          attorney_name: appointment.referring_attorneys.firm_name,
          attorney_email: appointment.referring_attorneys.email,
          attorney_phone: appointment.referring_attorneys.phone,
          appointments: []
        });
      }

      const appointmentDate = new Date(appointment.appointment_date);
      const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      remindersByAttorney.get(attorneyId)!.appointments.push({
        claimant_name: `${appointment.claimants.first_name} ${appointment.claimants.last_name}`,
        expert_type: appointment.medical_experts.expert_type,
        appointment_time: formattedTime,
        location: appointment.medical_experts.practice_address || 'TBD'
      });
    }

    // Send reminders to each attorney
    let emailsSent = 0;
    let whatsappSent = 0;
    const errors: any[] = [];

    for (const [, reminder] of remindersByAttorney) {
      // Build appointment list for email
      const appointmentListHtml = reminder.appointments
        .map((apt, index) => `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px 8px; color: #374151; font-weight: 500;">${index + 1}.</td>
            <td style="padding: 12px 8px; color: #374151;">${apt.claimant_name}</td>
            <td style="padding: 12px 8px; color: #374151;">${apt.expert_type}</td>
            <td style="padding: 12px 8px; color: #374151;">${apt.appointment_time}</td>
            <td style="padding: 12px 8px; color: #6b7280; font-size: 14px;">${apt.location}</td>
          </tr>
        `)
        .join('');

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #fbbf24; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #78350f; margin: 0 0 10px 0;">⏰ 48 Hour Reminder – Scheduled Assessments</h1>
          </div>
          
          <div style="background-color: white; padding: 20px;">
            <p style="color: #374151; margin-bottom: 20px;">Dear ${reminder.attorney_name},</p>
            
            <p style="color: #374151; margin-bottom: 20px;">
              This is a friendly reminder of the upcoming assessments scheduled in 48 hours.
            </p>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e5e7eb;">
              <thead style="background-color: #f9fafb;">
                <tr>
                  <th style="padding: 12px 8px; text-align: left; color: #6b7280; font-weight: 600;">#</th>
                  <th style="padding: 12px 8px; text-align: left; color: #6b7280; font-weight: 600;">Claimant</th>
                  <th style="padding: 12px 8px; text-align: left; color: #6b7280; font-weight: 600;">Discipline</th>
                  <th style="padding: 12px 8px; text-align: left; color: #6b7280; font-weight: 600;">Time</th>
                  <th style="padding: 12px 8px; text-align: left; color: #6b7280; font-weight: 600;">Location</th>
                </tr>
              </thead>
              <tbody>
                ${appointmentListHtml}
              </tbody>
            </table>
            
            <div style="background-color: #fef3c7; border-left: 4px solid #fbbf24; padding: 15px; margin: 20px 0;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                <strong>Please ensure:</strong><br>
                • All required documents have been submitted<br>
                • Claimants are informed of their appointment details<br>
                • Any special requirements are communicated to us
              </p>
            </div>
            
            <p style="color: #374151; margin-bottom: 5px;">Thank you,</p>
            <p style="color: #374151; font-weight: bold; margin-bottom: 0;">Kutlwano & Associates</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 0;">Medico-Legal Assessment Coordination Team</p>
          </div>
        </div>
      `;

      // Send email
      if (reminder.attorney_email) {
        try {
          const emailResult = await sendEmail({
            to: reminder.attorney_email,
            subject: "48 Hour Reminder – Scheduled Assessments",
            html: emailHtml,
          });

          if (emailResult.success) {
            emailsSent++;
            console.log(`Email sent to ${reminder.attorney_name}`);
          } else {
            errors.push({ attorney: reminder.attorney_name, type: 'email', error: emailResult.error });
          }
        } catch (error: any) {
          console.error(`Failed to send email to ${reminder.attorney_name}:`, error);
          errors.push({ attorney: reminder.attorney_name, type: 'email', error: error.message });
        }
      }

      // Send WhatsApp message (if WhatsApp integration is configured)
      if (reminder.attorney_phone) {
        try {
          const whatsappApiKey = Deno.env.get("WHATSAPP_API_KEY");
          const whatsappEndpoint = Deno.env.get("WHATSAPP_API_ENDPOINT");
          
          if (whatsappApiKey && whatsappEndpoint) {
            const appointmentList = reminder.appointments
              .map((apt, index) => `${index + 1}. ${apt.claimant_name} - ${apt.expert_type} at ${apt.appointment_time}`)
              .join('\n');

            const whatsappMessage = `*48 Hour Reminder*\n\nYour scheduled assessments are in 48 hours:\n\n${appointmentList}\n\nPlease check your email for full details.\n\nThank you,\nKutlwano & Associates`;

            const whatsappResponse = await fetch(whatsappEndpoint, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${whatsappApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: reminder.attorney_phone,
                message: whatsappMessage,
              }),
            });

            if (whatsappResponse.ok) {
              whatsappSent++;
              console.log(`WhatsApp sent to ${reminder.attorney_name}`);
            } else {
              const errorData = await whatsappResponse.text();
              errors.push({ attorney: reminder.attorney_name, type: 'whatsapp', error: errorData });
            }
          } else {
            console.log("WhatsApp API not configured, skipping WhatsApp notifications");
          }
        } catch (error: any) {
          console.error(`Failed to send WhatsApp to ${reminder.attorney_name}:`, error);
          errors.push({ attorney: reminder.attorney_name, type: 'whatsapp', error: error.message });
        }
      }
    }

    // Log the reminder activity
    console.log(`Reminders sent: ${emailsSent} emails, ${whatsappSent} WhatsApp messages`);

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: emailsSent + whatsappSent,
        emails_sent: emailsSent,
        whatsapp_sent: whatsappSent,
        attorneys_notified: remindersByAttorney.size,
        appointments_reminded: appointments.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-48hr-reminders function:", error);
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
