import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ArchiveRequest {
  period_type: 'monthly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
  assessment_data: {
    total_assessments: number;
    completed_reports: number;
    pending_reports: number;
    reports_taken_out: number;
    completion_rate: number;
    matter_type_data: any[];
    expert_performance_data: any[];
    monthly_trends_data: any[];
  };
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

    // Get user's law firm
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('law_firm_id')
      .eq('id', user.user.id)
      .single();

    if (profileError || !profile?.law_firm_id) {
      return new Response(
        JSON.stringify({ error: 'User profile not found or no law firm associated' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (req.method === 'POST') {
      const body: ArchiveRequest = await req.json();
      
      // Archive the assessment data
      const { data, error } = await supabase
        .from('assessment_report_archives')
        .insert({
          law_firm_id: profile.law_firm_id,
          period_type: body.period_type,
          period_start: body.period_start,
          period_end: body.period_end,
          total_assessments: body.assessment_data.total_assessments,
          completed_reports: body.assessment_data.completed_reports,
          pending_reports: body.assessment_data.pending_reports,
          reports_taken_out: body.assessment_data.reports_taken_out,
          completion_rate: body.assessment_data.completion_rate,
          matter_type_data: body.assessment_data.matter_type_data,
          expert_performance_data: body.assessment_data.expert_performance_data,
          monthly_trends_data: body.assessment_data.monthly_trends_data,
          created_by: user.user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Error archiving data:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to archive data' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Clean up old archives (keep last 5 years for yearly, all for others)
      if (body.period_type === 'yearly') {
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
        
        await supabase
          .from('assessment_report_archives')
          .delete()
          .eq('law_firm_id', profile.law_firm_id)
          .eq('period_type', 'yearly')
          .lt('period_start', fiveYearsAgo.toISOString());
      }

      return new Response(
        JSON.stringify({ success: true, archive: data }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (req.method === 'GET') {
      // Get archived assessment data
      const url = new URL(req.url);
      const periodType = url.searchParams.get('period_type') || 'monthly';
      
      const { data, error } = await supabase
        .from('assessment_report_archives')
        .select('*')
        .eq('law_firm_id', profile.law_firm_id)
        .eq('period_type', periodType)
        .order('period_start', { ascending: false });

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
        JSON.stringify({ archives: data }),
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
