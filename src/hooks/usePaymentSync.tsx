import { supabase } from "@/integrations/supabase/client";

/**
 * Bidirectional payment sync utility.
 * Keeps appointments, AOD documents, and short-term agreements in sync
 * when payments are captured on any one of the three.
 */

// Fetch linked assessments for an attorney (useful for showing in payment forms)
export const fetchLinkedAssessments = async (referringAttorneyId: string) => {
  try {
    const { data: appointments } = await supabase
      .from('appointments')
      .select(`
        id, appointment_date, service_fee, deposit_amount, payment_status, payment_date, payment_terms,
        claimants (first_name, last_name, auto_id),
        medical_experts (first_name, last_name, expert_type)
      `)
      .eq('referring_attorney_id', referringAttorneyId)
      .is('deleted_at', null)
      .order('appointment_date', { ascending: true });

    if (!appointments) return [];

    // Get expert report statuses
    const appointmentIds = appointments.map(a => a.id);
    const { data: reports } = await supabase
      .from('expert_reports')
      .select('appointment_id, report_status, payment_status')
      .in('appointment_id', appointmentIds);

    return appointments.map(apt => {
      const claimant = apt.claimants as any;
      const expert = apt.medical_experts as any;
      const report = reports?.find(r => r.appointment_id === apt.id);
      return {
        id: apt.id,
        appointmentDate: apt.appointment_date,
        claimantName: claimant ? `${claimant.first_name} ${claimant.last_name}` : 'Unknown',
        claimantAutoId: claimant?.auto_id || '',
        expertName: expert ? `${expert.first_name} ${expert.last_name}` : 'Unknown',
        expertType: expert?.expert_type || '',
        serviceFee: apt.service_fee || 0,
        depositAmount: apt.deposit_amount || 0,
        paymentStatus: apt.payment_status || 'pending',
        paymentDate: apt.payment_date,
        paymentTerms: apt.payment_terms || '',
        reportStatus: report?.report_status || 'pending',
        reportPaymentStatus: report?.payment_status || 'pending',
        balance: (apt.service_fee || 0) - (apt.deposit_amount || 0),
      };
    });
  } catch (error) {
    console.error('Error fetching linked assessments:', error);
    return [];
  }
};

// Sync appointment payment changes → AOD + Short-term agreements
export const syncAppointmentPaymentToAgreements = async (
  appointmentId: string,
  referringAttorneyId: string,
  paymentDifference: number,
  paymentDate: string
) => {
  const results = { aodSynced: false, shortTermSynced: false };

  try {
    // --- Sync to AOD Documents ---
    const { data: aodDoc } = await supabase
      .from('aod_documents')
      .select('id, total_contract_value, deposit_amount, payments_made, payment_status')
      .eq('referring_attorney_id', referringAttorneyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (aodDoc && paymentDifference !== 0) {
      await supabase
        .from('aod_payments')
        .insert({
          aod_document_id: aodDoc.id,
          payment_amount: Math.abs(paymentDifference),
          payment_date: paymentDate,
          payment_type: paymentDifference > 0 ? 'deposit' : 'refund',
          payment_notes: `Auto-synced from scheduled assessment payment`,
          reports_taken_out: 0,
        });

      await recalculateAODFromAppointments(aodDoc.id, referringAttorneyId);
      results.aodSynced = true;
    }

    // --- Sync to Short-term Agreements ---
    const { data: shortTermAgreements } = await supabase
      .from('short_term_agreements')
      .select('id, total_contract_value, deposit_amount, payments_made, payment_status, notes')
      .eq('referring_attorney_id', referringAttorneyId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (shortTermAgreements && shortTermAgreements.length > 0) {
      const matchingAgreement = shortTermAgreements.find(
        a => a.notes?.includes(appointmentId.substring(0, 8))
      ) || shortTermAgreements[0];

      await recalculateShortTermFromAppointments(matchingAgreement.id, referringAttorneyId);
      results.shortTermSynced = true;
    }
  } catch (error) {
    console.error('Error syncing appointment payment to agreements:', error);
  }

  return results;
};

// Sync AOD payment → appointments + short-term agreements
export const syncAODPaymentToAppointments = async (
  aodDocumentId: string,
  referringAttorneyId: string,
  paymentAmount: number,
  reportsCount: number,
  paymentType: string,
  paymentDate: string
) => {
  const results = { appointmentsSynced: 0, shortTermSynced: false };

  try {
    if (paymentType !== 'deposit' && reportsCount > 0) {
      // Regular/Final payment - allocate to oldest pending appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select('id, service_fee, deposit_amount, payment_status')
        .eq('referring_attorney_id', referringAttorneyId)
        .is('deleted_at', null)
        .in('payment_status', ['pending', 'deposit'])
        .order('appointment_date', { ascending: true })
        .limit(reportsCount);

      if (appointments && appointments.length > 0) {
        const paymentPerReport = paymentAmount / reportsCount;

        for (const appointment of appointments) {
          const currentDeposit = appointment.deposit_amount || 0;
          const serviceFee = appointment.service_fee || 0;
          const newDepositAmount = currentDeposit + paymentPerReport;

          let newPaymentStatus = 'pending';
          if (newDepositAmount > 0) {
            newPaymentStatus = newDepositAmount >= serviceFee ? 'full_payment' : 'deposit';
          }

          await supabase
            .from('appointments')
            .update({
              deposit_amount: newDepositAmount,
              payment_status: newPaymentStatus,
              payment_date: paymentDate
            })
            .eq('id', appointment.id);

          // Update expert report status
          await supabase
            .from('expert_reports')
            .update({
              report_status: 'taken_out',
              payment_status: 'paid',
              payment_date: paymentDate,
              updated_at: new Date().toISOString()
            })
            .eq('appointment_id', appointment.id);

          results.appointmentsSynced++;
        }
      }
    }

    // --- Sync to Short-term Agreements ---
    const { data: shortTermAgreements } = await supabase
      .from('short_term_agreements')
      .select('id')
      .eq('referring_attorney_id', referringAttorneyId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (shortTermAgreements) {
      await recalculateShortTermFromAppointments(shortTermAgreements.id, referringAttorneyId);
      results.shortTermSynced = true;
    }
  } catch (error) {
    console.error('Error syncing AOD payment to appointments:', error);
  }

  return results;
};

// Sync short-term payment → appointments + AOD
export const syncShortTermPaymentToAppointments = async (
  agreementId: string,
  referringAttorneyId: string,
  paymentAmount: number,
  reportsCount: number,
  paymentType: string,
  paymentDate: string
) => {
  const results = { appointmentsSynced: 0, aodSynced: false };

  try {
    if (paymentType !== 'deposit' && reportsCount > 0) {
      // Regular/Final payment — allocate to oldest pending short-term appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select('id, service_fee, deposit_amount, payment_status')
        .eq('referring_attorney_id', referringAttorneyId)
        .is('deleted_at', null)
        .eq('payment_terms', 'short-term')
        .in('payment_status', ['pending', 'deposit'])
        .order('appointment_date', { ascending: true })
        .limit(reportsCount);

      if (appointments && appointments.length > 0) {
        const paymentPerReport = paymentAmount / reportsCount;

        for (const appointment of appointments) {
          const currentDeposit = appointment.deposit_amount || 0;
          const serviceFee = appointment.service_fee || 0;
          const newDepositAmount = currentDeposit + paymentPerReport;

          let newPaymentStatus = 'pending';
          if (newDepositAmount > 0) {
            newPaymentStatus = newDepositAmount >= serviceFee ? 'full_payment' : 'deposit';
          }

          await supabase
            .from('appointments')
            .update({
              deposit_amount: newDepositAmount,
              payment_status: newPaymentStatus,
              payment_date: paymentDate
            })
            .eq('id', appointment.id);

          // Update expert report status
          await supabase
            .from('expert_reports')
            .update({
              report_status: 'taken_out',
              payment_status: 'paid',
              payment_date: paymentDate,
              updated_at: new Date().toISOString()
            })
            .eq('appointment_id', appointment.id);

          results.appointmentsSynced++;
        }
      }
    } else if (paymentType === 'deposit') {
      // Deposit — update the deposit on the oldest unpaid short-term appointment
      const { data: appointments } = await supabase
        .from('appointments')
        .select('id, service_fee, deposit_amount, payment_status')
        .eq('referring_attorney_id', referringAttorneyId)
        .is('deleted_at', null)
        .eq('payment_terms', 'short-term')
        .in('payment_status', ['pending'])
        .order('appointment_date', { ascending: true })
        .limit(1);

      if (appointments && appointments.length > 0) {
        const apt = appointments[0];
        const newDeposit = (apt.deposit_amount || 0) + paymentAmount;
        const serviceFee = apt.service_fee || 0;

        await supabase
          .from('appointments')
          .update({
            deposit_amount: newDeposit,
            payment_status: newDeposit >= serviceFee ? 'full_payment' : 'deposit',
            payment_date: paymentDate
          })
          .eq('id', apt.id);

        results.appointmentsSynced = 1;
      }
    }

    // Recalculate the short-term agreement totals
    await recalculateShortTermFromAppointments(agreementId, referringAttorneyId);

    // Also sync to AOD if one exists
    const { data: aodDoc } = await supabase
      .from('aod_documents')
      .select('id')
      .eq('referring_attorney_id', referringAttorneyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (aodDoc) {
      await recalculateAODFromAppointments(aodDoc.id, referringAttorneyId);
      results.aodSynced = true;
    }
  } catch (error) {
    console.error('Error syncing short-term payment to appointments:', error);
  }

  return results;
};

// Recalculate AOD document totals from all linked appointments
export const recalculateAODFromAppointments = async (
  aodDocumentId: string,
  referringAttorneyId: string
) => {
  try {
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, service_fee, deposit_amount, payment_status, payment_date')
      .eq('referring_attorney_id', referringAttorneyId)
      .is('deleted_at', null)
      .not('service_fee', 'is', null);

    if (!appointments) return;

    const totalContractValue = appointments.reduce((sum, a) => sum + (a.service_fee || 0), 0);
    const totalDeposits = appointments.reduce((sum, a) => sum + (a.deposit_amount || 0), 0);
    const totalReports = appointments.length;

    // Get actual aod_payments total
    const { data: aodPayments } = await supabase
      .from('aod_payments')
      .select('payment_amount')
      .eq('aod_document_id', aodDocumentId);

    const totalAODPayments = (aodPayments || []).reduce((sum, p) => sum + p.payment_amount, 0);
    const totalPaid = Math.max(totalDeposits, totalAODPayments);

    // Find last payment date from appointments
    const lastPaymentDate = appointments
      .filter(a => a.payment_date)
      .sort((a, b) => new Date(b.payment_date!).getTime() - new Date(a.payment_date!).getTime())[0]?.payment_date;

    let paymentStatus = 'pending';
    if (totalPaid >= totalContractValue && totalContractValue > 0) {
      paymentStatus = 'paid';
    } else if (totalPaid > 0) {
      paymentStatus = 'partial';
    }

    await supabase
      .from('aod_documents')
      .update({
        total_contract_value: totalContractValue,
        deposit_amount: totalDeposits,
        payment_status: paymentStatus,
        total_reports_agreed: totalReports,
        last_payment_date: lastPaymentDate || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', aodDocumentId);
  } catch (error) {
    console.error('Error recalculating AOD from appointments:', error);
  }
};

// Recalculate short-term agreement from linked appointments
export const recalculateShortTermFromAppointments = async (
  agreementId: string,
  referringAttorneyId: string
) => {
  try {
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, service_fee, deposit_amount, payment_status, payment_date')
      .eq('referring_attorney_id', referringAttorneyId)
      .is('deleted_at', null)
      .not('service_fee', 'is', null);

    if (!appointments) return;

    const totalContractValue = appointments.reduce((sum, a) => sum + (a.service_fee || 0), 0);
    const totalDeposits = appointments.reduce((sum, a) => sum + (a.deposit_amount || 0), 0);
    const totalReports = appointments.length;
    const reportsCompleted = appointments.filter(a => 
      a.payment_status === 'full_payment'
    ).length;

    // Find last payment date
    const lastPaymentDate = appointments
      .filter(a => a.payment_date)
      .sort((a, b) => new Date(b.payment_date!).getTime() - new Date(a.payment_date!).getTime())[0]?.payment_date;

    let paymentStatus: 'pending' | 'partial' | 'paid' = 'pending';
    if (totalDeposits >= totalContractValue && totalContractValue > 0) {
      paymentStatus = 'paid';
    } else if (totalDeposits > 0) {
      paymentStatus = 'partial';
    }

    await supabase
      .from('short_term_agreements')
      .update({
        total_contract_value: totalContractValue,
        deposit_amount: totalDeposits,
        payment_status: paymentStatus,
        total_reports_agreed: totalReports,
        reports_completed: reportsCompleted,
        payments_made: totalDeposits,
        last_payment_date: lastPaymentDate || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', agreementId);
  } catch (error) {
    console.error('Error recalculating short-term from appointments:', error);
  }
};
