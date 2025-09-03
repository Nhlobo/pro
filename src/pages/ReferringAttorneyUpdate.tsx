import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, RefreshCw, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import CompanyFooter from "@/components/CompanyFooter";

type AttorneyUpdateData = {
  auto_id: string;
  claimant_name: string;
  expert_type: string;
  assessment_date: string;
  assessment_time: string;
  location: string;
  appointment_id: string;
  claimant_id: string;
  referring_attorney: string;
};

const ReferringAttorneyUpdate = () => {
  const { toast } = useToast();
  const [updateData, setUpdateData] = useState<AttorneyUpdateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAttorney, setSelectedAttorney] = useState<string>('all');
  const [attorneys, setAttorneys] = useState<string[]>([]);

  // Manual refresh function
  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchUpdateData();
      toast({
        title: "Data Refreshed",
        description: "The assessment data has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh the data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUpdateData();
  }, [selectedAttorney]);

  const fetchUpdateData = async () => {
    try {
      setLoading(true);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('law_firm_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.law_firm_id) {
        toast({ title: "Error", description: "No law firm associated with your account.", variant: "destructive" });
        return;
      }

      let query = supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          referring_attorney,
          claimants!inner (
            id,
            auto_id,
            first_name,
            last_name
          ),
          medical_experts!inner (
            expert_type,
            practice_address
          )
        `)
        .eq('law_firm_id', profile.law_firm_id)
        .order('appointment_date', { ascending: true });

      if (selectedAttorney !== 'all') {
        query = query.eq('referring_attorney', selectedAttorney);
      }

      const { data: appointments, error } = await query;
      if (error) throw error;

      const uniqueAttorneys = [...new Set(appointments?.map(apt => apt.referring_attorney).filter(Boolean) || [])];
      setAttorneys(uniqueAttorneys);

      const processedData: AttorneyUpdateData[] = appointments?.map(appointment => {
        const appointmentDate = new Date(appointment.appointment_date);
        const claimant = appointment.claimants as any;
        const expert = appointment.medical_experts as any;
        
        return {
          auto_id: claimant?.auto_id || 'N/A',
          claimant_name: `${claimant?.first_name || ''} ${claimant?.last_name || ''}`.trim(),
          expert_type: expert?.expert_type || 'Not specified',
          assessment_date: format(appointmentDate, 'dd/MM/yyyy'),
          assessment_time: format(appointmentDate, 'p'),
          location: expert?.practice_address || 'Location TBD',
          appointment_id: appointment.id,
          claimant_id: claimant?.id || '',
          referring_attorney: appointment.referring_attorney || 'Unknown'
        };
      }) || [];

      setUpdateData(processedData);
    } catch (error) {
      console.error('Error fetching update data:', error);
      toast({ title: "Error", description: "Failed to fetch update data. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head><title>Referring Attorney Update Report</title></head>
          <body>
            <h1>Referring Attorney Update Report</h1>
            <p>Generated on: ${format(new Date(), 'PPP')}</p>
            <p>Total: ${updateData.length} appointments</p>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Referring Attorney Update - Medico-Legal Assessment System</title>
        <meta name="description" content="Real-time updates on scheduled assessments." />
      </Helmet>

      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" asChild>
                <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
              </Button>
              <h1 className="text-2xl font-bold">Referring Attorney Update</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={handleManualRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh Data'}
              </Button>
              <Button onClick={handleDownloadReport}>
                <Download className="h-4 w-4 mr-2" />Download
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter by Attorney</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedAttorney} onValueChange={setSelectedAttorney}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Attorneys</SelectItem>
                {attorneys.map(attorney => (
                  <SelectItem key={attorney} value={attorney}>{attorney}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheduled Assessments</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Auto ID</TableHead>
                    <TableHead>Claimant Name</TableHead>
                    <TableHead>Expert Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {updateData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row.auto_id}</TableCell>
                      <TableCell>{row.claimant_name}</TableCell>
                      <TableCell><Badge variant="outline">{row.expert_type}</Badge></TableCell>
                      <TableCell>{row.assessment_date}</TableCell>
                      <TableCell>{row.assessment_time}</TableCell>
                      <TableCell>{row.location}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <CompanyFooter />
    </div>
  );
};

export default ReferringAttorneyUpdate;