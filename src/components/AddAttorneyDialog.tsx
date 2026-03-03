import React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateLawFirmCode } from "@/utils/idGenerators";

const formSchema = z.object({
  contactPerson: z.string().min(2, "Contact person name is required"),
  lawFirmName: z.string().min(2, "Referring attorney name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  province: z.string().optional(),
});

interface AddAttorneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAttorneyAdded: (attorney: { id: string; name: string; email: string; code: string }) => void;
}

export const AddAttorneyDialog = ({ open, onOpenChange, onAttorneyAdded }: AddAttorneyDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [pitchlogSuggestions, setPitchlogSuggestions] = React.useState<any[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      contactPerson: "",
      lawFirmName: "",
      email: "",
      phone: "",
      province: "",
    },
  });

  // Fetch pitchlog entries to suggest data when law firm name matches
  const fetchPitchlogMatches = React.useCallback(async (firmName: string) => {
    if (firmName.length < 2) {
      setPitchlogSuggestions([]);
      return;
    }
    const { data } = await supabase
      .from('attorney_pitchlog')
      .select('law_firm_name, contact_person, email, telephone, province')
      .ilike('law_firm_name', `%${firmName}%`)
      .limit(5);
    setPitchlogSuggestions(data || []);
  }, []);

  const applyPitchlogData = (suggestion: any) => {
    form.setValue('lawFirmName', suggestion.law_firm_name);
    form.setValue('contactPerson', suggestion.contact_person || '');
    if (suggestion.email) form.setValue('email', suggestion.email);
    if (suggestion.telephone) form.setValue('phone', suggestion.telephone);
    if (suggestion.province) form.setValue('province', suggestion.province);
    setPitchlogSuggestions([]);
    toast({ title: 'Data imported from Pitchlog', description: `Pre-filled from ${suggestion.law_firm_name}` });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in.",
          variant: "destructive",
        });
        return;
      }

      // Check for duplicate NAME first
      const { data: nameCheck, error: nameCheckError } = await supabase
        .from('referring_attorneys')
        .select('id, name')
        .ilike('name', values.lawFirmName.trim());

      if (nameCheckError) throw nameCheckError;

      if (nameCheck && nameCheck.length > 0) {
        toast({
          title: "🚩 DUPLICATE DETECTED",
          description: `A referring attorney named "${values.lawFirmName}" already exists. Please use a different name or find the existing entry.`,
          variant: "destructive",
          duration: 8000,
        });
        setIsSubmitting(false);
        return;
      }

      // Check for duplicate email
      const { data: emailCheck, error: emailCheckError } = await supabase
        .from('referring_attorneys')
        .select('id, email')
        .ilike('email', values.email.trim());

      if (emailCheckError) throw emailCheckError;

      if (emailCheck && emailCheck.length > 0) {
        toast({
          title: "🚩 DUPLICATE EMAIL",
          description: `This email address is already registered to another attorney.`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Get the next sequence number
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

      const sequenceNumber = maxSequence + 1;
      const code = generateLawFirmCode(values.contactPerson, values.lawFirmName, sequenceNumber);

      // Insert the new attorney
      const { data, error } = await supabase
        .from('referring_attorneys')
        .insert({
          name: values.lawFirmName,
          contact_person: values.contactPerson,
          email: values.email,
          phone: values.phone || null,
          province: values.province || null,
          code: code,
          attorney_role: 'Referring Attorney',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "New attorney has been added successfully.",
      });

      // Send system-wide notification to all admin/employee users
      try {
        const { data: adminUsers } = await supabase
          .from('profiles')
          .select('id')
          .in('user_type', ['admin', 'employee']);

        if (adminUsers && adminUsers.length > 0) {
          const notifications = adminUsers.map((adminUser) => ({
            user_id: adminUser.id,
            title: '🆕 New Referring Attorney Added',
            message: `${values.lawFirmName} (${code}) has been added to the system by ${values.contactPerson}.`,
            type: 'info' as const,
            category: 'attorney_update',
            related_record_id: data.id,
            related_table: 'referring_attorneys',
            is_read: false,
            email_sent: false,
          }));

          await supabase.from('notifications').insert(notifications);
        }
      } catch (notifErr) {
        console.error('Failed to send new attorney notifications:', notifErr);
      }

      onAttorneyAdded({
        id: data.id,
        name: values.lawFirmName,
        email: values.email,
        code: code,
      });

      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add attorney.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Referring Attorney</DialogTitle>
          <DialogDescription>
            Add a new referring attorney that is not yet in the system.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="lawFirmName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Referring Attorney Name *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter referring attorney name" 
                      {...field} 
                      onChange={(e) => {
                        field.onChange(e);
                        fetchPitchlogMatches(e.target.value);
                      }}
                    />
                  </FormControl>
                  {pitchlogSuggestions.length > 0 && (
                    <div className="border rounded-md bg-popover p-1 space-y-1 max-h-32 overflow-y-auto">
                      <p className="text-xs text-muted-foreground px-2 pt-1">Found in Pitchlog:</p>
                      {pitchlogSuggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          className="w-full text-left px-2 py-1 text-sm rounded hover:bg-accent transition-colors"
                          onClick={() => applyPitchlogData(s)}
                        >
                          <span className="font-medium">{s.law_firm_name}</span>
                          <span className="text-muted-foreground ml-2 text-xs">{s.contact_person} {s.province ? `• ${s.province}` : ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Person *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter contact person name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Enter email address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter phone number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="province"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Province</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter province" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Attorney"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
