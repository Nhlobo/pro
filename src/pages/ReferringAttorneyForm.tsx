import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useFormDraft } from "@/hooks/useFormDraft";
import { DraftStatusIndicator } from "@/components/DraftStatusIndicator";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CompanyFooter from "@/components/CompanyFooter";
import { generateLawFirmCode } from "@/utils/idGenerators";

const formSchema = z.object({
  lawFirmName: z.string().min(2, "Referring attorney name is required"),
  contactPerson: z.string().min(2, "Contact person is required"),
  cellNumber: z
    .string()
    .min(7, "Enter a valid phone")
    .regex(/^[0-9+\-\s()]+$/, "Invalid phone number"),
  email: z.string().email("Invalid email address"),
  address: z.string().min(5, "Address is required").or(z.literal("")),
  attorneyRole: z.enum(["Plaintiff", "Defendant"]),
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
  matterType: z.enum(["MVA", "Med Neg", "Both"]),
  autoCode: z.string().min(2),
});

const RA_FORM_DEFAULTS = {
  lawFirmName: "", contactPerson: "", cellNumber: "", email: "",
  address: "", attorneyRole: "" as any, province: "" as any, matterType: "" as any, autoCode: "",
};

const ReferringAttorneyForm = () => {
  const { toast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Draft only for new records (not edit mode)
  const { draft, setDraft, clearDraft, lastSavedAt, saveStatus } = useFormDraft<typeof RA_FORM_DEFAULTS>(
    id ? `ra-form-edit-${id}` : 'ra-form-new',
    RA_FORM_DEFAULTS
  );
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: id ? RA_FORM_DEFAULTS : draft,
    mode: "onTouched",
  });

  const lawFirmName = form.watch("lawFirmName");
  const contactPerson = form.watch("contactPerson");
  const [nameWarning, setNameWarning] = useState<string>("");

  // Watch all values and persist to draft (only for new records)
  const watchedValues = form.watch();
  useEffect(() => {
    if (!id) setDraft(watchedValues as typeof RA_FORM_DEFAULTS);
  }, [JSON.stringify(watchedValues), id]);

  // Load existing attorney data if editing
  useEffect(() => {
    const loadAttorneyData = async () => {
      if (!id) {
        setIsEditing(false);
        return;
      }

      setIsEditing(true);
      setIsLoadingData(true);

      try {
        const { data, error } = await supabase
          .from('referring_attorneys')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        if (data) {
          // Map database matter_type to form values
          const matterTypeMap: Record<string, "MVA" | "Med Neg" | "Both"> = {
            "mva": "MVA",
            "med_neg": "Med Neg",
            "both": "Both"
          };

          // Map city names to correct provinces
          const provinceMap: Record<string, string> = {
            "Bloemfontein": "Free State",
            "Johannesburg": "Gauteng",
            "Pretoria": "Gauteng",
            "Cape Town": "Western Cape",
            "Durban": "KwaZulu-Natal",
            "Port Elizabeth": "Eastern Cape",
            "Polokwane": "Limpopo",
            "Nelspruit": "Mpumalanga",
            "Kimberley": "Northern Cape",
            "Mahikeng": "North West"
          };

          const province = data.province || "";
          const mappedProvince = provinceMap[province] || province;

          form.reset({
            lawFirmName: data.name || "",
            contactPerson: data.contact_person || "",
            cellNumber: data.phone || "",
            email: data.email || "",
            address: data.address || "",
            attorneyRole: data.attorney_role as any || "",
            province: mappedProvince as any || "",
            matterType: matterTypeMap[data.matter_type as string] || "" as any,
            autoCode: data.code || "",
          });
        }
      } catch (error: any) {
        console.error('Error loading attorney:', error);
        toast({
          title: "Error",
          description: "Failed to load attorney data.",
          variant: "destructive",
        });
        navigate('/referring-attorney-list');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadAttorneyData();
  }, [id, form, toast, navigate]);

  // Check for duplicate names in real-time
  useEffect(() => {
    const checkDuplicateName = async () => {
      if (!lawFirmName || lawFirmName.trim().length < 2) {
        setNameWarning("");
        return;
      }

      try {
        const { data, error } = await supabase
          .from('referring_attorneys')
          .select('id, name')
          .ilike('name', lawFirmName.trim());

        if (error) throw error;

        // Filter out current attorney if editing
        const duplicates = data?.filter(existing => existing.id !== id) || [];

        if (duplicates.length > 0) {
          setNameWarning("🚩 WARNING: A referring attorney with this name already exists! Please delete the duplicate or use a different name.");
        } else {
          setNameWarning("");
        }
      } catch (err) {
        console.error("Error checking duplicate name:", err);
      }
    };

    const timer = setTimeout(() => {
      checkDuplicateName();
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timer);
  }, [lawFirmName, id]);

  useEffect(() => {
    const generateCode = async () => {
      // Don't regenerate code when editing
      if (isEditing) return;
      if (!contactPerson || !lawFirmName) {
        form.setValue("autoCode", "");
        return;
      }

      try {
        // Get the highest existing sequence number from codes matching the pattern
        const { data, error } = await supabase
          .from('referring_attorneys')
          .select('code')
          .order('code', { ascending: false })
          .limit(100);

        if (error) throw error;

        // Extract sequence numbers and find the max
        let maxSequence = 0;
        if (data && data.length > 0) {
          data.forEach(item => {
            // Extract last 2 digits if code follows new pattern (e.g., ST251033)
            const match = item.code?.match(/(\d{2})$/);
            if (match) {
              const seq = parseInt(match[1], 10);
              if (seq > maxSequence) maxSequence = seq;
            }
          });
        }

        const nextSequence = maxSequence + 1;
        const code = generateLawFirmCode(contactPerson, lawFirmName, nextSequence);
        form.setValue("autoCode", code);
      } catch (err) {
        console.error("Error generating code:", err);
        // Fallback to sequence 1 if error
        const code = generateLawFirmCode(contactPerson, lawFirmName, 1);
        form.setValue("autoCode", code);
      }
    };

    generateCode();
  }, [contactPerson, lawFirmName, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      // Check for duplicate NAME first - this is the critical duplicate check
      const { data: nameCheck, error: nameCheckError } = await supabase
        .from('referring_attorneys')
        .select('id, name')
        .ilike('name', values.lawFirmName.trim());

      if (nameCheckError) throw nameCheckError;

      // Filter out current attorney if editing
      const nameDuplicates = nameCheck?.filter(existing => existing.id !== id) || [];

      if (nameDuplicates.length > 0) {
        toast({
          title: "🚩 DUPLICATE NAME DETECTED",
          description: `A referring attorney named "${values.lawFirmName}" already exists. Please delete one of the duplicate entries or use a different name.`,
          variant: "destructive",
          duration: 8000,
        });
        setIsSubmitting(false);
        return;
      }

      // Check for other duplicates (email, phone, code)
      const { data: existingAttorneys, error: checkError } = await supabase
        .from('referring_attorneys')
        .select('id, email, phone, code, name')
        .or(`email.eq.${values.email},phone.eq.${values.cellNumber},code.eq.${values.autoCode}`);

      if (checkError) throw checkError;

      // Filter out current attorney if editing
      const duplicates = existingAttorneys?.filter(existing => existing.id !== id) || [];

      if (duplicates.length > 0) {
        const duplicate = duplicates[0];
        let message = "An attorney with ";
        if (duplicate.email === values.email) message += "this email";
        else if (duplicate.phone === values.cellNumber) message += "this phone number";
        else if (duplicate.code === values.autoCode) message += "this code";
        message += " already exists.";

        toast({
          title: "Duplicate attorney found",
          description: message,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Convert matter type to database format
      const matterTypeMap: Record<string, "mva" | "med_neg" | "both"> = {
        "MVA": "mva",
        "Med Neg": "med_neg",
        "Both": "both"
      };

      const lawFirmData = {
        name: values.lawFirmName,
        contact_person: values.contactPerson,
        phone: values.cellNumber,
        email: values.email,
        address: values.address || null,
        attorney_role: values.attorneyRole,
        province: values.province,
        matter_type: matterTypeMap[values.matterType],
        code: values.autoCode,
      };

      if (isEditing && id) {
        // Update existing attorney
        const { error } = await supabase
          .from('referring_attorneys')
          .update(lawFirmData)
          .eq('id', id);

        if (error) throw error;

        toast({
          title: "Attorney updated",
          description: `${values.lawFirmName} has been updated successfully.`,
        });
        
        navigate('/referring-attorney-list');
      } else {
        // Create new attorney
        const { error } = await supabase
          .from('referring_attorneys')
          .insert(lawFirmData);

        if (error) throw error;

        toast({
          title: "Referring attorney saved",
          description: `${values.lawFirmName} (${values.autoCode}) has been added to the attorney list.`,
        });
        clearDraft(); // Clear saved draft after successful save
        form.reset(RA_FORM_DEFAULTS);
      }
    } catch (error: any) {
      toast({
        title: isEditing ? "Error updating attorney" : "Error saving attorney",
        description: error.message || `Failed to ${isEditing ? 'update' : 'save'} referring attorney.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      toast({
        title: "No file selected",
        description: "Please select an Excel file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsBulkUploading(true);
    try {
      const data = await bulkFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

      if (jsonData.length === 0) {
        throw new Error("The Excel file is empty");
      }

      // Get the highest existing sequence number first
      const { data: existingCodes, error: codesError } = await supabase
        .from('referring_attorneys')
        .select('code')
        .order('code', { ascending: false })
        .limit(100);

      if (codesError) throw codesError;

      let maxSequence = 0;
      if (existingCodes && existingCodes.length > 0) {
        existingCodes.forEach(item => {
          const match = item.code?.match(/(\d{4})$/);
          if (match) {
            const seq = parseInt(match[1], 10);
            if (seq > maxSequence) maxSequence = seq;
          }
        });
      }

      const attorneys = jsonData.map((row, index) => {
        const lawFirmName = row["Referring Attorney Name"] || row["referring_attorney_name"] || "";
        const contactPerson = row["Contact Person"] || row["contact_person"] || "";
        const email = row["Email"] || row["email"] || "";
        const telephone = row["Telephone"] || row["telephone"] || row["phone"] || "";
        const province = row["Province"] || row["province"] || "";
        
        // Generate auto code with incrementing sequence
        const sequenceNumber = maxSequence + index + 1;
        const code = generateLawFirmCode(contactPerson, lawFirmName, sequenceNumber);

        return {
          name: lawFirmName,
          contact_person: contactPerson,
          email: email,
          phone: telephone,
          province: province,
          code: code,
          attorney_role: "Plaintiff", // Default value
          matter_type: "both" as const, // Default value
        };
      });

      const { error } = await supabase.from('referring_attorneys').insert(attorneys);

      if (error) throw error;

      toast({
        title: "Bulk upload successful",
        description: `${attorneys.length} attorneys have been added successfully.`,
      });

      setBulkFile(null);
    } catch (error: any) {
      toast({
        title: "Error uploading attorneys",
        description: error.message || "Failed to upload attorneys from Excel file.",
        variant: "destructive",
      });
    } finally {
      setIsBulkUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        "Referring Attorney Name": "Example Referring Attorney",
        "Contact Person": "John Doe",
        "Email": "john@example.com",
        "Telephone": "+27123456789",
        "Province": "Gauteng",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "attorney_bulk_upload_template.xlsx");
  };

  const canonicalUrl = typeof window !== "undefined" ? window.location.href : "https://example.com/referring-attorney";

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Referring Attorney Form | Medico-Legal</title>
        <meta
          name="description"
          content="Capture referring attorney details, attorney role (Plaintiff/Defendant), province, and matter type (MVA, Med Neg, Both)."
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
          <h1 className="text-2xl md:text-3xl font-bold">
            {isEditing ? 'Edit Referring Attorney' : 'Referring Attorney Form'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditing ? 'Update referring attorney details and matter types.' : 'Enter referring attorney details and the type of matters handled.'}
          </p>
        </header>

        {isLoadingData ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">Loading attorney data...</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="single" className="w-full">
            {!isEditing && (
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="single">Single Entry</TabsTrigger>
                <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
              </TabsList>
            )}

          <TabsContent value="single">
            <Card>
              <CardContent className="p-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="lawFirmName"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Referring Attorney Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Alpha Legal Partners" 
                          {...field}
                          className={nameWarning ? "border-destructive" : ""}
                        />
                      </FormControl>
                      {nameWarning && (
                        <p className="text-sm font-semibold text-destructive mt-2 flex items-start gap-1">
                          <span>🚩</span>
                          <span>{nameWarning}</span>
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Jane Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cellNumber"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Telephone / Cell Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., +1 (555) 123-4567" {...field} />
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
                        <Input type="email" placeholder="e.g., contact@alphalegal.com" {...field} />
                      </FormControl>
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
                        <Input placeholder="e.g., 123 Main Street, City, Postal Code" {...field} />
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
                      <FormLabel>Auto code</FormLabel>
                      <FormControl>
                        <Input readOnly value={field.value} placeholder="Auto-generated" />
                      </FormControl>
                      <FormDescription>Initials (contact + firm) + current year and month (YYYYMM).</FormDescription>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="attorneyRole"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Attorney role</FormLabel>
                      <FormControl>
                         <RadioGroup
                           value={field.value || ""}
                           onValueChange={field.onChange}
                          className="flex flex-wrap gap-6"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem id="plaintiff" value="Plaintiff" />
                            <label htmlFor="plaintiff" className="text-sm">Plaintiff</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem id="defendant" value="Defendant" />
                            <label htmlFor="defendant" className="text-sm">Defendant</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="matterType"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Type of matter handled</FormLabel>
                      <FormControl>
                         <RadioGroup
                           value={field.value || ""}
                           onValueChange={field.onChange}
                          className="flex flex-wrap gap-6"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem id="mva" value="MVA" />
                            <label htmlFor="mva" className="text-sm">MVA</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem id="medneg" value="Med Neg" />
                            <label htmlFor="medneg" className="text-sm">Med Neg</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem id="both" value="Both" />
                            <label htmlFor="both" className="text-sm">Both</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="md:col-span-2 flex gap-3 justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (isEditing ? "Updating..." : "Saving...") : (isEditing ? "Update Attorney" : "Save")}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => form.reset()}>
                    Reset
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
          </TabsContent>

          {!isEditing && (
            <TabsContent value="bulk">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Bulk Upload Instructions</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload an Excel file with the following columns: Referring Attorney Name, Contact Person, Email, Telephone, Province
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={downloadTemplate}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download Template
                    </Button>
                  </div>

                  <div className="border-2 border-dashed border-border rounded-lg p-8">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <Upload className="h-12 w-12 text-muted-foreground" />
                      <div className="text-center">
                        <p className="text-sm font-medium">
                          {bulkFile ? bulkFile.name : "Select Excel file"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          .xlsx or .xls files only
                        </p>
                      </div>
                      <Input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                        className="max-w-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setBulkFile(null)}
                      disabled={!bulkFile || isBulkUploading}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      onClick={handleBulkUpload}
                      disabled={!bulkFile || isBulkUploading}
                    >
                      {isBulkUploading ? "Uploading..." : "Upload Attorneys"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}
          </Tabs>
        )}
      </main>
      <CompanyFooter />
    </div>
  );
};

export default ReferringAttorneyForm;
