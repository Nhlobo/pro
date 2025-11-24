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
                    <Input placeholder="Enter referring attorney name" {...field} />
                  </FormControl>
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
