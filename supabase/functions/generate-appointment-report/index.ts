import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  year: string;
  month?: string;
  quarter?: string;
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

    // User client for auth validation
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        }
      }
    );

    // Admin client for data operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get current user
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    // Get user's referring attorney (law firm) - may be null for admin/employee users
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('referring_attorney_id, role')
      .eq('id', user.id)
      .maybeSingle();
    
    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    const { period, year, month, quarter, appointments }: RequestBody = await req.json();
    
    const lawFirmId = profile.referring_attorney_id;
    console.log(`Generating ${period} report for user ${user.id} (law firm: ${lawFirmId || 'admin/no-firm'}) with ${appointments.length} appointments`);

    // Archive current period data only if user has a referring attorney
    if (lawFirmId) {
      await archiveCurrentPeriodData(adminClient, period, appointments, lawFirmId, user.id);
    } else {
      console.log('Skipping archiving - user has no referring_attorney_id (likely admin/employee)');
    }

    // Generate PDF report content with enhanced information
    const reportContent = generateReportContent(appointments, period, year, month, quarter);

    // Return a text report (changing to proper content type)
    const response = new Response(reportContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="scheduled-assessments-${period}-${new Date().toISOString().split('T')[0]}.txt"`,
      },
    });

    return response;

  } catch (error) {
    console.error('Error generating report:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
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
      referring_attorney_id: lawFirmId,
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
        .eq('referring_attorney_id', lawFirmId)
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

function generateReportContent(appointments: AppointmentData[], period: string, year: string, month?: string, quarter?: string): string {
  const now = new Date();
  const reportDate = now.toLocaleDateString();
  
  let periodText = '';
  if (period === 'monthly' && month) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    periodText = `${monthNames[parseInt(month) - 1]} ${year}`;
  } else if (period === 'quarterly' && quarter) {
    periodText = `Q${quarter} ${year}`;
  } else {
    periodText = year;
  }
  
  let content = `SCHEDULED ASSESSMENTS REPORT - ${period.toUpperCase()}\n`;
  content += `Period: ${periodText}\n`;
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
  content += `${'='.repeat(140)}\n`;
  content += `Auto ID | Claimant Name | Expert | Type | Date | Status | Report Status | Report Date\n`;
  content += `${'='.repeat(140)}\n`;
  
  appointments.forEach(apt => {
    const reportDateText = apt.report_date || 'N/A';
    const line = `${apt.auto_id.padEnd(8)} | ${apt.claimant_name.padEnd(15)} | ${apt.expert_name.padEnd(15)} | ${apt.expert_type.padEnd(12)} | ${apt.appointment_date.padEnd(12)} | ${apt.status.padEnd(10)} | ${apt.report_status.padEnd(15)} | ${reportDateText}\n`;
    content += line;
  });
  
  content += `${'='.repeat(140)}\n`;
  content += `\nReport generated automatically by Medico-Legal Assessment System\n`;
  content += `Archive period: ${getPeriodStart(period, now)} to ${getPeriodEnd(period, now)}\n`;
  content += `Data retention: 5 years as per policy\n`;
  content += `\nNOTE: Report dates are automatically captured when status changes to 'Received' or 'Completed'\n`;
  
  return content;
}
