import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams, useNavigate } from "react-router-dom";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CompanyFooter from "@/components/CompanyFooter";
import { ArrowLeft, FileText, Shield } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { generateExpertCode } from "@/utils/idGenerators";

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  surname: z.string().min(2, "Surname is required"),
  expertType: z.enum([
    "neurosurgeon",
    "orthopedic_surgeon", 
    "clinical_psychologist",
    "psychiatrist",
    "cardiologist",
    "pulmonologist",
    "neurologist",
    "radiologist",
    "plastic_surgeon",
    "general_surgeon",
    "emergency_medicine",
    "internal_medicine",
    "rheumatologist",
    "endocrinologist",
    "gastroenterologist",
    "oncologist",
    "dermatologist",
    "urologist",
    "ophthalmologist",
    "ent_surgeon",
    "anesthesiologist",
    "pathologist",
    "forensic_pathologist",
    "occupational_therapist",
    "physiotherapist",
    "biokinetisist",
    "speech_therapist",
    "audiologist"
  ], {
    required_error: "Please select an expert type",
  }),
  specialization: z.array(z.enum(["mva", "med_neg"])).min(1, "Please select at least one specialization"),
  qualifications: z.string().min(5, "Qualifications are required"),
  hpcsaNumber: z.string().min(1, "HPCSA practice number is required"),
  experience: z.string().min(1, "Experience years are required"),
  contactNumber: z
    .string()
    .min(7, "Enter a valid phone")
    .regex(/^[0-9+\-\s()]+$/, "Invalid phone number"),
  email: z.string().email("Invalid email address"),
  address: z.string().min(5, "Address is required"),
  province: z.enum([
    "gauteng",
    "western_cape", 
    "kwazulu_natal",
    "eastern_cape",
    "limpopo",
    "mpumalanga",
    "north_west",
    "free_state",
    "northern_cape"
  ], {
    required_error: "Please select a province",
  }),
  fees: z.string().min(1, "Fees in Rand are required"),
  courtFee: z.string().min(1, "Court fee in Rand is required"),
  courtAvailability: z.enum(["Yes", "No"], {
    required_error: "Please select court availability",
  }),
  notes: z.string().optional(),
  personalAssistantName: z.string().optional(),
  personalAssistantContact: z.string().optional(),
  autoCode: z.string().min(2),
  cvDocument: z.any().optional(),
});

const MedicalExpertFormPage = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [uploadingCV, setUploadingCV] = useState(false);
  
  // Check if we're in edit mode
  const expertId = searchParams.get('edit');
  const isEditMode = !!expertId;
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      surname: "",
      expertType: undefined,
      specialization: [],
      qualifications: "",
      hpcsaNumber: "",
      experience: "",
      contactNumber: "",
      email: "",
      address: "",
      province: undefined,
      fees: "",
      courtFee: "",
      courtAvailability: undefined,
      notes: "",
      personalAssistantName: "",
      personalAssistantContact: "",
      autoCode: "",
      cvDocument: null,
    },
    mode: "onTouched",
  });

  const name = form.watch("name");
  const surname = form.watch("surname");

  useEffect(() => {
    const code = generateExpertCode(name ?? "", surname ?? "");
    form.setValue("autoCode", code);
  }, [name, surname, form]);

  useEffect(() => {
    // Load expert data if in edit mode
    if (isEditMode && expertId) {
      loadExpertForEdit(expertId);
    }
  }, [isEditMode, expertId]);

  const loadExpertForEdit = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('medical_experts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        // Map the data to form values
        form.reset({
          name: data.first_name,
          surname: data.last_name,
          expertType: data.expert_type as any,
          specialization: (data.specializations || []).filter((spec: string) => spec === 'mva' || spec === 'med_neg') as ("mva" | "med_neg")[],
          qualifications: data.qualifications || "",
          hpcsaNumber: "", // This field might not exist in the current schema
          experience: data.years_experience?.toString() || "",
          contactNumber: data.contact_number || "",
          email: data.email || "",
          address: data.practice_address || "",
          province: data.province as any,
          fees: data.consultation_fees?.toString() || "",
          courtFee: data.court_fees?.toString() || "",
          courtAvailability: "Yes", // Default value, might need adjustment
          notes: data.availability_notes || "",
          personalAssistantName: data.personal_assistant_name || "",
          personalAssistantContact: data.personal_assistant_contact || "",
          autoCode: generateExpertCode(data.first_name, data.last_name),
        });
      } else {
        toast({
          title: "Expert not found",
          description: "The expert you're trying to edit could not be found.",
          variant: "destructive",
        });
        navigate('/medical-expert-form');
      }
    } catch (error) {
      console.error('Error loading expert:', error);
      toast({
        title: "Error loading expert",
        description: "Failed to load expert data for editing.",
        variant: "destructive",
      });
    }
  };

  const uploadCVDocument = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `cv-${Date.now()}.${fileExt}`;
      const filePath = `cvs/${fileName}`;

      const { error } = await supabase.storage
        .from('expert-documents')
        .upload(filePath, file);

      if (error) throw error;

      const { data } = supabase.storage
        .from('expert-documents')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading CV:', error);
      return null;
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      let cvDocumentUrl = null;
      
      // Upload CV document if provided
      if (cvFile) {
        setUploadingCV(true);
        cvDocumentUrl = await uploadCVDocument(cvFile);
        setUploadingCV(false);
        
        if (!cvDocumentUrl) {
          throw new Error('Failed to upload CV document');
        }
      }

      const expertData = {
        first_name: values.name,
        last_name: values.surname,
        expert_type: values.expertType,
        province: values.province,
        contact_number: values.contactNumber,
        email: values.email,
        practice_address: values.address,
        consultation_fees: parseInt(values.fees.replace(/[^\d]/g, '')) || null,
        court_fees: parseInt(values.courtFee.replace(/[^\d]/g, '')) || null,
        qualifications: values.qualifications,
        years_experience: parseInt(values.experience) || null,
        specializations: values.specialization,
        availability_notes: values.notes || null,
        personal_assistant_name: values.personalAssistantName || null,
        personal_assistant_contact: values.personalAssistantContact || null,
        ...(cvDocumentUrl && { cv_document_url: cvDocumentUrl }),
      };

      let data, error;
      
      if (isEditMode && expertId) {
        // Update existing expert
        ({ data, error } = await supabase
          .from('medical_experts')
          .update(expertData)
          .eq('id', expertId)
          .select()
          .single());
      } else {
        // Create new expert
        ({ data, error } = await supabase
          .from('medical_experts')
          .insert(expertData)
          .select()
          .single());
      }

      if (error) throw error;

      toast({
        title: isEditMode ? "Expert updated successfully" : "Medical expert saved successfully",
        description: `Dr. ${values.name} ${values.surname} has been ${isEditMode ? 'updated' : 'added to the directory'}`,
      });

      if (isEditMode) {
        // Navigate back to directory after successful edit
        navigate('/medical-expert-directory');
      } else {
        // Navigate to recently added page after successful creation
        navigate('/recently-added-experts');
      }
      
    } catch (error) {
      console.error('Error saving expert:', error);
      toast({
        title: "Error",
        description: "Failed to save medical expert. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{isEditMode ? 'Edit Medical Expert' : 'Add Medical Expert'} | Medico-Legal</title>
        <meta
          name="description"
          content={isEditMode ? 'Edit medical expert information and qualifications' : 'Add new medical expert to the directory with complete information and qualifications'}
        />
      </Helmet>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link 
            to="/medical-expert-directory" 
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Directory
          </Link>
          
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              {isEditMode ? 'Edit Medical Expert' : 'Add Medical Expert'}
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Shield className="h-4 w-4 mr-1" />
                Secure Form
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-2">
              {isEditMode 
                ? 'Update medical expert information and qualifications'
                : 'Add a new medical expert to the directory with complete information and qualifications'
              }
            </p>
          </div>
        </div>

        {/* Medical Expert Form */}
        <Card>
          <CardHeader>
            <CardTitle>
              {isEditMode ? 'Update Expert Information' : 'Expert Information'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Auto Code Display */}
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm font-medium">Auto-Generated Expert Code:</p>
                  <p className="text-lg font-mono text-primary">
                    {form.watch("autoCode") || "Enter name to generate code"}
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., John" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="surname"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Surname</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Smith" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expertType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expert Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select expert type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="neurosurgeon">Neurosurgeon</SelectItem>
                            <SelectItem value="orthopedic_surgeon">Orthopedic Surgeon</SelectItem>
                            <SelectItem value="clinical_psychologist">Clinical Psychologist</SelectItem>
                            <SelectItem value="psychiatrist">Psychiatrist</SelectItem>
                            <SelectItem value="cardiologist">Cardiologist</SelectItem>
                            <SelectItem value="pulmonologist">Pulmonologist</SelectItem>
                            <SelectItem value="neurologist">Neurologist</SelectItem>
                            <SelectItem value="radiologist">Radiologist</SelectItem>
                            <SelectItem value="plastic_surgeon">Plastic Surgeon</SelectItem>
                            <SelectItem value="general_surgeon">General Surgeon</SelectItem>
                            <SelectItem value="emergency_medicine">Emergency Medicine</SelectItem>
                            <SelectItem value="internal_medicine">Internal Medicine</SelectItem>
                            <SelectItem value="rheumatologist">Rheumatologist</SelectItem>
                            <SelectItem value="endocrinologist">Endocrinologist</SelectItem>
                            <SelectItem value="gastroenterologist">Gastroenterologist</SelectItem>
                            <SelectItem value="oncologist">Oncologist</SelectItem>
                            <SelectItem value="dermatologist">Dermatologist</SelectItem>
                            <SelectItem value="urologist">Urologist</SelectItem>
                            <SelectItem value="ophthalmologist">Ophthalmologist</SelectItem>
                            <SelectItem value="ent_surgeon">ENT Surgeon</SelectItem>
                            <SelectItem value="anesthesiologist">Anesthesiologist</SelectItem>
                            <SelectItem value="pathologist">Pathologist</SelectItem>
                            <SelectItem value="forensic_pathologist">Forensic Pathologist</SelectItem>
                            <SelectItem value="occupational_therapist">Occupational Therapist</SelectItem>
                            <SelectItem value="physiotherapist">Physiotherapist</SelectItem>
                            <SelectItem value="biokinetisist">Biokinetisist</SelectItem>
                            <SelectItem value="speech_therapist">Speech Therapist</SelectItem>
                            <SelectItem value="audiologist">Audiologist</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="specialization"
                    render={() => (
                      <FormItem>
                        <FormLabel>Specialization</FormLabel>
                        <FormDescription>Select all applicable specializations</FormDescription>
                        <div className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="mva"
                              checked={form.watch("specialization").includes("mva")}
                              onCheckedChange={(checked) => {
                                const currentSpecializations = form.getValues("specialization");
                                if (checked) {
                                  form.setValue("specialization", [...currentSpecializations, "mva"]);
                                } else {
                                  form.setValue("specialization", currentSpecializations.filter(s => s !== "mva"));
                                }
                              }}
                            />
                            <label htmlFor="mva" className="text-sm">Motor Vehicle Accident (MVA)</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="med_neg"
                              checked={form.watch("specialization").includes("med_neg")}
                              onCheckedChange={(checked) => {
                                const currentSpecializations = form.getValues("specialization");
                                if (checked) {
                                  form.setValue("specialization", [...currentSpecializations, "med_neg"]);
                                } else {
                                  form.setValue("specialization", currentSpecializations.filter(s => s !== "med_neg"));
                                }
                              }}
                            />
                            <label htmlFor="med_neg" className="text-sm">Medical Negligence</label>
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="qualifications"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Qualifications</FormLabel>
                        <FormControl>
                          <Textarea placeholder="e.g., MBChB, FCS(SA), MMed(Neurosurg)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hpcsaNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>HPCSA Practice Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., MP123456" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="experience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Years of Experience</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 15" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contactNumber"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel>Contact Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., +27 11 123 4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="e.g., doctor@medical.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="province"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel>Province</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select province" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="gauteng">Gauteng</SelectItem>
                            <SelectItem value="western_cape">Western Cape</SelectItem>
                            <SelectItem value="kwazulu_natal">KwaZulu-Natal</SelectItem>
                            <SelectItem value="eastern_cape">Eastern Cape</SelectItem>
                            <SelectItem value="limpopo">Limpopo</SelectItem>
                            <SelectItem value="mpumalanga">Mpumalanga</SelectItem>
                            <SelectItem value="north_west">North West</SelectItem>
                            <SelectItem value="free_state">Free State</SelectItem>
                            <SelectItem value="northern_cape">Northern Cape</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 123 Medical Centre, Johannesburg, 2000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fees"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel>Consultation Fees (Rand)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., R 5000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="courtFee"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel>Court Fee (Rand)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., R 8000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="courtAvailability"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel>Court Availability</FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            className="flex flex-wrap gap-6"
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem id="court-yes" value="Yes" />
                              <label htmlFor="court-yes" className="text-sm">Yes</label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem id="court-no" value="No" />
                              <label htmlFor="court-no" className="text-sm">No</label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="personalAssistantName"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel>Personal Assistant Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Jane Smith" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="personalAssistantContact"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel>Personal Assistant Contact</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., +27 11 987 6543" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional notes about court availability or other details..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* CV Document Upload */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">
                      CV Document (Optional)
                    </label>
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                      />
                      {cvFile && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          <span>Selected: {cvFile.name}</span>
                        </div>
                      )}
                      {uploadingCV && (
                        <p className="text-sm text-muted-foreground">Uploading CV...</p>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2 flex gap-3 justify-end">
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Saving..." : (isEditMode ? "Update Expert" : "Save Expert")}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => form.reset()}>
                      Reset
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
      <CompanyFooter />
    </div>
  );
};

export default MedicalExpertFormPage;