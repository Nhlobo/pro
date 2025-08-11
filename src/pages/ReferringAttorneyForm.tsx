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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  lawFirmName: z.string().min(2, "Law firm name is required"),
  codeLength: z.enum(["2", "3"]).default("3"),
  autoCode: z.string().min(2),
  contactPerson: z.string().min(2, "Contact person is required"),
  cellNumber: z
    .string()
    .min(7, "Enter a valid phone")
    .regex(/^[0-9+\-\s()]+$/, "Invalid phone number"),
  email: z.string().email("Invalid email address"),
  matterType: z.enum(["MVA", "Med Neg", "Both"], {
    required_error: "Please select a matter type",
  }),
});

function makeCode(name: string, length: number) {
  const letters = name.replace(/[^A-Za-z]/g, "").toUpperCase();
  return letters.slice(0, length);
}

const ReferringAttorneyForm = () => {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      lawFirmName: "",
      codeLength: "3",
      autoCode: "",
      contactPerson: "",
      cellNumber: "",
      email: "",
      matterType: undefined,
    },
    mode: "onTouched",
  });

  const lawFirmName = form.watch("lawFirmName");
  const codeLength = form.watch("codeLength");

  useEffect(() => {
    const code = makeCode(lawFirmName ?? "", Number(codeLength ?? 3));
    form.setValue("autoCode", code);
  }, [lawFirmName, codeLength, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    toast({
      title: "Referring attorney captured",
      description: `${values.lawFirmName} (${values.autoCode}) — ${values.matterType}`,
    });
    // Persist to Supabase later upon request
    console.log("Referring Attorney Form submit:", values);
  };

  const canonicalUrl = typeof window !== "undefined" ? window.location.href : "https://example.com/referring-attorney";

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Referring Attorney Form | Medico-Legal</title>
        <meta
          name="description"
          content="Capture referring law firm details, contact, and matter type (MVA, Med Neg, Both)."
        />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <main className="container mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Referring Attorney Form</h1>
          <p className="text-muted-foreground mt-1">Enter law firm details and the type of matters handled.</p>
        </header>

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
                  name="codeLength"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Auto code length</FormLabel>
                      <FormDescription>Automatic code uses the first 2 or 3 letters of the firm name.</FormDescription>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="flex items-center gap-6"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem id="len2" value="2" />
                            <label htmlFor="len2" className="text-sm">2 letters</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem id="len3" value="3" />
                            <label htmlFor="len3" className="text-sm">3 letters</label>
                          </div>
                        </RadioGroup>
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
                      <FormDescription>Derived from the law firm name automatically.</FormDescription>
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
                          value={field.value}
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

export default ReferringAttorneyForm;
