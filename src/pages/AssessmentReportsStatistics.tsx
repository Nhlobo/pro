import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { ArrowLeft, Download, TrendingUp, Calendar, FileText, Users } from "lucide-react";
import { Link } from "react-router-dom";
import CompanyFooter from "@/components/CompanyFooter";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const AssessmentReportsStatistics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("monthly");

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

  const generatePDFReport = () => {
    const doc = new jsPDF();
    let currentY = 20;
    
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
    
    // Title
    doc.setFontSize(20);
    doc.text('Assessment Reports & Statistics', 20, currentY);
    currentY += 15;
    
    doc.setFontSize(14);
    doc.text(`Report Period: ${periodTitle}`, 20, currentY);
    currentY += 10;
    doc.text(`Generated: ${currentDate.toLocaleDateString()}`, 20, currentY);
    currentY += 20;
    
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
      headStyles: { fillColor: [41, 128, 185] }
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
      headStyles: { fillColor: [41, 128, 185] }
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
        headStyles: { fillColor: [41, 128, 185] }
      });
    }
    
    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.text(`Page ${i} of ${pageCount}`, 170, 290);
      doc.text('Medico-Legal Assessment System', 20, 290);
    }
    
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
              <h1 className="text-2xl font-bold">Assessment Reports & Statistics</h1>
            </div>
            <div className="flex items-center gap-4">
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
              <Button onClick={generatePDFReport} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export Report
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Total Assessments</span>
              </div>
              <p className="text-2xl font-bold mt-2">{kpiData.totalAssessments}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Completed Reports</span>
              </div>
              <p className="text-2xl font-bold mt-2">{kpiData.completedReports}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-muted-foreground">Pending Reports</span>
              </div>
              <p className="text-2xl font-bold mt-2">{kpiData.pendingReports}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-red-600" />
                <span className="text-sm text-muted-foreground">Reports Taken Out</span>
              </div>
              <p className="text-2xl font-bold mt-2">{kpiData.reportsTakenOut}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-muted-foreground">Completion Rate</span>
              </div>
              <p className="text-2xl font-bold mt-2">{kpiData.completionRate}</p>
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
                      <BarChart data={matterTypeData}>
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
                      {matterTypeData.map((matter, index) => (
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
                    <BarChart data={monthlyData}>
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
                    <BarChart data={expertPerformanceData}>
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
                    <LineChart data={monthlyData}>
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