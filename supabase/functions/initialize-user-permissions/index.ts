import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withErrorHandler } from "../_shared/errors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(withErrorHandler(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Require admin caller OR internal service-role invocation
    const authHeader = req.headers.get('Authorization') ?? '';
    const providedToken = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const isInternal = providedToken && providedToken === serviceRoleKey;
    if (!isInternal) {
      if (!providedToken) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: userRes, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userRes?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: isAdmin } = await userClient.rpc('has_role', { _user_id: userRes.user.id, _role: 'admin' });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { userId, userType } = await req.json()

    if (!userId || !userType) {
      return new Response(
        JSON.stringify({ error: 'User ID and user type are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Define permissions structure based on user type
    const permissionsStructure = {
      referring_attorney: [
        // Medical Expert Management
        { category: 'Medical Expert Management', function: 'View Experts', sub_function: null },
        { category: 'Medical Expert Management', function: 'View Experts', sub_function: 'View Contact Details' },
        { category: 'Medical Expert Management', function: 'View Experts', sub_function: 'View Fees' },
        { category: 'Medical Expert Management', function: 'View Experts', sub_function: 'View CV' },
        { category: 'Medical Expert Management', function: 'View Experts', sub_function: 'View Availability' },
        
        // Appointment Management
        { category: 'Appointment Management', function: 'View Appointments', sub_function: null },
        { category: 'Appointment Management', function: 'Schedule Appointment', sub_function: null },
        { category: 'Appointment Management', function: 'View Appointments', sub_function: 'View Payment Status' },
        { category: 'Appointment Management', function: 'View Appointments', sub_function: 'View Expert Details' },
        { category: 'Appointment Management', function: 'View Appointments', sub_function: 'Download Reports' },
        
        // Case Management
        { category: 'Case Management', function: 'Request Appointment', sub_function: null },
        { category: 'Case Management', function: 'Request Appointment', sub_function: 'Create Request' },
        { category: 'Case Management', function: 'Request Appointment', sub_function: 'View Requests' },
        { category: 'Case Management', function: 'Request Appointment', sub_function: 'Track Status' },
        { category: 'Case Management', function: 'Claimant Progress', sub_function: null },
        { category: 'Case Management', function: 'Claimant Progress', sub_function: 'View Progress Reports' },
        { category: 'Case Management', function: 'Claimant Progress', sub_function: 'Generate Reports' },
        { category: 'Case Management', function: 'Assessment Updates', sub_function: null },
        { category: 'Case Management', function: 'Assessment Updates', sub_function: 'View Updates' },
        { category: 'Case Management', function: 'AOD Management', sub_function: null },
        { category: 'Case Management', function: 'AOD Management', sub_function: 'View AOD Documents' },
        { category: 'Case Management', function: 'AOD Management', sub_function: 'Track Payments' },
        { category: 'Case Management', function: 'Case Reports', sub_function: null },
        { category: 'Case Management', function: 'Case Reports', sub_function: 'View Reports' },
        { category: 'Case Management', function: 'Case Reports', sub_function: 'Generate Reports' },
        
        // Report Management
        { category: 'Report Management', function: 'View Reports', sub_function: null },
        { category: 'Report Management', function: 'Track Report Status', sub_function: null },
        { category: 'Report Management', function: 'Download Reports', sub_function: null },
        { category: 'Report Management', function: 'View Reports', sub_function: 'View Expert Performance' },
        { category: 'Report Management', function: 'View Reports', sub_function: 'View Financial Summary' },
        { category: 'Report Management', function: 'View Reports', sub_function: 'Export to PDF' },
        
        // Document Management
        { category: 'Document Management', function: 'Upload Documents', sub_function: null },
        { category: 'Document Management', function: 'View Documents', sub_function: null },
        { category: 'Document Management', function: 'Download Documents', sub_function: null },
      ],
      
      employee: [
        // Medical Expert Management
        { category: 'Medical Expert Management', function: 'View Experts', sub_function: null },
        { category: 'Medical Expert Management', function: 'Add Expert', sub_function: null },
        { category: 'Medical Expert Management', function: 'Edit Expert', sub_function: null },
        { category: 'Medical Expert Management', function: 'Delete Expert', sub_function: null },
        { category: 'Medical Expert Management', function: 'View Experts', sub_function: 'View Contact Details' },
        { category: 'Medical Expert Management', function: 'View Experts', sub_function: 'View Fees' },
        { category: 'Medical Expert Management', function: 'View Experts', sub_function: 'View CV' },
        { category: 'Medical Expert Management', function: 'View Experts', sub_function: 'View Availability' },
        
        // Appointment Management
        { category: 'Appointment Management', function: 'View Appointments', sub_function: null },
        { category: 'Appointment Management', function: 'Schedule Appointment', sub_function: null },
        { category: 'Appointment Management', function: 'Edit Appointment', sub_function: null },
        { category: 'Appointment Management', function: 'Cancel Appointment', sub_function: null },
        { category: 'Appointment Management', function: 'View Appointments', sub_function: 'View Payment Status' },
        { category: 'Appointment Management', function: 'View Appointments', sub_function: 'View Expert Details' },
        { category: 'Appointment Management', function: 'View Appointments', sub_function: 'Download Reports' },
        
        // Case Management
        { category: 'Case Management', function: 'Request Appointment', sub_function: null },
        { category: 'Case Management', function: 'Request Appointment', sub_function: 'Create Request' },
        { category: 'Case Management', function: 'Request Appointment', sub_function: 'View Requests' },
        { category: 'Case Management', function: 'Request Appointment', sub_function: 'Edit Request' },
        { category: 'Case Management', function: 'Request Appointment', sub_function: 'Track Status' },
        { category: 'Case Management', function: 'Claimant Progress', sub_function: null },
        { category: 'Case Management', function: 'Claimant Progress', sub_function: 'View Progress Reports' },
        { category: 'Case Management', function: 'Claimant Progress', sub_function: 'Generate Reports' },
        { category: 'Case Management', function: 'Claimant Progress', sub_function: 'Export Data' },
        { category: 'Case Management', function: 'Assessment Updates', sub_function: null },
        { category: 'Case Management', function: 'Assessment Updates', sub_function: 'Update Status' },
        { category: 'Case Management', function: 'Assessment Updates', sub_function: 'View Updates' },
        { category: 'Case Management', function: 'Assessment Updates', sub_function: 'Edit Assessment' },
        { category: 'Case Management', function: 'AOD Management', sub_function: null },
        { category: 'Case Management', function: 'AOD Management', sub_function: 'View AOD Documents' },
        { category: 'Case Management', function: 'AOD Management', sub_function: 'Upload Documents' },
        { category: 'Case Management', function: 'AOD Management', sub_function: 'Track Payments' },
        { category: 'Case Management', function: 'AOD Management', sub_function: 'Payment Plans' },
        { category: 'Case Management', function: 'Case Reports', sub_function: null },
        { category: 'Case Management', function: 'Case Reports', sub_function: 'View Reports' },
        { category: 'Case Management', function: 'Case Reports', sub_function: 'Generate Reports' },
        { category: 'Case Management', function: 'Case Reports', sub_function: 'Export Data' },
        
        // Report Management
        { category: 'Report Management', function: 'View Reports', sub_function: null },
        { category: 'Report Management', function: 'Track Report Status', sub_function: null },
        { category: 'Report Management', function: 'Download Reports', sub_function: null },
        { category: 'Report Management', function: 'Request Report Changes', sub_function: null },
        { category: 'Report Management', function: 'View Reports', sub_function: 'View Expert Performance' },
        { category: 'Report Management', function: 'View Reports', sub_function: 'View Financial Summary' },
        { category: 'Report Management', function: 'View Reports', sub_function: 'Export to PDF' },
        
        // Claimant Management
        { category: 'Claimant Management', function: 'View Claimants', sub_function: null },
        { category: 'Claimant Management', function: 'Add Claimant', sub_function: null },
        { category: 'Claimant Management', function: 'Edit Claimant', sub_function: null },
        { category: 'Claimant Management', function: 'Delete Claimant', sub_function: null },
        
        // Document Management
        { category: 'Document Management', function: 'Upload Documents', sub_function: null },
        { category: 'Document Management', function: 'View Documents', sub_function: null },
        { category: 'Document Management', function: 'Download Documents', sub_function: null },
        { category: 'Document Management', function: 'Delete Documents', sub_function: null },
        
        // Analytics & Reporting
        { category: 'Analytics & Reporting', function: 'View Analytics Dashboard', sub_function: null },
        { category: 'Analytics & Reporting', function: 'Generate Reports', sub_function: null },
        { category: 'Analytics & Reporting', function: 'Export Data', sub_function: null },
        { category: 'Analytics & Reporting', function: 'View Performance Metrics', sub_function: null },
      ]
    }

    const permissions = permissionsStructure[userType as keyof typeof permissionsStructure] || []

    // Insert function permissions
    const permissionRows = permissions.map(perm => ({
      user_id: userId,
      function_category: perm.category,
      function_name: perm.function,
      sub_function: perm.sub_function,
      granted: false, // Default to not granted
      user_type: userType
    }))

    if (permissionRows.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('function_permissions')
        .insert(permissionRows)

      if (insertError) {
        console.error('Error inserting function permissions:', insertError)
        return new Response(
          JSON.stringify({ error: 'Failed to initialize function permissions' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Function permissions initialized for ${userType}`,
        permissions_count: permissionRows.length
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in initialize-user-permissions:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}))