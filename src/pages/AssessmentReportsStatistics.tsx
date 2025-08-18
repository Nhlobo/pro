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

const AssessmentReportsStatistics = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("monthly");

  const monthlyData = [
    { month: "Jan", completed: 45, pending: 12, cancelled: 3 },
    { month: "Feb", completed: 52, pending: 8, cancelled: 2 },
    { month: "Mar", completed: 38, pending: 15, cancelled: 5 },
    { month: "Apr", completed: 61, pending: 10, cancelled: 1 },
    { month: "May", completed: 49, pending: 18, cancelled: 4 },
    { month: "Jun", completed: 55, pending: 14, cancelled: 2 }
  ];

  const assessmentTypeData = [
    { name: "Initial Assessment", value: 45, color: "#8884d8" },
    { name: "Follow-up", value: 30, color: "#82ca9d" },
    { name: "Final Assessment", value: 25, color: "#ffc658" }
  ];

  const expertPerformanceData = [
    { name: "Dr. Smith", assessments: 23, satisfaction: 4.8 },
    { name: "Dr. Jones", assessments: 19, satisfaction: 4.6 },
    { name: "Dr. Brown", assessments: 15, satisfaction: 4.9 },
    { name: "Dr. Wilson", assessments: 12, satisfaction: 4.7 }
  ];

  const kpiData = {
    totalAssessments: 312,
    completedReports: 298,
    pendingReports: 14,
    averageCompletionTime: "5.2 days",
    satisfactionRate: "96.5%"
  };

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/assessment-reports-statistics';

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
              <Button className="flex items-center gap-2">
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
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-muted-foreground">Avg. Completion</span>
              </div>
              <p className="text-2xl font-bold mt-2">{kpiData.averageCompletionTime}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-muted-foreground">Satisfaction</span>
              </div>
              <p className="text-2xl font-bold mt-2">{kpiData.satisfactionRate}</p>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Assessment Status by Month</CardTitle>
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
                        <Bar dataKey="cancelled" fill="#ff7c7c" name="Cancelled" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Assessment Types Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={assessmentTypeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {assessmentTypeData.map((entry, index) => (
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