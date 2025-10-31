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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CompanyFooter from "@/components/CompanyFooter";
import { generateClaimantId } from "@/utils/idGenerators";

const schema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Surname is required"),
  contact_number: z.string().optional(),
  referring_attorney_id: z.string().min(1, "Referring attorney is required"),
  auto_id: z.string().min(1, "Auto ID is required"),
});

type FormValues = z.infer<typeof schema>;

type LawFirm = { id: string; name: string; contact_person?: string };

const ClaimantForm: React.FC = () => {
  const { toast } = useToast();
  const [lawFirms, setLawFirms] = useState<LawFirm[]>([]);
  const [currentLawFirm, setCurrentLawFirm] = useState<LawFirm | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { first_name: "", last_name: "", contact_number: "", referring_attorney_id: "", auto_id: "" },
  });

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      try {
        // Load all referring attorneys for selection
        const { data: firms, error: firmsError } = await supabase
          .from('referring_attorneys')
          .select('id, name, contact_person')
          .order('name');

        if (firmsError) {
          console.error('Error fetching law firms:', firmsError);
          toast({
            title: 'Failed to load attorneys',
            description: 'Could not load referring attorneys list.',
            variant: 'destructive',
          });
        } else {
          setLawFirms(firms || []);
          console.log('Successfully loaded law firms:', firms);
        }

        // Load user's profile to get their referring attorney context
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('referring_attorney_id')
          .maybeSingle();

        if (!isMounted) return;

        if (profileError) {
          console.error('Error fetching profile:', profileError);
        } else if (profile?.referring_attorney_id) {
          // Find the user's referring attorney in the list
          const userFirm = firms?.find(f => f.id === profile.referring_attorney_id);
          if (userFirm) {
            setCurrentLawFirm(userFirm);
          }
        }

      } catch (err) {
        console.error('Unexpected error:', err);
        toast({
          title: 'Error loading data',
          description: 'An unexpected error occurred.',
          variant: 'destructive',
        });
      }
    };

    loadData();
    return () => { isMounted = false };
  }, [toast]);

  const onGenerateId = () => {
    const vals = form.getValues();
    const id = generateClaimantId(vals.first_name, vals.last_name);
    form.setValue("auto_id", id, { shouldValidate: true });
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setLoading(true);

      if (!values.referring_attorney_id) {
        toast({
          title: "Referring attorney required",
          description: "Please select a referring attorney.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Check for duplicate claimant using secure function
      const { data: existingClaimants, error: checkError } = await supabase
        .rpc('get_claimants_secure');

      if (checkError) {
        console.error('Error checking for duplicates:', checkError);
        toast({
          title: "Error",
          description: "Failed to validate claimant information.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Note: For non-admin users, we get masked data which limits duplicate detection
      // This is a security vs functionality trade-off - admins get full duplicate checking
      const nameMatch = existingClaimants?.some(claimant => 
        claimant.first_name_masked.toLowerCase().includes(values.first_name.trim().toLowerCase().substring(0, 2)) &&
        claimant.last_name_masked.toLowerCase().includes(values.last_name.trim().toLowerCase().substring(0, 2))
      );

      if (nameMatch) {
        toast({
          title: "Potential duplicate detected",
          description: "A similar claimant may already exist. Please verify before continuing.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const payload = { ...values };
      if (!payload.auto_id) {
        payload.auto_id = generateClaimantId(payload.first_name, payload.last_name);
      }

      const { error } = await supabase.from("claimants").insert({
        first_name: payload.first_name,
        last_name: payload.last_name,
        contact_number: payload.contact_number || null,
        referring_attorney_id: payload.referring_attorney_id,
        auto_id: payload.auto_id,
      });

      if (error) throw error;

      toast({ 
        title: "Claimant saved successfully!", 
        description: `Auto ID: ${payload.auto_id}. Navigate to claimant list to view all claimants.` 
      });
      
      form.reset({ first_name: "", last_name: "", contact_number: "", referring_attorney_id: "", auto_id: "" });
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
                  name="referring_attorney_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referring Attorney</FormLabel>
                       <FormControl>
                         <Select onValueChange={field.onChange} value={field.value}>
                           <SelectTrigger className="z-50">
                             <SelectValue placeholder="Select a referring attorney" />
                           </SelectTrigger>
                           <SelectContent className="z-[60] bg-background border shadow-lg">
                             {lawFirms.length === 0 ? (
                               <div className="px-2 py-1 text-sm text-muted-foreground">
                                 No attorneys available. Please add attorneys first.
                               </div>
                             ) : (
                               lawFirms.map((firm) => (
                                 <SelectItem key={firm.id} value={firm.id}>
                                   <div className="flex flex-col">
                                     <span className="font-medium">{firm.name}</span>
                                     {firm.contact_person && (
                                       <span className="text-xs text-muted-foreground">
                                         Contact: {firm.contact_person}
                                       </span>
                                     )}
                                   </div>
                                 </SelectItem>
                               ))
                             )}
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
                     <Link to="/claimant-list">View Claimant List</Link>
                   </Button>
                   <Button asChild variant="outline">
                     <Link to="/">Back to Dashboard</Link>
                   </Button>
                 </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
      <CompanyFooter />
    </div>
  );
};

export default ClaimantForm;
