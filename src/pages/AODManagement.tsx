import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AODDocumentManager } from "@/components/AODDocumentManager";
import { AODPaymentMonitor } from "@/components/AODPaymentMonitor";
import { ShortTermAgreementManager } from "@/components/ShortTermAgreementManager";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CompanyFooter from "@/components/CompanyFooter";
import { deduplicateAttorneys } from "@/utils/deduplicateAttorneys";

const AODManagement = () => {
  const [attorneys, setAttorneys] = useState<any[]>([]);
  const [lawFirmId, setLawFirmId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const syncAppointmentsToAOD = async (specificAttorneyId?: string) => {
    setSyncing(true);
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

      // Process AOD Documents (each appointment gets its own AOD)
      if (aodAppointments.length > 0) {
        console.log(`Processing ${aodAppointments.length} individual appointments for AOD`);
        
        for (const apt of aodAppointments) {
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
          
          console.log(`Processing AOD for attorney: ${referringAttorneyName} (ID: ${firmId})`);
          
          const totalValue = apt.service_fee || 0;
          const totalDeposit = apt.deposit_amount || 0;
          const outstanding = totalValue - totalDeposit;

          // Get claimant info from joined data
          const claimantId = claimantData?.auto_id || apt.claimant_id;
          const claimantName = claimantData ? `${claimantData.first_name} ${claimantData.last_name}` : 'Unknown';

          // Check if AOD document exists for this specific appointment
          const appointmentIdentifier = `APPOINTMENT:${apt.id}`;
          const existingDocs = await supabase
            .from('aod_documents')
            .select('id, contract_description, notes')
            .eq('referring_attorney_id', firmId);

          const existing = existingDocs?.data?.find(doc => 
            doc.notes?.includes(appointmentIdentifier)
          ) || null;

          const newDescription = `AOD - ${referringAttorneyName} - ${claimantName}`;
          const newFileName = `AOD Agreement - ${referringAttorneyName} - ${claimantId}`;
          const linkedAppointmentNote = `${appointmentIdentifier}\nScheduled Appointment Date: ${new Date(apt.appointment_date).toLocaleDateString()}\nReferring Attorney: ${referringAttorneyName}\nClaimant: ${claimantName} (${claimantId})\nOutstanding Debt: R${outstanding.toFixed(2)}\nTotal Value: R${totalValue.toFixed(2)}\nPaid: R${totalDeposit.toFixed(2)}\nSynced on ${new Date().toLocaleDateString()}`;

          if (existing) {
            await supabase
              .from('aod_documents')
              .update({
                total_contract_value: totalValue,
                deposit_amount: totalDeposit,
                payment_status: outstanding > 0 ? 'pending' : 'paid',
                total_reports_agreed: 1,
                contract_description: newDescription,
                file_name: newFileName,
                notes: linkedAppointmentNote,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
            
            console.log(`✅ Updated AOD for ${referringAttorneyName} - ${claimantName} - Linked to scheduled appointment`);
          } else {
            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 12);

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
                total_reports_agreed: 1,
                file_name: newFileName,
                document_url: 'pending',
                notes: linkedAppointmentNote
              });

            console.log(`✅ Created AOD for ${referringAttorneyName} - ${claimantName} - Linked to scheduled appointment`);
          }
          aodCount++;
        }
      }

      // Process Short-Term Agreements (each appointment gets its own agreement)
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
          
          console.log(`Processing Short-Term for attorney: ${referringAttorneyName} (ID: ${firmId})`);
          
          const totalValue = apt.service_fee || 0;
          const totalDeposit = apt.deposit_amount || 0;
          const outstanding = totalValue - totalDeposit;

          // Get claimant info from joined data
          const claimantId = claimantData?.auto_id || apt.claimant_id;
          const claimantName = claimantData ? `${claimantData.first_name} ${claimantData.last_name}` : 'Unknown';

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

          // Check if short-term agreement exists for this specific appointment
          const appointmentIdentifier = `APPOINTMENT:${apt.id}`;
          const existingAgreementsResult = await supabase
            .from('short_term_agreements')
            .select('id, contract_description, notes')
            .eq('referring_attorney_id', firmId);
          
          const existingAgreements = existingAgreementsResult.data || [];
          const existing = existingAgreements.find((ag: any) => 
            ag.notes?.includes(appointmentIdentifier)
          ) || null;

          const newDescription = `Short-Term - ${referringAttorneyName} - ${claimantName}`;
          const newFileName = `Short-Term Agreement - ${referringAttorneyName} - ${claimantId}`;
          const linkedAppointmentNote = `${appointmentIdentifier}\nScheduled Appointment Date: ${new Date(apt.appointment_date).toLocaleDateString()}\nReferring Attorney: ${referringAttorneyName}\nClaimant: ${claimantName} (${claimantId})\nOutstanding Debt: R${outstanding.toFixed(2)}\nTotal Value: R${totalValue.toFixed(2)}\nPaid: R${totalDeposit.toFixed(2)}\nSynced from scheduled assessments on ${new Date().toLocaleDateString()}`;

          if (existing) {
            await supabase
              .from('short_term_agreements')
              .update({
                total_contract_value: totalValue,
                deposit_amount: totalDeposit,
                payment_status: outstanding > 0 ? 'pending' : 'paid',
                total_reports_agreed: 1,
                payment_plan_structure: paymentTerms,
                contract_description: newDescription,
                contract_end_date: endDate.toISOString().split('T')[0],
                file_name: newFileName,
                notes: linkedAppointmentNote,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
            
            console.log(`✅ Updated Short-Term Agreement for ${referringAttorneyName} - ${claimantName} - Linked to scheduled appointment`);
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
                file_name: newFileName,
                notes: linkedAppointmentNote,
                status: 'active'
              });

            console.log(`✅ Created Short-Term Agreement for ${referringAttorneyName} - ${claimantName} - Linked to scheduled appointment`);
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

      // Refresh page data
      window.location.reload();

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
              <Link to="/aod-balance-summary">
                <Button variant="outline" className="gap-2">
                  <FileCheck className="h-4 w-4" />
                  View Balance Summary
                </Button>
              </Link>
              <Button 
                onClick={() => syncAppointmentsToAOD()}
                disabled={syncing}
                className="gap-2"
              >
                {syncing ? "Syncing..." : "Sync All Appointments to AOD"}
              </Button>
            </div>
            
            <AODPaymentMonitor />
            
            <Tabs defaultValue="documents" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="documents">AOD</TabsTrigger>
                <TabsTrigger value="short-term">Short-Term Agreements</TabsTrigger>
              </TabsList>
              
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
