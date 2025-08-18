import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AppointmentData {
  id: string;
  auto_id: string;
  claimant_name: string;
  expert_name: string;
  expert_type: string;
  appointment_date: string;
  appointment_time: string;
  referring_attorney: string;
  deposit: string;
  status: string;
  report_status: string;
  comments: string;
  report_date?: string;
}

interface RequestBody {
  period: 'monthly' | 'quarterly' | 'yearly';
  appointments: AppointmentData[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: authHeader,
          }
        }
      }
    );

    // Get current user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    // Get user's law firm
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('law_firm_id')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile?.law_firm_id) {
      throw new Error('User profile or law firm not found');
    }

    const { period, appointments }: RequestBody = await req.json();
    
    console.log(`Generating ${period} report for law firm ${profile.law_firm_id} with ${appointments.length} appointments`);

    // Archive current period data and manage historical data
    await archiveCurrentPeriodData(supabaseClient, period, appointments, profile.law_firm_id, user.id);

    // Generate PDF report content
    const reportContent = generateReportContent(appointments, period);

    // For now, return a simple text report (in production, you'd generate a PDF)
    const response = new Response(reportContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="scheduled-assessments-${period}-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });

    return response;

  } catch (error) {
    console.error('Error generating report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function archiveCurrentPeriodData(supabaseClient: any, period: string, appointments: AppointmentData[], lawFirmId: string, userId: string) {
  try {
    const now = new Date();
    const archiveTableName = `archived_appointments_${period}`;
    
    // Create archive record for this period
    const archiveData = {
      period_type: period,
      period_start: getPeriodStart(period, now),
      period_end: getPeriodEnd(period, now),
      total_appointments: appointments.length,
      archived_date: now.toISOString(),
      data: appointments,
      law_firm_id: lawFirmId,
      created_by: userId
    };

    // Store in archive table (this would need to be created via migration)
    const { error: archiveError } = await supabaseClient
      .from('appointment_archives')
      .insert([archiveData]);

    if (archiveError) {
      console.error('Error archiving data:', archiveError);
    }

    // Clean up old archives (keep only 5 years for yearly/quarterly)
    if (period === 'yearly' || period === 'quarterly') {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 5);
      
      const { error: cleanupError } = await supabaseClient
        .from('appointment_archives')
        .delete()
        .eq('period_type', period)
        .eq('law_firm_id', lawFirmId)
        .lt('period_start', cutoffDate.toISOString());

      if (cleanupError) {
        console.error('Error cleaning up old archives:', cleanupError);
      }
    }

    console.log(`Archived ${appointments.length} appointments for ${period} period`);
  } catch (error) {
    console.error('Error in archiving process:', error);
  }
}

function getPeriodStart(period: string, date: Date): string {
  const start = new Date(date);
  
  switch (period) {
    case 'monthly':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'quarterly':
      const quarter = Math.floor(start.getMonth() / 3);
      start.setMonth(quarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'yearly':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
  }
  
  return start.toISOString();
}

function getPeriodEnd(period: string, date: Date): string {
  const end = new Date(date);
  
  switch (period) {
    case 'monthly':
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'quarterly':
      const quarter = Math.floor(end.getMonth() / 3);
      end.setMonth((quarter + 1) * 3, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'yearly':
      end.setFullYear(end.getFullYear() + 1, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
  }
  
  return end.toISOString();
}

function generateReportContent(appointments: AppointmentData[], period: string): string {
  const now = new Date();
  const reportDate = now.toLocaleDateString();
  
  let content = `SCHEDULED ASSESSMENTS REPORT - ${period.toUpperCase()}\n`;
  content += `Generated on: ${reportDate}\n`;
  content += `Total Appointments: ${appointments.length}\n\n`;
  
  // Summary statistics
  const statusCounts = appointments.reduce((acc, apt) => {
    acc[apt.status] = (acc[apt.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const reportStatusCounts = appointments.reduce((acc, apt) => {
    acc[apt.report_status] = (acc[apt.report_status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  content += `APPOINTMENT STATUS SUMMARY:\n`;
  Object.entries(statusCounts).forEach(([status, count]) => {
    content += `${status}: ${count}\n`;
  });
  
  content += `\nREPORT STATUS SUMMARY:\n`;
  Object.entries(reportStatusCounts).forEach(([status, count]) => {
    content += `${status}: ${count}\n`;
  });
  
  content += `\nDETAILED APPOINTMENTS:\n`;
  content += `${'='.repeat(120)}\n`;
  content += `Auto ID | Claimant Name | Expert | Type | Date | Status | Report Status\n`;
  content += `${'='.repeat(120)}\n`;
  
  appointments.forEach(apt => {
    const line = `${apt.auto_id.padEnd(8)} | ${apt.claimant_name.padEnd(15)} | ${apt.expert_name.padEnd(15)} | ${apt.expert_type.padEnd(12)} | ${apt.appointment_date.padEnd(12)} | ${apt.status.padEnd(10)} | ${apt.report_status}\n`;
    content += line;
  });
  
  content += `${'='.repeat(120)}\n`;
  content += `\nReport generated automatically by Medico-Legal Assessment System\n`;
  content += `Archive period: ${getPeriodStart(period, now)} to ${getPeriodEnd(period, now)}\n`;
  
  return content;
}
