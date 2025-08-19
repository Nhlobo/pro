import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { ArrowLeft, Download, TrendingUp, Calendar, FileText, Users, Archive, History } from "lucide-react";
import { Link } from "react-router-dom";
import CompanyFooter from "@/components/CompanyFooter";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from "@/utils/pdfBranding";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AssessmentReportsStatistics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor((new Date().getMonth() + 3) / 3));
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [isHistoricalView, setIsHistoricalView] = useState(false);
  const [currentArchive, setCurrentArchive] = useState<any>(null);
  const { toast } = useToast();

  // Matter type contribution data
  const matterTypeData = [
    { name: "MVA", total: 125, completed: 110, pending: 12, takenOut: 3, color: "hsl(var(--primary))" },
    { name: "Medical Negligence", total: 89, completed: 82, pending: 5, takenOut: 2, color: "#82ca9d" },
    { name: "PRASA Matter", total: 67, completed: 62, pending: 4, takenOut: 1, color: "#ffc658" },
    { name: "Other Matters", total: 31, completed: 28, pending: 2, takenOut: 1, color: "#ff7c7c" }
  ];

  // Report status summary
  const reportStatusData = [
    { name: "Completed Reports", value: 282, color: "hsl(var(--primary))" },
    { name: "Reports Taken Out", value: 7, color: "#ff7c7c" },
    { name: "Pending Reports", value: 23, color: "#ffc658" }
  ];

  // Monthly trend data
  const monthlyData = [
    { month: "Jan", completed: 45, pending: 12, takenOut: 3 },
    { month: "Feb", completed: 52, pending: 8, takenOut: 2 },
    { month: "Mar", completed: 38, pending: 15, takenOut: 5 },
    { month: "Apr", completed: 61, pending: 10, takenOut: 1 },
    { month: "May", completed: 49, pending: 18, takenOut: 4 },
    { month: "Jun", completed: 55, pending: 14, takenOut: 2 }
  ];

  const expertPerformanceData = [
    { name: "Dr. Smith", assessments: 23, satisfaction: 4.8 },
    { name: "Dr. Jones", assessments: 19, satisfaction: 4.6 },
    { name: "Dr. Brown", assessments: 15, satisfaction: 4.9 },
    { name: "Dr. Wilson", assessments: 12, satisfaction: 4.7 }
  ];

  // Calculate totals from matter type data
  const totalAssessments = matterTypeData.reduce((sum, matter) => sum + matter.total, 0);
  const totalCompleted = matterTypeData.reduce((sum, matter) => sum + matter.completed, 0);
  const totalPending = matterTypeData.reduce((sum, matter) => sum + matter.pending, 0);
  const totalTakenOut = matterTypeData.reduce((sum, matter) => sum + matter.takenOut, 0);

  const kpiData = {
    totalAssessments,
    completedReports: totalCompleted,
    pendingReports: totalPending,
    reportsTakenOut: totalTakenOut,
    completionRate: `${((totalCompleted / totalAssessments) * 100).toFixed(1)}%`
  };

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/assessment-reports-statistics';

  // Load historical data on component mount
  useEffect(() => {
    loadHistoricalData();
  }, [selectedPeriod]);

  const loadHistoricalData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('archive-assessment-data', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: { period_type: selectedPeriod }
      });

      if (error) throw error;
      setHistoricalData(data.archives || []);
    } catch (error) {
      console.error('Error loading historical data:', error);
      toast({
        title: "Error",
        description: "Failed to load historical data",
        variant: "destructive",
      });
    }
  };

  const archiveCurrentData = async () => {
    try {
      const currentDate = new Date();
      let periodStart: Date, periodEnd: Date;

      switch (selectedPeriod) {
        case 'monthly':
          periodStart = new Date(selectedYear, selectedMonth, 1);
          periodEnd = new Date(selectedYear, selectedMonth + 1, 0);
          break;
        case 'quarterly':
          const quarterStartMonth = (selectedQuarter - 1) * 3;
          periodStart = new Date(selectedYear, quarterStartMonth, 1);
          periodEnd = new Date(selectedYear, quarterStartMonth + 3, 0);
          break;
        case 'yearly':
          periodStart = new Date(selectedYear, 0, 1);
          periodEnd = new Date(selectedYear, 11, 31);
          break;
        default:
          return;
      }

      const assessmentData = {
        total_assessments: kpiData.totalAssessments,
        completed_reports: kpiData.completedReports,
        pending_reports: kpiData.pendingReports,
        reports_taken_out: kpiData.reportsTakenOut,
        completion_rate: parseFloat(kpiData.completionRate.replace('%', '')),
        matter_type_data: matterTypeData,
        expert_performance_data: expertPerformanceData,
        monthly_trends_data: monthlyData,
      };

      const { data, error } = await supabase.functions.invoke('archive-assessment-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          period_type: selectedPeriod,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          assessment_data: assessmentData,
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} data archived successfully`,
      });

      // Reload historical data
      loadHistoricalData();
    } catch (error) {
      console.error('Error archiving data:', error);
      toast({
        title: "Error",
        description: "Failed to archive current data",
        variant: "destructive",
      });
    }
  };

  const loadHistoricalReport = (archive: any) => {
    setCurrentArchive(archive);
    setIsHistoricalView(true);
  };

  const generateHistoricalPDF = (archive: any) => {
    const doc = new jsPDF();
    
    const periodStart = new Date(archive.period_start);
    const periodEnd = new Date(archive.period_end);
    
    let periodTitle = '';
    let filename = '';
    
    switch (archive.period_type) {
      case 'monthly':
        periodTitle = `${periodStart.toLocaleString('default', { month: 'long' })} ${periodStart.getFullYear()}`;
        filename = `historical-assessment-report-${periodStart.toLocaleString('default', { month: 'long' }).toLowerCase()}-${periodStart.getFullYear()}.pdf`;
        break;
      case 'quarterly':
        const quarter = Math.floor((periodStart.getMonth() + 3) / 3);
        periodTitle = `Q${quarter} ${periodStart.getFullYear()}`;
        filename = `historical-assessment-report-q${quarter}-${periodStart.getFullYear()}.pdf`;
        break;
      case 'yearly':
        periodTitle = `${periodStart.getFullYear()}`;
        filename = `historical-assessment-report-${periodStart.getFullYear()}.pdf`;
        break;
    }
    
    // Add branding
    let currentY = addBrandingToPDF(doc, 'Historical Assessment Reports & Statistics', `Report Period: ${periodTitle}`);
    
    // Add archived date
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Archived: ${new Date(archive.archived_date).toLocaleDateString()}`, 105, currentY, { align: 'center' });
    currentY += 20;
    
    // KPI Summary
    doc.setFontSize(16);
    doc.text('Key Performance Indicators', 20, currentY);
    currentY += 10;
    
    const kpiTableData = [
      ['Total Assessments', archive.total_assessments.toString()],
      ['Completed Reports', archive.completed_reports.toString()],
      ['Pending Reports', archive.pending_reports.toString()],
      ['Reports Taken Out', archive.reports_taken_out.toString()],
      ['Completion Rate', `${archive.completion_rate}%`]
    ];
    
    autoTable(doc, {
      startY: currentY,
      head: [['Metric', 'Value']],
      body: kpiTableData,
      theme: 'striped',
      ...getStyledTableOptions()
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 20;
    
    // Matter Type Analysis
    doc.setFontSize(16);
    doc.text('Assessment Analysis by Matter Type', 20, currentY);
    currentY += 10;
    
    const matterTableData = archive.matter_type_data.map((matter: any) => [
      matter.name,
      matter.total.toString(),
      matter.completed.toString(),
      matter.pending.toString(),
      matter.takenOut.toString(),
      `${((matter.completed / matter.total) * 100).toFixed(1)}%`
    ]);
    
    autoTable(doc, {
      startY: currentY,
      head: [['Matter Type', 'Total', 'Completed', 'Pending', 'Taken Out', 'Completion Rate']],
      body: matterTableData,
      theme: 'striped',
      ...getStyledTableOptions()
    });
    
    // Add branded footer
    addBrandingFooter(doc);
    
    doc.save(filename);
  };

  // Get the data to display (current or historical)
  const displayData = isHistoricalView && currentArchive ? {
    totalAssessments: currentArchive.total_assessments,
    completedReports: currentArchive.completed_reports,
    pendingReports: currentArchive.pending_reports,
    reportsTakenOut: currentArchive.reports_taken_out,
    completionRate: `${currentArchive.completion_rate}%`,
    matterTypeData: currentArchive.matter_type_data,
    expertPerformanceData: currentArchive.expert_performance_data,
    monthlyData: currentArchive.monthly_trends_data,
  } : {
    totalAssessments: kpiData.totalAssessments,
    completedReports: kpiData.completedReports,
    pendingReports: kpiData.pendingReports,
    reportsTakenOut: kpiData.reportsTakenOut,
    completionRate: kpiData.completionRate,
    matterTypeData,
    expertPerformanceData,
    monthlyData,
  };

  const generatePDFReport = () => {
    const doc = new jsPDF();
    
    // Get current date and period info
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
    const currentYear = currentDate.getFullYear();
    const currentQuarter = Math.floor((currentDate.getMonth() + 3) / 3);
    
    let periodTitle = '';
    let filename = '';
    
    switch (selectedPeriod) {
      case 'monthly':
        periodTitle = `${currentMonth} ${currentYear}`;
        filename = `assessment-report-${currentMonth.toLowerCase()}-${currentYear}.pdf`;
        break;
      case 'quarterly':
        periodTitle = `Q${currentQuarter} ${currentYear}`;
        filename = `assessment-report-q${currentQuarter}-${currentYear}.pdf`;
        break;
      case 'yearly':
        periodTitle = `${currentYear}`;
        filename = `assessment-report-${currentYear}.pdf`;
        break;
    }
    
    // Add branding
    let currentY = addBrandingToPDF(doc, 'Assessment Reports & Statistics', `Report Period: ${periodTitle}`);
    
    // KPI Summary
    doc.setFontSize(16);
    doc.text('Key Performance Indicators', 20, currentY);
    currentY += 10;
    
    const kpiTableData = [
      ['Total Assessments', kpiData.totalAssessments.toString()],
      ['Completed Reports', kpiData.completedReports.toString()],
      ['Pending Reports', kpiData.pendingReports.toString()],
      ['Reports Taken Out', kpiData.reportsTakenOut.toString()],
      ['Completion Rate', kpiData.completionRate]
    ];
    
    autoTable(doc, {
      startY: currentY,
      head: [['Metric', 'Value']],
      body: kpiTableData,
      theme: 'striped',
      ...getStyledTableOptions()
    });
    
    // Get the final Y position after the table
    currentY = (doc as any).lastAutoTable.finalY + 20;
    
    // Matter Type Analysis
    doc.setFontSize(16);
    doc.text('Assessment Analysis by Matter Type', 20, currentY);
    currentY += 10;
    
    const matterTableData = matterTypeData.map(matter => [
      matter.name,
      matter.total.toString(),
      matter.completed.toString(),
      matter.pending.toString(),
      matter.takenOut.toString(),
      `${((matter.completed / matter.total) * 100).toFixed(1)}%`
    ]);
    
    autoTable(doc, {
      startY: currentY,
      head: [['Matter Type', 'Total', 'Completed', 'Pending', 'Taken Out', 'Completion Rate']],
      body: matterTableData,
      theme: 'striped',
      ...getStyledTableOptions()
    });
    
    // Expert Performance (if needed)
    if (expertPerformanceData.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Expert Performance Overview', 20, 20);
      
      const expertTableData = expertPerformanceData.map(expert => [
        expert.name,
        expert.assessments.toString(),
        expert.satisfaction.toString()
      ]);
      
      autoTable(doc, {
        startY: 30,
        head: [['Expert Name', 'Assessments', 'Satisfaction Rating']],
        body: expertTableData,
        theme: 'striped',
        ...getStyledTableOptions()
      });
    }
    
    // Add branded footer
    addBrandingFooter(doc);
    
    // Save the PDF
    doc.save(filename);
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Assessment Reports & Statistics - Medico-Legal Assessment System</title>
        <meta name="description" content="Comprehensive reports and statistics for medical assessment performance, completion rates, and expert analytics." />
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
              <h1 className="text-2xl font-bold">
                {isHistoricalView ? 'Historical Assessment Reports' : 'Assessment Reports & Statistics'}
              </h1>
              {isHistoricalView && (
                <Button variant="outline" size="sm" onClick={() => {
                  setIsHistoricalView(false);
                  setCurrentArchive(null);
                }}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Current
                </Button>
              )}
            </div>
            <div className="flex items-center gap-4">
              {!isHistoricalView && (
                <>
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly View</SelectItem>
                      <SelectItem value="quarterly">Quarterly View</SelectItem>
                      <SelectItem value="yearly">Yearly View</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {selectedPeriod === "monthly" && (
                    <>
                      <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {new Date(0, i).toLocaleString('default', { month: 'long' })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => {
                            const year = new Date().getFullYear() - i;
                            return (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  
                  <Button onClick={archiveCurrentData} variant="outline" className="flex items-center gap-2">
                    <Archive className="h-4 w-4" />
                    Archive Current
                  </Button>
                  
                  <Button onClick={generatePDFReport} className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export Report
                  </Button>
                </>
              )}
              
              {isHistoricalView && currentArchive && (
                <Button onClick={() => generateHistoricalPDF(currentArchive)} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download Historical Report
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Historical Data Navigation */}
        {!isHistoricalView && historicalData.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historical Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {historicalData.slice(0, 6).map((archive) => {
                  const periodStart = new Date(archive.period_start);
                  const periodTitle = archive.period_type === 'monthly' 
                    ? `${periodStart.toLocaleString('default', { month: 'long' })} ${periodStart.getFullYear()}`
                    : archive.period_type === 'quarterly'
                    ? `Q${Math.floor((periodStart.getMonth() + 3) / 3)} ${periodStart.getFullYear()}`
                    : `${periodStart.getFullYear()}`;
                  
                  return (
                    <Card key={archive.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => loadHistoricalReport(archive)}>
                      <CardContent className="p-4">
                        <h4 className="font-semibold text-sm mb-2">{periodTitle}</h4>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>Total: {archive.total_assessments}</p>
                          <p>Completed: {archive.completed_reports}</p>
                          <p>Rate: {archive.completion_rate}%</p>
                        </div>
                        <Button size="sm" variant="outline" className="w-full mt-3">
                          View Report
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Total Assessments</span>
              </div>
              <p className="text-2xl font-bold mt-2">{displayData.totalAssessments}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Completed Reports</span>
              </div>
              <p className="text-2xl font-bold mt-2">{displayData.completedReports}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-muted-foreground">Pending Reports</span>
              </div>
              <p className="text-2xl font-bold mt-2">{displayData.pendingReports}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-red-600" />
                <span className="text-sm text-muted-foreground">Reports Taken Out</span>
              </div>
              <p className="text-2xl font-bold mt-2">{displayData.reportsTakenOut}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-muted-foreground">Completion Rate</span>
              </div>
              <p className="text-2xl font-bold mt-2">{displayData.completionRate}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Expert Performance</TabsTrigger>
            <TabsTrigger value="trends">Trends Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Matter Type Contributions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle>Assessments by Matter Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={displayData.matterTypeData}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="total" fill="hsl(var(--primary))" name="Total Assessments" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Overall Report Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reportStatusData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {reportStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Matter Type Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle>Matter Type Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Matter Type</th>
                        <th className="text-center p-2">Total Assessments</th>
                        <th className="text-center p-2">Completed Reports</th>
                        <th className="text-center p-2">Pending Reports</th>
                        <th className="text-center p-2">Reports Taken Out</th>
                        <th className="text-center p-2">Completion Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayData.matterTypeData.map((matter: any, index: number) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-medium">{matter.name}</td>
                          <td className="text-center p-2">{matter.total}</td>
                          <td className="text-center p-2 text-green-600">{matter.completed}</td>
                          <td className="text-center p-2 text-yellow-600">{matter.pending}</td>
                          <td className="text-center p-2 text-red-600">{matter.takenOut}</td>
                          <td className="text-center p-2">{((matter.completed / matter.total) * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Status Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Report Status Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={displayData.monthlyData}>
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="completed" fill="hsl(var(--primary))" name="Completed" />
                      <Bar dataKey="pending" fill="#ffc658" name="Pending" />
                      <Bar dataKey="takenOut" fill="#ff7c7c" name="Taken Out" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Expert Performance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={displayData.expertPerformanceData}>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="assessments" fill="hsl(var(--primary))" name="Assessments Completed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assessment Completion Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={displayData.monthlyData}>
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="completed" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <CompanyFooter />
    </div>
  );
};

export default AssessmentReportsStatistics;