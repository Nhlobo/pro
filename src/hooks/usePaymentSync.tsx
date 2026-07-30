import { supabase } from "@/integrations/supabase/client";
import { classifyPaymentTerms } from "@/utils/paymentTermsClassification";

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
  paymentDate: string,
  paymentNotes?: string | null
) => {
  const results: { appointmentsSynced: number; aodSynced: boolean; paymentId: string | null } =
    { appointmentsSynced: 0, aodSynced: false, paymentId: null };

  try {
    // Record the payment itself against the agreement. This was previously
    // missing entirely - payments were only reflected as side-effects on
    // appointments/AOD, with no row in short_term_agreement_payments, which
    // meant there was nothing to attach a Proof of Payment to.
    const { data: userData } = await supabase.auth.getUser();
    const { data: paymentRow, error: paymentInsertError } = await supabase
      .from('short_term_agreement_payments')
      .insert({
        agreement_id: agreementId,
        payment_amount: paymentAmount,
        payment_type: paymentType,
        payment_date: paymentDate,
        reports_taken_out: reportsCount || 0,
        payment_notes: paymentNotes || null,
        recorded_by: userData.user?.id || null,
      })
      .select()
      .single();

    if (paymentInsertError) {
      console.error('Error recording short-term agreement payment:', paymentInsertError);
    } else {
      results.paymentId = paymentRow?.id || null;
    }

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

// Helper: get appointments linked to an agreement.
// Preference order:
//   1. Explicit linked_appointment_ids array on the agreement row (most reliable)
//   2. Notes-text marker fallback ("APPOINTMENT:<uuid>" or "Appointment ID: <8-char>")
//   3. Heuristic filter on the attorney's appointments by payment_terms
const fetchLinkedAppointmentsForAgreement = async (
  referringAttorneyId: string,
  notes: string | null,
  termsFilter: 'aod' | 'short-term' | 'any',
  linkedAppointmentIds?: string[] | null,
) => {
  // 1. Explicit array on the agreement
  if (linkedAppointmentIds && linkedAppointmentIds.length > 0) {
    const { data: linked } = await supabase
      .from('appointments')
      .select('id, service_fee, deposit_amount, payment_status, payment_date, payment_terms, discount_rate, discount_amount')
      .in('id', linkedAppointmentIds)
      .is('deleted_at', null);
    if (linked && linked.length > 0) return linked;
  }

  // 2. Notes-text marker fallback (full UUID or 8-char prefix)
  const fullIdMatches = (notes || '').match(/APPOINTMENT:([0-9a-fA-F-]{36})/g) || [];
  const fullIds = fullIdMatches
    .map((m) => m.split(':').pop()?.trim())
    .filter((v): v is string => Boolean(v));

  const { data: allAppts } = await supabase
    .from('appointments')
    .select('id, service_fee, deposit_amount, payment_status, payment_date, payment_terms, discount_rate, discount_amount')
    .eq('referring_attorney_id', referringAttorneyId)
    .is('deleted_at', null);
  if (!allAppts) return [];

  if (fullIds.length > 0) {
    const matched = allAppts.filter((a: any) => fullIds.includes(a.id));
    if (matched.length > 0) return matched;
  }

  const idMatches = (notes || '').match(/Appointment ID:\s*([a-f0-9]{8})/gi) || [];
  const idPrefixes = idMatches
    .map((m) => m.split(':').pop()?.trim().toLowerCase())
    .filter((v): v is string => Boolean(v));

  if (idPrefixes.length > 0) {
    const matched = allAppts.filter((a: any) =>
      idPrefixes.some((p) => a.id.toLowerCase().startsWith(p))
    );
    if (matched.length > 0) return matched;
  }

  // 3. Fallback: filter by payment_terms heuristic
  return allAppts.filter((a: any) => {
    const pt = (a.payment_terms || '').toLowerCase();
    if (termsFilter === 'aod') return pt.includes('aod') || pt.includes('long');
    if (termsFilter === 'short-term') {
      return (
        pt.includes('short') ||
        pt.includes('immediate') ||
        pt.includes('30') ||
        pt.includes('60') ||
        pt.includes('90')
      );
    }
    return true;
  });
};

const computeStatusFromAppointments = (appts: any[]) => {
  // service_fee on appointments already reflects any per-assessment discount applied at booking time.
  const totalDebt = appts.reduce((s, a) => s + Number(a.service_fee || 0), 0);
  const totalDiscount = appts.reduce((s, a) => s + Number(a.discount_amount || 0), 0);
  const totalPaid = appts.reduce((s, a) => {
    const fee = Number(a.service_fee || 0);
    const dep = Number(a.deposit_amount || 0);
    // Treat full_payment as fully paid even if deposit_amount field lags
    return s + (a.payment_status === 'full_payment' ? fee : Math.min(dep, fee));
  }, 0);
  const allPaid = appts.length > 0 && appts.every((a) => a.payment_status === 'full_payment');
  const lastPaymentDate = appts
    .filter((a) => a.payment_date)
    .map((a) => a.payment_date)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

  let paymentStatus: 'pending' | 'partial' | 'paid' = 'pending';
  if (allPaid || (totalDebt > 0 && totalPaid >= totalDebt)) paymentStatus = 'paid';
  else if (totalPaid > 0) paymentStatus = 'partial';

  return { totalDebt, totalDiscount, totalPaid, paymentStatus, lastPaymentDate };
};

// Recalculate AOD document — pulls live totals from linked appointments so any
// per-assessment discount and payment captured on Scheduled Assessment is reflected.
export const recalculateAODFromAppointments = async (
  aodDocumentId: string,
  referringAttorneyId: string
) => {
  try {
    const { data: aodDoc } = await supabase
      .from('aod_documents')
      .select('total_contract_value, deposit_amount, payment_status, last_payment_date, notes, payments_made, linked_appointment_ids')
      .eq('id', aodDocumentId)
      .single();

    if (!aodDoc) return;

    const appts = await fetchLinkedAppointmentsForAgreement(
      referringAttorneyId,
      aodDoc.notes,
      'aod',
      (aodDoc as any).linked_appointment_ids
    );

    if (appts.length === 0) {
      // No linked appointments — fall back to legacy aod_payments-only reconciliation
      const { data: aodPayments } = await supabase
        .from('aod_payments')
        .select('payment_amount, payment_date')
        .eq('aod_document_id', aodDocumentId);

      const totalAODPayments = (aodPayments || []).reduce((s, p) => s + p.payment_amount, 0);
      const totalPaid = (aodDoc.deposit_amount || 0) + totalAODPayments;
      const contractValue = aodDoc.total_contract_value || 0;
      let paymentStatus = 'pending';
      if (totalPaid >= contractValue && contractValue > 0) paymentStatus = 'paid';
      else if (totalPaid > 0) paymentStatus = 'partial';

      if (paymentStatus !== aodDoc.payment_status) {
        await supabase
          .from('aod_documents')
          .update({ payment_status: paymentStatus, payments_made: totalAODPayments, updated_at: new Date().toISOString() })
          .eq('id', aodDocumentId);
      }
      return;
    }

    const { totalDebt, totalDiscount, totalPaid, paymentStatus, lastPaymentDate } = computeStatusFromAppointments(appts);

    await supabase
      .from('aod_documents')
      .update({
        total_contract_value: totalDebt,
        deposit_amount: totalPaid, // treat all confirmed payments as deposit/payments captured
        payments_made: Math.max(0, totalPaid - (aodDoc.deposit_amount || 0)),
        discount_amount: totalDiscount,
        total_reports_agreed: appts.length,
        reports_released: appts.filter((a) => a.payment_status === 'full_payment').length,
        payment_status: paymentStatus,
        last_payment_date: lastPaymentDate || aodDoc.last_payment_date,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', aodDocumentId);
  } catch (error) {
    console.error('Error recalculating AOD from appointments:', error);
  }
};

// Recalculate short-term agreement — pulls live totals from linked appointments.
export const recalculateShortTermFromAppointments = async (
  agreementId: string,
  referringAttorneyId: string
) => {
  try {
    const { data: agreement } = await supabase
      .from('short_term_agreements')
      .select('total_contract_value, deposit_amount, payments_made, payment_status, notes, linked_appointment_ids')
      .eq('id', agreementId)
      .single();

    if (!agreement) return;

    const appts = await fetchLinkedAppointmentsForAgreement(
      referringAttorneyId,
      agreement.notes,
      'short-term',
      (agreement as any).linked_appointment_ids
    );

    if (appts.length === 0) {
      const contractValue = agreement.total_contract_value || 0;
      const totalPaid = (agreement.deposit_amount || 0) + (agreement.payments_made || 0);
      let paymentStatus: 'pending' | 'partial' | 'paid' = 'pending';
      if (totalPaid >= contractValue && contractValue > 0) paymentStatus = 'paid';
      else if (totalPaid > 0) paymentStatus = 'partial';
      if (paymentStatus !== agreement.payment_status) {
        await supabase
          .from('short_term_agreements')
          .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
          .eq('id', agreementId);
      }
      return;
    }

    const { totalDebt, totalDiscount, totalPaid, paymentStatus, lastPaymentDate } = computeStatusFromAppointments(appts);

    await supabase
      .from('short_term_agreements')
      .update({
        total_contract_value: totalDebt,
        deposit_amount: totalPaid,
        payments_made: Math.max(0, totalPaid - Number(agreement.deposit_amount || 0)),
        discount_amount: totalDiscount,
        total_reports_agreed: appts.length,
        reports_completed: appts.filter((a) => a.payment_status === 'full_payment').length,
        payment_status: paymentStatus,
        last_payment_date: lastPaymentDate,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', agreementId);
  } catch (error) {
    console.error('Error recalculating short-term from appointments:', error);
  }
};

// Backfill short-term agreements from real appointments.
//
// Historically, a `short_term_agreements` row was only ever created via the
// New Appointment form's own trigger (or a manual "quick create" dialog).
// Any appointment booked outside that path — a bulk/CSV upload, a direct
// import, or an appointment whose payment terms were edited afterwards —
// never got a matching agreement row, so it silently never showed up on
// the Short-Term Agreements list even though it is a real short-term
// matter. This scans every appointment, classifies its Terms of Payment
// with the same logic used at booking time (classifyPaymentTerms), and
// creates or extends the matching attorney/month agreement for any
// appointment that isn't already linked to one — so the list always
// reflects the appointments that actually exist.
export const backfillShortTermAgreementsFromAppointments = async (): Promise<{ created: number; updated: number }> => {
  const result = { created: 0, updated: 0 };
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return result;

    const { data: appts } = await supabase
      .from('appointments')
      .select('id, referring_attorney_id, appointment_date, service_fee, deposit_amount, payment_status, payment_terms, agreement_duration_months, matter_type')
      .is('deleted_at', null)
      .not('payment_terms', 'is', null);

    if (!appts || appts.length === 0) return result;

    const shortTermAppts = appts.filter(
      (a: any) => classifyPaymentTerms(a.payment_terms, a.agreement_duration_months) === 'short-term'
    );
    if (shortTermAppts.length === 0) return result;

    // Never create agreements for the firm's own internal/system attorney records.
    const { data: systemAttorneys } = await supabase
      .from('referring_attorneys')
      .select('id')
      .eq('is_system_company', true);
    const systemIds = new Set((systemAttorneys || []).map((a) => a.id));
    const eligible = shortTermAppts.filter((a: any) => !systemIds.has(a.referring_attorney_id));
    if (eligible.length === 0) return result;

    const { data: existingAgreements } = await supabase
      .from('short_term_agreements')
      .select(
        'id, referring_attorney_id, contract_start_date, notes, linked_appointment_ids, total_contract_value, deposit_amount, total_reports_agreed, payment_status'
      );

    // Every appointment already linked to an agreement — via the explicit
    // linked_appointment_ids array or the older APPOINTMENT:<id> notes marker.
    const covered = new Set<string>();
    for (const ag of existingAgreements || []) {
      for (const id of ((ag as any).linked_appointment_ids || []) as string[]) covered.add(id);
      const matches = (ag.notes || '').match(/APPOINTMENT:([0-9a-fA-F-]{36})/g) || [];
      for (const m of matches) covered.add(m.split(':')[1]);
    }

    const uncovered = eligible.filter((a: any) => !covered.has(a.id));
    if (uncovered.length === 0) return result;

    // Group by attorney + calendar month — the same "one agreement per
    // attorney per month" convention already used when an agreement is
    // created from the New Appointment form.
    const groups: Record<string, any[]> = {};
    for (const a of uncovered) {
      const d = new Date(a.appointment_date);
      const key = `${a.referring_attorney_id}__${d.getFullYear()}-${d.getMonth()}`;
      (groups[key] ||= []).push(a);
    }

    for (const groupAppts of Object.values(groups)) {
      const attorneyId = groupAppts[0].referring_attorney_id;
      const startDate = new Date(groupAppts[0].appointment_date);
      const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
      const monthStartStr = monthStart.toISOString().split('T')[0];
      const monthEndStr = monthEnd.toISOString().split('T')[0];

      const totalValue = groupAppts.reduce((s, a) => s + (Number(a.service_fee) || 0), 0);
      const totalDeposit = groupAppts.reduce((s, a) => s + (Number(a.deposit_amount) || 0), 0);
      const apptIds = groupAppts.map((a) => a.id);
      const markers = apptIds.map((id) => `APPOINTMENT:${id}`).join('\n');
      const matterTypes = Array.from(new Set(groupAppts.map((a) => a.matter_type).filter(Boolean)));

      // An agreement may already exist for this attorney/month (created via
      // the New Appointment flow) without yet covering every appointment in
      // it — extend that one instead of creating a duplicate for the month.
      const existingForMonth = (existingAgreements || []).find(
        (ag: any) =>
          ag.referring_attorney_id === attorneyId &&
          ag.contract_start_date >= monthStartStr &&
          ag.contract_start_date <= monthEndStr
      );

      if (existingForMonth) {
        const newValue = (Number(existingForMonth.total_contract_value) || 0) + totalValue;
        const newDeposit = (Number(existingForMonth.deposit_amount) || 0) + totalDeposit;
        const mergedAppointmentIds = Array.from(
          new Set([...(((existingForMonth as any).linked_appointment_ids as string[]) || []), ...apptIds])
        );
        await supabase
          .from('short_term_agreements')
          .update({
            total_contract_value: newValue,
            deposit_amount: newDeposit,
            total_reports_agreed: (existingForMonth.total_reports_agreed || 0) + groupAppts.length,
            payment_status: newDeposit >= newValue && newValue > 0 ? 'paid' : existingForMonth.payment_status,
            notes: `${existingForMonth.notes || ''}\n${markers}`.trim(),
            linked_appointment_ids: mergedAppointmentIds,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', existingForMonth.id);
        result.updated++;
        continue;
      }

      const endDate = new Date(monthStart);
      endDate.setMonth(endDate.getMonth() + 3); // default short-term duration when none was specified

      const { error: insertError } = await supabase.from('short_term_agreements').insert({
        referring_attorney_id: attorneyId,
        created_by: userData.user.id,
        agreement_method: 'email',
        contract_description: `Short-Term Agreement for ${monthStart.getMonth() + 1}/${monthStart.getFullYear()}`,
        contract_start_date: monthStartStr,
        contract_end_date: endDate.toISOString().split('T')[0],
        total_contract_value: totalValue,
        deposit_amount: totalDeposit,
        total_reports_agreed: groupAppts.length,
        payment_status: totalDeposit >= totalValue && totalValue > 0 ? 'paid' : totalDeposit > 0 ? 'partial' : 'pending',
        status: 'active',
        notes: `Auto-synced from existing appointments.\n${markers}`,
        linked_appointment_ids: apptIds,
        matter_types: matterTypes.length > 0 ? matterTypes : null,
      } as any);

      if (insertError) {
        console.error('Error backfilling short-term agreement:', insertError);
        continue;
      }
      result.created++;
    }
  } catch (error) {
    console.error('Error backfilling short-term agreements from appointments:', error);
  }
  return result;
};
