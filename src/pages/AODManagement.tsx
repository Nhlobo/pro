import { useEffect, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, FileCheck, FileText, Users, CheckCircle2, RefreshCw, PlusCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AODDocumentManager } from "@/components/AODDocumentManager";
import { AODPaymentMonitor } from "@/components/AODPaymentMonitor";
import { ShortTermAgreementManager } from "@/components/ShortTermAgreementManager";
import { AODTemplateGenerator } from "@/components/AODTemplateGenerator";
import { AODGroupedView } from "@/components/AODGroupedView";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CompanyFooter from "@/components/CompanyFooter";
import { deduplicateAttorneys } from "@/utils/deduplicateAttorneys";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";
import { consolidateDuplicateAgreements } from "@/utils/consolidateAgreements";
import { Loader2, Wand2 } from "lucide-react";

const AODManagement = () => {
  const [attorneys, setAttorneys] = useState<any[]>([]);
  const [lawFirmId, setLawFirmId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [consolidating, setConsolidating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  type SyncEntry = {
    key: string;
    label: string;
    kind: "AOD" | "Short-Term";
    status: "created" | "updated" | "uptodate" | "error";
    detail: string;
    newCount?: number;
    totalCount?: number;
  };
  const [syncEntries, setSyncEntries] = useState<SyncEntry[]>([]);
  const [syncSummary, setSyncSummary] = useState<{ created: number; updated: number; uptodate: number }>({ created: 0, updated: 0, uptodate: 0 });
  const { toast } = useToast();
  const { triggerSync } = useAppointmentSync();

  const refetch = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const pushEntry = (entry: SyncEntry) => {
    setSyncEntries(prev => [...prev, entry]);
    setSyncSummary(prev => ({
      created: prev.created + (entry.status === "created" ? 1 : 0),
      updated: prev.updated + (entry.status === "updated" ? 1 : 0),
      uptodate: prev.uptodate + (entry.status === "uptodate" ? 1 : 0),
    }));
  };

  const syncAppointmentsToAOD = async (specificAttorneyId?: string) => {
    setSyncing(true);
    setSyncEntries([]);
    setSyncSummary({ created: 0, updated: 0, uptodate: 0 });
    setSyncDialogOpen(true);
    console.log('🔄 Manual sync triggered', specificAttorneyId ? `for attorney: ${specificAttorneyId}` : 'for all attorneys');
    
    try {
      // Get all scheduled assessments using the secure RPC function
      const { data: assessments, error: appointmentsError } = await supabase
        .rpc('get_scheduled_assessments_secure');

      if (appointmentsError) {
        console.error('Error fetching scheduled assessments:', appointmentsError);
        toast({
          title: "Sync Failed",
          description: appointmentsError.message,
          variant: "destructive",
        });
        return;
      }

      if (!assessments || assessments.length === 0) {
        toast({
          title: "No Assessments",
          description: "No scheduled assessments found",
        });
        return;
      }

      // Get referring attorney details to filter out system companies
      const { data: referringAttorneys, error: attorneyError } = await supabase
        .from('referring_attorneys')
        .select('id, name, is_system_company')
        .in('id', [...new Set(assessments.map((a: any) => a.referring_attorney_id))]);

      if (attorneyError) {
        console.error('Error fetching attorneys:', attorneyError);
        toast({
          title: "Sync Failed",
          description: "Failed to fetch attorney details",
          variant: "destructive",
        });
        return;
      }

      // Filter by specific attorney if provided and filter for scheduled/assessed status
      // Also filter out system companies (like Kutlwano associate)
      let filteredAssessments = assessments.filter((apt: any) => {
        const attorney = referringAttorneys?.find((ra: any) => ra.id === apt.referring_attorney_id);
        const isNotSystemCompany = !attorney?.is_system_company;
        const matchesAttorney = !specificAttorneyId || apt.referring_attorney_id === specificAttorneyId;
        const hasValidStatus = apt.case_status === 'scheduled' || apt.case_status === 'assessed';
        const hasServiceFee = apt.service_fee != null;
        
        return isNotSystemCompany && matchesAttorney && hasValidStatus && hasServiceFee;
      });

      // Map the RPC response to match the expected format
      const appointments = filteredAssessments.map((apt: any) => ({
        id: apt.appointment_id,
        referring_attorney_id: apt.referring_attorney_id,
        service_fee: apt.service_fee,
        deposit_amount: apt.deposit_amount,
        case_status: apt.case_status,
        referring_attorney: apt.referring_attorney,
        payment_terms: null, // Will need to fetch separately if needed
        agreement_duration_months: null, // Will need to fetch separately if needed
        appointment_date: apt.appointment_date,
        claimant_id: apt.claimant_auto_id,
        claimants: {
          auto_id: apt.claimant_auto_id,
          first_name: apt.claimant_name?.split(' ')[0] || '',
          last_name: apt.claimant_name?.split(' ').slice(1).join(' ') || '',
          referring_attorney_id: apt.referring_attorney_id
        }
      }));

      // Fetch full appointment details including payment_terms and agreement_duration_months
      const appointmentIds = appointments.map((apt: any) => apt.id);
      const { data: fullAppointments } = await supabase
        .from('appointments')
        .select('id, payment_terms, agreement_duration_months')
        .in('id', appointmentIds);

      // Merge the payment terms data
      const appointmentsWithClaimants = appointments.map((apt: any) => {
        const fullApt = fullAppointments?.find((fa: any) => fa.id === apt.id);
        return {
          ...apt,
          payment_terms: fullApt?.payment_terms,
          agreement_duration_months: fullApt?.agreement_duration_months
        };
      });

      // Filter appointments with debt
      const appointmentsWithDebt = appointmentsWithClaimants.filter(apt => {
        const balance = (apt.service_fee || 0) - (apt.deposit_amount || 0);
        return balance > 0;
      });

      console.log(`Found ${appointmentsWithDebt.length} appointments with outstanding balance`);

      if (appointmentsWithDebt.length === 0) {
        toast({
          title: "No Outstanding Balances",
          description: "All appointments are fully paid",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Separate appointments into AOD and Short-Term based on payment terms
      // AOD: When "AOD (Agreement on Demand)" is selected
      // Short-Term: When "Short-Term Agreement", "30 Days", "60 Days", "90 Days", or "Immediate Payment" is selected
      const aodAppointments: any[] = [];
      const shortTermAppointments: any[] = [];

      appointmentsWithDebt.forEach(apt => {
        const paymentTerm = (apt.payment_terms || '').toLowerCase();
        
        // AOD Document is triggered when "AOD (Agreement on Demand)" is selected
        const isAOD = paymentTerm === 'aod' || 
                      paymentTerm.includes('agreement on demand') ||
                      (apt.agreement_duration_months && apt.agreement_duration_months >= 12);
        
        // Short-Term Agreement is triggered for: short-term, 30-days, 60-days, 90-days, immediate
        const isShortTerm = paymentTerm === 'short-term' ||
                           paymentTerm === '30-days' ||
                           paymentTerm === '60-days' ||
                           paymentTerm === '90-days' ||
                           paymentTerm === 'immediate' ||
                           paymentTerm.includes('short') ||
                           paymentTerm.includes('day') ||
                           (apt.agreement_duration_months && apt.agreement_duration_months < 12);
        
        if (isAOD) {
          aodAppointments.push(apt);
        } else if (isShortTerm || !paymentTerm) {
          // Default to short-term if no payment term specified or if it's a short-term type
          shortTermAppointments.push(apt);
        } else {
          // Fallback: if payment term is set but doesn't match known patterns, use duration
          if (apt.agreement_duration_months && apt.agreement_duration_months >= 12) {
            aodAppointments.push(apt);
          } else {
            shortTermAppointments.push(apt);
          }
        }
      });

      console.log(`AOD appointments: ${aodAppointments.length}, Short-term: ${shortTermAppointments.length}`);

      let aodCount = 0;
      let shortTermCount = 0;

      // Process AOD Documents - GROUP BY MONTH AND ATTORNEY (ONLY NEW/UPDATED APPOINTMENTS)
      if (aodAppointments.length > 0) {
        console.log(`Processing ${aodAppointments.length} appointments for monthly AOD grouping`);
        
        // Group appointments by attorney and month
        const groupedByAttorneyMonth = new Map<string, any[]>();
        
        for (const apt of aodAppointments) {
          const appointmentDate = new Date(apt.appointment_date);
          const monthKey = `${apt.referring_attorney_id}_${appointmentDate.getFullYear()}_${appointmentDate.getMonth()}`;
          
          if (!groupedByAttorneyMonth.has(monthKey)) {
            groupedByAttorneyMonth.set(monthKey, []);
          }
          groupedByAttorneyMonth.get(monthKey)!.push(apt);
        }
        
        console.log(`Grouped into ${groupedByAttorneyMonth.size} monthly AOD documents`);
        
        // Process each attorney-month group
        for (const [monthKey, appointments] of groupedByAttorneyMonth.entries()) {
          const firstApt = appointments[0];
          const firmId = firstApt.referring_attorney_id;
          
          // Fetch attorney name and check if it's a system company
          const { data: attorneyData } = await supabase
            .from('referring_attorneys')
            .select('name, contact_person, is_system_company')
            .eq('id', firmId)
            .single();
          
          // Skip system companies (like Kutlwano Associate)
          if (attorneyData?.is_system_company) {
            console.log(`⏭️ Skipping system company: ${attorneyData.name}`);
            continue;
          }
          
          const referringAttorneyName = attorneyData?.name || firstApt.referring_attorney || 'Unknown Referring Attorney';
          const appointmentDate = new Date(firstApt.appointment_date);
          const monthYear = appointmentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          
          console.log(`Processing monthly AOD for ${referringAttorneyName} - ${monthYear} (${appointments.length} assessments)`);
          
          // Get appointment IDs for this group
          const appointmentIds = appointments.map(apt => apt.id);

          // Check if monthly AOD document exists for this attorney-month
          const monthIdentifier = `MONTHLY_AOD:${firmId}:${appointmentDate.getFullYear()}-${String(appointmentDate.getMonth() + 1).padStart(2, '0')}`;
          const existingDocs = await supabase
            .from('aod_documents')
            .select('id, contract_description, notes, total_contract_value, deposit_amount, total_reports_agreed, reports_released')
            .eq('referring_attorney_id', firmId);

          const existing = existingDocs?.data?.find(doc => 
            doc.notes?.includes(monthIdentifier)
          ) || null;

          // Parse existing synced appointments from notes to avoid duplicates
          let existingSyncedAppointmentIds: string[] = [];
          if (existing?.notes) {
            const appointmentMatches = existing.notes.match(/APPOINTMENT:([a-f0-9-]+)/g);
            if (appointmentMatches) {
              existingSyncedAppointmentIds = appointmentMatches.map((m: string) => m.replace('APPOINTMENT:', ''));
            }
          }

          // Filter to only NEW appointments not already synced
          const newAppointments = appointments.filter(apt => !existingSyncedAppointmentIds.includes(apt.id));
          
          if (existing && newAppointments.length === 0) {
            // No new appointments - just refresh report status counts
            const { data: expertReportsData } = await supabase
              .from('expert_reports')
              .select('id, report_status, appointment_id')
              .in('appointment_id', existingSyncedAppointmentIds);

            const completedReportStatuses = [
              'report_submitted_on_aod', 'report_fully_paid_submitted', 'taken_out',
              'completed', 'received', 'released'
            ];

            const reportsReleased = expertReportsData?.filter(report =>
              completedReportStatuses.some(status =>
                report.report_status?.toLowerCase().includes(status.toLowerCase().replace(/_/g, ' ')) ||
                report.report_status?.toLowerCase().replace(/_/g, ' ') === status.toLowerCase()
              )
            ).length || 0;

            if (reportsReleased !== (existing.reports_released || 0)) {
              await supabase
                .from('aod_documents')
                .update({ reports_released: reportsReleased, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
            }
            pushEntry({
              key: monthKey,
              label: `${referringAttorneyName} — ${monthYear}`,
              kind: "AOD",
              status: "uptodate",
              detail: `Already synced · ${existingSyncedAppointmentIds.length} assessment(s)`,
              totalCount: existingSyncedAppointmentIds.length,
              newCount: 0,
            });
            continue;
          }

          // ALWAYS recompute totals from union of synced appointment IDs to prevent
          // any double-counting of payments captured from scheduled assessments.
          const allAppointmentIds: string[] = Array.from(new Set([
            ...existingSyncedAppointmentIds,
            ...appointments.map(a => a.id),
          ]));

          const { data: truthAppointments } = await supabase
            .from('appointments')
            .select('id, service_fee, deposit_amount')
            .in('id', allAppointmentIds)
            .is('deleted_at', null);

          const truthList = truthAppointments || [];
          const totalValue = truthList.reduce((s, a: any) => s + (a.service_fee || 0), 0);
          const totalDeposit = truthList.reduce((s, a: any) => s + (a.deposit_amount || 0), 0);
          const totalReports = truthList.length;

          const outstanding = totalValue - totalDeposit;

          // Fetch completed reports count from expert_reports table
          const { data: expertReportsData } = await supabase
            .from('expert_reports')
            .select('id, report_status, appointment_id')
            .in('appointment_id', allAppointmentIds);

          const completedReportStatuses = [
            'report_submitted_on_aod', 'report_fully_paid_submitted', 'taken_out',
            'completed', 'received', 'released'
          ];
          
          const reportsReleased = expertReportsData?.filter(report => 
            completedReportStatuses.some(status => 
              report.report_status?.toLowerCase().includes(status.toLowerCase().replace(/_/g, ' ')) ||
              report.report_status?.toLowerCase().replace(/_/g, ' ') === status.toLowerCase()
            )
          ).length || 0;

          console.log(`📊 AOD Reports: ${totalReports} assessments, ${reportsReleased} reports released`);

          // Build appointment details list for ALL synced appointments
          const appointmentsToDocument = existing ? newAppointments : appointments;
          const appointmentDetails = appointmentsToDocument.map(apt => {
            const claimantData = apt.claimants;
            const claimantId = claimantData?.auto_id || apt.claimant_id;
            const claimantName = claimantData ? `${claimantData.first_name} ${claimantData.last_name}` : 'Unknown';
            const aptValue = apt.service_fee || 0;
            const aptDeposit = apt.deposit_amount || 0;
            return `APPOINTMENT:${apt.id}|${claimantName} (${claimantId})|R${aptValue.toFixed(2)}|Deposit: R${aptDeposit.toFixed(2)}|Date: ${new Date(apt.appointment_date).toLocaleDateString()}`;
          }).join('\n');

          const newDescription = `AOD - ${referringAttorneyName} - ${monthYear} (${totalReports} Assessments)`;
          const newFileName = `AOD Agreement - ${referringAttorneyName} - ${monthYear.replace(' ', '_')}`;

          if (existing) {
            // Append new appointment details to existing notes
            const updatedNotes = `${existing.notes}\n\n--- NEW SYNC ${new Date().toLocaleDateString()} ---\nAdded ${newAppointments.length} new assessments:\n${appointmentDetails}`;
            
            await supabase
              .from('aod_documents')
              .update({
                total_contract_value: totalValue,
                deposit_amount: totalDeposit,
                payment_status: outstanding > 0 ? 'pending' : 'paid',
                total_reports_agreed: totalReports,
                reports_released: reportsReleased,
                contract_description: newDescription,
                file_name: newFileName,
                notes: updatedNotes,
                linked_appointment_ids: allAppointmentIds,
                updated_at: new Date().toISOString(),
              } as any)
              .eq('id', existing.id);
            
            console.log(`✅ Updated monthly AOD for ${referringAttorneyName} - ${monthYear} (+${newAppointments.length} new, total: ${totalReports} assessments)`);
            pushEntry({
              key: monthKey,
              label: `${referringAttorneyName} — ${monthYear}`,
              kind: "AOD",
              status: "updated",
              detail: `+${newAppointments.length} new · Total R${totalValue.toFixed(2)} · Paid R${totalDeposit.toFixed(2)} · Recomputed from ${totalReports} assessments`,
              newCount: newAppointments.length,
              totalCount: totalReports,
            });
          } else {
            const startDate = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), 1);
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 12);

            const linkedAppointmentNote = `${monthIdentifier}
Monthly Consolidated AOD
Referring Attorney: ${referringAttorneyName}
Period: ${monthYear}
Total Assessments: ${totalReports}
Reports Released: ${reportsReleased}
Total Value: R${totalValue.toFixed(2)}
Total Deposits: R${totalDeposit.toFixed(2)}
Outstanding Balance: R${outstanding.toFixed(2)}
Synced on ${new Date().toLocaleDateString()}

ASSESSMENT DETAILS:
${appointmentDetails}`;

            await supabase
              .from('aod_documents')
              .insert({
                referring_attorney_id: firmId,
                uploaded_by: user.id,
                contract_description: newDescription,
                contract_start_date: startDate.toISOString().split('T')[0],
                contract_end_date: endDate.toISOString().split('T')[0],
                total_contract_value: totalValue,
                deposit_amount: totalDeposit,
                payment_status: outstanding > 0 ? 'pending' : 'paid',
                total_reports_agreed: totalReports,
                reports_released: reportsReleased,
                file_name: newFileName,
                document_url: 'pending',
                notes: linkedAppointmentNote,
                linked_appointment_ids: allAppointmentIds,
              } as any);

            console.log(`✅ Created monthly AOD for ${referringAttorneyName} - ${monthYear} (${totalReports} assessments, ${reportsReleased} reports released)`);
            pushEntry({
              key: monthKey,
              label: `${referringAttorneyName} — ${monthYear}`,
              kind: "AOD",
              status: "created",
              detail: `New · ${totalReports} assessment(s) · Total R${totalValue.toFixed(2)} · Paid R${totalDeposit.toFixed(2)}`,
              newCount: totalReports,
              totalCount: totalReports,
            });
          }
          aodCount++;
        }
      }

      // Process Short-Term Agreements (each appointment gets its own agreement) - ONLY NEW/CHANGED
      if (shortTermAppointments.length > 0) {
        console.log(`Processing ${shortTermAppointments.length} individual appointments for Short-Term`);

        for (const apt of shortTermAppointments) {
          const claimantData = apt.claimants;
          const firmId = apt.referring_attorney_id;
          
          // Fetch attorney name and check if it's a system company
          const { data: attorneyData } = await supabase
            .from('referring_attorneys')
            .select('name, contact_person, is_system_company')
            .eq('id', firmId)
            .single();
          
          // Skip system companies (like Kutlwano Associate)
          if (attorneyData?.is_system_company) {
            console.log(`⏭️ Skipping system company: ${attorneyData.name}`);
            continue;
          }
          
          const referringAttorneyName = attorneyData?.name || apt.referring_attorney || 'Unknown Referring Attorney';
          
          const totalValue = apt.service_fee || 0;
          const totalDeposit = apt.deposit_amount || 0;
          const outstanding = totalValue - totalDeposit;

          // Get claimant info from joined data
          const claimantId = claimantData?.auto_id || apt.claimant_id;
          const claimantName = claimantData ? `${claimantData.first_name} ${claimantData.last_name}` : 'Unknown';

          // Check if short-term agreement exists for this specific appointment
          const appointmentIdentifier = `APPOINTMENT:${apt.id}`;
          const existingAgreementsResult = await supabase
            .from('short_term_agreements')
            .select('id, contract_description, notes, total_contract_value, deposit_amount')
            .eq('referring_attorney_id', firmId);
          
          const existingAgreements = existingAgreementsResult.data || [];
          const existing = existingAgreements.find((ag: any) => 
            ag.notes?.includes(appointmentIdentifier)
          ) || null;

          // Skip if already synced with same values (no changes)
          if (existing) {
            const existingValue = existing.total_contract_value || 0;
            const existingDeposit = existing.deposit_amount || 0;
            
            if (existingValue === totalValue && existingDeposit === totalDeposit) {
              // Only fetch and update report status
              const { data: expertReportData } = await supabase
                .from('expert_reports')
                .select('id, report_status')
                .eq('appointment_id', apt.id);

              const completedReportStatuses = [
                'report_submitted_on_aod', 'report_fully_paid_submitted', 'taken_out',
                'completed', 'received', 'released'
              ];
              
              const reportsCompleted = expertReportData?.filter(report => 
                completedReportStatuses.some(status => 
                  report.report_status?.toLowerCase().includes(status.toLowerCase().replace(/_/g, ' ')) ||
                  report.report_status?.toLowerCase().replace(/_/g, ' ') === status.toLowerCase()
                )
              ).length || 0;

              // Update only reports_completed field
              await supabase
                .from('short_term_agreements')
                .update({
                  reports_completed: reportsCompleted,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

              console.log(`⏭️ No value changes for ${referringAttorneyName} - ${claimantName}, updated report status only`);
              pushEntry({
                key: `st_${apt.id}`,
                label: `${referringAttorneyName} — ${claimantName}`,
                kind: "Short-Term",
                status: "uptodate",
                detail: `Already synced · R${totalValue.toFixed(2)} (Paid R${totalDeposit.toFixed(2)})`,
                newCount: 0,
                totalCount: 1,
              });
              continue;
            }
          }

          // Fetch report status for this appointment
          const { data: expertReportData } = await supabase
            .from('expert_reports')
            .select('id, report_status')
            .eq('appointment_id', apt.id);

          const completedReportStatuses = [
            'report_submitted_on_aod', 'report_fully_paid_submitted', 'taken_out',
            'completed', 'received', 'released'
          ];
          
          const reportsCompleted = expertReportData?.filter(report => 
            completedReportStatuses.some(status => 
              report.report_status?.toLowerCase().includes(status.toLowerCase().replace(/_/g, ' ')) ||
              report.report_status?.toLowerCase().replace(/_/g, ' ') === status.toLowerCase()
            )
          ).length || 0;

          console.log(`📊 Short-Term Report: ${reportsCompleted} reports completed for appointment ${apt.id}`);

          // Extract payment terms duration
          const paymentTerms = apt.payment_terms || '90-days';
          let durationMonths = 3;
          if (paymentTerms.includes('30') || paymentTerms.includes('1-month')) {
            durationMonths = 1;
          } else if (paymentTerms.includes('60') || paymentTerms.includes('2-month')) {
            durationMonths = 2;
          } else if (paymentTerms.includes('90') || paymentTerms.includes('3-month')) {
            durationMonths = 3;
          } else if (paymentTerms.includes('6-month')) {
            durationMonths = 6;
          }

          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + durationMonths);

          const newDescription = `Short-Term - ${referringAttorneyName} - ${claimantName}`;
          const newFileName = `Short-Term Agreement - ${referringAttorneyName} - ${claimantId}`;
          const linkedAppointmentNote = `${appointmentIdentifier}\nScheduled Appointment Date: ${new Date(apt.appointment_date).toLocaleDateString()}\nReferring Attorney: ${referringAttorneyName}\nClaimant: ${claimantName} (${claimantId})\nOutstanding Debt: R${outstanding.toFixed(2)}\nTotal Value: R${totalValue.toFixed(2)}\nPaid: R${totalDeposit.toFixed(2)}\nReports Completed: ${reportsCompleted}\nSynced from scheduled assessments on ${new Date().toLocaleDateString()}`;

          if (existing) {
            await supabase
              .from('short_term_agreements')
              .update({
                total_contract_value: totalValue,
                deposit_amount: totalDeposit,
                payment_status: outstanding > 0 ? 'pending' : 'paid',
                total_reports_agreed: 1,
                reports_completed: reportsCompleted,
                payment_plan_structure: paymentTerms,
                contract_description: newDescription,
                contract_end_date: endDate.toISOString().split('T')[0],
                file_name: newFileName,
                notes: linkedAppointmentNote,
                linked_appointment_ids: [apt.id],
                updated_at: new Date().toISOString(),
              } as any)
              .eq('id', existing.id);
            
            console.log(`✅ Updated Short-Term Agreement for ${referringAttorneyName} - ${claimantName} (values changed)`);
          } else {
            await supabase
              .from('short_term_agreements')
              .insert({
                referring_attorney_id: firmId,
                created_by: user.id,
                agreement_method: 'email',
                contract_description: newDescription,
                contract_start_date: startDate.toISOString().split('T')[0],
                contract_end_date: endDate.toISOString().split('T')[0],
                total_contract_value: totalValue,
                deposit_amount: totalDeposit,
                payment_status: outstanding > 0 ? 'pending' : 'paid',
                payment_plan_structure: paymentTerms,
                total_reports_agreed: 1,
                reports_completed: reportsCompleted,
                file_name: newFileName,
                notes: linkedAppointmentNote,
                linked_appointment_ids: [apt.id],
                status: 'active'
              } as any);

            console.log(`✅ Created Short-Term Agreement for ${referringAttorneyName} - ${claimantName} (${reportsCompleted} reports completed)`);
          }
          shortTermCount++;
        }
      }

      const attorneyInfo = specificAttorneyId 
        ? `for ${attorneys.find(a => a.id === specificAttorneyId)?.name || 'selected attorney'}`
        : 'for all attorneys';
      
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${aodCount} AOD${aodCount !== 1 ? 's' : ''} and ${shortTermCount} short-term agreement${shortTermCount !== 1 ? 's' : ''} ${attorneyInfo}`,
      });

      // Refresh data without page reload
      triggerSync();
      refetch();

    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: "Sync Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user's referring attorney organization
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: profile } = await supabase
          .from("profiles")
          .select("referring_attorney_id, role")
          .eq("id", user.id)
          .single();

        // For admin/employee users without referring_attorney_id, get system company
        if (profile?.referring_attorney_id) {
          setLawFirmId(profile.referring_attorney_id);
        } else if (profile?.role === 'admin' || profile?.role === 'employee') {
          // Get system company referring attorney
          const { data: systemCompany } = await supabase
            .from("referring_attorneys")
            .select("id")
            .eq("is_system_company", true)
            .single();
          
          if (systemCompany?.id) {
            setLawFirmId(systemCompany.id);
          } else {
            toast({
              title: "Configuration Error",
              description: "System company not found. Please contact administrator.",
              variant: "destructive",
            });
          }
        }

        // Fetch referring attorneys from referring_attorneys table (exclude system companies)
        console.log("Fetching referring attorneys...");
        const { data: attorneysData, error } = await supabase
          .rpc('get_referring_attorneys_list');

        console.log("Referring attorneys query result:", { attorneysData, error });

        if (error) {
          console.error("Error fetching referring attorneys:", error);
          toast({
            title: "Error fetching referring attorneys",
            description: error.message,
            variant: "destructive",
          });
          throw error;
        }
        
        // Filter out system companies (e.g., Kutlwano Associate)
        const nonSystemAttorneys = (attorneysData || []).filter((att: any) => !att.is_system_company);
        console.log("Filtered out system companies, remaining attorneys:", nonSystemAttorneys);
        const deduplicated = deduplicateAttorneys(nonSystemAttorneys);
        console.log("Deduplicated attorneys:", deduplicated);
        setAttorneys(deduplicated);
      } catch (error: any) {
        console.error("Fetch data error:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to load data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/aod-management';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>AOD Management - Referring Attorney Agreements & Payment Tracking</title>
        <meta 
          name="description" 
          content="Manage Acknowledgement of Debts documents, payment plans, interest rates, and referring attorney agreements for medico-legal assessments." 
        />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 opacity-70 blur-3xl bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.25),transparent_60%)]" />
        <div className="container mx-auto px-4 py-10">
          <div className="relative">
            <Link to="/" className="inline-block mb-4">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <FileCheck className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl md:text-4xl font-bold">AOD & Payment Management</h1>
                <p className="text-muted-foreground mt-2 max-w-2xl">
                  Manage Acknowledgement of Debts (AOD), payment plans, and interest rates for referring attorneys
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-end gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Master AOD Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Master AOD Agreement Template</DialogTitle>
                  </DialogHeader>
                  <AODTemplateGenerator />
                </DialogContent>
              </Dialog>
              <Link to="/aod-balance-summary">
                <Button variant="outline" className="gap-2">
                  <FileCheck className="h-4 w-4" />
                  View Balance Summary
                </Button>
              </Link>
              <Button
                onClick={async () => {
                  setConsolidating(true);
                  try {
                    const r = await consolidateDuplicateAgreements();
                    toast({
                      title: "Consolidation Complete",
                      description: `Processed ${r.attorneysProcessed} attorneys · merged ${r.aodMerged} duplicate AOD(s) and ${r.shortTermMerged} short-term duplicate(s) · linked ${r.appointmentsLinked} appointments.`,
                    });
                    triggerSync();
                    refetch();
                  } catch (e: any) {
                    toast({ title: "Consolidation Failed", description: e.message, variant: "destructive" });
                  } finally {
                    setConsolidating(false);
                  }
                }}
                disabled={consolidating || syncing}
                variant="secondary"
                className="gap-2"
              >
                {consolidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {consolidating ? "Consolidating..." : "Consolidate Duplicates"}
              </Button>
              <Button 
                onClick={() => syncAppointmentsToAOD()}
                disabled={syncing || consolidating}
                className="gap-2"
              >
                {syncing ? "Syncing..." : "Sync All Appointments to AOD"}
              </Button>
            </div>
            
            <AODPaymentMonitor />
            
            <Tabs defaultValue="grouped" className="w-full">
              <TabsList className="grid w-full max-w-xl grid-cols-3">
                <TabsTrigger value="grouped" className="gap-2">
                  <Users className="h-4 w-4" />
                  Grouped by Attorney
                </TabsTrigger>
                <TabsTrigger value="documents">AOD Documents</TabsTrigger>
                <TabsTrigger value="short-term">Short-Term</TabsTrigger>
              </TabsList>
              
              <TabsContent value="grouped" className="mt-6">
                <AODGroupedView />
              </TabsContent>
              
              <TabsContent value="documents" className="mt-6">
                <AODDocumentManager 
                  attorneys={attorneys} 
                  lawFirmId={lawFirmId}
                  onSyncAttorney={syncAppointmentsToAOD}
                  isSyncing={syncing}
                />
              </TabsContent>
              
              <TabsContent value="short-term" className="mt-6">
                <ShortTermAgreementManager 
                  attorneys={attorneys} 
                  lawFirmId={lawFirmId}
                  onSyncAttorney={syncAppointmentsToAOD}
                  isSyncing={syncing}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      <CompanyFooter />
    </div>
  );
};

export default AODManagement;
