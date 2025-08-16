import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { CalendarIcon, Plus, Filter, ArrowLeft, MoreHorizontal, Check, Download, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Schema for individual appointment in multiple booking
const singleAppointmentSchema = z.object({
  expertId: z.string().min(1, "Expert is required"),
  serviceFee: z.number().min(0, "Service fee must be positive"),
  appointmentDate: z.date(),
  appointmentTime: z.string().min(1, "Appointment time is required"),
});

// Main appointment schema with support for multiple appointments
const appointmentSchema = z.object({
  claimantId: z.string().min(1, "Claimant is required"),
  referringAttorney: z.string().min(1, "Referring attorney is required"),
  matterType: z.enum(["MVA", "Medical Negligence", "Assault Matter", "Slip and Fall Matter"]),
  
  // For single appointment mode
  expertType: z.string().optional(),
  expertId: z.string().optional(),
  serviceFee: z.number().optional(),
  appointmentDate: z.date().optional(),
  appointmentTime: z.string().optional(),
  
  // For multiple appointment mode
  appointments: z.array(singleAppointmentSchema).optional(),
  totalDeposit: z.number().min(0, "Total deposit must be positive").optional(),
  
  // Common fields
  paymentStatus: z.enum(["pending", "deposit", "full_payment"]),
  paymentTerms: z.string().optional(),
  agreementDurationMonths: z.number().optional(),
});

type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface Claimant {
  id: string;
  first_name: string;
  last_name: string;
  auto_id: string;
}

interface MedicalExpert {
  id: string;
  first_name: string;
  last_name: string;
  expert_type: string;
}

interface Appointment {
  id: string;
  claimant_id: string;
  referring_attorney: string;
  matter_type: string;
  expert_id: string;
  service_fee: number;
  appointment_date: string;
  deposit_amount: number;
  payment_status: string;
  payment_terms: string;
  agreement_duration_months: number;
  case_status: string;
  created_at: string;
}

interface ReferringAttorney {
  name: string;
  firm: string;
}

export default function AppointmentSchedule() {
  const [claimants, setClaimants] = useState<Claimant[]>([]);
  const [experts, setExperts] = useState<MedicalExpert[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [savedAttorneys, setSavedAttorneys] = useState<ReferringAttorney[]>([]);
  const [filteredExperts, setFilteredExperts] = useState<MedicalExpert[]>([]);
  const [reportPeriod, setReportPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [isMultipleMode, setIsMultipleMode] = useState(false);
  const [multipleAppointments, setMultipleAppointments] = useState<{
    expertId: string;
    serviceFee: number;
    appointmentDate: Date;
    appointmentTime: string;
  }[]>([]);
  const { toast } = useToast();

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      serviceFee: 0,
      totalDeposit: 0,
      paymentStatus: "pending",
      agreementDurationMonths: 0,
      expertType: "all",
      appointmentTime: "",
      matterType: "MVA",
      appointments: [],
    },
  });

  // Watch expertType to filter experts
  const selectedExpertType = form.watch("expertType");

  useEffect(() => {
    fetchClaimants();
    fetchExperts();
    fetchAppointments();
    fetchSavedAttorneys();
  }, []);

  // Filter experts based on selected type
  useEffect(() => {
    if (selectedExpertType === "all" || !selectedExpertType) {
      setFilteredExperts(experts);
    } else {
      const filtered = experts.filter(expert => 
        expert.expert_type.toLowerCase() === selectedExpertType.toLowerCase()
      );
      setFilteredExperts(filtered);
    }
  }, [experts, selectedExpertType]);


  const fetchClaimants = async () => {
    try {
      const { data, error } = await supabase
        .from("claimants")
        .select("id, first_name, last_name, auto_id");
      
      if (error) throw error;
      setClaimants(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch claimants",
        variant: "destructive",
      });
    }
  };

  const fetchExperts = async () => {
    try {
      const { data, error } = await supabase
        .from("medical_experts")
        .select("id, first_name, last_name, expert_type");
      
      if (error) throw error;
      setExperts(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch medical experts",
        variant: "destructive",
      });
    }
  };

  const fetchAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("appointment_date", { ascending: true });
      
      if (error) throw error;
      
      // Sort by appointment date to ensure earliest dates are first
      const sortedAppointments = (data || []).sort((a, b) => 
        new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
      );
      
      setAppointments(sortedAppointments);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch appointments",
        variant: "destructive",
      });
    }
  };

  const fetchSavedAttorneys = async () => {
    try {
      // Get unique attorneys from appointments and law firms
      const [appointmentsData, lawFirmsData] = await Promise.all([
        supabase
          .from("appointments")
          .select("referring_attorney")
          .not("referring_attorney", "is", null),
        supabase
          .from("law_firms")
          .select("contact_person, name")
          .not("contact_person", "is", null)
      ]);

      const attorneys: ReferringAttorney[] = [];
      
      // Add attorneys from appointments
      if (appointmentsData.data) {
        const uniqueAppointmentAttorneys = [...new Set(appointmentsData.data.map(app => app.referring_attorney))];
        uniqueAppointmentAttorneys.forEach(attorney => {
          if (attorney && !attorneys.some(a => a.name === attorney)) {
            attorneys.push({ name: attorney, firm: "Previous Appointment" });
          }
        });
      }

      // Add attorneys from law firms
      if (lawFirmsData.data) {
        lawFirmsData.data.forEach(firm => {
          if (firm.contact_person && !attorneys.some(a => a.name === firm.contact_person)) {
            attorneys.push({ name: firm.contact_person, firm: firm.name });
          }
        });
      }

      setSavedAttorneys(attorneys);
    } catch (error) {
      console.error("Error fetching saved attorneys:", error);
    }
  };

  // Handle claimant selection to auto-populate attorney
  const handleClaimantChange = (claimantId: string) => {
    form.setValue('claimantId', claimantId);
    
    // Find if this claimant has previous appointments with attorneys
    const claimantAppointments = appointments.filter(app => app.claimant_id === claimantId);
    if (claimantAppointments.length > 0) {
      // Use the most recent attorney for this claimant
      const mostRecentAttorney = claimantAppointments
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        .referring_attorney;
      
      if (mostRecentAttorney) {
        form.setValue('referringAttorney', mostRecentAttorney);
        toast({
          title: "Attorney Auto-populated",
          description: `Used ${mostRecentAttorney} from previous appointment`,
        });
      }
    }
  };

  const addAppointmentToQueue = () => {
    const expertId = form.getValues("expertId");
    const serviceFee = form.getValues("serviceFee");
    const appointmentDate = form.getValues("appointmentDate");
    const appointmentTime = form.getValues("appointmentTime");

    if (!expertId || !serviceFee || !appointmentDate || !appointmentTime) {
      toast({
        title: "Missing Information",
        description: "Please fill in expert, service fee, date, and time before adding to queue",
        variant: "destructive",
      });
      return;
    }

    const newAppointment = {
      expertId,
      serviceFee,
      appointmentDate,
      appointmentTime,
    };

    setMultipleAppointments(prev => [...prev, newAppointment]);
    
    // Clear only the appointment-specific fields
    form.setValue("expertId", "");
    form.setValue("serviceFee", 0);
    form.setValue("appointmentDate", undefined);
    form.setValue("appointmentTime", "");
    form.setValue("expertType", "all");
    
    toast({
      title: "Added to Queue",
      description: `Appointment ${multipleAppointments.length + 1} added to queue`,
    });
  };

  const removeFromQueue = (index: number) => {
    setMultipleAppointments(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: AppointmentFormData) => {
    if (isMultipleMode) {
      // Handle multiple appointments submission
      if (multipleAppointments.length === 0) {
        toast({
          title: "No Appointments",
          description: "Please add at least one appointment to the queue",
          variant: "destructive",
        });
        return;
      }
      
      try {
        const { data: lawFirmData } = await supabase.rpc('get_current_user_law_firm');
        const paymentDate = data.paymentStatus !== "pending" ? new Date().toISOString() : null;
        
        // Calculate total service fees and per-appointment deposit
        const totalServiceFee = multipleAppointments.reduce((sum, app) => sum + app.serviceFee, 0);
        const totalDeposit = data.totalDeposit || 0;
        const depositPerAppointment = totalDeposit / multipleAppointments.length;
        
        const appointmentsToInsert = multipleAppointments.map(appointment => {
          const [hours, minutes] = appointment.appointmentTime.split(':');
          const appointmentDateTime = new Date(appointment.appointmentDate);
          appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          
          return {
            claimant_id: data.claimantId,
            referring_attorney: data.referringAttorney,
            matter_type: data.matterType,
            expert_id: appointment.expertId,
            service_fee: appointment.serviceFee,
            appointment_date: appointmentDateTime.toISOString(),
            deposit_amount: depositPerAppointment,
            payment_status: data.paymentStatus,
            payment_date: paymentDate,
            payment_terms: data.paymentTerms,
            agreement_duration_months: data.agreementDurationMonths,
            law_firm_id: lawFirmData,
          };
        });

        const { error } = await supabase
          .from("appointments")
          .insert(appointmentsToInsert);

        if (error) throw error;

        toast({
          title: "Success",
          description: `${multipleAppointments.length} appointments scheduled successfully`,
        });

        setMultipleAppointments([]);
        setIsMultipleMode(false);
        form.reset();
        fetchAppointments();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to schedule multiple appointments",
          variant: "destructive",
        });
      }
      return;
    }

    // Handle single appointment submission
    try {
      const { data: lawFirmData } = await supabase.rpc('get_current_user_law_firm');
      
      const paymentDate = data.paymentStatus !== "pending" ? new Date().toISOString() : null;
      const [hours, minutes] = data.appointmentTime!.split(':');
      const appointmentDateTime = new Date(data.appointmentDate!);
      appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const { error } = await supabase
        .from("appointments")
        .insert({
          claimant_id: data.claimantId,
          referring_attorney: data.referringAttorney,
          matter_type: data.matterType,
          expert_id: data.expertId!,
          service_fee: data.serviceFee!,
          appointment_date: appointmentDateTime.toISOString(),
          deposit_amount: data.totalDeposit || 0,
          payment_status: data.paymentStatus,
          payment_date: paymentDate,
          payment_terms: data.paymentTerms,
          agreement_duration_months: data.agreementDurationMonths,
          law_firm_id: lawFirmData,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Appointment scheduled successfully",
      });

      form.reset();
      fetchAppointments();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to schedule appointment",
        variant: "destructive",
      });
    }
  };

  const getTotalServiceFees = () => {
    return multipleAppointments.reduce((total, appointment) => total + appointment.serviceFee, 0);
  };

  const updateCaseStatus = async (appointmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ case_status: newStatus })
        .eq("id", appointmentId);

      if (error) throw error;
      fetchAppointments();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update case status",
        variant: "destructive",
      });
    }
  };

  const getClaimantInfo = (claimantId: string) => {
    const claimant = claimants.find(c => c.id === claimantId);
    return claimant ? { name: `${claimant.first_name} ${claimant.last_name}`, autoId: claimant.auto_id } : { name: "Unknown", autoId: "N/A" };
  };

  const getExpertInfo = (expertId: string) => {
    const expert = experts.find(e => e.id === expertId);
    return expert ? { name: `${expert.first_name} ${expert.last_name}`, type: expert.expert_type } : { name: "Unknown", type: "N/A" };
  };

  const uniqueExpertTypes = [...new Set(experts.map(expert => expert.expert_type))];

  // Filter appointments by period
  const getFilteredAppointments = () => {
    const now = reportDate;
    let start: Date, end: Date;

    switch (reportPeriod) {
      case 'monthly':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'quarterly':
        start = startOfQuarter(now);
        end = endOfQuarter(now);
        break;
      case 'yearly':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
    }

    return appointments.filter(appointment => 
      isWithinInterval(new Date(appointment.appointment_date), { start, end })
    );
  };

  const filteredAppointments = getFilteredAppointments();

  // Calculate statistics
  const getStatistics = () => {
    const mvaCount = filteredAppointments.filter(appointment => {
      const expertInfo = getExpertInfo(appointment.expert_id);
      return expertInfo.type.toLowerCase().includes('mva') || expertInfo.type.toLowerCase().includes('motor vehicle');
    }).length;

    const medNegCount = filteredAppointments.filter(appointment => {
      const expertInfo = getExpertInfo(appointment.expert_id);
      return expertInfo.type.toLowerCase().includes('medical negligence') || 
             expertInfo.type.toLowerCase().includes('negligence') ||
             expertInfo.type.toLowerCase().includes('medico-legal');
    }).length;

    const totalCount = filteredAppointments.length;

    return { mvaCount, medNegCount, totalCount };
  };

  const statistics = getStatistics();

  // Generate PDF report
  const generatePDFReport = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Appointment Report', pageWidth / 2, 20, { align: 'center' });
      
      // Period info
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const periodText = `${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)} Report - ${format(reportDate, 'MMMM yyyy')}`;
      doc.text(periodText, pageWidth / 2, 30, { align: 'center' });
      
      // Statistics
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary Statistics', 14, 45);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Appointments: ${statistics.totalCount}`, 14, 55);
      doc.text(`MVA Assessments: ${statistics.mvaCount}`, 14, 65);
      doc.text(`Medical Negligence Assessments: ${statistics.medNegCount}`, 14, 75);
      doc.text(`Other Assessments: ${statistics.totalCount - statistics.mvaCount - statistics.medNegCount}`, 14, 85);
      
      // Check if there are appointments to include in the report
      if (filteredAppointments.length === 0) {
        doc.setFontSize(12);
        doc.text('No appointments found for the selected period.', 14, 105);
      } else {
        // Table data
        const tableData = filteredAppointments.map(appointment => {
          const claimantInfo = getClaimantInfo(appointment.claimant_id);
          const expertInfo = getExpertInfo(appointment.expert_id);
          
          return [
            claimantInfo.autoId,
            format(new Date(appointment.appointment_date), 'yyyy-MM-dd HH:mm'),
            appointment.matter_type || 'N/A',
            expertInfo.name,
            expertInfo.type,
            claimantInfo.name,
            appointment.referring_attorney,
            `R${appointment.service_fee}`,
            appointment.payment_status.replace('_', ' '),
            appointment.case_status || 'Active'
          ];
        });

        // Table headers
        const headers = [
          'Auto Code', 'Date', 'Matter Type', 'Expert', 'Expert Type', 'Claimant', 
          'Attorney', 'Fee', 'Payment', 'Status'
        ];

        // Add table
        (doc as any).autoTable({
          head: [headers],
          body: tableData,
          startY: 95,
          fontSize: 8,
          cellWidth: 'wrap',
          styles: {
            fontSize: 8,
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [66, 139, 202],
            textColor: 255,
            fontStyle: 'bold'
          },
          columnStyles: {
            0: { cellWidth: 12 },
            1: { cellWidth: 22 },
            2: { cellWidth: 18 },
            3: { cellWidth: 18 },
            4: { cellWidth: 18 },
            5: { cellWidth: 18 },
            6: { cellWidth: 18 },
            7: { cellWidth: 12 },
            8: { cellWidth: 12 },
            9: { cellWidth: 12 }
          }
        });
      }

      // Save the PDF
      const fileName = `appointments_${reportPeriod}_${format(reportDate, 'yyyy-MM')}.pdf`;
      // Use a robust download approach that works well in iframes
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `PDF report downloaded: ${fileName}`,
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF report. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="mb-6">
        <Button variant="outline" asChild>
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Appointment Schedule</h1>
      </div>

      {/* Appointment Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              {isMultipleMode ? "Schedule Multiple Appointments" : "Schedule New Appointment"}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                type="button"
                variant={isMultipleMode ? "default" : "outline"}
                onClick={() => {
                  setIsMultipleMode(!isMultipleMode);
                  setMultipleAppointments([]);
                  form.reset();
                }}
              >
                {isMultipleMode ? "Single Mode" : "Multiple Mode"}
              </Button>
              {isMultipleMode && multipleAppointments.length > 0 && (
                <Button 
                  type="button"
                  onClick={() => form.handleSubmit(onSubmit)()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Submit All ({multipleAppointments.length})
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Claimant Selection */}
                <FormField
                  control={form.control}
                  name="claimantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Claimant</FormLabel>
                      <Select onValueChange={handleClaimantChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select claimant" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {claimants.map((claimant) => (
                            <SelectItem key={claimant.id} value={claimant.id}>
                              {claimant.first_name} {claimant.last_name} ({claimant.auto_id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Referring Attorney */}
                <FormField
                  control={form.control}
                  name="referringAttorney"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referring Attorney</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select attorney" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {savedAttorneys.map((attorney) => (
                            <SelectItem key={`${attorney.name}-${attorney.firm}`} value={attorney.name}>
                              {attorney.name} ({attorney.firm})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Type of Matter */}
                <FormField
                  control={form.control}
                  name="matterType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type of Matter</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select matter type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MVA">MVA</SelectItem>
                          <SelectItem value="Medical Negligence">Medical Negligence</SelectItem>
                          <SelectItem value="Assault Matter">Assault Matter</SelectItem>
                          <SelectItem value="Slip and Fall Matter">Slip and Fall Matter</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Expert Type Filter */}
                <FormField
                  control={form.control}
                  name="expertType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expert Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select expert type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {uniqueExpertTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Expert Selection */}
                <FormField
                  control={form.control}
                  name="expertId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medical Expert</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select expert" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredExperts.map((expert) => (
                            <SelectItem key={expert.id} value={expert.id}>
                              {expert.first_name} {expert.last_name} ({expert.expert_type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="serviceFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Fee</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="appointmentDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Appointment Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "yyyy-MM-dd")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              field.onChange(date);
                              form.trigger("appointmentDate");
                            }}
                            disabled={(date) => {
                              // Only disable past dates, allow all future dates for advance booking
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              return date < today;
                            }}
                            initialFocus
                            className="pointer-events-auto"
                            captionLayout="dropdown-buttons"
                            fromYear={new Date().getFullYear()}
                            toYear={new Date().getFullYear() + 2}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="appointmentTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Appointment Time</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          {...field}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="totalDeposit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isMultipleMode ? "Total Deposit Amount" : "Deposit Amount"}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Status</FormLabel>
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        // Auto-set payment date when status changes from pending
                        if (value !== "pending") {
                          // Payment date will be set in onSubmit
                        }
                      }} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="deposit">Deposit Paid</SelectItem>
                          <SelectItem value="full_payment">Full Payment</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="agreementDurationMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agreement Duration (Months)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="paymentTerms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter payment terms and conditions..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Multiple Mode Summary */}
              {isMultipleMode && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Multiple Appointments Summary</h4>
                      <p className="text-sm text-muted-foreground">
                        Total Queued: {multipleAppointments.length} | 
                        Total Service Fees: R{getTotalServiceFees()}
                      </p>
                    </div>
                    <Button 
                      type="button"
                      onClick={addAppointmentToQueue}
                      variant="outline"
                    >
                      Add to Queue
                    </Button>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full">
                {isMultipleMode ? "Add to Queue" : "Schedule Appointment"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Multiple Appointments Queue */}
      {isMultipleMode && multipleAppointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Queued Appointments ({multipleAppointments.length})
              </div>
              <Button 
                variant="outline" 
                onClick={() => setMultipleAppointments([])}
                className="text-red-600 hover:text-red-700"
              >
                Clear All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {multipleAppointments.map((appointment, index) => {
                const expertInfo = getExpertInfo(appointment.expertId);
                
                return (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                      <div>
                        <div className="font-medium">{format(appointment.appointmentDate, "yyyy-MM-dd")}</div>
                        <div className="text-sm text-muted-foreground">{appointment.appointmentTime}</div>
                      </div>
                      <div>
                        <div className="font-medium">{expertInfo.name}</div>
                        <div className="text-sm text-muted-foreground">{expertInfo.type}</div>
                      </div>
                      <div>
                        <div className="font-medium">R{appointment.serviceFee}</div>
                        <div className="text-sm text-muted-foreground">Service Fee</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removeFromQueue(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Controls and Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Report & Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {/* Report Period Selection */}
            <div className="flex gap-2">
              <Select value={reportPeriod} onValueChange={(value: 'monthly' | 'quarterly' | 'yearly') => setReportPeriod(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Picker for Report Period */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-60">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(reportDate, "MMMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={reportDate}
                    onSelect={(date) => date && setReportDate(date)}
                    initialFocus
                    captionLayout="dropdown-buttons"
                    fromYear={2020}
                    toYear={new Date().getFullYear() + 2}
                  />
                </PopoverContent>
              </Popover>

              <Button type="button" onClick={generatePDFReport} className="flex items-center gap-2" aria-label="Download appointment report as PDF">
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{statistics.totalCount}</div>
                <div className="text-sm text-muted-foreground">Total Appointments</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{statistics.mvaCount}</div>
                <div className="text-sm text-muted-foreground">MVA Assessments</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{statistics.medNegCount}</div>
                <div className="text-sm text-muted-foreground">Medical Negligence</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{statistics.totalCount - statistics.mvaCount - statistics.medNegCount}</div>
                <div className="text-sm text-muted-foreground">Other Assessments</div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Appointments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Scheduled Appointments ({reportPeriod} view)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claimant Auto Code</TableHead>
                  <TableHead>Assessment Date</TableHead>
                  <TableHead>Matter Type</TableHead>
                  <TableHead>Expert Name</TableHead>
                  <TableHead>Expert Type</TableHead>
                  <TableHead>Claimant Name</TableHead>
                  <TableHead>Referring Attorney</TableHead>
                  <TableHead>Service Fee</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Case Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.map((appointment) => {
                  const claimantInfo = getClaimantInfo(appointment.claimant_id);
                  const expertInfo = getExpertInfo(appointment.expert_id);
                  
                  return (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium">{claimantInfo.autoId}</TableCell>
                      <TableCell>{format(new Date(appointment.appointment_date), "yyyy-MM-dd HH:mm")}</TableCell>
                      <TableCell className="font-medium">{appointment.matter_type}</TableCell>
                      <TableCell>{expertInfo.name}</TableCell>
                      <TableCell>{expertInfo.type}</TableCell>
                      <TableCell>{claimantInfo.name}</TableCell>
                      <TableCell>{appointment.referring_attorney}</TableCell>
                      <TableCell>R{appointment.service_fee}</TableCell>
                      <TableCell className="capitalize">{appointment.payment_status.replace('_', ' ')}</TableCell>
                       <TableCell className="capitalize">{appointment.case_status}</TableCell>
                       <TableCell>
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button variant="ghost" className="h-8 w-8 p-0">
                               <span className="sr-only">Open actions menu</span>
                               <MoreHorizontal className="h-4 w-4" />
                             </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent 
                             align="end" 
                             className="w-48 bg-background border border-border shadow-lg z-50"
                           >
                             {["scheduled", "assessed", "cancelled", "rescheduled"].map((status) => (
                               <DropdownMenuItem
                                 key={status}
                                 className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent"
                                 onClick={() => updateCaseStatus(appointment.id, status)}
                               >
                                 <span className="capitalize text-sm">{status}</span>
                                 {appointment.case_status === status && (
                                   <Check className="h-4 w-4 text-primary" />
                                 )}
                               </DropdownMenuItem>
                             ))}
                           </DropdownMenuContent>
                         </DropdownMenu>
                       </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}