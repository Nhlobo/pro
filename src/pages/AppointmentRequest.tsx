import React from "react";
import { Helmet } from "react-helmet-async";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Send } from "lucide-react";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CompanyFooter from "@/components/CompanyFooter";
import { generateAppointmentRequestId } from "@/utils/idGenerators";
import { AddAttorneyDialog } from "@/components/AddAttorneyDialog";
import { Plus } from "lucide-react";
import { useFormDraft } from "@/hooks/useFormDraft";


const formSchema = z.object({
  selectedAttorneyId: z.string().optional(),
  referringAttorneyName: z.string().min(2, "Referring Attorney name is required"),
  attorneyEmail: z.string().email("Please enter a valid email address").min(1, "Attorney email is required"),
  claimantFirstName: z.string().min(2, "First name is required"),
  claimantLastName: z.string().min(2, "Last name is required"),
  autoId: z.string().min(2),
  isMinor: z.enum(["yes", "no"]),
  guardianName: z.string().optional(),
  expertType: z.enum([
    "Orthopaedic Surgeon",
    "Neurologist", 
    "Psychiatrist",
    "Psychologist",
    "Occupational Therapist",
    "Physiotherapist",
    "General Practitioner",
    "Ophthalmologist",
    "ENT Specialist",
    "Radiologist",
    "Addendum (Post-Report)",
    "Affidavits",
    "Joint Minutes (Post-Report)",
    "Other"
  ]),
  otherExpertType: z.string().optional(),
  matterType: z.enum(["MVA", "Medical Negligence", "Other Matters"]),
  specialRequests: z.array(z.string()).optional(),
  province: z.enum([
    "Eastern Cape",
    "Free State", 
    "Gauteng",
    "KwaZulu-Natal",
    "Limpopo",
    "Mpumalanga",
    "Northern Cape",
    "North West",
    "Western Cape",
  ]),
  preferredDateType: z.enum(["specific", "month"]),
  suggestedDate: z.string().optional(),
  suggestedMonth: z.string().optional(),
  additionalNotes: z.string().optional(),
}).refine(data => {
  if (data.isMinor === "yes" && (!data.guardianName || data.guardianName.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Guardian name is required for minors",
  path: ["guardianName"],
}).refine(data => {
  if (data.expertType === "Other" && (!data.otherExpertType || data.otherExpertType.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Please specify the type of expert",
  path: ["otherExpertType"],
}).refine(data => {
  if (data.preferredDateType === "specific" && (!data.suggestedDate || data.suggestedDate.trim() === "")) {
    return false;
  }
  if (data.preferredDateType === "month" && (!data.suggestedMonth || data.suggestedMonth.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Please provide your date/month preference",
  path: ["suggestedDate", "suggestedMonth"],
});

const AR_FORM_DEFAULTS = {
  selectedAttorneyId: "", referringAttorneyName: "", attorneyEmail: "",
  claimantFirstName: "", claimantLastName: "", autoId: "",
  isMinor: undefined as any, guardianName: "", expertType: undefined as any,
  otherExpertType: "", matterType: undefined as any, specialRequests: [] as string[],
  province: undefined as any, preferredDateType: undefined as any,
  suggestedDate: "", suggestedMonth: "", additionalNotes: "",
};

const AppointmentRequest = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [attorneys, setAttorneys] = React.useState<Array<{ id: string; name: string; email: string; code: string }>>([]);
  const [loadingAttorneys, setLoadingAttorneys] = React.useState(true);
  const [showAddAttorneyDialog, setShowAddAttorneyDialog] = React.useState(false);

  const { draft, setDraft, clearDraft } = useFormDraft<typeof AR_FORM_DEFAULTS>('appointment-request-new', AR_FORM_DEFAULTS);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: draft,
    mode: "onTouched",
  });

  // Persist all form values to draft on every change
  const watchedValues = form.watch();
  React.useEffect(() => {
    setDraft(watchedValues as typeof AR_FORM_DEFAULTS);
  }, [JSON.stringify(watchedValues)]);

  // Fetch attorneys and auto-populate user's attorney on mount
  React.useEffect(() => {
    const fetchAttorneys = async () => {
      try {
        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        // Fetch all attorneys
        const { data: attorneysData, error: attorneysError } = await supabase
          .from('referring_attorneys')
          .select('id, name, email, code, contact_person, phone')
          .order('name');

        if (attorneysError) throw attorneysError;
        setAttorneys(attorneysData || []);

        // Get user's profile to find their associated referring attorney
        if (user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('referring_attorney_id, role, email, first_name, last_name')
            .eq('id', user.id)
            .single();

          const isAdmin = profile?.role === 'admin';
          let linkedAttorneyId = profile?.referring_attorney_id;

          // If no referring_attorney_id and not admin, try fallback lookup
          if (!linkedAttorneyId && !isAdmin) {
            const userEmail = profile?.email || user.email;
            
            // Try to match by email or phone in referring_attorneys table
            const matchedAttorney = attorneysData?.find(
              a => a.email === userEmail || 
              (user.phone && a.phone === user.phone)
            );
            
            if (matchedAttorney) {
              linkedAttorneyId = matchedAttorney.id;
              
              // Update user profile to link this attorney
              await supabase
                .from('profiles')
                .update({ referring_attorney_id: matchedAttorney.id })
                .eq('id', user.id);
              
              toast({
                title: "Attorney Auto-Linked",
                description: `Linked to ${matchedAttorney.name} based on your email.`,
              });
            } else {
              // No match found - auto-create a new referring attorney profile
              const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
                              userEmail?.split('@')[0] || 'New Attorney';
              const attorneyCode = `ATT-${Date.now().toString().slice(-6)}`;
              
              const { data: newAttorney, error: createError } = await supabase
                .from('referring_attorneys')
                .insert({
                  name: fullName,
                  email: userEmail,
                  phone: user.phone,
                  code: attorneyCode,
                  contact_person: fullName,
                  attorney_role: profile?.role || 'referring_attorney'
                })
                .select()
                .single();

              if (createError) {
                console.error('Error creating attorney:', createError);
                toast({
                  title: "Error",
                  description: "Could not create referring attorney profile. Please contact an administrator.",
                  variant: "destructive",
                });
              } else {
                linkedAttorneyId = newAttorney.id;
                
                // Update user profile to link the new attorney
                await supabase
                  .from('profiles')
                  .update({ referring_attorney_id: newAttorney.id })
                  .eq('id', user.id);
                
                // Add new attorney to the list
                setAttorneys([...attorneysData || [], newAttorney]);
                
                toast({
                  title: "Profile Created",
                  description: "A new referring attorney profile has been created and linked.",
                });
              }
            }
          }

          if (linkedAttorneyId) {
            // Find the attorney in the list
            const currentAttorneys = attorneysData || [];
            const userAttorney = currentAttorneys.find(a => a.id === linkedAttorneyId);
            
            if (userAttorney) {
              // Auto-populate the form with user's attorney
              form.setValue("selectedAttorneyId", userAttorney.id);
              form.setValue("referringAttorneyName", userAttorney.name);
              form.setValue("attorneyEmail", userAttorney.email || "");
            }
          }
        }
      } catch (error: any) {
        console.error('Error loading attorneys:', error);
        toast({
          title: "Error",
          description: "Failed to load attorneys list. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setLoadingAttorneys(false);
      }
    };

    fetchAttorneys();
  }, [toast]);

  const claimantFirstName = form.watch("claimantFirstName");
  const claimantLastName = form.watch("claimantLastName");
  const selectedAttorneyId = form.watch("selectedAttorneyId");

  // Auto-generate ID when claimant names change
  React.useEffect(() => {
    const autoId = generateAppointmentRequestId(claimantFirstName ?? "", claimantLastName ?? "");
    form.setValue("autoId", autoId);
  }, [claimantFirstName, claimantLastName, form]);

  // Update attorney details when selection changes
  React.useEffect(() => {
    if (selectedAttorneyId && selectedAttorneyId !== "add_new") {
      const attorney = attorneys.find(a => a.id === selectedAttorneyId);
      if (attorney) {
        form.setValue("referringAttorneyName", attorney.name);
        form.setValue("attorneyEmail", attorney.email);
      }
    } else if (selectedAttorneyId === "add_new") {
      setShowAddAttorneyDialog(true);
    }
  }, [selectedAttorneyId, attorneys, form]);

  const handleAttorneyAdded = (attorney: { id: string; name: string; email: string; code: string }) => {
    setAttorneys(prev => [...prev, attorney]);
    form.setValue("selectedAttorneyId", attorney.id);
    form.setValue("referringAttorneyName", attorney.name);
    form.setValue("attorneyEmail", attorney.email);
  };

  const watchIsMinor = form.watch("isMinor");
  const watchExpertType = form.watch("expertType");
  const watchMatterType = form.watch("matterType");
  const watchPreferredDateType = form.watch("preferredDateType");

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      // Get current user info
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to submit an appointment request.",
          variant: "destructive",
        });
        return;
      }

      // Get user's profile and referring attorney
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('referring_attorney_id, first_name, last_name')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.referring_attorney_id) {
        toast({
          title: "Profile Error",
          description: "Could not find your referring attorney association. Please contact an administrator.",
          variant: "destructive",
        });
        return;
      }

      // Create the appointment request data
      const requestData = {
        referring_attorney_id: profile.referring_attorney_id,
        requested_by: user.id,
        referring_attorney_name: values.referringAttorneyName!,
        attorney_email: values.attorneyEmail,
        claimant_first_name: values.claimantFirstName,
        claimant_last_name: values.claimantLastName,
        is_minor: values.isMinor === "yes",
        guardian_name: values.isMinor === "yes" ? values.guardianName : null,
        expert_type_requested: values.expertType === "Other" ? values.otherExpertType : values.expertType!,
        matter_type: values.matterType!,
        special_requests: values.specialRequests || [],
        province: values.province!,
        preferred_date_type: values.preferredDateType!,
        suggested_date: values.preferredDateType === "specific" ? values.suggestedDate : null,
        suggested_month: values.preferredDateType === "month" ? values.suggestedMonth : null,
        additional_notes: values.additionalNotes,
        status: 'pending',
      };

      // Insert the appointment request
      const { error: insertError } = await supabase
        .from('appointment_requests')
        .insert(requestData);

      if (insertError) {
        throw new Error(insertError.message);
      }

      // Send email notification to info@kutlwanoassociate.com
      const { error: emailError } = await supabase.functions.invoke('send-appointment-request', {
        body: { requestData }
      });

      if (emailError) {
        console.warn('Email notification failed:', emailError);
        // Don't fail the whole request if email fails
      }

      toast({
        title: "Request Submitted",
        description: `Appointment request for ${values.claimantFirstName} ${values.claimantLastName} (ID: ${values.autoId}) has been submitted successfully.`,
      });
      clearDraft(); // Clear draft after successful submit
      form.reset(AR_FORM_DEFAULTS);
      navigate('/referring-attorney-list');
    } catch (error: any) {
      toast({
        title: "Error submitting request",
        description: error.message || "Failed to submit appointment request.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const canonicalUrl = typeof window !== "undefined" ? window.location.href : "https://example.com/appointment-request";

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Appointment Request | Medico-Legal Assessment System</title>
        <meta
          name="description"
          content="Submit an appointment request for medical expert assessment. Provide claimant details, expert type needed, location preferences, and suggested dates."
        />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Request Appointment</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Medical Expert Appointment Request
            </CardTitle>
            <p className="text-muted-foreground">
              Submit a request for a medical expert assessment appointment. Our team will review and contact you to schedule.
            </p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Referring Attorney Information</h3>
                  
                  <FormField
                    control={form.control}
                    name="selectedAttorneyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Select Referring Attorney *</FormLabel>
                        <Select 
                          value={field.value || ""} 
                          onValueChange={field.onChange}
                          disabled={loadingAttorneys}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={loadingAttorneys ? "Loading attorneys..." : "Select an attorney or add new"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {attorneys.map((attorney) => (
                              <SelectItem key={attorney.id} value={attorney.id}>
                                {attorney.name} ({attorney.code})
                              </SelectItem>
                            ))}
                            <SelectItem value="add_new" className="font-semibold text-primary">
                              <div className="flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                Add New Attorney
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select from existing attorneys or add a new one
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="referringAttorneyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Referring Attorney Name *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Auto-filled when attorney is selected" 
                            {...field} 
                            readOnly={!!selectedAttorneyId && selectedAttorneyId !== "add_new"}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="attorneyEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Attorney Email *</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="Auto-filled when attorney is selected" 
                            {...field} 
                            readOnly={!!selectedAttorneyId && selectedAttorneyId !== "add_new"}
                          />
                        </FormControl>
                        <FormDescription>
                          Email address for communication and approvals regarding this appointment request
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Claimant Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Claimant Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="claimantFirstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Claimant First Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter first name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="claimantLastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Claimant Last Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter last name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="autoId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Auto ID</FormLabel>
                          <FormControl>
                            <Input readOnly value={field.value} placeholder="Auto-generated" />
                          </FormControl>
                          <FormDescription>
                            Initials (first + last name) + current year and month (YYYYMM)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="isMinor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Is the claimant a minor (under 18)? *</FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            className="flex gap-6"
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="yes" id="minor-yes" />
                              <label htmlFor="minor-yes" className="text-sm">Yes</label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="no" id="minor-no" />
                              <label htmlFor="minor-no" className="text-sm">No</label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchIsMinor === "yes" && (
                    <FormField
                      control={form.control}
                      name="guardianName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Guardian/Parent Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter guardian's full name" {...field} />
                          </FormControl>
                          <FormDescription>
                            Required for minors - please provide the legal guardian's name
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Expert Requirements */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Expert Requirements</h3>
                  
                  <FormField
                    control={form.control}
                    name="expertType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type of Medical Expert Needed *</FormLabel>
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select expert type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Orthopaedic Surgeon">Orthopaedic Surgeon</SelectItem>
                            <SelectItem value="Neurologist">Neurologist</SelectItem>
                            <SelectItem value="Psychiatrist">Psychiatrist</SelectItem>
                            <SelectItem value="Psychologist">Psychologist</SelectItem>
                            <SelectItem value="Occupational Therapist">Occupational Therapist</SelectItem>
                            <SelectItem value="Physiotherapist">Physiotherapist</SelectItem>
                            <SelectItem value="General Practitioner">General Practitioner</SelectItem>
                            <SelectItem value="Ophthalmologist">Ophthalmologist</SelectItem>
                            <SelectItem value="ENT Specialist">ENT Specialist</SelectItem>
                            <SelectItem value="Radiologist">Radiologist</SelectItem>
                            <SelectItem value="Other">Other (please specify)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchExpertType === "Other" && (
                    <FormField
                      control={form.control}
                      name="otherExpertType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Specify Expert Type *</FormLabel>
                          <FormControl>
                            <Input placeholder="Please specify the type of expert needed" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Case Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Case Details</h3>
                  
                  <FormField
                    control={form.control}
                    name="matterType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type of Matter *</FormLabel>
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select matter type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="MVA">MVA (Motor Vehicle Accident)</SelectItem>
                            <SelectItem value="Medical Negligence">Medical Negligence</SelectItem>
                            <SelectItem value="Other Matters">Other Matters</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="specialRequests"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Special Requests (Optional)</FormLabel>
                        <div className="space-y-3">
                          {["Merit Report", "RAF4 form only", "RAF1 form"].map((option) => (
                            <div key={option} className="flex items-center space-x-2">
                              <Checkbox
                                id={option}
                                checked={field.value?.includes(option as any) || false}
                                onCheckedChange={(checked) => {
                                  const currentValues = field.value || [];
                                  if (checked) {
                                    field.onChange([...currentValues, option]);
                                  } else {
                                    field.onChange(currentValues.filter((v) => v !== option));
                                  }
                                }}
                              />
                              <label htmlFor={option} className="text-sm">
                                {option}
                              </label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Location & Scheduling */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Location & Scheduling</h3>
                  
                  <FormField
                    control={form.control}
                    name="province"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Province/Location *</FormLabel>
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select province" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Eastern Cape">Eastern Cape</SelectItem>
                            <SelectItem value="Free State">Free State</SelectItem>
                            <SelectItem value="Gauteng">Gauteng</SelectItem>
                            <SelectItem value="KwaZulu-Natal">KwaZulu-Natal</SelectItem>
                            <SelectItem value="Limpopo">Limpopo</SelectItem>
                            <SelectItem value="Mpumalanga">Mpumalanga</SelectItem>
                            <SelectItem value="Northern Cape">Northern Cape</SelectItem>
                            <SelectItem value="North West">North West</SelectItem>
                            <SelectItem value="Western Cape">Western Cape</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the preferred province where the assessment should take place
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preferredDateType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date Preference Type *</FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={field.value || ""}
                            onValueChange={field.onChange}
                            className="flex gap-6"
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="specific" id="date-specific" />
                              <label htmlFor="date-specific" className="text-sm">Specific Date</label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="month" id="date-month" />
                              <label htmlFor="date-month" className="text-sm">Preferred Month</label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchPreferredDateType === "specific" && (
                    <FormField
                      control={form.control}
                      name="suggestedDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Suggested Date *</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              min={getMinDate()}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Please select your preferred appointment date
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {watchPreferredDateType === "month" && (
                    <FormField
                      control={form.control}
                      name="suggestedMonth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Suggested Month *</FormLabel>
                          <FormControl>
                            <Input
                              type="month"
                              min={new Date().toISOString().slice(0, 7)}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Please select your preferred appointment month
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Additional Notes */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="additionalNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Please provide any additional information, special requirements, or notes regarding this appointment request..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Any special instructions, accessibility requirements, or other relevant information
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Submit Button */}
                <div className="flex gap-4 pt-6">
                  <Button type="submit" disabled={isSubmitting} className="flex-1">
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Submitting Request..." : "Submit Appointment Request"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { clearDraft(); form.reset(AR_FORM_DEFAULTS); }}>
                    Clear Form
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>

      <AddAttorneyDialog
        open={showAddAttorneyDialog}
        onOpenChange={setShowAddAttorneyDialog}
        onAttorneyAdded={handleAttorneyAdded}
      />

      <CompanyFooter />
    </div>
  );
};

export default AppointmentRequest;