
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
      
      let query = supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          referring_attorney,
          claimants!inner(auto_id, first_name, last_name),
          medical_experts!inner(first_name, last_name, expert_type),
          law_firms!inner(name),
          expert_reports(report_status, report_submitted_date)
        `)
        .order('appointment_date', { ascending: false });

      // If referring attorney, filter by their name
      if (isReferringAttorney()) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', user.id)
            .single();
          
          if (profile) {
            const attorneyName = `${profile.first_name} ${profile.last_name}`;
            query = query.eq('referring_attorney', attorneyName);
          }
        }
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const formattedReports: ClaimantReport[] = (data || []).map((appointment: any) => ({
        id: appointment.id,
        claimant_name: `${appointment.claimants.first_name} ${appointment.claimants.last_name}`,
        claimant_auto_id: appointment.claimants.auto_id,
        expert_name: `${appointment.medical_experts.first_name} ${appointment.medical_experts.last_name}`,
        expert_type: appointment.medical_experts.expert_type,
        appointment_date: appointment.appointment_date,
        report_status: appointment.expert_reports?.[0]?.report_status || 'pending',
        report_submitted_date: appointment.expert_reports?.[0]?.report_submitted_date,
        referring_attorney: appointment.referring_attorney,
        law_firm_name: appointment.law_firms.name,
      }));

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
        <title>Claimant Reports - Medico-Legal Assessment System</title>
        <meta name="description" content="View comprehensive claimant assessment reports and expert evaluations." />
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
            <h1 className="text-3xl md:text-4xl font-bold">Claimant Reports</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              {isReferringAttorney() ? 
                "View your claimant assessment reports and expert evaluations" :
                "Comprehensive claimant assessment reports and expert evaluations"
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
                          <p className="font-medium">Expert</p>
                          <p className="text-muted-foreground">{report.expert_name}</p>
                          <p className="text-xs text-muted-foreground">{report.expert_type}</p>
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
