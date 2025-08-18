import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, Search, Calendar, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import CompanyFooter from "@/components/CompanyFooter";

type ScheduledAppointment = {
  id: string;
  claimantName: string;
  expertName: string;
  date: string;
  time: string;
  location: string;
  status: "scheduled" | "completed" | "cancelled" | "in-progress";
  assessmentType: string;
};

const ScheduledAssessment = () => {
  const [searchTerm, setSearchTerm] = useState("");
  
  const mockAppointments: ScheduledAppointment[] = [
    {
      id: "1",
      claimantName: "John Doe",
      expertName: "Dr. Smith",
      date: "2025-08-20",
      time: "10:00",
      location: "Medical Center A",
      status: "scheduled",
      assessmentType: "Initial Assessment"
    },
    {
      id: "2",
      claimantName: "Jane Smith",
      expertName: "Dr. Jones",
      date: "2025-08-21",
      time: "14:30",
      location: "Medical Center B",
      status: "completed",
      assessmentType: "Follow-up Assessment"
    },
    {
      id: "3",
      claimantName: "Mike Johnson",
      expertName: "Dr. Brown",
      date: "2025-08-22",
      time: "09:15",
      location: "Medical Center C",
      status: "in-progress",
      assessmentType: "Final Assessment"
    }
  ];

  const filteredAppointments = mockAppointments.filter(appointment =>
    appointment.claimantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.expertName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "bg-blue-100 text-blue-800";
      case "completed": return "bg-green-100 text-green-800";
      case "cancelled": return "bg-red-100 text-red-800";
      case "in-progress": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleDownloadReport = () => {
    // Implement download functionality
    console.log("Downloading scheduled assessments report...");
  };

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/scheduled-assessment';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Scheduled Assessments - Medico-Legal Assessment System</title>
        <meta name="description" content="View and manage all scheduled medical assessment appointments with download reporting capabilities." />
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
              <h1 className="text-2xl font-bold">Scheduled Assessments</h1>
            </div>
            <Button onClick={handleDownloadReport} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download Report
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Scheduled Assessment Appointments
            </CardTitle>
            <div className="flex items-center gap-2 max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by claimant or expert name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Claimant Name</TableHead>
                    <TableHead>Medical Expert</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Assessment Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium">{appointment.id}</TableCell>
                      <TableCell>{appointment.claimantName}</TableCell>
                      <TableCell>{appointment.expertName}</TableCell>
                      <TableCell>{appointment.date}</TableCell>
                      <TableCell className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {appointment.time}
                      </TableCell>
                      <TableCell>{appointment.location}</TableCell>
                      <TableCell>{appointment.assessmentType}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(appointment.status)}>
                          {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                          <Button variant="outline" size="sm">
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {filteredAppointments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No scheduled assessments found.
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <CompanyFooter />
    </div>
  );
};

export default ScheduledAssessment;