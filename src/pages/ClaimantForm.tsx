import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Surname is required"),
  contact_number: z.string().optional(),
  law_firm_id: z.string().min(1, "Referring attorney is required"),
  auto_id: z.string().min(1, "Auto ID is required"),
});

type FormValues = z.infer<typeof schema>;

type LawFirm = { id: string; name: string };

function generateAutoId(firstName: string, lastName: string) {
  const f = (firstName?.trim()?.charAt(0) || "X").toUpperCase();
  const l = (lastName?.trim()?.charAt(0) || "X").toUpperCase();
  const num = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${f}${l}${num}`;
}

const ClaimantForm: React.FC = () => {
  const { toast } = useToast();
  const [lawFirms, setLawFirms] = useState<LawFirm[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { first_name: "", last_name: "", contact_number: "", law_firm_id: "", auto_id: "" },
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const { data, error } = await (supabase as any).from("law_firms").select("id,name").order("name");
      if (!isMounted) return;
      if (error) {
        toast({ title: "Failed to load law firms", description: error.message, variant: "destructive" });
      } else {
        setLawFirms((data || []) as LawFirm[]);
      }
    })();
    return () => { isMounted = false };
  }, [toast]);

  const onGenerateId = () => {
    const vals = form.getValues();
    const id = generateAutoId(vals.first_name, vals.last_name);
    form.setValue("auto_id", id, { shouldValidate: true });
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setLoading(true);
      const payload = { ...values };
      if (!payload.auto_id) {
        payload.auto_id = generateAutoId(payload.first_name, payload.last_name);
      }

      const { error } = await (supabase as any).from("claimants").insert({
        first_name: payload.first_name,
        last_name: payload.last_name,
        contact_number: payload.contact_number || null,
        law_firm_id: payload.law_firm_id,
        auto_id: payload.auto_id,
      });

      if (error) throw error;

      toast({ title: "Claimant created", description: `Auto ID: ${payload.auto_id}` });
      form.reset({ first_name: "", last_name: "", contact_number: "", law_firm_id: "", auto_id: "" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message ?? "Failed to create claimant", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/claimant';

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Create Claimant | Medico-Legal</title>
        <meta name="description" content="Create a new claimant and link to a referring attorney. Auto ID is generated from name and 4 digits." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="border-b">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl md:text-3xl font-bold">Create Claimant</h1>
          <p className="text-muted-foreground mt-2">Capture claimant details and link to the referring attorney.</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. John" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Surname</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="contact_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact number (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 012 345 6789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="law_firm_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referring Attorney</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a law firm" />
                          </SelectTrigger>
                          <SelectContent>
                            {lawFirms.map((lf) => (
                              <SelectItem key={lf.id} value={lf.id}>{lf.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-3 items-end">
                  <FormField
                    control={form.control}
                    name="auto_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Auto ID</FormLabel>
                        <FormControl>
                          <Input readOnly placeholder="Generate from name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="button" variant="secondary" onClick={onGenerateId}>
                    Generate ID
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Claimant"}</Button>
                  <Button asChild variant="outline">
                    <Link to="/">Back to Dashboard</Link>
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

export default ClaimantForm;
