import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ArchiveRequest {
  period_type: 'monthly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
}

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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Set the auth context
    const token = authHeader.replace('Bearer ', '');
    const { data: user, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user's profile and role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('referring_attorney_id, role')
      .eq('id', user.user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const isAdmin = profile.role === 'admin';
    const referringAttorneyId = profile.referring_attorney_id;

    // Non-admin users must have a referring attorney
    if (!isAdmin && !referringAttorneyId) {
      return new Response(
        JSON.stringify({ error: 'No referring attorney associated with your account' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (req.method === 'POST') {
      const { period_type, period_start, period_end }: ArchiveRequest = await req.json();

      console.log('Archiving assessment data:', { period_type, period_start, period_end, referring_attorney_id: referringAttorneyId, is_admin: isAdmin });

      // Fetch assessment data for the period
      let appointmentsQuery = supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          case_status,
          service_fee,
          deposit_amount,
          payment_status,
          payment_date,
          matter_type,
          referring_attorney_id,
          claimants (
            auto_id,
            first_name,
            last_name
          ),
          medical_experts (
            expert_type
          ),
          expert_reports (
            report_status,
            report_submitted_date,
            payment_date,
            days_to_complete,
            expert_performance
          )
        `)
        .gte('appointment_date', period_start)
        .lte('appointment_date', period_end);

      // Filter by referring attorney for non-admin users
      if (!isAdmin && referringAttorneyId) {
        appointmentsQuery = appointmentsQuery.eq('referring_attorney_id', referringAttorneyId);
      }

      const { data: appointments, error: appointmentsError } = await appointmentsQuery;

      if (appointmentsError) {
        console.error('Error fetching appointments:', appointmentsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch appointment data' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Calculate statistics
      const totalAssessments = appointments?.length || 0;
      const completedReports = appointments?.filter(apt => 
        apt.expert_reports?.some(report => report.report_status === 'completed')
      ).length || 0;
      const pendingReports = appointments?.filter(apt => 
        apt.expert_reports?.some(report => report.report_status === 'pending')
      ).length || 0;
      const reportsTakenOut = appointments?.filter(apt => 
        apt.expert_reports?.length > 0
      ).length || 0;
      const completionRate = totalAssessments > 0 ? (completedReports / totalAssessments) * 100 : 0;

      // Process monthly trends
      const monthlyTrends = appointments?.reduce((acc, apt) => {
        const month = new Date(apt.appointment_date).toISOString().slice(0, 7);
        if (!acc[month]) acc[month] = 0;
        acc[month]++;
        return acc;
      }, {} as Record<string, number>) || {};

      // Process expert performance data
      const expertPerformance = appointments?.reduce((acc, apt) => {
        const expertType = apt.medical_experts?.[0]?.expert_type;
        if (expertType && apt.expert_reports?.length > 0) {
          if (!acc[expertType]) {
            acc[expertType] = { good: 0, average: 0, bad: 0, total: 0 };
          }
          apt.expert_reports.forEach(report => {
            acc[expertType].total++;
            if (report.expert_performance) {
              acc[expertType][report.expert_performance as keyof typeof acc[string]]++;
            }
          });
        }
        return acc;
      }, {} as Record<string, any>) || {};

      // Process matter type data
      const matterTypeData = appointments?.reduce((acc, apt) => {
        const matterType = apt.matter_type || 'Unspecified';
        if (!acc[matterType]) acc[matterType] = 0;
        acc[matterType]++;
        return acc;
      }, {} as Record<string, number>) || {};

      // Archive the assessment data
      const { data, error } = await supabase
        .from('assessment_report_archives')
        .insert({
          referring_attorney_id: referringAttorneyId, // Will be null for admin users
          period_start,
          period_end,
          period_type,
          total_assessments: totalAssessments,
          completed_reports: completedReports,
          pending_reports: pendingReports,
          reports_taken_out: reportsTakenOut,
          completion_rate: completionRate,
          monthly_trends_data: Object.entries(monthlyTrends).map(([month, count]) => ({ month, count })),
          expert_performance_data: Object.entries(expertPerformance).map(([type, data]) => ({ expert_type: type, ...data })),
          matter_type_data: Object.entries(matterTypeData).map(([type, count]) => ({ matter_type: type, count })),
          created_by: user.user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating archive:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to create archive' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Clean up old archives (keep only 5 years)
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      let deleteQuery = supabase
        .from('assessment_report_archives')
        .delete()
        .lt('archived_date', fiveYearsAgo.toISOString());

      if (!isAdmin && referringAttorneyId) {
        deleteQuery = deleteQuery.eq('referring_attorney_id', referringAttorneyId);
      }

      await deleteQuery;

      console.log('Archive created successfully:', data.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          archive_id: data.id,
          statistics: {
            total_assessments: totalAssessments,
            completed_reports: completedReports,
            pending_reports: pendingReports,
            completion_rate: completionRate.toFixed(2) + '%'
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (req.method === 'GET') {
      // Retrieve archived data
      const url = new URL(req.url);
      const archivePeriodType = url.searchParams.get('period_type') || 'monthly';
      
      let archivesQuery = supabase
        .from('assessment_report_archives')
        .select('*')
        .eq('period_type', archivePeriodType)
        .order('period_start', { ascending: false })
        .limit(24); // Last 24 periods

      // Filter by referring attorney for non-admin users
      if (!isAdmin && referringAttorneyId) {
        archivesQuery = archivesQuery.eq('referring_attorney_id', referringAttorneyId);
      }

      const { data: archives, error } = await archivesQuery;

      if (error) {
        console.error('Error fetching archives:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch archives' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      return new Response(
        JSON.stringify({ archives }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Archive function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
