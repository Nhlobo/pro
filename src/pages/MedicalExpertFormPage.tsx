import React, { useEffect, useState, useCallback, useMemo } from "react";
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
import { ArrowLeft, FileText, Shield, Plus, Save, Cloud, CloudOff, History, ArrowRight, RefreshCw, Filter, X } from "lucide-react";
import { useAuditTrail } from "@/hooks/useAuditTrail";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTimeShort } from "@/utils/dateTime";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { generateExpertCode } from "@/utils/idGenerators";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { DateRangePicker, isWithinDateRange } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";

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
  feesMerit: z.string().optional().default(""),
  feesPerHour: z.string().optional().default(""),
  courtFee: z.string().optional().default(""),
  courtAvailability: z.enum(["Yes", "No"]),
  notes: z.string().optional(),
  personalAssistantName: z.string().optional(),
  personalAssistantContact: z.string().optional(),
  autoCode: z.string().min(2),
  cvDocument: z.any().optional(),
});

const MedicalExpertFormPage = ({ onSaved, editExpertId }: { onSaved?: () => void; editExpertId?: string | null } = {}) => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { expertId: routeExpertId } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingExpert, setLoadingExpert] = useState(false);
  const [cvFiles, setCvFiles] = useState<File[]>([]);
  const [qualificationsFiles, setQualificationsFiles] = useState<File[]>([]);
  const [hpcsaFiles, setHpcsaFiles] = useState<File[]>([]);
  const [uploadingCV, setUploadingCV] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [openExpertType, setOpenExpertType] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [expertTypes, setExpertTypes] = useState([
    "accident_specialist", "anesthesiologist", "audiologist", "biokinetisist", "cardiologist",
    "clinical_psychologist", "dermatologist", "emergency_medicine", "endocrinologist",
    "ent_surgeon", "forensic_pathologist", "gastroenterologist", "general_practitioner",
    "general_surgeon", "internal_medicine", "maxillofacial_surgeon", "midwife", "neurologist",
    "neurosurgeon", "nurse", "occupational_therapist", "oncologist", "ophthalmologist",
    "orthopedic_surgeon", "pathologist", "physiotherapist", "plastic_surgeon", "psychiatrist",
    "pulmonologist", "radiologist", "rheumatologist", "speech_therapist", "urologist"
  ]);
  const [newExpertType, setNewExpertType] = useState("");
  const [previousFees, setPreviousFees] = useState<{
    feesMVA: string | null;
    feesMedNeg: string | null;
    feesMerit: string | null;
    feesPerHour: string | null;
    courtFee: string | null;
  }>({ feesMVA: null, feesMedNeg: null, feesMerit: null, feesPerHour: null, courtFee: null });

  const { logAuditTrail } = useAuditTrail();
  const [feeHistory, setFeeHistory] = useState<any[]>([]);
  const [loadingFeeHistory, setLoadingFeeHistory] = useState(false);

  const [feeDateRange, setFeeDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedFeeType, setSelectedFeeType] = useState<string>("all");
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>("");

  const FEE_FIELD_LABELS: Record<string, string> = {
    consultation_fee_mva: "Consultation Fee MVA",
    consultation_fee_med_neg: "Consultation Fee Med Neg",
    merit_fees: "Merit Fees",
    consultation_fee_per_hour: "Hourly Rate Fee",
    court_fees: "Court Fee",
  };
  const FEE_FIELD_KEYS = Object.keys(FEE_FIELD_LABELS);

  const filteredFeeHistory = useMemo(() => {
    return feeHistory.filter((entry) => {
      const changed: string[] = Array.isArray(entry.changed_fields)
        ? entry.changed_fields.filter((f: string) => FEE_FIELD_KEYS.includes(f))
        : Object.keys(entry.new_values || {}).filter((f) => FEE_FIELD_KEYS.includes(f));
      if (changed.length === 0) return false;

      if (selectedFeeType !== "all" && !changed.includes(selectedFeeType)) return false;

      const email = (entry.user_email || "").toLowerCase();
      if (selectedUserEmail && !email.includes(selectedUserEmail.toLowerCase().trim())) return false;

      if (!isWithinDateRange(entry.created_at, feeDateRange)) return false;

      return true;
    });
  }, [feeHistory, selectedFeeType, selectedUserEmail, feeDateRange]);

  const uniqueFeeUsers = useMemo(() => {
    const emails = new Set<string>();
    feeHistory.forEach((entry) => {
      if (entry.user_email) emails.add(entry.user_email);
    });
    return Array.from(emails).sort();
  }, [feeHistory]);

  const clearFeeFilters = () => {
    setFeeDateRange(undefined);
    setSelectedFeeType("all");
    setSelectedUserEmail("");
  };

  const fetchFeeHistory = useCallback(async (id: string) => {
    if (!id) return;
    setLoadingFeeHistory(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action_type, old_values, new_values, changed_fields, user_email, created_at, function_area")
        .eq("table_name", "medical_experts")
        .eq("record_id", id)
        .eq("function_area", "expert_fees")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!error) setFeeHistory(data || []);
    } finally {
      setLoadingFeeHistory(false);
    }
  }, []);

  const formatRand = (v: string | null) => {
    if (v === null || v === undefined || v === "") return null;
    const n = parseInt(String(v).replace(/[^\d]/g, ""));
    if (!Number.isFinite(n)) return null;
    return `R ${n.toLocaleString("en-ZA")}`;
  };

  const PreviousFeeNote: React.FC<{ previous: string | null; current: string }> = ({ previous, current }) => {
    const prevFormatted = formatRand(previous);
    if (!prevFormatted) return null;
    const prevNum = parseInt(String(previous ?? "").replace(/[^\d]/g, "")) || 0;
    const currNum = parseInt(String(current ?? "").replace(/[^\d]/g, "")) || 0;
    const changed = prevNum !== currNum;
    return (
      <p className={`text-xs mt-1 ${changed ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>
        Previous: <span className="line-through">{prevFormatted}</span>
        {changed && currNum > 0 && (
          <span className="ml-2 not-italic">→ New: R {currNum.toLocaleString("en-ZA")}</span>
        )}
      </p>
    );
  };

  // Check if we're in edit mode - support prop, route params and query params
  const expertId = editExpertId || routeExpertId || searchParams.get('edit');
  const isEditMode = !!expertId;

  useEffect(() => {
    if (expertId) fetchFeeHistory(expertId);
  }, [expertId, fetchFeeHistory]);
  
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
      feesMerit: "",
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
        // Supports legacy values like "KwaZulu-Natal".
        const normalizeProvince = (province: string | null) => {
          if (!province) return undefined;
          return province.toLowerCase().replace(/[\s-]+/g, '_');
        };
        
        // Map the data to form values with proper type handling
        const expertType = data.expert_type as string;
        
        // Ensure the loaded expert type exists in the dropdown list
        if (expertType && !expertTypes.includes(expertType)) {
          setExpertTypes(prev => [...prev, expertType]);
        }
        
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
          feesMerit: (data as any).merit_fees?.toString() || "",
          feesPerHour: data.consultation_fee_per_hour?.toString() || "",
          courtFee: data.court_fees?.toString() || "0",
          courtAvailability: "Yes",
          notes: data.availability_notes || "",
          personalAssistantName: data.personal_assistant_name || "",
          personalAssistantContact: data.personal_assistant_contact || "",
          autoCode: generateExpertCode(data.first_name, data.last_name),
        });

        setPreviousFees({
          feesMVA: data.consultation_fee_mva?.toString() ?? null,
          feesMedNeg: data.consultation_fee_med_neg?.toString() ?? null,
          feesMerit: (data as any).merit_fees?.toString() ?? null,
          feesPerHour: data.consultation_fee_per_hour?.toString() ?? null,
          courtFee: data.court_fees?.toString() ?? null,
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

  const uploadExpertFile = async (
    file: File,
    folder: 'cvs' | 'qualifications' | 'hpcsa',
    prefix: string,
  ): Promise<{ path: string; url: string } | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${prefix}-${Date.now()}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      const { error } = await supabase.storage
        .from('expert-documents')
        .upload(filePath, file);

      if (error) throw error;

      const { data } = supabase.storage
        .from('expert-documents')
        .getPublicUrl(filePath);

      return { path: filePath, url: data.publicUrl };
    } catch (error) {
      console.error(`Error uploading ${folder} document:`, error);
      return null;
    }
  };

  const uploadCVDocument = async (file: File): Promise<string | null> => {
    const res = await uploadExpertFile(file, 'cvs', 'cv');
    return res?.url ?? null;
  };

  const insertVaultDocument = async (params: {
    expertId: string;
    expertName: string;
    docType: 'Expert CV' | 'Expert Qualifications' | 'Expert HPCSA Certificate';
    filePath: string;
    file: File;
    uploadedBy: string;
  }) => {
    const { error } = await supabase.from('documents').insert({
      document_type: params.docType,
      file_name: `${params.docType} - ${params.expertName} - ${params.file.name}`,
      file_path: params.filePath,
      file_size: params.file.size,
      file_type: params.file.type,
      uploaded_by: params.uploadedBy,
      expert_id: params.expertId,
      approval_status: 'pending',
      access_level: 'internal',
      is_visible_to_attorney: false,
      is_visible_to_expert: true,
      notes: 'Auto-uploaded from expert profile — pending admin review',
    });
    if (error) console.error('Vault insert failed:', error);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      // Check for duplicate expert by name and surname (case-insensitive, only when creating new)
      if (!isEditMode) {
        const { data: existingExperts, error: checkError } = await supabase
          .from('medical_experts')
          .select('id, first_name, last_name, expert_type')
          .ilike('first_name', values.name.trim())
          .ilike('last_name', values.surname.trim());

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (existingExperts && existingExperts.length > 0) {
          const existingExpert = existingExperts[0];
          toast({
            title: "Duplicate Expert Detected",
            description: `An expert named Dr. ${existingExpert.first_name} ${existingExpert.last_name} (${existingExpert.expert_type}) already exists. To prevent duplicates, you cannot add another expert with the same name.`,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      const cvUploads: Array<{ file: File; path: string; url: string }> = [];
      const qualificationsUploads: Array<{ file: File; path: string; url: string }> = [];
      const hpcsaUploads: Array<{ file: File; path: string; url: string }> = [];

      const totalFiles = cvFiles.length + qualificationsFiles.length + hpcsaFiles.length;
      if (totalFiles > 0) {
        setUploadingCV(true);
        setUploadingDocs(true);
        try {
          for (const f of cvFiles) {
            const res = await uploadExpertFile(f, 'cvs', 'cv');
            if (!res) throw new Error(`Failed to upload CV document: ${f.name}`);
            cvUploads.push({ file: f, ...res });
          }
          for (const f of qualificationsFiles) {
            const res = await uploadExpertFile(f, 'qualifications', 'qual');
            if (!res) throw new Error(`Failed to upload qualifications document: ${f.name}`);
            qualificationsUploads.push({ file: f, ...res });
          }
          for (const f of hpcsaFiles) {
            const res = await uploadExpertFile(f, 'hpcsa', 'hpcsa');
            if (!res) throw new Error(`Failed to upload HPCSA document: ${f.name}`);
            hpcsaUploads.push({ file: f, ...res });
          }
        } finally {
          setUploadingCV(false);
          setUploadingDocs(false);
        }
      }

      // Keep first uploaded URL on the expert record (for legacy fields)
      const cvDocumentUrl = cvUploads[0]?.url ?? null;
      const qualificationsUrl = qualificationsUploads[0]?.url ?? null;
      const hpcsaUrl = hpcsaUploads[0]?.url ?? null;


      const feesMva = values.feesMVA ? parseInt(values.feesMVA.replace(/[^\d]/g, '')) : null;
      const feesMedNeg = values.feesMedNeg ? parseInt(values.feesMedNeg.replace(/[^\d]/g, '')) : null;
      const feesMerit = values.feesMerit ? parseInt(values.feesMerit.replace(/[^\d]/g, '')) : null;
      const feesPerHour = values.feesPerHour ? parseInt(values.feesPerHour.replace(/[^\d]/g, '')) : null;
      const courtFees = parseInt(values.courtFee.replace(/[^\d]/g, '')) || null;

      // Keep legacy `consultation_fees` in sync so the directory table updates correctly.
      // Prefer Med Neg (if provided), else MVA, else per-hour.
      const legacyConsultationFees = feesMedNeg ?? feesMva ?? feesPerHour;

      // Store province consistently in display format (matches directory filters)
      const formatProvinceForStorage = (province: z.infer<typeof formSchema>["province"]) => {
        const provinceMap: Record<z.infer<typeof formSchema>["province"], string> = {
          gauteng: "Gauteng",
          western_cape: "Western Cape",
          kwazulu_natal: "KwaZulu-Natal",
          eastern_cape: "Eastern Cape",
          limpopo: "Limpopo",
          mpumalanga: "Mpumalanga",
          north_west: "North West",
          free_state: "Free State",
          northern_cape: "Northern Cape",
        };
        return provinceMap[province] ?? province;
      };

      const expertData = {
        first_name: values.name,
        last_name: values.surname,
        expert_type: values.expertType,
        province: formatProvinceForStorage(values.province),
        contact_number: values.contactNumber,
        email: values.email,
        practice_address: values.address,
        consultation_fee_mva: feesMva,
        consultation_fee_med_neg: feesMedNeg,
        merit_fees: feesMerit,
        consultation_fee_per_hour: feesPerHour,
        consultation_fees: legacyConsultationFees,
        court_fees: courtFees,
        qualifications: values.qualifications,
        years_experience: parseInt(values.experience) || null,
        specializations: values.specialization,
        matter_types: values.matterTypes,
        availability_notes: values.notes || null,
        personal_assistant_name: values.personalAssistantName || null,
        personal_assistant_contact: values.personalAssistantContact || null,
        ...(cvDocumentUrl && { cv_document_url: cvDocumentUrl }),
        ...(qualificationsUrl && { qualifications_document_url: qualificationsUrl }),
        ...(hpcsaUrl && { hpcsa_document_url: hpcsaUrl }),
      };

      let data, error;

      // --- OPTIMISTIC UPDATE (edit mode only) ---------------------------------
      // Snapshot the current baseline so we can revert if the server rejects the
      // change, then immediately reflect the new values in the rest of the app
      // (directory cards, credit control, statement previews, etc.) BEFORE the
      // network round-trip completes. The editor itself is already controlled
      // by the form values the user just typed, so it reflects changes instantly.
      const optimisticPreviousFees = previousFees;
      if (isEditMode && expertId) {
        try {
          setPreviousFees({
            feesMVA: feesMva?.toString() ?? null,
            feesMedNeg: feesMedNeg?.toString() ?? null,
            feesMerit: feesMerit?.toString() ?? null,
            feesPerHour: feesPerHour?.toString() ?? null,
            courtFee: courtFees?.toString() ?? null,
          });
          window.dispatchEvent(new CustomEvent('medical-expert-updated', {
            detail: {
              expertId,
              consultation_fees: legacyConsultationFees,
              court_fees: courtFees,
              optimistic: true,
              patch: expertData,
            },
          }));
        } catch (e) {
          console.warn('Optimistic broadcast failed', e);
        }
      }

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

      if (error) {
        // Revert the optimistic baseline so the next attempt still detects
        // the original "previous" fee values for audit logging.
        if (isEditMode) setPreviousFees(optimisticPreviousFees);
        throw error;
      }

      // Mirror every uploaded document into the Document Vault
      const savedExpertId = (data as any)?.id ?? expertId;
      const expertFullName = `Dr. ${values.name} ${values.surname}`.trim();
      const { data: authData } = await supabase.auth.getUser();
      const uploadedBy = authData?.user?.id;

      if (savedExpertId && uploadedBy) {
        for (const u of cvUploads) {
          await insertVaultDocument({
            expertId: savedExpertId, expertName: expertFullName,
            docType: 'Expert CV', filePath: u.path, file: u.file, uploadedBy,
          });
        }
        for (const u of qualificationsUploads) {
          await insertVaultDocument({
            expertId: savedExpertId, expertName: expertFullName,
            docType: 'Expert Qualifications', filePath: u.path, file: u.file, uploadedBy,
          });
        }
        for (const u of hpcsaUploads) {
          await insertVaultDocument({
            expertId: savedExpertId, expertName: expertFullName,
            docType: 'Expert HPCSA Certificate', filePath: u.path, file: u.file, uploadedBy,
          });
        }
      }

      // Clear saved draft data on successful submit
      clearSavedData();

      // Refresh the "Previous" baseline to the values we just persisted so any
      // further edits compare against the latest saved amounts.
      setPreviousFees({
        feesMVA: feesMva?.toString() ?? null,
        feesMedNeg: feesMedNeg?.toString() ?? null,
        feesMerit: feesMerit?.toString() ?? null,
        feesPerHour: feesPerHour?.toString() ?? null,
        courtFee: courtFees?.toString() ?? null,
      });

      // Log fee changes to audit trail (only changed fee fields)
      try {
        const prevMap: Record<string, number | null> = {
          consultation_fee_mva: previousFees.feesMVA ? parseInt(previousFees.feesMVA) : null,
          consultation_fee_med_neg: previousFees.feesMedNeg ? parseInt(previousFees.feesMedNeg) : null,
          merit_fees: previousFees.feesMerit ? parseInt(previousFees.feesMerit) : null,
          consultation_fee_per_hour: previousFees.feesPerHour ? parseInt(previousFees.feesPerHour) : null,
          court_fees: previousFees.courtFee ? parseInt(previousFees.courtFee) : null,
        };
        const newMap: Record<string, number | null> = {
          consultation_fee_mva: feesMva,
          consultation_fee_med_neg: feesMedNeg,
          merit_fees: feesMerit,
          consultation_fee_per_hour: feesPerHour,
          court_fees: courtFees,
        };
        const oldChanged: Record<string, number | null> = {};
        const newChanged: Record<string, number | null> = {};
        for (const k of FEE_FIELD_KEYS) {
          if ((prevMap[k] ?? null) !== (newMap[k] ?? null)) {
            oldChanged[k] = prevMap[k] ?? null;
            newChanged[k] = newMap[k] ?? null;
          }
        }
        const changedKeys = Object.keys(newChanged);
        if (savedExpertId && changedKeys.length > 0) {
          await logAuditTrail(
            'medical_experts',
            savedExpertId,
            isEditMode ? 'UPDATE' : 'CREATE',
            'expert_fees',
            isEditMode ? oldChanged : null,
            newChanged,
            `Fees ${isEditMode ? 'updated' : 'set'} for ${expertFullName}: ${changedKeys.map(k => FEE_FIELD_LABELS[k]).join(', ')}`
          );
          fetchFeeHistory(savedExpertId);
        }
      } catch (e) {
        console.warn('Failed to log fee change history', e);
      }


      // Broadcast update so all consumers (directory, credit control, payment planner,
      // appointment/statement previews) refresh their cached fee data immediately.
      try {
        window.dispatchEvent(new CustomEvent('medical-expert-updated', {
          detail: {
            expertId: savedExpertId,
            consultation_fees: legacyConsultationFees,
            court_fees: courtFees,
            isEditMode,
          },
        }));
      } catch (e) {
        console.warn('Failed to dispatch medical-expert-updated event', e);
      }

      toast({
        title: isEditMode ? "Expert updated successfully" : "Medical expert saved successfully",
        description: `Dr. ${values.name} ${values.surname} has been ${isEditMode ? 'updated' : 'added to the directory'}`,
      });

      if (onSaved) {
        onSaved();
      } else if (isEditMode) {
        navigate('/medical-expert-directory');
      } else {
        navigate('/recently-added-experts');
      }
      
    } catch (error) {
      console.error('Error saving expert:', error);
      toast({
        title: isEditMode ? "Update completed with issues" : "Error",
        description: isEditMode
          ? "We couldn't confirm the save, but the editor will close. Please verify the expert record."
          : "Failed to save medical expert. Please try again.",
        variant: "destructive",
      });
      // In edit mode, always close the editor — even when the server reports
      // an error or no changes — so the user is not left stuck on the page.
      if (isEditMode) {
        if (onSaved) {
          onSaved();
        } else {
          navigate('/medical-expert-directory');
        }
      }
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
                                <CommandEmpty className="py-2 text-center text-sm text-muted-foreground">
                                  No expert type found.
                                </CommandEmpty>
                                <CommandGroup className="max-h-64 overflow-auto">
                                  {expertTypes.map((type) => (
                                    <CommandItem
                                      key={type}
                                      value={type}
                                      onSelect={() => {
                                        field.onChange(type);
                                        setOpenExpertType(false);
                                        setNewExpertType("");
                                      }}
                                    >
                                      {formatExpertType(type)}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                                {newExpertType.trim() && !expertTypes.includes(newExpertType.toLowerCase().replace(/\s+/g, '_')) && (
                                  <div className="border-t border-border p-1">
                                    <Button
                                      variant="ghost"
                                      className="w-full justify-start text-sm"
                                      onClick={() => {
                                        const formattedType = newExpertType.trim().toLowerCase().replace(/\s+/g, '_');
                                        if (!expertTypes.includes(formattedType)) {
                                          setExpertTypes(prev => [...prev, formattedType]);
                                        }
                                        field.onChange(formattedType);
                                        setOpenExpertType(false);
                                        setNewExpertType("");
                                      }}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add new type: "{newExpertType.trim()}"
                                    </Button>
                                  </div>
                                )}
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
                        <PreviousFeeNote previous={previousFees.feesMVA} current={field.value} />
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
                        <PreviousFeeNote previous={previousFees.feesMedNeg} current={field.value} />
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
                        <PreviousFeeNote previous={previousFees.feesMerit} current={field.value} />
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
                        <PreviousFeeNote previous={previousFees.feesPerHour} current={field.value} />
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
                        <PreviousFeeNote previous={previousFees.courtFee} current={field.value} />
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

                  {/* CV Documents Upload (multiple) */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">
                      CV Documents (Optional — multiple allowed)
                    </label>
                    <div className="space-y-2">
                      <Input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setCvFiles(Array.from(e.target.files || []))}
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                      />
                      {cvFiles.length > 0 && (
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {cvFiles.map((f, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span>{f.name}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {uploadingCV && (
                        <p className="text-sm text-muted-foreground">Uploading CV...</p>
                      )}
                    </div>
                  </div>

                  {/* Qualifications Documents Upload (multiple) */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">
                      Qualifications Documents (Optional — multiple allowed)
                    </label>
                    <div className="space-y-2">
                      <Input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => setQualificationsFiles(Array.from(e.target.files || []))}
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                      />
                      {qualificationsFiles.length > 0 && (
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {qualificationsFiles.map((f, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span>{f.name}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* HPCSA Certificates Upload (multiple) */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">
                      HPCSA Certificates (Optional — multiple allowed)
                    </label>
                    <div className="space-y-2">
                      <Input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => setHpcsaFiles(Array.from(e.target.files || []))}
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                      />
                      {hpcsaFiles.length > 0 && (
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {hpcsaFiles.map((f, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span>{f.name}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {uploadingDocs && (
                        <p className="text-sm text-muted-foreground">Uploading documents to Document Vault...</p>
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
                       type={isEditMode ? "button" : "submit"}
                       disabled={isLoading}
                       onClick={async (e) => {
                         if (isEditMode) {
                           e.preventDefault();
                           // If nothing changed in edit mode, close the page without re-submitting.
                           if (!form.formState.isDirty) {
                             toast({
                               title: "No changes detected",
                               description: "Closing the editor — no updates were needed.",
                             });
                             if (onSaved) {
                               onSaved();
                             } else {
                               navigate('/medical-expert-directory');
                             }
                             return;
                           }
                           // Otherwise run the normal validated submit.
                           await form.handleSubmit(onSubmit, (errors) => {
                             console.log("Form validation errors:", errors);
                             toast({
                               title: "Validation Error",
                               description: `Please fill in all required fields correctly. ${Object.keys(errors).length} field(s) need attention.`,
                               variant: "destructive",
                             });
                           })();
                           return;
                         }
                         // Create mode: trigger validation as before; native submit handles the rest.
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

        {isEditMode && (
          <Card className="mt-6 border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5" /> Fee Change History
                <Badge variant="outline" className="ml-2">
                  {filteredFeeHistory.length}
                  {filteredFeeHistory.length !== feeHistory.length && ` / ${feeHistory.length}`}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto gap-2"
                  onClick={() => expertId && fetchFeeHistory(expertId)}
                  disabled={loadingFeeHistory}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingFeeHistory ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Every fee update is recorded with the user who made the change, the previous amount, the new amount, and the date/time (SAST).
              </p>
            </CardHeader>
            <CardContent>
              {feeHistory.length > 0 && (
                <div className="flex flex-wrap items-end gap-3 mb-4 pb-4 border-b">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Date Range</label>
                    <DateRangePicker
                      value={feeDateRange}
                      onChange={setFeeDateRange}
                      placeholder="Pick dates"
                      className="w-[200px]"
                      size="sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Fee Type</label>
                    <Select value={selectedFeeType} onValueChange={setSelectedFeeType}>
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="All fee types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All fee types</SelectItem>
                        {FEE_FIELD_KEYS.map((key) => (
                          <SelectItem key={key} value={key}>{FEE_FIELD_LABELS[key]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Changed By</label>
                    <Select value={selectedUserEmail} onValueChange={setSelectedUserEmail}>
                      <SelectTrigger className="w-[200px] h-8 text-xs">
                        <SelectValue placeholder="All users" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All users</SelectItem>
                        {uniqueFeeUsers.map((email) => (
                          <SelectItem key={email} value={email}>{email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(feeDateRange?.from || selectedFeeType !== "all" || selectedUserEmail) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-muted-foreground"
                      onClick={clearFeeFilters}
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear
                    </Button>
                  )}
                </div>
              )}
              {feeHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  {loadingFeeHistory ? 'Loading fee change history...' : 'No fee changes recorded for this expert yet.'}
                </p>
              ) : (
                <ScrollArea className="max-h-[420px] pr-2">
                  <div className="space-y-3">
                    {filteredFeeHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">No fee changes match your filters.</p>
                    ) : (
                      filteredFeeHistory.map((entry) => {
                      const changed: string[] = Array.isArray(entry.changed_fields)
                        ? entry.changed_fields.filter((f: string) => FEE_FIELD_KEYS.includes(f))
                        : Object.keys(entry.new_values || {}).filter((f) => FEE_FIELD_KEYS.includes(f));
                      if (changed.length === 0) return null;
                      return (
                        <div key={entry.id} className="border rounded-md p-3 bg-card">
                          <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                            <Badge variant={entry.action_type === 'CREATE' ? 'default' : 'secondary'}>
                              {entry.action_type}
                            </Badge>
                            <span className="font-medium">{entry.user_email || 'system'}</span>
                            <span className="ml-auto text-muted-foreground">
                              {formatDateTimeShort(entry.created_at)}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {changed.map((f) => {
                              const oldV = entry.old_values?.[f];
                              const newV = entry.new_values?.[f];
                              const fmt = (v: any) =>
                                v === null || v === undefined || v === '' ? '—' : `R ${Number(v).toLocaleString('en-ZA')}`;
                              return (
                                <div key={f} className="flex flex-wrap items-center gap-2 text-sm">
                                  <span className="font-medium min-w-[180px]">{FEE_FIELD_LABELS[f] || f}</span>
                                  <span className="text-muted-foreground line-through">{fmt(oldV)}</span>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-semibold text-amber-600 dark:text-amber-400">{fmt(newV)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        )}
      </main>
      <CompanyFooter />
    </div>
  );
};

export default MedicalExpertFormPage;