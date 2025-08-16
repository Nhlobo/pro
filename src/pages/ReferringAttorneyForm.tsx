import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AttorneyBulkUpload from "@/components/AttorneyBulkUpload";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CompanyFooter from "@/components/CompanyFooter";

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

function makeCode(contactName: string, firmName: string) {
  const n = (contactName?.trim()?.charAt(0) || "X").toUpperCase().replace(/[^A-Z]/g, "X");
  const f = (firmName?.trim()?.charAt(0) || "X").toUpperCase().replace(/[^A-Z]/g, "X");
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${n}${f}${yyyy}${mm}`;
}

const ReferringAttorneyForm = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
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
    const code = makeCode(contactPerson ?? "", lawFirmName ?? "");
    form.setValue("autoCode", code);
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

        <div className="space-y-6">
          <AttorneyBulkUpload onUploadSuccess={() => {
            toast({
              title: "Upload successful",
              description: "Attorneys have been added to the list.",
            });
          }} />
          
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
        </div>
      </main>
      <CompanyFooter />
    </div>
  );
};

export default ReferringAttorneyForm;
