import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, differenceInDays } from "date-fns";
import { Calendar, FileText, Printer, Download, ChevronLeft } from "lucide-react";
import CompanyFooter from "@/components/CompanyFooter";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { addPrintBranding } from "@/utils/pdfBranding";

type TimePeriod = "week" | "month" | "quarter" | "year";

interface ClaimantData {
  id: string;
  first_name: string;
  last_name: string;
  contact_number: string | null;
  auto_id: string;
  created_at: string;
  law_firm: {
    id: string;
    name: string;
    contact_person: string | null;
  };
  appointments: {
    id: string;
    appointment_date: string;
    case_status: string;
    medical_experts: {
      expert_type: string;
    } | null;
    expert_reports: {
      report_status: string;
      report_submitted_date: string | null;
    }[] | null;
  }[] | null;
}

interface GroupedClaimants {
  [lawFirmId: string]: {
    lawFirm: ClaimantData['law_firm'];
    claimants: ClaimantData[];
    count: number;
  };
}

const ClaimantReports: React.FC = () => {
  const { toast } = useToast();
  const [claimants, setClaimants] = useState<any[]>([]);
  const [groupedClaimants, setGroupedClaimants] = useState<GroupedClaimants>({});
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("month");
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Helper function to get claimant assessment status
  const getAssessmentStatus = (claimant: any) => {
    if (!claimant.appointments || claimant.appointments.length === 0) {
      return "No Appointment";
    }
    
    const latestAppointment = claimant.appointments[claimant.appointments.length - 1];
    return latestAppointment.case_status || "Scheduled";
  };

  // Helper function to get expert type
  const getExpertType = (claimant: any) => {
    if (!claimant.appointments || claimant.appointments.length === 0) {
      return "N/A";
    }
    
    const latestAppointment = claimant.appointments[claimant.appointments.length - 1];
    return latestAppointment.medical_experts?.expert_type || "N/A";
  };

  // Helper function to get report status
  const getReportStatus = (claimant: any) => {
    if (!claimant.appointments || claimant.appointments.length === 0) {
      return "No Report";
    }
    
    const latestAppointment = claimant.appointments[claimant.appointments.length - 1];
    if (!latestAppointment.expert_reports || latestAppointment.expert_reports.length === 0) {
      return "No Report";
    }
    
    const latestReport = latestAppointment.expert_reports[latestAppointment.expert_reports.length - 1];
    return latestReport.report_status || "Pending";
  };

  // Helper function to get appointment date
  const getAppointmentDate = (claimant: any) => {
    if (!claimant.appointments || claimant.appointments.length === 0) {
      return "N/A";
    }
    
    const latestAppointment = claimant.appointments[claimant.appointments.length - 1];
    if (!latestAppointment.appointment_date) {
      return "N/A";
    }
    
    return format(new Date(latestAppointment.appointment_date), 'MMM dd, yyyy');
  };

  // Helper function to calculate remaining days for report completion
  const getRemainingDays = (claimant: any) => {
    if (!claimant.appointments || claimant.appointments.length === 0) {
      return "N/A";
    }
    
    const latestAppointment = claimant.appointments[claimant.appointments.length - 1];
    if (!latestAppointment.appointment_date) {
      return "N/A";
    }
    
    const assessmentDate = new Date(latestAppointment.appointment_date);
    const today = new Date();
    const daysDiff = differenceInDays(today, assessmentDate);
    
    // Check if report is completed
    const hasCompletedReport = latestAppointment.expert_reports?.some((report: any) => 
      report.report_status === 'completed' && report.report_submitted_date
    );
    
    if (hasCompletedReport) {
      return "Completed";
    }
    
    return `${daysDiff} days`;
  };

  const fetchClaimants = async () => {
    try {
      setLoading(true);
      
      // Calculate date range based on selected period
      let startDate: Date;
      let endDate: Date;
      
      switch (timePeriod) {
        case "week":
          startDate = startOfWeek(selectedDate);
          endDate = endOfWeek(selectedDate);
          break;
        case "month":
          startDate = startOfMonth(selectedDate);
          endDate = endOfMonth(selectedDate);
          break;
        case "quarter":
          startDate = startOfQuarter(selectedDate);
          endDate = endOfQuarter(selectedDate);
          break;
        case "year":
          startDate = startOfYear(selectedDate);
          endDate = endOfYear(selectedDate);
          break;
      }

      // First get claimants data
      const { data: claimantsData, error: claimantsError } = await supabase
        .from("claimants")
        .select(`
          id,
          first_name,
          last_name,
          contact_number,
          auto_id,
          created_at,
          law_firm_id
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (claimantsError) throw claimantsError;

      if (!claimantsData || claimantsData.length === 0) {
        setClaimants([]);
        setGroupedClaimants({});
        return;
      }

      // Get unique law firm IDs
      const lawFirmIds = [...new Set(claimantsData.map(c => c.law_firm_id))];

      // Get law firms data
      const { data: lawFirmsData, error: lawFirmsError } = await supabase
        .from("law_firms")
        .select("id, name, contact_person")
        .in("id", lawFirmIds);

      if (lawFirmsError) throw lawFirmsError;

      // Create law firms lookup
      const lawFirmsLookup = lawFirmsData?.reduce((acc: any, firm: any) => {
        acc[firm.id] = firm;
        return acc;
      }, {}) || {};

      // Get appointments for these claimants
      const claimantIds = claimantsData.map(c => c.id);
      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select(`
          id,
          claimant_id,
          appointment_date,
          case_status,
          expert_id
        `)
        .in("claimant_id", claimantIds);

      // Get medical experts data if we have appointments
      let expertsLookup = {};
      if (appointmentsData && appointmentsData.length > 0) {
        const expertIds = [...new Set(appointmentsData.map(a => a.expert_id).filter(Boolean))];
        if (expertIds.length > 0) {
          const { data: expertsData } = await supabase
            .from("medical_experts")
            .select("id, expert_type")
            .in("id", expertIds);
          
          expertsLookup = expertsData?.reduce((acc: any, expert: any) => {
            acc[expert.id] = expert;
            return acc;
          }, {}) || {};
        }
      }

      // Get expert reports data if we have appointments
      let reportsLookup = {};
      if (appointmentsData && appointmentsData.length > 0) {
        const appointmentIds = appointmentsData.map(a => a.id);
        const { data: reportsData } = await supabase
          .from("expert_reports")
          .select("appointment_id, report_status, report_submitted_date")
          .in("appointment_id", appointmentIds);
        
        reportsLookup = reportsData?.reduce((acc: any, report: any) => {
          if (!acc[report.appointment_id]) {
            acc[report.appointment_id] = [];
          }
          acc[report.appointment_id].push(report);
          return acc;
        }, {}) || {};
      }

      // Combine all data
      const enrichedClaimants = claimantsData.map((claimant: any) => {
        const lawFirm = lawFirmsLookup[claimant.law_firm_id] || { 
          id: claimant.law_firm_id, 
          name: 'Unknown Law Firm', 
          contact_person: null 
        };
        
        const claimantAppointments = appointmentsData?.filter(a => a.claimant_id === claimant.id) || [];
        
        const appointments = claimantAppointments.map((appointment: any) => ({
          ...appointment,
          medical_experts: expertsLookup[appointment.expert_id] || null,
          expert_reports: reportsLookup[appointment.id] || []
        }));

        return {
          ...claimant,
          law_firm: lawFirm,
          appointments
        };
      });

      setClaimants(enrichedClaimants);

      // Group claimants by law firm
      const grouped = enrichedClaimants.reduce((acc: any, claimant: any) => {
        const lawFirmId = claimant.law_firm.id;
        if (!acc[lawFirmId]) {
          acc[lawFirmId] = {
            lawFirm: claimant.law_firm,
            claimants: [],
            count: 0
          };
        }
        acc[lawFirmId].claimants.push(claimant);
        acc[lawFirmId].count++;
        return acc;
      }, {});

      setGroupedClaimants(grouped);
    } catch (error: any) {
      console.error('Error fetching claimants:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch claimants",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaimants();
  }, [timePeriod, selectedDate]);

  const handlePrint = () => {
    const printContent = generatePrintContent();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownloadPDF = () => {
    // For PDF generation, we'll use the browser's print to PDF functionality
    const printContent = generatePrintContent();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      // The user can then use Ctrl+P and select "Save as PDF"
      setTimeout(() => {
        printWindow.print();
      }, 100);
    }
  };

  const generatePrintContent = () => {
    const periodLabel = timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1);
    const dateLabel = format(selectedDate, 'MMMM yyyy');
    const totalClaimants = claimants.length;
    const totalLawFirms = Object.keys(groupedClaimants).length;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Claimant Report - ${periodLabel} ${dateLabel}</title>
          ${addPrintBranding()}
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .summary { display: flex; justify-content: space-around; margin-bottom: 30px; }
            .summary-item { text-align: center; }
            .law-firm-section { margin-bottom: 30px; page-break-inside: avoid; }
            .law-firm-header { background-color: #f5f5f5; padding: 10px; font-weight: bold; border: 1px solid #ddd; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f9f9f9; }
            .no-data { text-align: center; font-style: italic; color: #666; }
          </style>
        </head>
        <body>
          <div class="branded-header">
            <div class="logo-section">
              <img src="/lovable-uploads/d45f27ec-34bf-470c-bc47-015dff5748e0.png" alt="Kutlwano & Associate">
            </div>
            <h1 class="company-title">Kutlwano & Associate (Pty) Ltd</h1>
            <h2 class="report-title">${periodLabel} Claimant Report for ${dateLabel}</h2>
            <p>Generated on ${format(new Date(), 'MMMM dd, yyyy HH:mm')}</p>
          </div>
          
          <div class="summary">
            <div class="summary-item">
              <h3>${totalClaimants}</h3>
              <p>Total Claimants</p>
            </div>
            <div class="summary-item">
              <h3>${totalLawFirms}</h3>
              <p>Law Firms</p>
            </div>
          </div>

          ${Object.values(groupedClaimants).map((group: any) => `
            <div class="law-firm-section">
              <div class="law-firm-header">
                ${group.lawFirm.name} (${group.count} claimants)
                ${group.lawFirm.contact_person ? ` - Contact: ${group.lawFirm.contact_person}` : ''}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Auto ID</th>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Date Created</th>
                  </tr>
                </thead>
                <tbody>
                  ${group.claimants.map(claimant => `
                    <tr>
                      <td>${claimant.auto_id}</td>
                      <td>${claimant.first_name} ${claimant.last_name}</td>
                      <td>${claimant.contact_number || 'N/A'}</td>
                      <td>${format(new Date(claimant.created_at), 'MMM dd, yyyy')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}

          ${totalClaimants === 0 ? '<div class="no-data">No claimants found for the selected period.</div>' : ''}
          
          <div class="branded-footer">
            <div class="footer-left">Kutlwano & Associate (Pty) Ltd</div>
            <div class="footer-center">
              <p class="slogan">"We tough a file, We change a life, We are Kutlwano and Associate"</p>
            </div>
            <div class="footer-right">Page 1</div>
          </div>
        </body>
      </html>
    `;
  };

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/claimant-reports';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Claimant Reports | Medico-Legal</title>
        <meta name="description" content="View and generate claimant reports grouped by referring attorney with time-based filtering and export options." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Claimant Reports</h1>
              <p className="text-muted-foreground mt-2">View claimants grouped by referring attorney with time-based filtering.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-sm font-medium mb-2 block">Time Period</label>
                <Select value={timePeriod} onValueChange={(value: TimePeriod) => setTimePeriod(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Weekly</SelectItem>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="quarter">Quarterly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Date</label>
                <input
                  type="month"
                  value={format(selectedDate, 'yyyy-MM')}
                  onChange={(e) => setSelectedDate(new Date(e.target.value + '-01'))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handlePrint} variant="outline">
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button onClick={handleDownloadPDF} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{claimants.length}</div>
              <p className="text-sm text-muted-foreground">Total Claimants</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{Object.keys(groupedClaimants).length}</div>
              <p className="text-sm text-muted-foreground">Law Firms</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">
                {claimants.length > 0 ? (claimants.length / Math.max(Object.keys(groupedClaimants).length, 1)).toFixed(1) : '0'}
              </div>
              <p className="text-sm text-muted-foreground">Avg per Firm</p>
            </CardContent>
          </Card>
        </div>

        {/* Claimants by Law Firm */}
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">Loading claimant data...</div>
            </CardContent>
          </Card>
        ) : Object.keys(groupedClaimants).length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No claimants found for the selected time period.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.values(groupedClaimants).map((group) => (
              <Card key={group.lawFirm.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{group.lawFirm.name}</h3>
                      {group.lawFirm.contact_person && (
                        <p className="text-sm text-muted-foreground">Contact: {group.lawFirm.contact_person}</p>
                      )}
                    </div>
                    <div className="text-sm bg-secondary text-secondary-foreground px-3 py-1 rounded-full">
                      {group.count} claimant{group.count !== 1 ? 's' : ''}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Auto ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Expert Type</TableHead>
                        <TableHead>Report Status</TableHead>
                        <TableHead>Appointment Date</TableHead>
                        <TableHead>Remaining Days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.claimants.map((claimant) => (
                        <TableRow key={claimant.id}>
                          <TableCell className="font-mono">{claimant.auto_id}</TableCell>
                          <TableCell>{claimant.first_name} {claimant.last_name}</TableCell>
                          <TableCell>{getExpertType(claimant)}</TableCell>
                          <TableCell>{getReportStatus(claimant)}</TableCell>
                          <TableCell>{getAppointmentDate(claimant)}</TableCell>
                          <TableCell>{getRemainingDays(claimant)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <CompanyFooter />
    </div>
  );
};

export default ClaimantReports;