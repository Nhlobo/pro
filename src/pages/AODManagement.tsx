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
        .select('id, law_firm_id, service_fee, deposit_amount, case_status, referring_attorney')
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

      // Group by law firm
      const lawFirms = [...new Set(appointmentsWithDebt.map(a => a.law_firm_id))];
      console.log(`Processing ${lawFirms.length} law firm(s)`);

      for (const firmId of lawFirms) {
        const firmAppointments = appointmentsWithDebt.filter(a => a.law_firm_id === firmId);
        const totalValue = firmAppointments.reduce((sum, apt) => sum + (apt.service_fee || 0), 0);
        const totalDeposit = firmAppointments.reduce((sum, apt) => sum + (apt.deposit_amount || 0), 0);
        const outstanding = totalValue - totalDeposit;

        const { data: { user } } = await supabase.auth.getUser();
        const referringAttorney = firmAppointments[0]?.referring_attorney || 'Unknown';

        // Check if AOD document exists
        const { data: existing } = await supabase
          .from('aod_documents')
          .select('id')
          .eq('law_firm_id', firmId)
          .maybeSingle();

        if (existing) {
          // Update existing
          await supabase
            .from('aod_documents')
            .update({
              total_contract_value: totalValue,
              deposit_amount: totalDeposit,
              payment_status: outstanding > 0 ? 'pending' : 'paid',
              total_reports_agreed: firmAppointments.length,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          
          console.log(`✅ Updated AOD for law firm ${firmId}`);
        } else {
          // Create new
          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 12);

          await supabase
            .from('aod_documents')
            .insert({
              attorney_id: firmId,
              law_firm_id: firmId,
              uploaded_by: user?.id,
              contract_description: `AOD - ${referringAttorney} - ${firmAppointments.length} assessments`,
              contract_start_date: startDate.toISOString().split('T')[0],
              contract_end_date: endDate.toISOString().split('T')[0],
              total_contract_value: totalValue,
              deposit_amount: totalDeposit,
              payment_status: outstanding > 0 ? 'pending' : 'paid',
              total_reports_agreed: firmAppointments.length,
              file_name: `AOD - ${referringAttorney}`,
              document_url: '',
              notes: `Synced ${firmAppointments.length} appointments. Outstanding: R${outstanding.toFixed(2)}`
            });

          console.log(`✅ Created AOD for law firm ${firmId}`);
        }
      }

      toast({
        title: "Sync Complete",
        description: `Processed ${lawFirms.length} law firm(s) with ${appointmentsWithDebt.length} appointments`,
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
        // Get current user's law firm
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: profile } = await supabase
          .from("profiles")
          .select("law_firm_id")
          .eq("id", user.id)
          .single();

        if (profile?.law_firm_id) {
          setLawFirmId(profile.law_firm_id);
        }

        // Fetch attorneys using the same RPC as ReferringAttorneyList
        console.log("Fetching attorneys...");
        const { data: attorneysData, error } = await supabase
          .rpc('get_law_firms_list');

        console.log("Attorneys query result:", { attorneysData, error });

        if (error) {
          console.error("Error fetching attorneys:", error);
          toast({
            title: "Error fetching attorneys",
            description: error.message,
            variant: "destructive",
          });
          throw error;
        }
        
        // Deduplicate attorneys before setting state
        const uniqueAttorneys = deduplicateAttorneys(attorneysData || []);
        console.log("Setting attorneys:", uniqueAttorneys);
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
