import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DebtCase {
  id: string;
  claimant_name: string;
  claimant_auto_id: string;
  report_status: string;
  appointment_date: string;
  days_pending: number;
  amount_due: number;
  expert_name: string;
  case_status: string;
}

export interface DebtSummary {
  total_reports_issued: number;
  pending_reports: number;
  assessments_completed: number;
  total_owed: number;
  average_pending_days: number;
  total_assessed: number;
  taken_reports: number;
  remaining_reports: number;
  total_deposits: number;
  balance_after_deposits: number;
  adjusted_debt: number;
  deposit_status: 'yes' | 'no';
  payment_overdue: boolean;
}

export const useAttorneyDebts = () => {
  const [debtSummary, setDebtSummary] = useState<DebtSummary>({
    total_reports_issued: 0,
    pending_reports: 0,
    assessments_completed: 0,
    total_owed: 0,
    average_pending_days: 0,
    total_assessed: 0,
    taken_reports: 0,
    remaining_reports: 0,
    total_deposits: 0,
    balance_after_deposits: 0,
    adjusted_debt: 0,
    deposit_status: 'no',
    payment_overdue: false,
  });
  const [debtCases, setDebtCases] = useState<DebtCase[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAttorneyDebts = async () => {
    try {
      setLoading(true);

      // Get current user's referring attorney ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('referring_attorney_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.referring_attorney_id) {
        throw new Error('No referring attorney found for current user');
      }

      // Fetch appointments with related data - only scheduled/completed ones
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          case_status,
          service_fee,
          payment_status,
          claimant_id,
          expert_id,
          matter_type,
          deposit_amount,
          claimants!inner (first_name, last_name, auto_id),
          medical_experts!inner (first_name, last_name, expert_type)
        `)
        .eq('referring_attorney_id', profile.referring_attorney_id)
        .is('deleted_at', null)
        .in('case_status', ['scheduled', 'completed', 'in_progress']);

      if (appointmentsError) throw appointmentsError;

      // Fetch expert reports
      const { data: reports, error: reportsError } = await supabase
        .from('expert_reports')
        .select('*')
        .in('appointment_id', appointments?.map(a => a.id) || []);

      if (reportsError) throw reportsError;

      // Fetch AOD documents for total debt
      const { data: aodDocs, error: aodError } = await supabase
        .from('aod_documents')
        .select('*')
        .eq('referring_attorney_id', profile.referring_attorney_id);

      if (aodError) throw aodError;

      // Calculate summary metrics
      const completedReports = reports?.filter(r => 
        ['completed', 'Report fully paid & submitted'].includes(r.report_status)
      ) || [];

      const takenOutReports = reports?.filter(r => 
        ['taken_out', 'Taken Out'].includes(r.report_status)
      ) || [];

      const pendingReports = reports?.filter(r => 
        ['pending', 'in_progress', 'under_review', 'not_received'].includes(r.report_status)
      ) || [];

      const completedAssessments = appointments?.filter(a => 
        a.case_status === 'completed'
      ) || [];

      const totalAssessed = completedReports.length + takenOutReports.length;

      // Calculate total owed from unpaid service fees
      const unpaidServiceFees = appointments?.reduce((sum, apt) => {
        if (apt.payment_status !== 'paid' && apt.service_fee) {
          return sum + Number(apt.service_fee);
        }
        return sum;
      }, 0) || 0;

      // Calculate total owed from AOD documents
      const aodDebt = aodDocs?.reduce((sum, doc) => {
        const totalValue = Number(doc.total_contract_value || 0);
        const paymentsMade = Number(doc.payments_made || 0);
        return sum + (totalValue - paymentsMade);
      }, 0) || 0;

      const totalOwed = unpaidServiceFees + aodDebt;

      // Calculate total deposits
      const totalDeposits = appointments?.reduce((sum, apt) => {
        return sum + Number(apt.deposit_amount || 0);
      }, 0) || 0;

      // Add deposits from AOD documents
      const aodDeposits = aodDocs?.reduce((sum, doc) => {
        return sum + Number(doc.deposit_amount || 0);
      }, 0) || 0;

      const allDeposits = totalDeposits + aodDeposits;
      const balanceAfterDeposits = totalOwed - allDeposits;
      const adjustedDebt = balanceAfterDeposits;

      // Check if any deposits have been made
      const hasDeposits = allDeposits > 0;

      // Calculate average pending days and create cases data
      const now = new Date();
      let totalPendingDays = 0;
      
      const casesData: DebtCase[] = appointments?.map(apt => {
        const report = reports?.find(r => r.appointment_id === apt.id);
        const appointmentDate = new Date(apt.appointment_date);
        const daysPending = Math.floor((now.getTime() - appointmentDate.getTime()) / (1000 * 60 * 60 * 24));
        
        const isPending = ['pending', 'in_progress', 'under_review', 'not_received'].includes(report?.report_status || 'not_received');
        if (isPending) {
          totalPendingDays += daysPending;
        }

        const claimant = Array.isArray(apt.claimants) ? apt.claimants[0] : apt.claimants;
        const expert = Array.isArray(apt.medical_experts) ? apt.medical_experts[0] : apt.medical_experts;

        return {
          id: apt.id,
          claimant_name: claimant 
            ? `${claimant.first_name} ${claimant.last_name}`
            : 'Unknown',
          claimant_auto_id: claimant?.auto_id || 'N/A',
          report_status: report?.report_status || 'not_received',
          appointment_date: apt.appointment_date,
          days_pending: daysPending,
          amount_due: apt.payment_status !== 'paid' ? Number(apt.service_fee || 0) : 0,
          expert_name: expert 
            ? `${expert.first_name} ${expert.last_name}`
            : 'Unknown',
          case_status: apt.case_status || 'scheduled',
        };
      }) || [];

      // Check for overdue payments (more than 35 days)
      const hasOverdue = casesData.some(c => 
        ['pending', 'in_progress', 'under_review', 'not_received'].includes(c.report_status) && 
        c.days_pending > 35
      );

      const averagePendingDays = pendingReports.length > 0 
        ? Math.round(totalPendingDays / pendingReports.length)
        : 0;

      setDebtSummary({
        total_reports_issued: completedReports.length,
        pending_reports: pendingReports.length,
        assessments_completed: completedAssessments.length,
        total_owed: totalOwed,
        average_pending_days: averagePendingDays,
        total_assessed: totalAssessed,
        taken_reports: takenOutReports.length,
        remaining_reports: pendingReports.length,
        total_deposits: allDeposits,
        balance_after_deposits: balanceAfterDeposits,
        adjusted_debt: adjustedDebt,
        deposit_status: hasDeposits ? 'yes' : 'no',
        payment_overdue: hasOverdue,
      });

      setDebtCases(casesData);

      // Check for reports pending > 45 days and notify
      const longPendingReports = casesData.filter(c => 
        ['pending', 'in_progress', 'under_review', 'not_received'].includes(c.report_status) && 
        c.days_pending > 45
      );

      if (longPendingReports.length > 0) {
        toast({
          title: 'Pending Reports Alert',
          description: `You have ${longPendingReports.length} report(s) pending for more than 45 days.`,
          variant: 'destructive',
        });
      }

    } catch (error) {
      console.error('Error fetching attorney debts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load debt information',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttorneyDebts();

    // Real-time subscription for scheduled appointments
    const appointmentsChannel = supabase
      .channel('attorney-debts-appointments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
        },
        (payload) => {
          console.log('Scheduled appointment change detected:', payload);
          fetchAttorneyDebts();
        }
      )
      .subscribe();

    // Real-time subscription for AOD documents
    const aodChannel = supabase
      .channel('attorney-debts-aod')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'aod_documents',
        },
        (payload) => {
          console.log('AOD document change detected:', payload);
          fetchAttorneyDebts();
        }
      )
      .subscribe();

    // Real-time subscription for expert reports
    const reportsChannel = supabase
      .channel('attorney-debts-reports')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expert_reports',
        },
        (payload) => {
          console.log('Expert report change detected:', payload);
          fetchAttorneyDebts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(aodChannel);
      supabase.removeChannel(reportsChannel);
    };
  }, []);

  return {
    debtSummary,
    debtCases,
    loading,
    refetch: fetchAttorneyDebts,
  };
};
