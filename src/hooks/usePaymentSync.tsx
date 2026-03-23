import { supabase } from "@/integrations/supabase/client";

/**
 * Bidirectional payment sync utility.
 * Keeps appointments, AOD documents, and short-term agreements in sync
 * when payments are captured on any one of the three.
 */

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
      // Record AOD payment entry
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

      // Recalculate AOD totals from all linked appointments
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
      // Find the matching agreement (check if appointment ID is in notes)
      const matchingAgreement = shortTermAgreements.find(
        a => a.notes?.includes(appointmentId.substring(0, 8))
      ) || shortTermAgreements[0];

      // Recalculate from appointments
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
              payment_date: new Date().toISOString(),
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

// Recalculate AOD document totals from all linked appointments
export const recalculateAODFromAppointments = async (
  aodDocumentId: string,
  referringAttorneyId: string
) => {
  try {
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, service_fee, deposit_amount, payment_status')
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
        last_payment_date: new Date().toISOString(),
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
      .select('id, service_fee, deposit_amount, payment_status')
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
        updated_at: new Date().toISOString()
      })
      .eq('id', agreementId);
  } catch (error) {
    console.error('Error recalculating short-term from appointments:', error);
  }
};
