import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, FileText, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import CompanyFooter from "@/components/CompanyFooter";

type ClaimantReportData = {
  auto_id: string;
  claimant_name: string;
  assessment_date: string;
  status: string;
  report_status: string;
  days_countdown: number | null;
  expert_types: string[];
  multiple_assessments: boolean;
  comment_status: string;
  claimant_id: string;
  appointment_id: string;
};

const statusOptions = [
  "Report await final payment",
  "Report fully paid Await expert to complete the report",
  "Report completed",
  "Assessment pending"
];

const ReferringAttorneyReport = () => {
  const { toast } = useToast();
  const [reportData, setReportData] = useState<ClaimantReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      // Get current user's law firm
      const { data: profile } = await supabase
        .from('profiles')
        .select('law_firm_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.law_firm_id) {
        toast({
          title: "Error",
          description: "No law firm associated with your account.",
          variant: "destructive",
        });
        return;
      }

      // Fetch claimants with their appointments and reports
      const { data: claimants, error } = await supabase
        .from('claimants')
        .select(`
          id,
          auto_id,
          first_name,
          last_name,
          appointments (
            id,
            appointment_date,
            case_status,
            expert_id,
            medical_experts (
              expert_type
            ),
            expert_reports (
              report_status,
              report_submitted_date,
              payment_date,
              days_to_complete
            )
          )
        `)
        .eq('law_firm_id', profile.law_firm_id);

      if (error) throw error;

      // Process the data
      const processedData: ClaimantReportData[] = [];
      
      claimants?.forEach(claimant => {
        // Group appointments by date to detect multiple assessments
        const appointmentsByDate = claimant.appointments.reduce((acc, apt) => {
          const date = format(new Date(apt.appointment_date), 'yyyy-MM-dd');
          if (!acc[date]) acc[date] = [];
          acc[date].push(apt);
          return acc;
        }, {} as Record<string, any[]>);

        Object.entries(appointmentsByDate).forEach(([date, appointments]) => {
          const expertTypes = appointments.map(apt => apt.medical_experts?.expert_type).filter(Boolean);
          const hasMultipleAssessments = appointments.length > 1;
          
          // Get the most recent report status and countdown
          let reportStatus = 'Not Assessed';
          let daysCountdown: number | null = null;
          let appointmentStatus = 'Not Assessed';
          
          appointments.forEach(apt => {
            if (apt.case_status === 'completed') {
              appointmentStatus = 'Assessed';
            } else if (apt.case_status === 'scheduled') {
              appointmentStatus = 'Scheduled';
            } else if (apt.case_status === 'cancelled') {
              appointmentStatus = 'Cancelled';
            }

            if (apt.expert_reports && apt.expert_reports.length > 0) {
              const report = apt.expert_reports[0];
              reportStatus = report.report_status;
              
              // Calculate countdown days
              if (report.payment_date && !report.report_submitted_date) {
                const paymentDate = new Date(report.payment_date);
                const today = new Date();
                const diffTime = today.getTime() - paymentDate.getTime();
                daysCountdown = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              } else if (report.days_to_complete) {
                daysCountdown = report.days_to_complete;
              }
            }
          });

          processedData.push({
            auto_id: claimant.auto_id,
            claimant_name: `${claimant.first_name} ${claimant.last_name}`,
            assessment_date: date,
            status: appointmentStatus,
            report_status: reportStatus,
            days_countdown: daysCountdown,
            expert_types: expertTypes,
            multiple_assessments: hasMultipleAssessments,
            comment_status: 'Assessment pending',
            claimant_id: claimant.id,
            appointment_id: appointments[0]?.id || ''
          });
        });
      });

      setReportData(processedData);
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch report data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCommentChange = (claimantId: string, value: string) => {
    setComments(prev => ({
      ...prev,
      [claimantId]: value
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Assessed": return <Badge variant="default">Assessed</Badge>;
      case "Scheduled": return <Badge variant="secondary">Scheduled</Badge>;
      case "Not Assessed": return <Badge variant="outline">Not Assessed</Badge>;
      case "Cancelled": return <Badge variant="destructive">Cancelled</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getReportStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge variant="default">Completed</Badge>;
      case "pending": return <Badge variant="secondary">Pending</Badge>;
      case "in_progress": return <Badge variant="outline">In Progress</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleDownloadReport = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Referring Attorney Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .header { margin-bottom: 20px; }
            .badge { padding: 2px 6px; border-radius: 4px; font-size: 12px; }
            .assessed { background-color: #22c55e; color: white; }
            .scheduled { background-color: #3b82f6; color: white; }
            .not-assessed { background-color: #6b7280; color: white; }
            .cancelled { background-color: #ef4444; color: white; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Referring Attorney Report</h1>
            <p>Generated on: ${format(new Date(), 'PPP')}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Auto ID</th>
                <th>Claimant Name</th>
                <th>Assessment Date</th>
                <th>Status</th>
                <th>Report Status</th>
                <th>Days Countdown</th>
                <th>Expert Type(s)</th>
                <th>Multiple Assessments</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.map(row => `
                <tr>
                  <td>${row.auto_id}</td>
                  <td>${row.claimant_name}</td>
                  <td>${format(new Date(row.assessment_date), 'PPP')}</td>
                  <td><span class="badge ${row.status.toLowerCase().replace(' ', '-')}">${row.status}</span></td>
                  <td>${row.report_status}</td>
                  <td>${row.days_countdown ? `${row.days_countdown} days` : 'N/A'}</td>
                  <td>${row.expert_types.join(', ')}</td>
                  <td>${row.multiple_assessments ? 'Yes' : 'No'}</td>
                  <td>${comments[row.claimant_id] || 'Assessment pending'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/referring-attorney-report';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Referring Attorney Report - Medico-Legal Assessment System</title>
        <meta name="description" content="Comprehensive report showing claimant assessments, report status, and expert information for referring attorneys." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
              <h1 className="text-2xl font-bold">Referring Attorney Report</h1>
            </div>
            <Button onClick={handleDownloadReport}>
              <Download className="h-4 w-4 mr-2" />
              Download Report
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Claimant Assessment Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Auto ID</TableHead>
                    <TableHead>Claimant Name</TableHead>
                    <TableHead>Assessment Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Report Status</TableHead>
                    <TableHead>Days Countdown</TableHead>
                    <TableHead>Expert Type(s)</TableHead>
                    <TableHead>Multiple Assessments</TableHead>
                    <TableHead>Comments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Loading report data...
                      </TableCell>
                    </TableRow>
                  ) : (
                    reportData.map((row, index) => (
                      <TableRow key={`${row.claimant_id}-${index}`}>
                        <TableCell className="font-medium">{row.auto_id}</TableCell>
                        <TableCell>{row.claimant_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(row.assessment_date), 'MMM dd, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(row.status)}
                        </TableCell>
                        <TableCell>
                          {getReportStatusBadge(row.report_status)}
                        </TableCell>
                        <TableCell>
                          {row.days_countdown ? (
                            <span className="font-medium text-orange-600">
                              {row.days_countdown} days
                            </span>
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {row.expert_types.map((type, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.multiple_assessments ? (
                            <Badge variant="secondary">Multiple</Badge>
                          ) : (
                            <Badge variant="outline">Single</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={comments[row.claimant_id] || 'Assessment pending'}
                            onValueChange={(value) => handleCommentChange(row.claimant_id, value)}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {reportData.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                No assessment data found for your law firm.
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <CompanyFooter />
    </div>
  );
};

export default ReferringAttorneyReport;