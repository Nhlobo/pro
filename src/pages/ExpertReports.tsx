import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, FileText, Users, DollarSign, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from "@/utils/pdfBranding";
import CompanyFooter from "@/components/CompanyFooter";

// Extend jsPDF type to include autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => void;
  }
}

interface ExpertFinancialData {
  expert_id: string;
  expert_name: string;
  expert_type: string;
  total_cost_fees: number;
  deposits_paid: number;
  debts_owed: number;
  total_overdue: number;
  total_assessments: number;
  completed_reports: number;
  pending_reports: number;
  overdue_reports: number;
  claimants: {
    auto_id: string;
    name: string;
    appointment_date: string;
    status: string;
    amount: number;
  }[];
}

const ExpertReports = () => {
  const navigate = useNavigate();
  const [expertData, setExpertData] = useState<ExpertFinancialData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpert, setSelectedExpert] = useState<string>("all");

  useEffect(() => {
    fetchExpertFinancialData();
  }, []);

  const fetchExpertFinancialData = async () => {
    try {
      setLoading(true);

      // Fetch appointments with related data using individual queries for better type safety
      const { data: appointments, error: appointmentsError } = await supabase
        .from("appointments")
        .select(`
          id,
          expert_id,
          claimant_id,
          service_fee,
          deposit_amount,
          payment_status,
          payment_date,
          appointment_date,
          case_status
        `);

      if (appointmentsError) {
        console.error("Error fetching appointments:", appointmentsError);
        throw appointmentsError;
      }

      // Fetch experts
      const { data: experts, error: expertsError } = await supabase
        .from("medical_experts")
        .select("id, first_name, last_name, expert_type");

      if (expertsError) {
        console.error("Error fetching experts:", expertsError);
        throw expertsError;
      }

      // Fetch claimants
      const { data: claimants, error: claimantsError } = await supabase
        .from("claimants")
        .select("id, auto_id, first_name, last_name");

      if (claimantsError) {
        console.error("Error fetching claimants:", claimantsError);
        throw claimantsError;
      }

      // Fetch expert reports
      const { data: expertReports, error: reportsError } = await supabase
        .from("expert_reports")
        .select(`
          id,
          appointment_id,
          report_status,
          payment_status,
          report_due_date,
          report_submitted_date,
          expert_performance
        `);

      if (reportsError) {
        console.error("Error fetching reports:", reportsError);
        throw reportsError;
      }

      // Create lookup maps
      const expertMap = new Map(experts?.map(e => [e.id, e]) || []);
      const claimantMap = new Map(claimants?.map(c => [c.id, c]) || []);
      const reportMap = new Map(expertReports?.map(r => [r.appointment_id, r]) || []);

      // Process and group data by expert
      const expertDataMap = new Map<string, ExpertFinancialData>();

      appointments?.forEach((appointment) => {
        const expert = expertMap.get(appointment.expert_id);
        const claimant = claimantMap.get(appointment.claimant_id);
        const report = reportMap.get(appointment.id);

        if (!expert || !claimant || !expert.id || expert.id.trim() === "") return;

        const expertKey = expert.id;
        const expertName = `${expert.first_name} ${expert.last_name}`;

        if (!expertDataMap.has(expertKey)) {
          expertDataMap.set(expertKey, {
            expert_id: expertKey,
            expert_name: expertName,
            expert_type: expert.expert_type,
            total_cost_fees: 0,
            deposits_paid: 0,
            debts_owed: 0,
            total_overdue: 0,
            total_assessments: 0,
            completed_reports: 0,
            pending_reports: 0,
            overdue_reports: 0,
            claimants: [],
          });
        }

        const expertData = expertDataMap.get(expertKey)!;
        
        // Calculate financial data
        const serviceFee = appointment.service_fee || 0;
        const depositAmount = appointment.deposit_amount || 0;
        
        expertData.total_cost_fees += serviceFee;
        expertData.deposits_paid += depositAmount;
        expertData.total_assessments++;

        // Calculate debts and overdue amounts
        if (appointment.payment_status !== 'paid') {
          const debtAmount = serviceFee - depositAmount;
          expertData.debts_owed += debtAmount;
          
          // Check if overdue (more than 30 days past appointment date)
          const appointmentDate = new Date(appointment.appointment_date);
          const currentDate = new Date();
          const daysDiff = Math.floor((currentDate.getTime() - appointmentDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff > 30) {
            expertData.total_overdue += debtAmount;
          }
        }

        // Calculate report status
        if (report) {
          if (report.report_status === 'completed') {
            expertData.completed_reports++;
          } else if (report.report_status === 'pending') {
            expertData.pending_reports++;
            
            // Check if report is overdue
            if (report.report_due_date) {
              const dueDate = new Date(report.report_due_date);
              const currentDate = new Date();
              if (currentDate > dueDate) {
                expertData.overdue_reports++;
              }
            }
          }
        }

        // Add claimant data
        expertData.claimants.push({
          auto_id: claimant.auto_id,
          name: `${claimant.first_name} ${claimant.last_name}`,
          appointment_date: appointment.appointment_date,
          status: appointment.case_status || 'scheduled',
          amount: serviceFee,
        });
      });

      setExpertData(Array.from(expertDataMap.values()));
    } catch (error) {
      console.error("Error fetching expert financial data:", error);
      toast.error("Failed to load expert reports");
    } finally {
      setLoading(false);
    }
  };

  const generateExpertPDF = (expert: ExpertFinancialData) => {
    const doc = new jsPDF();
    
    // Add branding
    const yPosition = addBrandingToPDF(doc, "Expert Financial Report", expert.expert_name);
    
    let currentY = yPosition + 10;

    // Expert Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Financial Summary", 20, currentY);
    currentY += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Expert Type: ${expert.expert_type}`, 20, currentY);
    currentY += 5;
    doc.text(`Total Assessments: ${expert.total_assessments}`, 20, currentY);
    currentY += 5;
    doc.text(`Total Cost Fees: $${expert.total_cost_fees.toFixed(2)}`, 20, currentY);
    currentY += 5;
    doc.text(`Deposits Paid: $${expert.deposits_paid.toFixed(2)}`, 20, currentY);
    currentY += 5;
    doc.text(`Debts Owed: $${expert.debts_owed.toFixed(2)}`, 20, currentY);
    currentY += 5;
    doc.text(`Total Overdue: $${expert.total_overdue.toFixed(2)}`, 20, currentY);
    currentY += 15;

    // Report Tracking Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Report Tracking Summary", 20, currentY);
    currentY += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Completed Reports: ${expert.completed_reports}`, 20, currentY);
    currentY += 5;
    doc.text(`Pending Reports: ${expert.pending_reports}`, 20, currentY);
    currentY += 5;
    doc.text(`Overdue Reports: ${expert.overdue_reports}`, 20, currentY);
    currentY += 15;

    // Claimants Table
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Claimants List", 20, currentY);
    currentY += 10;

    const tableData = expert.claimants.map(claimant => [
      claimant.auto_id,
      claimant.name,
      new Date(claimant.appointment_date).toLocaleDateString(),
      claimant.status,
      `$${claimant.amount.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Auto ID', 'Claimant Name', 'Appointment Date', 'Status', 'Amount']],
      body: tableData,
      ...getStyledTableOptions(),
    });

    // Add footer
    addBrandingFooter(doc);

    // Save the PDF
    doc.save(`expert-report-${expert.expert_name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
    toast.success("Expert report downloaded successfully");
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      scheduled: { variant: "secondary" as const, color: "text-blue-600" },
      completed: { variant: "default" as const, color: "text-green-600" },
      cancelled: { variant: "destructive" as const, color: "text-red-600" },
      pending: { variant: "outline" as const, color: "text-yellow-600" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.scheduled;
    return <Badge variant={config.variant} className={config.color}>{status}</Badge>;
  };

  const filteredData = selectedExpert && selectedExpert !== "all"
    ? expertData.filter(expert => expert.expert_id === selectedExpert)
    : expertData;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading expert reports...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Expert Reports</h1>
              <p className="text-slate-600">Financial tracking and performance analytics</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-4">
              <Select value={selectedExpert} onValueChange={setSelectedExpert}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select expert (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Experts</SelectItem>
                  {expertData
                    .filter((expert) => expert.expert_id && expert.expert_id.trim() !== "")
                    .map((expert) => (
                      <SelectItem key={expert.expert_id} value={expert.expert_id}>
                        {expert.expert_name} ({expert.expert_type})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Expert Cards */}
        <div className="grid gap-6 mb-8">
          {filteredData.map((expert) => (
            <Card key={expert.expert_id} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>{expert.expert_name}</span>
                    <Badge variant="outline">{expert.expert_type}</Badge>
                  </CardTitle>
                </div>
                <Button
                  onClick={() => generateExpertPDF(expert)}
                  className="flex items-center space-x-2"
                  size="sm"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Report</span>
                </Button>
              </CardHeader>
              <CardContent>
                {/* Financial Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Cost Fees</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-700">${expert.total_cost_fees.toFixed(2)}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Deposits Paid</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700">${expert.deposits_paid.toFixed(2)}</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      <span className="font-medium">Debts Owed</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-700">${expert.debts_owed.toFixed(2)}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <span className="font-medium">Total Overdue</span>
                    </div>
                    <p className="text-2xl font-bold text-red-700">${expert.total_overdue.toFixed(2)}</p>
                  </div>
                </div>

                {/* Report Tracking */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-slate-600" />
                      <span className="font-medium">Total Assessments</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-700">{expert.total_assessments}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <span className="font-medium">Completed Reports</span>
                    <p className="text-2xl font-bold text-green-700">{expert.completed_reports}</p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <span className="font-medium">Pending Reports</span>
                    <p className="text-2xl font-bold text-yellow-700">{expert.pending_reports}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <span className="font-medium">Overdue Reports</span>
                    <p className="text-2xl font-bold text-red-700">{expert.overdue_reports}</p>
                  </div>
                </div>

                {/* Claimants Table */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Claimants ({expert.claimants.length})</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Auto ID</TableHead>
                          <TableHead>Claimant Name</TableHead>
                          <TableHead>Appointment Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expert.claimants.map((claimant, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{claimant.auto_id}</TableCell>
                            <TableCell>{claimant.name}</TableCell>
                            <TableCell>{new Date(claimant.appointment_date).toLocaleDateString()}</TableCell>
                            <TableCell>{getStatusBadge(claimant.status)}</TableCell>
                            <TableCell>${claimant.amount.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredData.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-slate-600">No expert reports found.</p>
            </CardContent>
          </Card>
        )}
      </div>
      
      <CompanyFooter />
    </div>
  );
};

export default ExpertReports;