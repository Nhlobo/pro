import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, Filter, ArrowLeft } from "lucide-react";
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
import { cn } from "@/lib/utils";

const appointmentSchema = z.object({
  claimantId: z.string().min(1, "Claimant is required"),
  referringAttorney: z.string().min(1, "Referring attorney is required"),
  expertId: z.string().min(1, "Expert is required"),
  serviceFee: z.number().min(0, "Service fee must be positive"),
  appointmentDate: z.date(),
  depositAmount: z.number().min(0, "Deposit amount must be positive"),
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

export default function AppointmentSchedule() {
  const [claimants, setClaimants] = useState<Claimant[]>([]);
  const [experts, setExperts] = useState<MedicalExpert[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredClaimants, setFilteredClaimants] = useState<Claimant[]>([]);
  const [filteredExperts, setFilteredExperts] = useState<MedicalExpert[]>([]);
  const [claimantFilter, setClaimantFilter] = useState("");
  const [attorneyFilter, setAttorneyFilter] = useState("");
  const [expertFilter, setExpertFilter] = useState("");
  const [expertTypeFilter, setExpertTypeFilter] = useState("");
  const { toast } = useToast();

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      serviceFee: 0,
      depositAmount: 0,
      paymentStatus: "pending",
      agreementDurationMonths: 0,
    },
  });

  useEffect(() => {
    fetchClaimants();
    fetchExperts();
    fetchAppointments();
  }, []);

  useEffect(() => {
    // Filter claimants based on search
    const filtered = claimants.filter(claimant =>
      `${claimant.first_name} ${claimant.last_name}`.toLowerCase().includes(claimantFilter.toLowerCase()) ||
      claimant.auto_id.toLowerCase().includes(claimantFilter.toLowerCase())
    );
    setFilteredClaimants(filtered);
  }, [claimants, claimantFilter]);

  useEffect(() => {
    // Filter experts based on search and type
    const filtered = experts.filter(expert => {
      const nameMatch = `${expert.first_name} ${expert.last_name}`.toLowerCase().includes(expertFilter.toLowerCase());
      const typeMatch = expertTypeFilter === "all" || expertTypeFilter === "" || expert.expert_type.toLowerCase().includes(expertTypeFilter.toLowerCase());
      return nameMatch && typeMatch;
    });
    setFilteredExperts(filtered);
  }, [experts, expertFilter, expertTypeFilter]);

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
      setAppointments(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch appointments",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: AppointmentFormData) => {
    try {
      const { data: lawFirmData } = await supabase.rpc('get_current_user_law_firm');
      
      const { error } = await supabase
        .from("appointments")
        .insert({
          claimant_id: data.claimantId,
          referring_attorney: data.referringAttorney,
          expert_id: data.expertId,
          service_fee: data.serviceFee,
          appointment_date: data.appointmentDate.toISOString(),
          deposit_amount: data.depositAmount,
          payment_status: data.paymentStatus,
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
  const uniqueAttorneys = [...new Set(appointments.map(app => app.referring_attorney))];

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
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Schedule New Appointment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Claimant Selection with Filter */}
                <div className="space-y-2">
                  <FormLabel>Filter Claimants</FormLabel>
                  <Input
                    placeholder="Search claimants..."
                    value={claimantFilter}
                    onChange={(e) => setClaimantFilter(e.target.value)}
                    className="mb-2"
                  />
                  <FormField
                    control={form.control}
                    name="claimantId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Claimant</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select claimant" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredClaimants.map((claimant) => (
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
                </div>

                {/* Referring Attorney with Filter */}
                <div className="space-y-2">
                  <FormLabel>Filter Attorneys</FormLabel>
                  <Input
                    placeholder="Search attorneys..."
                    value={attorneyFilter}
                    onChange={(e) => setAttorneyFilter(e.target.value)}
                    className="mb-2"
                  />
                  <FormField
                    control={form.control}
                    name="referringAttorney"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Referring Attorney</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter attorney name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Expert Type Filter */}
                <div className="space-y-2">
                  <FormLabel>Filter by Expert Type</FormLabel>
                  <Select value={expertTypeFilter} onValueChange={setExpertTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All expert types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {uniqueExpertTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Expert Selection with Filter */}
                <div className="space-y-2">
                  <FormLabel>Filter Experts</FormLabel>
                  <Input
                    placeholder="Search experts..."
                    value={expertFilter}
                    onChange={(e) => setExpertFilter(e.target.value)}
                    className="mb-2"
                  />
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
                </div>

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
                                format(field.value, "PPP")
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
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="depositAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deposit Amount</FormLabel>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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

              <Button type="submit" className="w-full">
                Schedule Appointment
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Appointments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Scheduled Appointments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claimant Auto Code</TableHead>
                  <TableHead>Assessment Date</TableHead>
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
                {appointments.map((appointment) => {
                  const claimantInfo = getClaimantInfo(appointment.claimant_id);
                  const expertInfo = getExpertInfo(appointment.expert_id);
                  
                  return (
                    <TableRow key={appointment.id}>
                      <TableCell className="font-medium">{claimantInfo.autoId}</TableCell>
                      <TableCell>{format(new Date(appointment.appointment_date), "PPP")}</TableCell>
                      <TableCell>{expertInfo.name}</TableCell>
                      <TableCell>{expertInfo.type}</TableCell>
                      <TableCell>{claimantInfo.name}</TableCell>
                      <TableCell>{appointment.referring_attorney}</TableCell>
                      <TableCell>${appointment.service_fee}</TableCell>
                      <TableCell className="capitalize">{appointment.payment_status.replace('_', ' ')}</TableCell>
                      <TableCell className="capitalize">{appointment.case_status}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          {["scheduled", "assessed", "cancelled", "rescheduled"].map((status) => (
                            <div key={status} className="flex items-center space-x-2">
                              <Checkbox
                                id={`${appointment.id}-${status}`}
                                checked={appointment.case_status === status}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    updateCaseStatus(appointment.id, status);
                                  }
                                }}
                              />
                              <label
                                htmlFor={`${appointment.id}-${status}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
                              >
                                {status}
                              </label>
                            </div>
                          ))}
                        </div>
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