
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, FileText, Calendar, User, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import CompanyFooter from "@/components/CompanyFooter";

interface ClaimantReport {
  id: string;
  claimant_name: string;
  claimant_auto_id: string;
  expert_name: string;
  expert_type: string;
  appointment_date: string;
  report_status: string;
  report_submitted_date?: string;
  referring_attorney: string;
  law_firm_name: string;
}

const ClaimantReports = () => {
  const [reports, setReports] = useState<ClaimantReport[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isReferringAttorney, userRole } = usePermissions();

  useEffect(() => {
    fetchClaimantReports();
  }, []);

  const fetchClaimantReports = async () => {
    try {
      setLoading(true);
      
      // Get current user's profile and law firm
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, referring_attorney_id, role')
        .eq('id', user.id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      // Fetch appointments with related data
      let appointmentQuery = supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          referring_attorney,
          claimant_id,
          expert_id,
          referring_attorney_id
        `)
        .order('appointment_date', { ascending: false });

      // System admins can see all data, others filtered by referring attorney
      if (profile.referring_attorney_id) {
        appointmentQuery = appointmentQuery.eq('referring_attorney_id', profile.referring_attorney_id);
      }

      // If referring attorney, filter by their name
      if (isReferringAttorney() && profile.first_name && profile.last_name) {
        const attorneyName = `${profile.first_name} ${profile.last_name}`;
        appointmentQuery = appointmentQuery.eq('referring_attorney', attorneyName);
      }

      const { data: appointments, error: appointmentsError } = await appointmentQuery;

      if (appointmentsError) {
        throw appointmentsError;
      }

      if (!appointments || appointments.length === 0) {
        setReports([]);
        return;
      }

      // Get unique IDs for batch fetching
      const claimantIds = [...new Set(appointments.map(a => a.claimant_id))];
      const expertIds = [...new Set(appointments.map(a => a.expert_id))];
      const appointmentIds = appointments.map(a => a.id);

      // Fetch claimants
      const { data: claimants } = await supabase
        .from('claimants')
        .select('id, auto_id, first_name, last_name')
        .in('id', claimantIds);

      // Fetch experts using the secure function
      const { data: allExperts } = await supabase
        .rpc('get_medical_experts_secure');
      
      const experts = allExperts?.filter(expert => expertIds.includes(expert.id)) || [];

      // Fetch referring attorney
      const { data: lawFirm } = await supabase
        .from('referring_attorneys')
        .select('id, name')
        .eq('id', profile.referring_attorney_id)
        .single();

      // Fetch expert reports
      const { data: expertReports } = await supabase
        .from('expert_reports')
        .select('appointment_id, report_status, report_submitted_date')
        .in('appointment_id', appointmentIds);

      // Format the data
      const formattedReports: ClaimantReport[] = appointments.map((appointment: any) => {
        const claimant = claimants?.find(c => c.id === appointment.claimant_id);
        const expert = experts?.find(e => e.id === appointment.expert_id);
        const report = expertReports?.find(r => r.appointment_id === appointment.id);

        return {
          id: appointment.id,
          claimant_name: claimant ? `${claimant.first_name} ${claimant.last_name}` : 'Unknown',
          claimant_auto_id: claimant?.auto_id || 'N/A',
          expert_name: expert ? `${expert.first_name} ${expert.last_name}` : 'Unknown',
          expert_type: expert?.expert_type || 'Unknown',
          appointment_date: appointment.appointment_date,
          report_status: report?.report_status || 'pending',
          report_submitted_date: report?.report_submitted_date,
          referring_attorney: appointment.referring_attorney,
          law_firm_name: lawFirm?.name || 'Unknown',
        };
      });

      setReports(formattedReports);
    } catch (error: any) {
      console.error('Error fetching claimant reports:', error);
      toast({
        title: "Error",
        description: "Failed to load claimant reports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      completed: "default",
      pending: "secondary",
      in_progress: "outline",
      not_received: "destructive"
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/claimant-reports';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Claimant Progress Report - Medico-Legal Assessment System</title>
        <meta name="description" content="Track progress of claimant assessment reports and expert evaluations." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 opacity-70 blur-3xl bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.25),transparent_60%)]" />
        <div className="container mx-auto px-4 py-10">
          <div className="relative">
            <Link to={isReferringAttorney() ? "/" : "/"} className="inline-block mb-4">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold">Claimant Progress Report</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              {isReferringAttorney() ? 
                "Track progress of your claimant assessment reports and expert evaluations" :
                "Monitor progress of claimant assessment reports and expert evaluations"
              }
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Reports Found</h3>
                <p className="text-muted-foreground">
                  {isReferringAttorney() ? 
                    "You don't have any claimant reports yet." :
                    "No claimant reports available."
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {reports.map((report) => (
                <Card key={report.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {report.claimant_name} ({report.claimant_auto_id})
                      </CardTitle>
                      {getStatusBadge(report.report_status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Expert Type</p>
                          <p className="text-muted-foreground">{report.expert_type}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Appointment</p>
                          <p className="text-muted-foreground">{formatDate(report.appointment_date)}</p>
                        </div>
                      </div>

                      {report.report_submitted_date && (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">Report Submitted</p>
                            <p className="text-muted-foreground">{formatDate(report.report_submitted_date)}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Referring Attorney</p>
                          <p className="text-muted-foreground">{report.referring_attorney}</p>
                          <p className="text-xs text-muted-foreground">{report.law_firm_name}</p>
                        </div>
                      </div>
                    </div>

                    {report.report_status === 'completed' && (
                      <div className="mt-4 pt-4 border-t">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="gap-2"
                          disabled={isReferringAttorney()}
                        >
                          <Download className="h-4 w-4" />
                          {isReferringAttorney() ? "Contact admin for report" : "Download Report"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <CompanyFooter />
    </div>
  );
};

export default ClaimantReports;
