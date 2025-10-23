import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Restore request from user: ${user.email}`);

    const { appointmentId } = await req.json();

    if (!appointmentId) {
      return new Response(
        JSON.stringify({ error: 'Appointment ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Attempting to restore appointment: ${appointmentId}`);

    // Call the restore function
    const { data: restoredData, error: restoreError } = await supabase
      .rpc('restore_appointment', { appointment_id: appointmentId });

    if (restoreError) {
      console.error('Error restoring appointment:', restoreError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to restore appointment',
          details: restoreError.message 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Appointment restored successfully:', restoredData);

    // Also restore related expert reports if they exist
    const { error: reportRestoreError } = await supabase
      .from('expert_reports')
      .update({ 
        updated_at: new Date().toISOString()
      })
      .eq('appointment_id', appointmentId);

    if (reportRestoreError) {
      console.warn('Failed to update expert reports:', reportRestoreError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Appointment restored successfully',
        data: restoredData 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
