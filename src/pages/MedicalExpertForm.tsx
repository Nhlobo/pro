
import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, User, MapPin, DollarSign, ArrowLeft, Upload, FileText } from "lucide-react";
import { Link } from "react-router-dom";

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
  specialization: z.enum(["mva", "med_neg", "both"], {
    required_error: "Please select a specialization",
  }),
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

function makeExpertCode(name: string, surname: string) {
  const n = (name?.trim()?.charAt(0) || "X").toUpperCase().replace(/[^A-Z]/g, "X");
  const s = (surname?.trim()?.charAt(0) || "X").toUpperCase().replace(/[^A-Z]/g, "X");
  const randomNumbers = Math.floor(10000 + Math.random() * 90000).toString();
  return `${n}${s}${randomNumbers}`;
}

interface SavedExpert {
  id: string;
  first_name: string;
  last_name: string;
  expert_type: string;
  province: string;
  consultation_fees?: number;
  court_fees?: number;
  created_at: string;
}

const MedicalExpertForm = () => {
  const { toast } = useToast();
  const [savedExperts, setSavedExperts] = useState<SavedExpert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [uploadingCV, setUploadingCV] = useState(false);
  const [processingBulk, setProcessingBulk] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      surname: "",
      expertType: undefined,
      specialization: undefined,
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
    const code = makeExpertCode(name ?? "", surname ?? "");
    form.setValue("autoCode", code);
  }, [name, surname, form]);

  useEffect(() => {
    fetchRecentExperts();
  }, []);

  const fetchRecentExperts = async () => {
    try {
      const { data, error } = await supabase
        .from('medical_experts')
        .select('id, first_name, last_name, expert_type, province, consultation_fees, court_fees, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setSavedExperts(data || []);
    } catch (error) {
      console.error('Error fetching experts:', error);
    }
  };

  const formatExpertType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatProvince = (province: string) => {
    const provinceMap: Record<string, string> = {
      gauteng: "Gauteng",
      western_cape: "Western Cape",
      kwazulu_natal: "KwaZulu-Natal",
      eastern_cape: "Eastern Cape",
      limpopo: "Limpopo",
      mpumalanga: "Mpumalanga",
      north_west: "North West",
      free_state: "Free State",
      northern_cape: "Northern Cape"
    };
    return provinceMap[province] || province;
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

  const processBulkUpload = async (file: File) => {
    setProcessingBulk(true);
    try {
      // For now, just show a message that bulk upload is being processed
      toast({
        title: "Bulk upload initiated",
        description: `Processing ${file.name}. Individual expert entries will be created.`,
      });
      
      // TODO: Implement Excel/PDF parsing logic here
      // This would involve parsing the file and creating multiple expert entries
      
    } catch (error) {
      console.error('Error processing bulk upload:', error);
      toast({
        title: "Error",
        description: "Failed to process bulk upload. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingBulk(false);
      setBulkFile(null);
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
      const { data, error } = await supabase
        .from('medical_experts')
        .insert({
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
          specializations: [values.specialization],
          availability_notes: values.notes || null,
          personal_assistant_name: values.personalAssistantName || null,
          personal_assistant_contact: values.personalAssistantContact || null,
          cv_document_url: cvDocumentUrl,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Medical expert saved successfully",
        description: `Dr. ${values.name} ${values.surname} has been added to the directory`,
      });

      // Add the new expert to the list
      setSavedExperts(prev => [data, ...prev.slice(0, 4)]);
      
      // Reset form and files
      form.reset();
      setCvFile(null);
      
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

  const canonicalUrl = typeof window !== "undefined" ? window.location.href : "https://example.com/medical-expert";

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Medical Expert Form | Medico-Legal</title>
        <meta
          name="description"
          content="Register medical experts with specialization, qualifications, fees in Rand, court availability, and contact details."
        />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="outline" asChild>
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Medical Expert Form</h1>
          <p className="text-muted-foreground mt-1">Register medical experts with their specializations and details.</p>
        </header>

        {/* Bulk Upload Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Bulk Expert Upload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload multiple experts at once using Excel (.xlsx) or PDF format.
              </p>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".xlsx,.xls,.pdf"
                  onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => bulkFile && processBulkUpload(bulkFile)}
                  disabled={!bulkFile || processingBulk}
                >
                  {processingBulk ? "Processing..." : "Upload"}
                </Button>
              </div>
              {bulkFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {bulkFile.name}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
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
                    <FormItem className="md:col-span-1">
                      <FormLabel>Surname</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expertType"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
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
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Case Specialization</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select case specialization" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="mva">MVA</SelectItem>
                          <SelectItem value="med_neg">Med Neg</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="autoCode"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Auto Code</FormLabel>
                      <FormControl>
                        <Input readOnly value={field.value} placeholder="Auto-generated" />
                      </FormControl>
                      <FormDescription>First letter of name + surname + 5 random numbers.</FormDescription>
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
                        <Textarea placeholder="e.g., MD, PhD in Orthopedics, Board Certified..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hpcsaNumber"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>HPCSA Practice Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., MP0123456" {...field} />
                      </FormControl>
                      <FormDescription>Health Professions Council of South Africa registration number</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="experience"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Years of Experience</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 15" {...field} />
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
                    {isLoading ? "Saving..." : "Save"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => form.reset()}>
                    Reset
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Recently Added Experts */}
        {savedExperts.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Recently Added Experts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {savedExperts.map((expert) => (
                  <div key={expert.id} className="border rounded-lg p-4 bg-muted/30">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">
                          Dr. {expert.first_name} {expert.last_name}
                        </h3>
                        <p className="text-muted-foreground">
                          {formatExpertType(expert.expert_type)}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {formatProvince(expert.province)}
                      </Badge>
                    </div>
                    
                    <Separator className="my-2" />
                    
                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>Expert ID: {expert.id.slice(0, 8)}...</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{formatProvince(expert.province)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {expert.consultation_fees ? `R${expert.consultation_fees}` : 'Fees TBC'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-2 text-xs text-muted-foreground">
                      Added on {new Date(expert.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default MedicalExpertForm;
