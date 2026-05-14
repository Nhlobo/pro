import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { withErrorHandler } from "../_shared/errors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoConfirmationRequest {
  appointmentId: string;
  force?: boolean; // Force resend even if already sent
}

serve(withErrorHandler(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appointmentId, force = false }: AutoConfirmationRequest = await req.json();

    console.log('Processing auto-confirmation for appointment:', appointmentId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        referring_attorney_id,
        referring_attorney,
        claimants (
          id,
          first_name,
          last_name,
          auto_id
        ),
        medical_experts (
          id,
          first_name,
          last_name,
          email,
          consultation_fees
        )
      `)
      .eq('id', appointmentId)
      .is('deleted_at', null)
      .single();

    if (appointmentError || !appointment) {
      console.error('Appointment not found:', appointmentError);
      return new Response(
        JSON.stringify({ error: 'Appointment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!appointment.appointment_date) {
      console.log('Appointment has no date, skipping email');
      return new Response(
        JSON.stringify({ message: 'No appointment date set, skipping email' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appointmentDate = new Date(appointment.appointment_date).toISOString().split('T')[0];

    // Find all appointments for the same attorney on the same date
    const { data: sameDataAppointments, error: sameDataError } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        service_fee,
        claimants (
          id,
          first_name,
          last_name,
          auto_id
        ),
        medical_experts (
          id,
          first_name,
          last_name,
          email,
          expert_type,
          practice_address,
          consultation_fees
        )
      `)
      .eq('referring_attorney_id', appointment.referring_attorney_id)
      .gte('appointment_date', appointmentDate)
      .lt('appointment_date', new Date(new Date(appointmentDate).getTime() + 86400000).toISOString())
      .is('deleted_at', null);

    if (sameDataError) {
      console.error('Error finding same-date appointments:', sameDataError);
      throw sameDataError;
    }

    const appointmentIds = sameDataAppointments?.map(a => a.id) || [];
    const shouldGroup = appointmentIds.length > 1;

    console.log(`Found ${appointmentIds.length} appointments on ${appointmentDate} for attorney ${appointment.referring_attorney_id}`);
    console.log('Should group:', shouldGroup);

    // Check if grouped email was already sent for this date
    if (shouldGroup && !force) {
      const { data: existingLog } = await supabase
        .from('grouped_email_log')
        .select('*')
        .eq('referring_attorney_id', appointment.referring_attorney_id)
        .eq('appointment_date', appointmentDate)
        .order('sent_at', { ascending: false })
        .limit(1)
        .single();

      if (existingLog) {
        // Check if the appointment IDs match (same appointments)
        const existingIds = new Set(existingLog.appointment_ids);
        const currentIds = new Set(appointmentIds);
        const areEqual = existingIds.size === currentIds.size && 
                        [...existingIds].every(id => currentIds.has(id));

        if (areEqual) {
          console.log('Grouped email already sent for this date with same appointments, skipping');
          return new Response(
            JSON.stringify({ 
              message: 'Grouped email already sent', 
              logId: existingLog.id 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.log('New appointment added to existing date, will resend updated group');
        }
      }
    }

    // Get attorney email
    const { data: attorney } = await supabase
      .from('referring_attorneys')
      .select('email, name, contact_person')
      .eq('id', appointment.referring_attorney_id)
      .single();

    if (!attorney?.email) {
      console.error('Attorney email not found');
      return new Response(
        JSON.stringify({ error: 'Attorney email not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send emails based on grouping logic
    if (shouldGroup) {
      console.log('Sending grouped confirmation email');
      
      // Call the existing send-appointment-confirmation function for the first appointment
      // It will automatically detect and group all same-day appointments
      const { data: emailResult, error: emailError } = await supabase.functions.invoke(
        'send-appointment-confirmation',
        {
          body: {
            appointmentId: appointmentIds[0],
            attorneyEmail: attorney.email,
          }
        }
      );

      if (emailError) {
        console.error('Error sending grouped email:', emailError);
        throw emailError;
      }

      // Log the grouped email send
      const { error: logError } = await supabase
        .from('grouped_email_log')
        .insert({
          referring_attorney_id: appointment.referring_attorney_id,
          appointment_date: appointmentDate,
          appointment_ids: appointmentIds,
          email_sent_to: attorney.email,
        });

      if (logError) {
        console.error('Error logging grouped email:', logError);
      }

      return new Response(
        JSON.stringify({ 
          message: 'Grouped email sent successfully',
          appointmentCount: appointmentIds.length,
          emailSentTo: attorney.email
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log('Sending individual confirmation email');
      
      // Send individual email
      const { data: emailResult, error: emailError } = await supabase.functions.invoke(
        'send-appointment-confirmation',
        {
          body: {
            appointmentId: appointmentId,
            attorneyEmail: attorney.email,
          }
        }
      );

      if (emailError) {
        console.error('Error sending individual email:', emailError);
        throw emailError;
      }

      return new Response(
        JSON.stringify({ 
          message: 'Individual email sent successfully',
          emailSentTo: attorney.email
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in auto-send-grouped-confirmation:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));