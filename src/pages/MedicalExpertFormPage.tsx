import React, { useEffect, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
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
import { ArrowLeft, FileText, Shield, Plus, Save, Cloud, CloudOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { generateExpertCode } from "@/utils/idGenerators";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";

const STORAGE_KEY = "medical_expert_form_draft";

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  surname: z.string().min(2, "Surname is required"),
  expertType: z.string().min(2, "Expert type is required"),
  specialization: z.array(z.string()).default([]),
  matterTypes: z.array(z.enum(["MVA", "Med Neg"])).default(["MVA"]),
  qualifications: z.string().optional().default(""),
  hpcsaNumber: z.string().optional().default(""),
  experience: z.string().optional().default(""),
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
  feesPerHour: z.string().optional().default(""),
  courtFee: z.string().optional().default(""),
  courtAvailability: z.enum(["Yes", "No"]),
  notes: z.string().optional(),
  personalAssistantName: z.string().optional(),
  personalAssistantContact: z.string().optional(),
  autoCode: z.string().min(2),
  cvDocument: z.any().optional(),
});

const MedicalExpertFormPage = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { expertId: routeExpertId } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingExpert, setLoadingExpert] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [uploadingCV, setUploadingCV] = useState(false);
  const [openExpertType, setOpenExpertType] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [expertTypes, setExpertTypes] = useState([
    "neurosurgeon", "orthopedic_surgeon", "clinical_psychologist", "psychiatrist",
    "cardiologist", "pulmonologist", "neurologist", "radiologist", "plastic_surgeon",
    "general_surgeon", "emergency_medicine", "internal_medicine", "rheumatologist",
    "endocrinologist", "gastroenterologist", "oncologist", "dermatologist", "urologist",
    "ophthalmologist", "ent_surgeon", "anesthesiologist", "pathologist", "forensic_pathologist",
    "occupational_therapist", "physiotherapist", "biokinetisist", "speech_therapist", "audiologist", "midwife", "nurse"
  ]);
  const [newExpertType, setNewExpertType] = useState("");
  
  // Check if we're in edit mode - support both route params and query params
  const expertId = routeExpertId || searchParams.get('edit');
  const isEditMode = !!expertId;
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      surname: "",
      expertType: "",
      specialization: [],
      matterTypes: ["MVA"],
      qualifications: "",
      hpcsaNumber: "",
      experience: "",
      contactNumber: "",
      email: "",
      address: "",
      province: undefined,
      feesMVA: "",
      feesMedNeg: "",
      feesPerHour: "",
      courtFee: "",
      courtAvailability: undefined,
      notes: "",
      personalAssistantName: "",
      personalAssistantContact: "",
      autoCode: "",
      cvDocument: null,
    },
    mode: "onChange",
  });

  const name = form.watch("name");
  const surname = form.watch("surname");

  // Auto-save form data to localStorage
  const saveToLocalStorage = useCallback((data: z.infer<typeof formSchema>) => {
    if (isEditMode) return; // Don't auto-save when editing existing expert
    
    try {
      setAutoSaveStatus('saving');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        data,
        timestamp: new Date().toISOString()
      }));
      setAutoSaveStatus('saved');
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving form data:', error);
      setAutoSaveStatus('unsaved');
    }
  }, [isEditMode]);

  // Load saved form data on mount
  useEffect(() => {
    if (isEditMode) return; // Don't load draft when editing
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { data, timestamp } = JSON.parse(saved);
        const savedTime = new Date(timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - savedTime.getTime()) / (1000 * 60 * 60);
        
        // Only restore if saved within the last 24 hours
        if (hoursDiff < 24 && data) {
          form.reset(data);
          setLastSaved(savedTime);
          toast({
            title: "Draft Restored",
            description: `Your previous form data from ${savedTime.toLocaleTimeString()} has been restored.`,
          });
        }
      }
    } catch (error) {
      console.error('Error loading saved form data:', error);
    }
  }, [isEditMode]);

  // Watch all form values and auto-save on changes
  useEffect(() => {
    const subscription = form.watch((value) => {
      // Only save if there's meaningful data
      if (value.name || value.surname || value.expertType || value.email) {
        setAutoSaveStatus('unsaved');
        // Debounce the save
        const timeoutId = setTimeout(() => {
          saveToLocalStorage(value as z.infer<typeof formSchema>);
        }, 1000);
        return () => clearTimeout(timeoutId);
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch, saveToLocalStorage]);

  // Clear saved data after successful submit
  const clearSavedData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAutoSaveStatus('saved');
  }, []);

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
    setLoadingExpert(true);
    try {
      const { data, error } = await supabase
        .from('medical_experts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        console.log('Loading expert data:', data);
        
        // Normalize province value to match enum format (lowercase with underscores)
        const normalizeProvince = (province: string | null) => {
          if (!province) return undefined;
          return province.toLowerCase().replace(/\s+/g, '_');
        };
        
        // Map the data to form values with proper type handling
        const expertType = data.expert_type as z.infer<typeof formSchema>['expertType'];
        
        form.reset({
          name: data.first_name,
          surname: data.last_name,
          expertType: expertType,
          specialization: (data.specializations || []) as string[],
          matterTypes: (data.matter_types || ['MVA']) as ("MVA" | "Med Neg")[],
          qualifications: data.qualifications || "Not specified",
          hpcsaNumber: "Not specified",
          experience: data.years_experience?.toString() || "0",
          contactNumber: data.contact_number || "",
          email: data.email || "",
          address: data.practice_address || "",
          province: normalizeProvince(data.province) as any,
          feesMVA: data.consultation_fee_mva?.toString() || "",
          feesMedNeg: data.consultation_fee_med_neg?.toString() || "",
          feesPerHour: data.consultation_fee_per_hour?.toString() || "",
          courtFee: data.court_fees?.toString() || "0",
          courtAvailability: "Yes",
          notes: data.availability_notes || "",
          personalAssistantName: data.personal_assistant_name || "",
          personalAssistantContact: data.personal_assistant_contact || "",
          autoCode: generateExpertCode(data.first_name, data.last_name),
        });
        
        toast({
          title: "Expert loaded",
          description: `Editing Dr. ${data.first_name} ${data.last_name}`,
        });
      } else {
        toast({
          title: "Expert not found",
          description: "The expert you're trying to edit could not be found.",
          variant: "destructive",
        });
        navigate('/medical-expert-directory');
      }
    } catch (error) {
      console.error('Error loading expert:', error);
      toast({
        title: "Error loading expert",
        description: "Failed to load expert data for editing.",
        variant: "destructive",
      });
      navigate('/medical-expert-directory');
    } finally {
      setLoadingExpert(false);
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

      const expertData = {
        first_name: values.name,
        last_name: values.surname,
        expert_type: values.expertType,
        province: values.province,
        contact_number: values.contactNumber,
        email: values.email,
        practice_address: values.address,
        consultation_fee_mva: values.feesMVA ? parseInt(values.feesMVA.replace(/[^\d]/g, '')) : null,
        consultation_fee_med_neg: values.feesMedNeg ? parseInt(values.feesMedNeg.replace(/[^\d]/g, '')) : null,
        consultation_fee_per_hour: values.feesPerHour ? parseInt(values.feesPerHour.replace(/[^\d]/g, '')) : null,
        court_fees: parseInt(values.courtFee.replace(/[^\d]/g, '')) || null,
        qualifications: values.qualifications,
        years_experience: parseInt(values.experience) || null,
        specializations: values.specialization,
        matter_types: values.matterTypes,
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

      // Clear saved draft data on successful submit
      clearSavedData();

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
            <div className="flex items-center justify-between">
              <CardTitle>
                {isEditMode ? 'Update Expert Information' : 'Expert Information'}
              </CardTitle>
              {!isEditMode && (
                <div className="flex items-center gap-2 text-sm">
                  {autoSaveStatus === 'saving' && (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                      <Cloud className="h-3 w-3 mr-1 animate-pulse" />
                      Saving...
                    </Badge>
                  )}
                  {autoSaveStatus === 'saved' && lastSaved && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                      <Save className="h-3 w-3 mr-1" />
                      Auto-saved {lastSaved.toLocaleTimeString()}
                    </Badge>
                  )}
                  {autoSaveStatus === 'unsaved' && (
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                      <CloudOff className="h-3 w-3 mr-1" />
                      Unsaved changes
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingExpert ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground">Loading expert information...</p>
                </div>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
                  console.log("Form validation errors:", errors);
                  toast({
                    title: "Validation Error",
                    description: `Please fill in all required fields correctly. ${Object.keys(errors).length} field(s) need attention.`,
                    variant: "destructive",
                  });
                })} className="space-y-6">
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
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel className={fieldState.error ? "text-destructive" : ""}>
                          Name <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., John" 
                            {...field} 
                            className={fieldState.error ? "border-destructive bg-destructive/10 focus:ring-destructive" : ""}
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
                      <FormItem>
                        <FormLabel className={fieldState.error ? "text-destructive" : ""}>
                          Surname <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Smith" 
                            {...field} 
                            className={fieldState.error ? "border-destructive bg-destructive/10 focus:ring-destructive" : ""}
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
                        <FormItem className="flex flex-col">
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
                    name="matterTypes"
                    render={() => (
                      <FormItem>
                        <FormLabel>Type of Matter</FormLabel>
                        <FormDescription>Select matter types this expert handles</FormDescription>
                        <div className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="matter_mva"
                              checked={form.watch("matterTypes").includes("MVA")}
                              onCheckedChange={(checked) => {
                                const currentTypes = form.getValues("matterTypes");
                                if (checked) {
                                  form.setValue("matterTypes", [...currentTypes, "MVA"]);
                                } else {
                                  form.setValue("matterTypes", currentTypes.filter(s => s !== "MVA"));
                                }
                              }}
                            />
                            <label htmlFor="matter_mva" className="text-sm">MVA</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="matter_med_neg"
                              checked={form.watch("matterTypes").includes("Med Neg")}
                              onCheckedChange={(checked) => {
                                const currentTypes = form.getValues("matterTypes");
                                if (checked) {
                                  form.setValue("matterTypes", [...currentTypes, "Med Neg"]);
                                } else {
                                  form.setValue("matterTypes", currentTypes.filter(s => s !== "Med Neg"));
                                }
                              }}
                            />
                            <label htmlFor="matter_med_neg" className="text-sm">Med Neg</label>
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
                    render={({ field, fieldState }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel className={fieldState.error ? "text-destructive" : ""}>
                          Contact Number <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., +27 11 123 4567" 
                            {...field} 
                            className={fieldState.error ? "border-destructive bg-destructive/10" : ""}
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
                            className={fieldState.error ? "border-destructive bg-destructive/10" : ""}
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
                          <SelectContent className="bg-background z-50">
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
                            className={fieldState.error ? "border-destructive bg-destructive/10" : ""}
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
                        <FormLabel>Consultation Fee MVA (Rand)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., R 5000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="feesMedNeg"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel>Consultation Fee Med Neg (Rand)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., R 6000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="feesPerHour"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel>Consultation Fee Per Hour (Rand)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., R 2500" {...field} />
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
                    render={({ field, fieldState }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel className={fieldState.error ? "text-destructive" : ""}>
                          Court Availability <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            className={`flex flex-wrap gap-6 p-2 rounded ${fieldState.error ? "border border-destructive bg-destructive/10" : ""}`}
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

                  {/* Form Error Summary */}
                  {Object.keys(form.formState.errors).length > 0 && (
                    <div className="md:col-span-2 p-4 rounded-lg bg-destructive/10 border border-destructive">
                      <p className="text-destructive font-medium mb-2">Please fix the following errors:</p>
                      <ul className="list-disc list-inside text-sm text-destructive space-y-1">
                        {Object.entries(form.formState.errors).map(([field, error]) => (
                          <li key={field}>
                            <span className="font-medium capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}</span>: {error?.message as string}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="md:col-span-2 flex gap-3 justify-end">
                    <Button 
                      type="submit" 
                      disabled={isLoading}
                      onClick={() => {
                        // Trigger validation on all fields when clicking submit
                        form.trigger();
                      }}
                    >
                      {isLoading ? "Saving..." : (isEditMode ? "Update Expert" : "Save Expert")}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => form.reset()}>
                      Reset
                    </Button>
                    {!isEditMode && lastSaved && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          clearSavedData();
                          form.reset();
                          toast({
                            title: "Draft Cleared",
                            description: "Saved form data has been cleared.",
                          });
                        }}
                      >
                        Clear Draft
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </Form>
            )}
          </CardContent>
        </Card>
      </main>
      <CompanyFooter />
    </div>
  );
};

export default MedicalExpertFormPage;