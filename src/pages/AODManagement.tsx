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
      // Get all appointments with outstanding balance
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('id, law_firm_id, service_fee, deposit_amount, case_status, referring_attorney, payment_terms, agreement_duration_months')
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

      // Separate appointments into AOD and Short-Term based on payment terms and duration
      const aodAppointments: any[] = [];
      const shortTermAppointments: any[] = [];

      appointmentsWithDebt.forEach(apt => {
        const isAOD = apt.payment_terms?.toLowerCase().includes('aod') || 
                      (apt.agreement_duration_months && apt.agreement_duration_months >= 12);
        
        if (isAOD) {
          aodAppointments.push(apt);
        } else {
          shortTermAppointments.push(apt);
        }
      });

      console.log(`AOD appointments: ${aodAppointments.length}, Short-term: ${shortTermAppointments.length}`);

      let aodCount = 0;
      let shortTermCount = 0;

      // Process AOD Documents (grouped by referring attorney's organization)
      if (aodAppointments.length > 0) {
        const lawFirms = [...new Set(aodAppointments.map(a => a.law_firm_id))];
        
        for (const firmId of lawFirms) {
          const firmAppointments = aodAppointments.filter(a => a.law_firm_id === firmId);
          const totalValue = firmAppointments.reduce((sum, apt) => sum + (apt.service_fee || 0), 0);
          const totalDeposit = firmAppointments.reduce((sum, apt) => sum + (apt.deposit_amount || 0), 0);
          const outstanding = totalValue - totalDeposit;
          
          // Get all unique referring attorneys for this organization, trimmed and cleaned
          const referringAttorneys = [...new Set(
            firmAppointments
              .map(a => a.referring_attorney?.trim())
              .filter(Boolean)
          )];
          const referringAttorneyNames = referringAttorneys.join(', ') || 'Unknown Referring Attorney';

          // Check if AOD document exists for this referring attorney
          const { data: existingDocs } = await supabase
            .from('aod_documents')
            .select('id')
            .eq('law_firm_id', firmId);

          const existing = existingDocs && existingDocs.length > 0 ? existingDocs[0] : null;

          const newDescription = `AOD - ${referringAttorneyNames} (${firmAppointments.length} assessments)`;
          const newFileName = `AOD Agreement - ${referringAttorneyNames}`;

          if (existing) {
            await supabase
              .from('aod_documents')
              .update({
                total_contract_value: totalValue,
                deposit_amount: totalDeposit,
                payment_status: outstanding > 0 ? 'pending' : 'paid',
                total_reports_agreed: firmAppointments.length,
                contract_description: newDescription,
                file_name: newFileName,
                notes: `Referring Attorneys: ${referringAttorneyNames}. Synced ${firmAppointments.length} appointments. Outstanding: R${outstanding.toFixed(2)}`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
            
            console.log(`✅ Updated AOD for referring attorney ${firmId} - ${referringAttorneyNames} (${firmAppointments.length} appointments)`);
          } else {
            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 12);

            await supabase
              .from('aod_documents')
              .insert({
                attorney_id: firmId,
                law_firm_id: firmId,
                uploaded_by: user.id,
                contract_description: newDescription,
                contract_start_date: startDate.toISOString().split('T')[0],
                contract_end_date: endDate.toISOString().split('T')[0],
                total_contract_value: totalValue,
                deposit_amount: totalDeposit,
                payment_status: outstanding > 0 ? 'pending' : 'paid',
                total_reports_agreed: firmAppointments.length,
                file_name: newFileName,
                document_url: 'pending',
                notes: `Referring Attorneys: ${referringAttorneyNames}. Synced ${firmAppointments.length} appointments. Outstanding: R${outstanding.toFixed(2)}`
              });

            console.log(`✅ Created AOD for referring attorney ${firmId} - ${referringAttorneyNames} (${firmAppointments.length} appointments)`);
          }
          aodCount++;
        }
      }

      // Process Short-Term Agreements (grouped by referring attorney)
      if (shortTermAppointments.length > 0) {
        // Group by referring attorney organization AND individual referring attorney
        const attorneyGroups = new Map<string, any[]>();
        
        shortTermAppointments.forEach(apt => {
          const key = `${apt.law_firm_id}_${apt.referring_attorney}`;
          if (!attorneyGroups.has(key)) {
            attorneyGroups.set(key, []);
          }
          attorneyGroups.get(key)!.push(apt);
        });

        for (const [key, attorneyAppointments] of attorneyGroups) {
          const firstApt = attorneyAppointments[0];
          const referringAttorneyName = (firstApt.referring_attorney || 'Unknown Referring Attorney').trim();
          const totalValue = attorneyAppointments.reduce((sum, apt) => sum + (apt.service_fee || 0), 0);
          const totalDeposit = attorneyAppointments.reduce((sum, apt) => sum + (apt.deposit_amount || 0), 0);
          const outstanding = totalValue - totalDeposit;

          // Extract payment terms duration (e.g., "90-days" -> 3 months)
          const paymentTerms = firstApt.payment_terms || '90-days';
          let durationMonths = 3; // default
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

          // Check if short-term agreement exists for this referring attorney
          const { data: existingAgreements } = await supabase
            .from('short_term_agreements')
            .select('id, contract_description')
            .eq('law_firm_id', firstApt.law_firm_id)
            .ilike('contract_description', `%${referringAttorneyName}%`);

          const existing = existingAgreements && existingAgreements.length > 0 ? existingAgreements[0] : null;

          const newDescription = `Short-Term - ${referringAttorneyName} (${attorneyAppointments.length} assessments)`;
          const newFileName = `Short-Term Agreement - ${referringAttorneyName}`;

          if (existing) {
            await supabase
              .from('short_term_agreements')
              .update({
                total_contract_value: totalValue,
                deposit_amount: totalDeposit,
                payment_status: outstanding > 0 ? 'pending' : 'paid',
                total_reports_agreed: attorneyAppointments.length,
                payment_plan_structure: paymentTerms,
                contract_description: newDescription,
                contract_end_date: endDate.toISOString().split('T')[0],
                file_name: newFileName,
                notes: `Referring Attorney: ${referringAttorneyName}. Synced ${attorneyAppointments.length} appointments. Outstanding: R${outstanding.toFixed(2)}`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
            
            console.log(`✅ Updated Short-Term Agreement for ${referringAttorneyName} (${attorneyAppointments.length} appointments)`);
          } else {
            await supabase
              .from('short_term_agreements')
              .insert({
                attorney_id: firstApt.law_firm_id,
                law_firm_id: firstApt.law_firm_id,
                created_by: user.id,
                contract_description: newDescription,
                contract_start_date: startDate.toISOString().split('T')[0],
                contract_end_date: endDate.toISOString().split('T')[0],
                total_contract_value: totalValue,
                deposit_amount: totalDeposit,
                payment_status: outstanding > 0 ? 'pending' : 'paid',
                payment_plan_structure: paymentTerms,
                total_reports_agreed: attorneyAppointments.length,
                file_name: newFileName,
                notes: `Referring Attorney: ${referringAttorneyName}. Synced ${attorneyAppointments.length} appointments. Outstanding: R${outstanding.toFixed(2)}`,
                status: 'active'
              } as any);

            console.log(`✅ Created Short-Term Agreement for ${referringAttorneyName} (${attorneyAppointments.length} appointments)`);
          }
          shortTermCount++;
        }
      }

      toast({
        title: "Sync Complete",
        description: `Created/Updated ${aodCount} AOD documents and ${shortTermCount} short-term agreements`,
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

        // Fetch referring attorneys from law_firms table (centralized referring attorney list)
        console.log("Fetching referring attorneys from law_firms table...");
        const { data: lawFirmsData, error } = await supabase
          .rpc('get_law_firms_list');

        console.log("Referring attorneys query result:", { lawFirmsData, error });

        if (error) {
          console.error("Error fetching referring attorneys:", error);
          toast({
            title: "Error fetching referring attorneys",
            description: error.message,
            variant: "destructive",
          });
          throw error;
        }
        
        // Deduplicate and ensure proper structure with all required fields
        const uniqueAttorneys = deduplicateAttorneys(lawFirmsData || []).map(attorney => ({
          id: attorney.id,
          name: attorney.name || 'Unknown',
          law_firm: attorney.name || null, // Use name as law_firm for consistency
          email: attorney.email_masked || null,
          phone: attorney.phone_masked || null,
        }));
        
        console.log("Setting referring attorneys from law_firms table:", uniqueAttorneys);
        setAttorneys(uniqueAttorneys);
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
        <title>AOD Management - Acknowledgement of Debts Documents</title>
        <meta 
          name="description" 
          content="Manage Acknowledgement of Debts documents, payment plans, interest rates, and attorney agreements for medico-legal assessments." 
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
