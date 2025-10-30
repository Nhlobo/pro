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

  const syncAppointmentsToAOD = async () => {
    setSyncing(true);
    console.log('🔄 Manual sync triggered from AOD Management page');
    
    try {
      // Get all appointments with outstanding balance including claimant data
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select(`
          id, 
          law_firm_id, 
          service_fee, 
          deposit_amount, 
          case_status, 
          referring_attorney, 
          payment_terms, 
          agreement_duration_months,
          claimant_id,
          claimants(auto_id, first_name, last_name)
        `)
        .in('case_status', ['scheduled', 'assessed'])
        .not('service_fee', 'is', null);

      if (error) {
        console.error('Error fetching appointments:', error);
        toast({
          title: "Sync Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (!appointments || appointments.length === 0) {
        toast({
          title: "No Appointments",
          description: "No scheduled or assessed appointments found",
        });
        return;
      }

      // Filter appointments with debt
      const appointmentsWithDebt = appointments.filter(apt => {
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
          const referringAttorneyName = (apt.referring_attorney || 'Unknown Referring Attorney').trim();
          const firmId = apt.law_firm_id;
          
          const totalValue = apt.service_fee || 0;
          const totalDeposit = apt.deposit_amount || 0;
          const outstanding = totalValue - totalDeposit;

          // Get claimant info from joined data
          const claimantData = apt.claimants;
          const claimantId = claimantData?.auto_id || apt.claimant_id;
          const claimantName = claimantData ? `${claimantData.first_name} ${claimantData.last_name}` : 'Unknown';

          // Check if AOD document exists for this specific appointment
          const appointmentIdentifier = `APPOINTMENT:${apt.id}`;
          const existingDocs = await supabase
            .from('aod_documents')
            .select('id, contract_description, notes')
            .eq('law_firm_id', firmId);

          const existing = existingDocs?.data?.find(doc => 
            doc.notes?.includes(appointmentIdentifier)
          ) || null;

          const newDescription = `AOD - ${referringAttorneyName} - ${claimantName}`;
          const newFileName = `AOD Agreement - ${referringAttorneyName} - ${claimantId}`;

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
                notes: `${appointmentIdentifier}\nReferring Attorney: ${referringAttorneyName}\nClaimant: ${claimantName} (${claimantId})\nOutstanding Debt: R${outstanding.toFixed(2)}\nTotal Value: R${totalValue.toFixed(2)}\nPaid: R${totalDeposit.toFixed(2)}\nSynced on ${new Date().toLocaleDateString()}`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
            
            console.log(`✅ Updated AOD for ${referringAttorneyName} - ${claimantName} - Outstanding: R${outstanding.toFixed(2)}`);
          } else {
            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 12);

            await supabase
              .from('aod_documents')
              .insert({
                law_firm_id: firmId,
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
                notes: `${appointmentIdentifier}\nReferring Attorney: ${referringAttorneyName}\nClaimant: ${claimantName} (${claimantId})\nOutstanding Debt: R${outstanding.toFixed(2)}\nTotal Value: R${totalValue.toFixed(2)}\nPaid: R${totalDeposit.toFixed(2)}\nSynced on ${new Date().toLocaleDateString()}`
              });

            console.log(`✅ Created AOD for ${referringAttorneyName} - ${claimantName} - Outstanding: R${outstanding.toFixed(2)}`);
          }
          aodCount++;
        }
      }

      // Process Short-Term Agreements (each appointment gets its own agreement)
      if (shortTermAppointments.length > 0) {
        console.log(`Processing ${shortTermAppointments.length} individual appointments for Short-Term`);

        for (const apt of shortTermAppointments) {
          const referringAttorneyName = (apt.referring_attorney || 'Unknown Referring Attorney').trim();
          const totalValue = apt.service_fee || 0;
          const totalDeposit = apt.deposit_amount || 0;
          const outstanding = totalValue - totalDeposit;

          // Find or create attorney record from scheduled assessment data
          let attorneyId: string | null = null;
          
          const { data: existingAttorneys } = await supabase
            .from('attorneys')
            .select('id, name, law_firm_id')
            .eq('law_firm_id', apt.law_firm_id)
            .ilike('name', referringAttorneyName);
          
          if (existingAttorneys && existingAttorneys.length > 0) {
            attorneyId = existingAttorneys[0].id;
          } else {
            const { data: newAttorney, error: attorneyError } = await supabase
              .from('attorneys')
              .insert({
                name: referringAttorneyName,
                law_firm_id: apt.law_firm_id,
                created_by: user.id,
                status: 'active'
              })
              .select('id')
              .single();
            
            if (attorneyError) {
              console.error(`Error creating attorney: ${attorneyError.message}`);
              continue;
            }
            
            attorneyId = newAttorney.id;
          }

          if (!attorneyId) {
            console.error(`Could not find or create attorney: ${referringAttorneyName}`);
            continue;
          }

          // Get claimant info from joined data
          const claimantData = apt.claimants;
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
          const existingAgreementsResult = await (supabase as any)
            .from('short_term_agreements')
            .select('id, contract_description, notes')
            .eq('law_firm_id', apt.law_firm_id)
            .eq('attorney_id', attorneyId);
          
          const existingAgreements = existingAgreementsResult.data || [];
          const existing = existingAgreements.find((ag: any) => 
            ag.notes?.includes(appointmentIdentifier)
          ) || null;

          const newDescription = `Short-Term - ${referringAttorneyName} - ${claimantName}`;
          const newFileName = `Short-Term Agreement - ${referringAttorneyName} - ${claimantId}`;

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
                notes: `${appointmentIdentifier}\nReferring Attorney: ${referringAttorneyName}\nClaimant: ${claimantName} (${claimantId})\nOutstanding Debt: R${outstanding.toFixed(2)}\nTotal Value: R${totalValue.toFixed(2)}\nPaid: R${totalDeposit.toFixed(2)}\nSynced from scheduled assessments on ${new Date().toLocaleDateString()}`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
            
            console.log(`✅ Updated Short-Term Agreement for ${referringAttorneyName} - ${claimantName} - Outstanding: R${outstanding.toFixed(2)}`);
          } else {
            await supabase
              .from('short_term_agreements')
              .insert({
                attorney_id: attorneyId,
                law_firm_id: apt.law_firm_id,
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
                notes: `${appointmentIdentifier}\nReferring Attorney: ${referringAttorneyName}\nClaimant: ${claimantName} (${claimantId})\nOutstanding Debt: R${outstanding.toFixed(2)}\nTotal Value: R${totalValue.toFixed(2)}\nPaid: R${totalDeposit.toFixed(2)}\nSynced from scheduled assessments on ${new Date().toLocaleDateString()}`,
                status: 'active'
              });

            console.log(`✅ Created Short-Term Agreement for ${referringAttorneyName} - ${claimantName} - Outstanding: R${outstanding.toFixed(2)}`);
          }
          shortTermCount++;
        }
      }

      toast({
        title: "Sync Complete",
        description: `Successfully synced ${aodCount} AOD documents and ${shortTermCount} short-term agreements from scheduled and assessed appointments`,
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
          .select("law_firm_id, role")
          .eq("id", user.id)
          .single();

        // For admin/employee users without law_firm_id, get system company
        if (profile?.law_firm_id) {
          setLawFirmId(profile.law_firm_id);
        } else if (profile?.role === 'admin' || profile?.role === 'employee') {
          // Get system company law firm
          const { data: systemCompany } = await supabase
            .from("law_firms")
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

        // Fetch referring attorneys from law firms table
        console.log("Fetching referring attorneys from law_firms table...");
        const { data: attorneysData, error } = await supabase
          .rpc('get_law_firms_list');

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
        
        console.log("Setting referring attorneys from law_firms:", attorneysData);
        const deduplicated = deduplicateAttorneys(attorneysData || []);
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
                <h1 className="text-3xl md:text-4xl font-bold">AOD Management</h1>
                <p className="text-muted-foreground mt-2 max-w-2xl">
                  Manage Acknowledgement of Debts documents, payment plans, and interest rates for referring attorneys
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
            <div className="flex justify-end">
              <Button 
                onClick={syncAppointmentsToAOD}
                disabled={syncing}
                className="gap-2"
              >
                {syncing ? "Syncing..." : "Sync Appointments to AOD"}
              </Button>
            </div>
            
            <AODPaymentMonitor />
            
            <Tabs defaultValue="documents" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="documents">AOD Documents</TabsTrigger>
                <TabsTrigger value="short-term">Short-Term Agreements</TabsTrigger>
              </TabsList>
              
              <TabsContent value="documents" className="mt-6">
                <AODDocumentManager attorneys={attorneys} lawFirmId={lawFirmId} />
              </TabsContent>
              
              <TabsContent value="short-term" className="mt-6">
                <ShortTermAgreementManager attorneys={attorneys} lawFirmId={lawFirmId} />
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
