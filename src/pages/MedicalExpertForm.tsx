
import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams, useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';
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
import CompanyFooter from "@/components/CompanyFooter";
import { CheckCircle, User, MapPin, ArrowLeft, Upload, FileText, Shield, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { generateExpertCode } from "@/utils/idGenerators";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  surname: z.string().min(2, "Surname is required"),
  expertType: z.string().min(2, "Expert type is required"),
  specialization: z.array(z.string()).min(1, "Please select at least one specialization"),
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
  ]),
  feesMVA: z.string().optional().default(""),
  feesMedNeg: z.string().optional().default(""),
  feesMerit: z.string().optional().default(""),
  feesPerHour: z.string().optional().default(""),
  courtFee: z.string().optional().default(""),
  courtAvailability: z.enum(["Yes", "No"]),
  notes: z.string().optional(),
  personalAssistantName: z.string().optional(),
  personalAssistantContact: z.string().optional(),
  practiceCompanyName: z.string().optional().default(""),
  autoCode: z.string().min(2),
  cvDocument: z.any().optional(),
});

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [savedExperts, setSavedExperts] = useState<SavedExpert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [uploadingCV, setUploadingCV] = useState(false);
  const [processingBulk, setProcessingBulk] = useState(false);
  const [clearingExperts, setClearingExperts] = useState(false);
  const [bulkMatterType, setBulkMatterType] = useState<'MVA' | 'Med Neg'>('MVA');
  const [openExpertType, setOpenExpertType] = useState(false);
  const [expertTypes, setExpertTypes] = useState([
    "neurosurgeon", "orthopedic_surgeon", "clinical_psychologist", "psychiatrist",
    "cardiologist", "pulmonologist", "neurologist", "radiologist", "plastic_surgeon",
    "general_surgeon", "emergency_medicine", "internal_medicine", "rheumatologist",
    "endocrinologist", "gastroenterologist", "oncologist", "dermatologist", "urologist",
    "ophthalmologist", "ent_surgeon", "anesthesiologist", "pathologist", "forensic_pathologist",
    "occupational_therapist", "physiotherapist", "biokinetisist", "speech_therapist", "audiologist"
  ]);
  const [newExpertType, setNewExpertType] = useState("");
  
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
      feesMVA: "",
      feesMedNeg: "",
      feesMerit: "",
      feesPerHour: "",
      courtFee: "",
      courtAvailability: undefined,
      notes: "",
      personalAssistantName: "",
      personalAssistantContact: "",
      practiceCompanyName: "",
      autoCode: "",
      cvDocument: null,
    },
    mode: "onChange",
  });

  const name = form.watch("name");
  const surname = form.watch("surname");

  useEffect(() => {
    const code = generateExpertCode(name ?? "", surname ?? "");
    form.setValue("autoCode", code);
  }, [name, surname, form]);

  useEffect(() => {
    fetchRecentExperts();
    
    // Load expert data if in edit mode, then trigger validation to highlight empty fields
    if (isEditMode && expertId) {
      loadExpertForEdit(expertId);
    } else {
      // Trigger validation on new form to highlight required fields immediately
      form.trigger();
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
          feesMVA: data.consultation_fee_mva?.toString() || "",
          feesMedNeg: data.consultation_fee_med_neg?.toString() || "",
          feesMerit: (data as any).merit_fees?.toString() || "",
          feesPerHour: data.consultation_fee_per_hour?.toString() || "",
          courtFee: data.court_fees?.toString() || "",
          courtAvailability: "Yes", // Default value, might need adjustment
          notes: data.availability_notes || "",
          personalAssistantName: data.personal_assistant_name || "",
          personalAssistantContact: data.personal_assistant_contact || "",
          practiceCompanyName: (data as any).practice_company_name || "",
          autoCode: generateExpertCode(data.first_name, data.last_name),
        });
      } else {
        toast({
          title: "Expert not found",
          description: "The expert you're trying to edit could not be found.",
          variant: "destructive",
        });
        navigate('/medical-expert');
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

  const clearAllExperts = async () => {
    setClearingExperts(true);
    try {
      const { data, error } = await supabase.rpc('clear_medical_experts');
      
      if (error) {
        throw new Error(error.message);
      }
      
      toast({
        title: "Experts cleared successfully",
        description: `Removed ${data} experts from the directory. You can now upload your new list.`,
      });
      
    } catch (error) {
      console.error('Error clearing experts:', error);
      toast({
        title: "Error clearing experts",
        description: error instanceof Error ? error.message : "Failed to clear experts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setClearingExperts(false);
    }
  };

  const processBulkUpload = async (file: File, matterType: 'MVA' | 'Med Neg') => {
    setProcessingBulk(true);
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        // Process Excel file
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Skip header row and process data
        const expertsData = [];
        const errors = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;
          
          try {
            // Map Excel columns to expert data (adjust column indices as needed)
            const expertData = {
              first_name: row[0]?.toString().trim() || '',
              last_name: row[1]?.toString().trim() || '',
              expert_type: row[2]?.toString().toLowerCase().replace(/\s+/g, '_') || 'general_practitioner',
              province: row[3]?.toString().trim() || '',
              contact_number: row[4]?.toString().trim() || null,
              email: row[5]?.toString().trim() || null,
              practice_address: row[6]?.toString().trim() || null,
              qualifications: row[7]?.toString().trim() || null,
              years_experience: parseInt(row[8]?.toString()) || null,
              specializations: row[9] ? [row[9].toString().trim()] : [],
              consultation_fees: parseFloat(row[10]?.toString().replace(/[^\d.]/g, '')) || null,
              court_fees: parseFloat(row[11]?.toString().replace(/[^\d.]/g, '')) || null,
              availability_notes: row[12]?.toString().trim() || null,
              personal_assistant_name: row[13]?.toString().trim() || null,
              personal_assistant_contact: row[14]?.toString().trim() || null,
              status: 'active',
              matter_types: [matterType]
            };
            
            // Validate required fields
            if (!expertData.first_name || !expertData.last_name) {
              errors.push(`Row ${i + 1}: Missing required name fields`);
              continue;
            }
            
            expertsData.push(expertData);
          } catch (error) {
            errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Invalid data format'}`);
          }
        }
        
        if (expertsData.length === 0) {
          throw new Error('No valid expert data found in the file');
        }
        
        // Insert experts into database
        const { data, error } = await supabase
          .from('medical_experts')
          .insert(expertsData)
          .select();
          
        if (error) {
          throw error;
        }
        
        toast({
          title: "Bulk upload completed successfully",
          description: `${data.length} ${matterType} experts have been added to the directory. ${errors.length > 0 ? `${errors.length} rows had errors.` : ''}`,
        });
        
        if (errors.length > 0) {
          console.warn('Upload errors:', errors);
        }
        
      } else if (fileExtension === 'pdf') {
        // For PDF files, show message that it needs to be converted
        toast({
          title: "PDF Upload Not Supported",
          description: "Please convert your PDF to Excel format (.xlsx) and try again.",
          variant: "destructive",
        });
        return;
      } else {
        throw new Error('Unsupported file format. Please use Excel (.xlsx, .xls) files.');
      }
      
      // Navigate to expert directory to show the list
      setTimeout(() => {
        navigate('/medical-expert-directory');
      }, 2000);
      
    } catch (error) {
      console.error('Error processing bulk upload:', error);
      toast({
        title: "Bulk Upload Error",
        description: error instanceof Error ? error.message : "Failed to process bulk upload. Please check your file format and try again.",
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
      // Check for duplicate expert (only when creating new, not editing)
      if (!isEditMode) {
        const { data: existingExpert, error: checkError } = await supabase
          .from('medical_experts')
          .select('id, first_name, last_name, expert_type')
          .eq('first_name', values.name)
          .eq('last_name', values.surname)
          .eq('expert_type', values.expertType)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (existingExpert) {
          toast({
            title: "Duplicate Expert Detected",
            description: `Dr. ${values.name} ${values.surname} (${values.expertType}) already exists in the directory.`,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

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

      const feeMVA = values.feesMVA ? parseInt(values.feesMVA.replace(/[^\d]/g, '')) || null : null;
      const feeMedNeg = values.feesMedNeg ? parseInt(values.feesMedNeg.replace(/[^\d]/g, '')) || null : null;
      const feeMerit = values.feesMerit ? parseInt(values.feesMerit.replace(/[^\d]/g, '')) || null : null;
      const feePerHour = values.feesPerHour ? parseInt(values.feesPerHour.replace(/[^\d]/g, '')) || null : null;
      // consultation_fees = highest fee for table display
      const consultationFees = feeMedNeg ?? feeMVA ?? feePerHour ?? null;

      const expertData: Record<string, any> = {
        first_name: values.name,
        last_name: values.surname,
        expert_type: values.expertType,
        province: values.province,
        contact_number: values.contactNumber,
        email: values.email,
        practice_address: values.address,
        consultation_fee_mva: feeMVA,
        consultation_fee_med_neg: feeMedNeg,
        merit_fees: feeMerit,
        consultation_fee_per_hour: feePerHour,
        consultation_fees: consultationFees,
        court_fees: values.courtFee ? parseInt(values.courtFee.replace(/[^\d]/g, '')) || null : null,
        qualifications: values.qualifications,
        years_experience: parseInt(values.experience) || null,
        specializations: values.specialization,
        availability_notes: values.notes || null,
        personal_assistant_name: values.personalAssistantName || null,
        personal_assistant_contact: values.personalAssistantContact || null,
        practice_company_name: values.practiceCompanyName || null,
        status: 'active',
      };

      if (cvDocumentUrl) {
        expertData.cv_document_url = cvDocumentUrl;
      }

      let data, error;
      
      if (isEditMode && expertId) {
        // Update existing expert
        ({ data, error } = await supabase
          .from('medical_experts')
          .update(expertData as any)
          .eq('id', expertId)
          .select()
          .single());
      } else {
        // Create new expert
        ({ data, error } = await supabase
          .from('medical_experts')
          .insert(expertData as any)
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
        // Add the new expert to the list for create mode
        setSavedExperts(prev => [data, ...prev.slice(0, 4)]);
        
        // Reset form and files
        form.reset();
        setCvFile(null);
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                {isEditMode ? 'Edit Medical Expert' : 'Medical Expert Form'}
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  <Shield className="h-4 w-4 mr-1" />
                  Internal Control
                </Badge>
              </h1>
              <p className="text-muted-foreground mt-1">
                {isEditMode ? 'Update expert information and details for administrative control.' : 'Register medical experts with their specializations and details for internal management.'}
              </p>
            </div>
          </div>
        </header>

        {/* Bulk Upload Section */}
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Upload className="h-5 w-5" />
              Bulk Expert Upload - Administrative Feature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload multiple experts at once using Excel (.xlsx) format. The Excel file should have the following columns in order:
              </p>
              <div className="grid grid-cols-10 gap-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                <span className="font-medium">First Name</span>
                <span className="font-medium">Last Name</span>
                <span className="font-medium">Expert Type</span>
                <span className="font-medium">Province</span>
                <span className="font-medium">Contact Number</span>
                <span className="font-medium">Email</span>
                <span className="font-medium">Address</span>
                <span className="font-medium">Qualifications</span>
                <span className="font-medium">Experience</span>
                <span className="font-medium">Specializations</span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Select Expert Matter Type <span className="text-destructive">*</span>
                  </label>
                  <Select value={bulkMatterType} onValueChange={(value) => setBulkMatterType(value as 'MVA' | 'Med Neg')}>
                    <SelectTrigger className="w-full md:w-[300px]">
                      <SelectValue placeholder="Select matter type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MVA">MVA Experts</SelectItem>
                      <SelectItem value="Med Neg">Med Neg Experts</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    All experts in the uploaded file will be tagged with this matter type
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => bulkFile && processBulkUpload(bulkFile, bulkMatterType)}
                    disabled={!bulkFile || processingBulk}
                  >
                    {processingBulk ? "Processing..." : "Upload"}
                  </Button>
                </div>
              </div>
              {bulkFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {bulkFile.name}
                </p>
              )}
              
              {/* Clear Experts Section */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-destructive">Clear All Experts</h4>
                    <p className="text-sm text-muted-foreground">
                      Remove all existing experts from the directory to start fresh.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={clearAllExperts}
                    disabled={clearingExperts}
                  >
                    {clearingExperts ? "Clearing..." : "Clear All"}
                  </Button>
                </div>
              </div>
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
                  render={({ field, fieldState }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel className={fieldState.error ? "text-destructive" : ""}>
                        Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., John"
                          {...field}
                          className={fieldState.error ? "border-destructive bg-destructive/10 focus-visible:ring-destructive" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="surname"
                  render={({ field, fieldState }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel className={fieldState.error ? "text-destructive" : ""}>
                        Surname <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Doe"
                          {...field}
                          className={fieldState.error ? "border-destructive bg-destructive/10 focus-visible:ring-destructive" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expertType"
                  render={({ field, fieldState }) => {
                    const formatExpertType = (value: string) => {
                      return value.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ');
                    };
                    
                    return (
                      <FormItem className="md:col-span-1 flex flex-col">
                        <FormLabel className={fieldState.error ? "text-destructive" : ""}>
                          Expert Type <span className="text-destructive">*</span>
                        </FormLabel>
                        <Popover open={openExpertType} onOpenChange={setOpenExpertType}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={`justify-between ${fieldState.error ? "border-destructive bg-destructive/10" : ""} ${!field.value && "text-muted-foreground"}`}
                              >
                                {field.value ? formatExpertType(field.value) : "Select expert type"}
                                <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0 bg-background z-50">
                            <Command>
                              <CommandInput 
                                placeholder="Search or type new expert type..." 
                                value={newExpertType}
                                onValueChange={setNewExpertType}
                              />
                              <CommandEmpty>
                                <Button
                                  variant="ghost"
                                  className="w-full justify-start"
                                  onClick={() => {
                                    if (newExpertType.trim()) {
                                      const formattedType = newExpertType.toLowerCase().replace(/\s+/g, '_');
                                      if (!expertTypes.includes(formattedType)) {
                                        setExpertTypes([...expertTypes, formattedType]);
                                      }
                                      field.onChange(formattedType);
                                      setOpenExpertType(false);
                                      setNewExpertType("");
                                    }
                                  }}
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add "{newExpertType}"
                                </Button>
                              </CommandEmpty>
                              <CommandGroup className="max-h-64 overflow-auto">
                                {expertTypes.map((type) => (
                                  <CommandItem
                                    key={type}
                                    value={type}
                                    onSelect={() => {
                                      field.onChange(type);
                                      setOpenExpertType(false);
                                    }}
                                  >
                                    {formatExpertType(type)}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="specialization"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Case Specialization</FormLabel>
                      <FormControl>
                        <div className="flex items-center space-x-6">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="mva"
                              checked={field.value?.includes("mva")}
                              onCheckedChange={(checked) => {
                                const currentValue = field.value || [];
                                if (checked) {
                                  field.onChange([...currentValue, "mva"]);
                                } else {
                                  field.onChange(currentValue.filter((val) => val !== "mva"));
                                }
                              }}
                            />
                            <label
                              htmlFor="mva"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              MVA
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="med_neg"
                              checked={field.value?.includes("med_neg")}
                              onCheckedChange={(checked) => {
                                const currentValue = field.value || [];
                                if (checked) {
                                  field.onChange([...currentValue, "med_neg"]);
                                } else {
                                  field.onChange(currentValue.filter((val) => val !== "med_neg"));
                                }
                              }}
                            />
                            <label
                              htmlFor="med_neg"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Med Neg
                            </label>
                          </div>
                        </div>
                      </FormControl>
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
                  render={({ field, fieldState }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className={fieldState.error ? "text-destructive" : ""}>
                        Qualifications <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., MD, PhD in Orthopedics, Board Certified..."
                          {...field}
                          className={fieldState.error ? "border-destructive bg-destructive/10 focus-visible:ring-destructive" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hpcsaNumber"
                  render={({ field, fieldState }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel className={fieldState.error ? "text-destructive" : ""}>
                        HPCSA Practice Number <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., MP0123456"
                          {...field}
                          className={fieldState.error ? "border-destructive bg-destructive/10 focus-visible:ring-destructive" : ""}
                        />
                      </FormControl>
                      <FormDescription>Health Professions Council of South Africa registration number</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="experience"
                  render={({ field, fieldState }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel className={fieldState.error ? "text-destructive" : ""}>
                        Years of Experience <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 15"
                          {...field}
                          className={fieldState.error ? "border-destructive bg-destructive/10 focus-visible:ring-destructive" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactNumber"
                  render={({ field, fieldState }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel className={fieldState.error ? "text-destructive" : ""}>
                        Contact Number <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., +27 11 123 4567"
                          {...field}
                          className={fieldState.error ? "border-destructive bg-destructive/10 focus-visible:ring-destructive" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel className={fieldState.error ? "text-destructive" : ""}>
                        Email <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="e.g., doctor@medical.com"
                          {...field}
                          className={fieldState.error ? "border-destructive bg-destructive/10 focus-visible:ring-destructive" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="province"
                  render={({ field, fieldState }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel className={fieldState.error ? "text-destructive" : ""}>
                        Province <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className={fieldState.error ? "border-destructive bg-destructive/10" : ""}>
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
                  render={({ field, fieldState }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className={fieldState.error ? "text-destructive" : ""}>
                        Address <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 123 Medical Centre, Johannesburg, 2000"
                          {...field}
                          className={fieldState.error ? "border-destructive bg-destructive/10 focus-visible:ring-destructive" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="feesMVA"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Consultation Fee / MVA (Rand)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., R 5000" {...field} />
                      </FormControl>
                      <FormDescription>Optional - Motor Vehicle Accident fee</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="feesMedNeg"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Consultation Fee / Med Neg (Rand)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., R 6000" {...field} />
                      </FormControl>
                      <FormDescription>Optional - Medical Negligence fee</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="feesMerit"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Merit Fees (Rand)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., R 4000" {...field} />
                      </FormControl>
                      <FormDescription>Optional - Merit report fee</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="feesPerHour"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Hourly Rate Fee (Rand)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., R 2500" {...field} />
                      </FormControl>
                      <FormDescription>Optional - Per hour rate</FormDescription>
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
                   name="practiceCompanyName"
                   render={({ field }) => (
                     <FormItem className="md:col-span-2">
                       <FormLabel>Practice / Company Name <span className="text-muted-foreground text-xs font-normal">(Optional)</span></FormLabel>
                       <FormControl>
                         <Input placeholder="e.g., Smith Neurology Practice (Pty) Ltd" {...field} />
                       </FormControl>
                       <FormDescription>For experts who practice under their own registered company or practice name</FormDescription>
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
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Recently Added Experts */}
        {savedExperts.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
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
                         <span className="h-4 w-4 text-center font-bold text-primary">R</span>
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
      <CompanyFooter />
    </div>
  );
};

export default MedicalExpertForm;
