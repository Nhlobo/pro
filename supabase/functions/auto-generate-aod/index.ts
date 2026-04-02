import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AppointmentData {
  id: string;
  referring_attorney_id: string;
  payment_terms: string | null;
  service_fee: number | null;
  deposit_amount: number | null;
  agreement_duration_months: number | null;
  appointment_date: string;
  claimant_id: string;
  referring_attorney: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { record } = await req.json() as { record: AppointmentData };
    
    console.log('Auto AOD Generation triggered for appointment:', record.id);
    console.log('Payment terms:', record.payment_terms);

    // Check if payment terms includes AOD
    const paymentTermsLower = (record.payment_terms || '').toLowerCase();
    const isAOD = paymentTermsLower.includes('aod') || 
                  paymentTermsLower.includes('agreement on demand');

    if (!isAOD) {
      console.log('Not an AOD payment - skipping auto-generation');
      return new Response(
        JSON.stringify({ message: 'Not an AOD payment type', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate contract details
    const agreementDurationMonths = record.agreement_duration_months || 12;
    const totalContractValue = record.service_fee || 0;
    const depositAmount = record.deposit_amount || 0;
    const remainingBalance = totalContractValue - depositAmount;

    // Calculate payment plan based on duration
    let paymentPlanStructure = '';
    if (agreementDurationMonths <= 3) {
      paymentPlanStructure = '1-3 months payment plan';
    } else if (agreementDurationMonths <= 6) {
      paymentPlanStructure = '6 months payment plan';
    } else if (agreementDurationMonths <= 12) {
      paymentPlanStructure = '12 months payment plan';
    } else if (agreementDurationMonths <= 18) {
      paymentPlanStructure = '18 months payment plan';
    } else {
      paymentPlanStructure = '24 months payment plan';
    }

    // Calculate contract dates
    const appointmentDate = new Date(record.appointment_date);
    const contractStartDate = appointmentDate.toISOString().split('T')[0];
    const contractEndDate = new Date(appointmentDate);
    contractEndDate.setMonth(contractEndDate.getMonth() + agreementDurationMonths);
    const contractEndDateStr = contractEndDate.toISOString().split('T')[0];

    // Calculate next payment date (30 days from appointment)
    const nextPaymentDate = new Date(appointmentDate);
    nextPaymentDate.setDate(nextPaymentDate.getDate() + 30);

    // Get claimant information for description
    const { data: claimant } = await supabaseClient
      .from('claimants')
      .select('first_name, last_name, auto_id')
      .eq('id', record.claimant_id)
      .single();

    const claimantName = claimant 
      ? `${claimant.first_name} ${claimant.last_name}` 
      : 'Unknown Claimant';

    // Check for existing AOD document for this attorney (one AOD per attorney)
    const { data: existingAOD, error: checkError } = await supabaseClient
      .from('aod_documents')
      .select('*')
      .eq('referring_attorney_id', record.referring_attorney_id)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking for existing AOD:', checkError);
    }

    let aodDoc;

    if (existingAOD) {
      // Check if this appointment is already synced by looking in notes
      const existingNotes = existingAOD.notes || '';
      const appointmentMarker = `APPOINTMENT:${record.id}`;
      const isAlreadySynced = existingNotes.includes(appointmentMarker);

      if (isAlreadySynced) {
        console.log('Appointment already synced to AOD - skipping duplicate');
        return new Response(
          JSON.stringify({ 
            message: 'Appointment already synced to this AOD',
            skipped: true,
            aod_document_id: existingAOD.id,
            appointment_id: record.id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update existing AOD document with NEW appointment data only
      console.log('Updating existing AOD document with new appointment:', existingAOD.id);
      
      const updatedTotalValue = (existingAOD.total_contract_value || 0) + totalContractValue;
      const updatedDeposit = (existingAOD.deposit_amount || 0) + depositAmount;
      const updatedReports = (existingAOD.total_reports_agreed || 0) + 1;
      
      // Append appointment marker to notes for tracking
      const newNotes = existingNotes + `\n${appointmentMarker} - ${claimantName} (R${totalContractValue.toFixed(2)}, Deposit: R${depositAmount.toFixed(2)})`;

      const { data: updated, error: updateError } = await supabaseClient
        .from('aod_documents')
        .update({
          total_contract_value: updatedTotalValue,
          deposit_amount: updatedDeposit,
          total_reports_agreed: updatedReports,
          payment_status: updatedDeposit >= updatedTotalValue ? 'paid' : (updatedDeposit > 0 ? 'partial' : 'pending'),
          notes: newNotes,
          contract_description: `AOD for ${record.referring_attorney} (${updatedReports} assessments)`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingAOD.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating AOD document:', updateError);
        throw updateError;
      }

      aodDoc = updated;
      console.log('AOD document updated successfully with new appointment');
    } else {
      // Create new AOD document entry (first AOD for this attorney)
      console.log('Creating new AOD document for attorney:', record.referring_attorney);
      
      const appointmentMarker = `APPOINTMENT:${record.id}`;
      
      const aodDocumentData = {
        referring_attorney_id: record.referring_attorney_id,
        document_url: '',
        file_name: `AUTO_AOD_${record.referring_attorney_id}.pdf`,
        contract_description: `AOD for ${record.referring_attorney}`,
        contract_start_date: contractStartDate,
        contract_end_date: contractEndDateStr,
        payment_plan_structure: paymentPlanStructure,
        payment_due_date: nextPaymentDate.toISOString(),
        deposit_amount: depositAmount,
        total_contract_value: totalContractValue,
        total_reports_agreed: 1,
        payments_made: 0,
        payment_status: depositAmount >= totalContractValue ? 'paid' : (depositAmount > 0 ? 'partial' : 'pending'),
        next_payment_date: depositAmount >= totalContractValue ? null : nextPaymentDate.toISOString(),
        notes: `Auto-generated AOD\n${appointmentMarker} - ${claimantName} (R${totalContractValue.toFixed(2)}, Deposit: R${depositAmount.toFixed(2)})`,
        uploaded_by: record.referring_attorney_id,
        auto_triggered: true,
        trigger_reason: 'new_appointment',
      };

      // Set interest rates based on payment plan
      if (agreementDurationMonths <= 3) {
        aodDocumentData['interest_rate_1_3_months'] = 5.0;
      } else if (agreementDurationMonths <= 6) {
        aodDocumentData['interest_rate_6_months'] = 7.5;
      } else if (agreementDurationMonths <= 12) {
        aodDocumentData['interest_rate_12_months'] = 10.0;
      } else if (agreementDurationMonths <= 18) {
        aodDocumentData['interest_rate_18_months'] = 12.5;
      } else {
        aodDocumentData['interest_rate_24_months'] = 15.0;
      }

      const { data: created, error: createError } = await supabaseClient
        .from('aod_documents')
        .insert(aodDocumentData)
        .select()
        .single();

      if (createError) {
        console.error('Error creating AOD document:', createError);
        throw createError;
      }

      aodDoc = created;
      console.log('AOD document created successfully');
    }

    console.log('AOD document auto-generated successfully:', aodDoc.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'AOD document auto-generated successfully',
        aod_document_id: aodDoc.id,
        appointment_id: record.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in auto-generate-aod function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
