
import React, { useEffect } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

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
  autoCode: z.string().min(2),
});

function makeExpertCode(name: string, surname: string) {
  const n = (name?.trim()?.charAt(0) || "X").toUpperCase().replace(/[^A-Z]/g, "X");
  const s = (surname?.trim()?.charAt(0) || "X").toUpperCase().replace(/[^A-Z]/g, "X");
  const randomNumbers = Math.floor(10000 + Math.random() * 90000).toString();
  return `${n}${s}${randomNumbers}`;
}

const MedicalExpertForm = () => {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      surname: "",
      expertType: undefined,
      specialization: undefined,
      qualifications: "",
      experience: "",
      contactNumber: "",
      email: "",
      address: "",
      province: undefined,
      fees: "",
      courtFee: "",
      courtAvailability: undefined,
      notes: "",
      autoCode: "",
    },
    mode: "onTouched",
  });

  const name = form.watch("name");
  const surname = form.watch("surname");

  useEffect(() => {
    const code = makeExpertCode(name ?? "", surname ?? "");
    form.setValue("autoCode", code);
  }, [name, surname, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    toast({
      title: "Medical expert captured",
      description: `${values.name} ${values.surname} (${values.autoCode}) — ${values.specialization}`,
    });
    // Persist to Supabase later upon request
    console.log("Medical Expert Form submit:", values);
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
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Medical Expert Form</h1>
          <p className="text-muted-foreground mt-1">Register medical experts with their specializations and details.</p>
        </header>

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

                <div className="md:col-span-2 flex gap-3 justify-end">
                  <Button type="submit">Save</Button>
                  <Button type="button" variant="secondary" onClick={() => form.reset()}>
                    Reset
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MedicalExpertForm;
