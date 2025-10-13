import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, Download } from "lucide-react";
import * as XLSX from "xlsx";

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
  lawFirmName: z.string().min(2, "Law firm name is required"),
  contactPerson: z.string().min(2, "Contact person is required"),
  cellNumber: z
    .string()
    .min(7, "Enter a valid phone")
    .regex(/^[0-9+\-\s()]+$/, "Invalid phone number"),
  email: z.string().email("Invalid email address"),
  address: z.string().min(5, "Address is required"),
  attorneyRole: z.enum(["Plaintiff", "Defendant"], {
    required_error: "Please select the attorney role",
  }),
  province: z.enum(
    [
      "Eastern Cape",
      "Free State",
      "Gauteng",
      "KwaZulu-Natal",
      "Limpopo",
      "Mpumalanga",
      "Northern Cape",
      "North West",
      "Western Cape",
    ],
    { required_error: "Please select a province" }
  ),
  matterType: z.enum(["MVA", "Med Neg", "Both"], {
    required_error: "Please select a matter type",
  }),
  autoCode: z.string().min(2),
});

const ReferringAttorneyForm = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      lawFirmName: "",
      contactPerson: "",
      cellNumber: "",
      email: "",
      address: "",
      attorneyRole: "" as any,
      province: "" as any,
      matterType: "" as any,
      autoCode: "",
    },
    mode: "onTouched",
  });

  const lawFirmName = form.watch("lawFirmName");
  const contactPerson = form.watch("contactPerson");

  useEffect(() => {
    const generateCode = async () => {
      if (!contactPerson || !lawFirmName) {
        form.setValue("autoCode", "");
        return;
      }

      try {
        // Get the highest existing sequence number from codes matching the pattern
        const { data, error } = await supabase
          .from('law_firms')
          .select('code')
          .order('code', { ascending: false })
          .limit(100);

        if (error) throw error;

        // Extract sequence numbers and find the max
        let maxSequence = 0;
        if (data && data.length > 0) {
          data.forEach(item => {
            // Extract last 4 digits if code follows pattern
            const match = item.code?.match(/(\d{4})$/);
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
      // Convert matter type to database format
      const matterTypeMap: Record<string, "mva" | "med_neg" | "both"> = {
        "MVA": "mva",
        "Med Neg": "med_neg",
        "Both": "both"
      };

      const { error } = await supabase.from('law_firms').insert({
        name: values.lawFirmName,
        contact_person: values.contactPerson,
        phone: values.cellNumber,
        email: values.email,
        address: values.address,
        attorney_role: values.attorneyRole,
        province: values.province,
        matter_type: matterTypeMap[values.matterType],
        code: values.autoCode,
      });

      if (error) throw error;

      toast({
        title: "Referring attorney saved",
        description: `${values.lawFirmName} (${values.autoCode}) has been added to the attorney list.`,
      });
      
      form.reset();
    } catch (error: any) {
      toast({
        title: "Error saving attorney",
        description: error.message || "Failed to save referring attorney.",
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
        .from('law_firms')
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
        const lawFirmName = row["Law Firm Name"] || row["law_firm_name"] || "";
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

      const { error } = await supabase.from('law_firms').insert(attorneys);

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
        "Law Firm Name": "Example Law Firm",
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
          content="Capture referring law firm details, attorney role (Plaintiff/Defendant), province, and matter type (MVA, Med Neg, Both)."
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
          <h1 className="text-2xl md:text-3xl font-bold">Referring Attorney Form</h1>
          <p className="text-muted-foreground mt-1">Enter law firm details and the type of matters handled.</p>
        </header>

        <Tabs defaultValue="single" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="single">Single Entry</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
          </TabsList>

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
                      <FormLabel>Referring Law Firm Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Alpha Legal Partners" {...field} />
                      </FormControl>
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
                    {isSubmitting ? "Saving..." : "Save"}
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

          <TabsContent value="bulk">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Bulk Upload Instructions</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload an Excel file with the following columns: Law Firm Name, Contact Person, Email, Telephone, Province
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
        </Tabs>
      </main>
      <CompanyFooter />
    </div>
  );
};

export default ReferringAttorneyForm;
