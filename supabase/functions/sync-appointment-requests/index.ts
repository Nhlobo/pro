import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withErrorHandler } from "../_shared/errors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(withErrorHandler(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get request data
    const { action } = await req.json().catch(() => ({ action: 'status' }));

    console.log('Sync appointment requests function called with action:', action);

    if (action === 'manual_sync') {
      // Manual sync trigger
      const { error: syncError } = await supabase.rpc('sync_existing_appointment_requests');
      
      if (syncError) {
        console.error('Manual sync error:', syncError);
        return new Response(
          JSON.stringify({ error: 'Failed to sync appointment requests', details: syncError.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Get sync status
      const { data: requestsData, error: requestsError } = await supabase
        .from('appointment_requests')
        .select('id, status, synced_appointment_id, referring_attorney_name, claimant_first_name, claimant_last_name')
        .in('status', ['approved', 'new_date_proposed']);

      if (requestsError) {
        console.error('Error fetching sync status:', requestsError);
      }

      const syncedCount = requestsData?.filter(req => req.synced_appointment_id).length || 0;
      const unsyncedCount = requestsData?.filter(req => !req.synced_appointment_id).length || 0;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Manual sync completed',
          stats: {
            total_approved_proposed: requestsData?.length || 0,
            synced: syncedCount,
            unsynced: unsyncedCount
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Default action: get sync status
    const { data: requestsData, error: requestsError } = await supabase
      .from('appointment_requests')
      .select('id, status, synced_appointment_id, referring_attorney_name, claimant_first_name, claimant_last_name, created_at')
      .in('status', ['approved', 'new_date_proposed'])
      .order('created_at', { ascending: false });

    if (requestsError) {
      console.error('Error fetching appointment requests:', requestsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sync status', details: requestsError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const syncedRequests = requestsData?.filter(req => req.synced_appointment_id) || [];
    const unsyncedRequests = requestsData?.filter(req => !req.synced_appointment_id) || [];

    // Get appointments created from synced requests
    const syncedAppointmentIds = syncedRequests.map(req => req.synced_appointment_id).filter(Boolean);
    
    let appointmentsData: any[] = [];
    if (syncedAppointmentIds.length > 0) {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, appointment_date, case_status, referring_attorney')
        .in('id', syncedAppointmentIds);
      
      if (!error) {
        appointmentsData = data || [];
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sync_status: {
          total_approved_proposed: requestsData?.length || 0,
          synced: syncedRequests.length,
          unsynced: unsyncedRequests.length,
          synced_requests: syncedRequests.map(req => ({
            id: req.id,
            attorney: req.referring_attorney_name,
            claimant: `${req.claimant_first_name} ${req.claimant_last_name}`,
            appointment_id: req.synced_appointment_id,
            status: req.status
          })),
          unsynced_requests: unsyncedRequests.map(req => ({
            id: req.id,
            attorney: req.referring_attorney_name,
            claimant: `${req.claimant_first_name} ${req.claimant_last_name}`,
            status: req.status,
            reason: 'Pending expert matching or date validation'
          })),
          synced_appointments: appointmentsData.map(apt => ({
            id: apt.id,
            appointment_date: apt.appointment_date,
            status: apt.case_status,
            attorney: apt.referring_attorney
          }))
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Sync appointment requests function error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}));