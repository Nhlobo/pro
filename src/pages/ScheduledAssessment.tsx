import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Download, Search, Calendar, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CompanyFooter from "@/components/CompanyFooter";

type ScheduledAppointment = {
  id: string;
  auto_id: string;
  claimant_name: string;
  expert_name: string;
  expert_type: string;
  appointment_date: string;
  appointment_time: string;
  referring_attorney: string;
  deposit: string;
  status: string;
  report_status: string;
  comments: string;
  deposit_date?: string;
  report_date?: string;
};

const ScheduledAssessment = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [appointments, setAppointments] = useState<ScheduledAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          deposit_amount,
          payment_date,
          case_status,
          referring_attorney,
          claimants!inner (
            auto_id,
            first_name,
            last_name
          ),
          medical_experts!inner (
            first_name,
            last_name,
            expert_type
          ),
          expert_reports (
            report_status,
            report_submitted_date
          )
        `)
        .order('appointment_date', { ascending: false });

      if (error) throw error;

      const formattedAppointments: ScheduledAppointment[] = data?.map((appointment: any) => ({
        id: appointment.id,
        auto_id: appointment.claimants?.auto_id || 'N/A',
        claimant_name: `${appointment.claimants?.first_name || ''} ${appointment.claimants?.last_name || ''}`.trim(),
        expert_name: `${appointment.medical_experts?.first_name || ''} ${appointment.medical_experts?.last_name || ''}`.trim(),
        expert_type: appointment.medical_experts?.expert_type || 'N/A',
        appointment_date: appointment.appointment_date ? format(new Date(appointment.appointment_date), 'MMM dd, yyyy') : 'N/A',
        appointment_time: appointment.appointment_date ? format(new Date(appointment.appointment_date), 'HH:mm') : 'N/A',
        referring_attorney: appointment.referring_attorney || 'N/A',
        deposit: appointment.deposit_amount > 0 ? 'Yes' : 'No',
        status: appointment.case_status || 'Scheduled',
        report_status: appointment.expert_reports?.[0]?.report_status || 'Not Received',
        comments: '',
        deposit_date: appointment.payment_date ? format(new Date(appointment.payment_date), 'MMM dd, yyyy') : undefined,
        report_date: appointment.expert_reports?.[0]?.report_submitted_date ? format(new Date(appointment.expert_reports[0].report_submitted_date), 'MMM dd, yyyy') : undefined
      })) || [];

      setAppointments(formattedAppointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast({
        title: "Error",
        description: "Failed to fetch appointments. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAppointments = appointments.filter(appointment =>
    appointment.claimant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.expert_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appointment.auto_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "scheduled": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "assessed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "rescheduled": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getReportStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "received": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "not received": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "preparing report": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "completed": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const updateComments = (appointmentId: string, newComments: string) => {
    setComments(prev => ({
      ...prev,
      [appointmentId]: newComments
    }));
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
                    <TableHead>Auto ID</TableHead>
                    <TableHead>Medical Expert</TableHead>
                    <TableHead>Type of Expert</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Referring Attorney</TableHead>
                    <TableHead>Deposit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Report Status</TableHead>
                    <TableHead>Comments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        Loading appointments...
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAppointments.map((appointment) => (
                      <TableRow key={appointment.id}>
                        <TableCell className="font-medium">{appointment.auto_id}</TableCell>
                        <TableCell>{appointment.expert_name}</TableCell>
                        <TableCell>{appointment.expert_type}</TableCell>
                        <TableCell>{appointment.appointment_date}</TableCell>
                        <TableCell className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {appointment.appointment_time}
                        </TableCell>
                        <TableCell>{appointment.referring_attorney}</TableCell>
                        <TableCell>
                          <Badge variant={appointment.deposit === 'Yes' ? 'default' : 'secondary'}>
                            {appointment.deposit}
                            {appointment.deposit === 'Yes' && appointment.deposit_date && (
                              <span className="text-xs block">({appointment.deposit_date})</span>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(appointment.status)}>
                            {appointment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getReportStatusColor(appointment.report_status)}>
                            {appointment.report_status}
                            {appointment.report_status === 'Received' && appointment.report_date && (
                              <span className="text-xs block">({appointment.report_date})</span>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Textarea
                            placeholder="Add comments..."
                            value={comments[appointment.id] || appointment.comments}
                            onChange={(e) => updateComments(appointment.id, e.target.value)}
                            className="min-h-[60px] w-40"
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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