import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, RefreshCw, Filter, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import CompanyFooter from "@/components/CompanyFooter";
import { AppointmentEmailPreviewDialog } from "@/components/AppointmentEmailPreviewDialog";

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
  attorney_email?: string;
  attorney_phone?: string;
  matter_type?: string;
};

const ReferringAttorneyUpdate = () => {
  const { toast } = useToast();
  const [updateData, setUpdateData] = useState<AttorneyUpdateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAttorney, setSelectedAttorney] = useState<string>('all');
  const [attorneys, setAttorneys] = useState<{name: string, display: string}[]>([]);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('');

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
        .select('referring_attorney_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      let query = supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          referring_attorney,
          matter_type,
          claimant_id,
          expert_id
        `)
        .order('appointment_date', { ascending: true });

      // System admins can see all data, others filtered by law firm
      if (profile?.referring_attorney_id) {
        query = query.eq('referring_attorney_id', profile.referring_attorney_id);
      }

      if (selectedAttorney !== 'all') {
        query = query.eq('referring_attorney', selectedAttorney);
      }

      const { data: appointments, error } = await query;
      if (error) throw error;

      // Fetch claimants and experts separately
      const claimantIds = [...new Set(appointments?.map(a => a.claimant_id).filter(Boolean))];
      const expertIds = [...new Set(appointments?.map(a => a.expert_id).filter(Boolean))];

      const [{ data: claimants }, { data: experts }] = await Promise.all([
        supabase.from('claimants').select('id, auto_id, first_name, last_name').in('id', claimantIds),
        supabase.from('medical_experts').select('id, expert_type, practice_address').in('id', expertIds)
      ]);

      // Get unique attorney names and fetch their profile information
      const uniqueAttorneyNames = [...new Set(appointments?.map(apt => apt.referring_attorney).filter(Boolean) || [])];
      
      // Fetch attorney profiles to get detailed information
      let attorneyQuery = supabase
        .from('profiles')
        .select(`
          first_name,
          last_name,
          role,
          position,
          law_firms!inner (
            name
          )
        `)
        .eq('role', 'referring_attorney');

      // System admins can see all attorneys, others filtered by law firm
      if (profile?.referring_attorney_id) {
        attorneyQuery = attorneyQuery.eq('referring_attorney_id', profile.referring_attorney_id);
      }

      const { data: attorneyProfiles } = await attorneyQuery;

      // Create enhanced attorney display list
      const enhancedAttorneys = uniqueAttorneyNames.map(attorneyName => {
        // Try to match with profile data
        const matchedProfile = attorneyProfiles?.find(p => {
          const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
          return fullName === attorneyName || attorneyName.includes(p.first_name || '') || attorneyName.includes(p.last_name || '');
        });

        if (matchedProfile) {
          const lawFirm = (matchedProfile.law_firms as any)?.name || '';
          const position = matchedProfile.position || 'Attorney';
          return {
            name: attorneyName,
            display: `${matchedProfile.first_name} ${matchedProfile.last_name} - ${position}${lawFirm ? ` at ${lawFirm}` : ''}`
          };
        }
        
        return {
          name: attorneyName,
          display: `${attorneyName} - Attorney`
        };
      });

      setAttorneys(enhancedAttorneys);

      const processedData: AttorneyUpdateData[] = appointments?.map(appointment => {
        const appointmentDate = new Date(appointment.appointment_date);
        const claimant = claimants?.find(c => c.id === appointment.claimant_id);
        const expert = experts?.find(e => e.id === appointment.expert_id);
        
        return {
          auto_id: claimant?.auto_id || 'N/A',
          claimant_name: `${claimant?.first_name || ''} ${claimant?.last_name || ''}`.trim(),
          expert_type: expert?.expert_type || 'Not specified',
          assessment_date: format(appointmentDate, 'dd/MM/yyyy'),
          assessment_time: format(appointmentDate, 'HH:mm'),
          location: expert?.practice_address || 'Location TBD',
          appointment_id: appointment.id,
          claimant_id: claimant?.id || '',
          referring_attorney: appointment.referring_attorney || 'Unknown',
          matter_type: appointment.matter_type || 'Not specified'
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

  const handleSendConfirmation = (appointmentId: string) => {
    setSelectedAppointmentId(appointmentId);
    setPreviewDialogOpen(true);
  };

  const handleEmailSent = () => {
    toast({
      title: "Success",
      description: "Appointment confirmation emails sent successfully",
    });
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
        <title>Assessment Update - Medico-Legal Assessment System</title>
        <meta name="description" content="Real-time updates on scheduled assessments." />
      </Helmet>

      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" asChild>
                <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
              </Button>
              <h1 className="text-2xl font-bold">Assessment Update</h1>
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
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter by Referring Attorney
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedAttorney} onValueChange={setSelectedAttorney}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Select an attorney..." />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-md z-50">
                <SelectItem value="all" className="font-medium">
                  All Referring Attorneys
                </SelectItem>
                {attorneys.map(attorney => (
                  <SelectItem key={attorney.name} value={attorney.name} className="py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{attorney.display}</span>
                      <span className="text-xs text-muted-foreground">Click to filter appointments</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheduled Assessments - Attorney Session Details</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Auto ID</TableHead>
                    <TableHead>Referring Attorney</TableHead>
                    <TableHead>Claimant Name</TableHead>
                    <TableHead>Matter Type</TableHead>
                    <TableHead>Expert Type</TableHead>
                    <TableHead>Assessment Date</TableHead>
                    <TableHead>Session Time</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {updateData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Badge variant="secondary">{row.auto_id}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-primary">
                          {row.referring_attorney}
                        </div>
                      </TableCell>
                      <TableCell>{row.claimant_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.matter_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">{row.expert_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.assessment_date}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm bg-muted px-2 py-1 rounded">
                          {row.assessment_time}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="text-sm text-muted-foreground truncate">
                          {row.location}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendConfirmation(row.appointment_id)}
                          className="gap-2"
                        >
                          <Mail className="h-4 w-4" />
                          Send Confirmation
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <AppointmentEmailPreviewDialog
        isOpen={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        appointmentId={selectedAppointmentId}
        onConfirmSend={handleEmailSent}
      />

      <CompanyFooter />
    </div>
  );
};

export default ReferringAttorneyUpdate;