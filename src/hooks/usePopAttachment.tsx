import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PopAttachment {
  id: string;
  record_type: string;
  record_id: string;
  payment_reference: string;
  sageone_transaction_id: string | null;
  file_path: string;
  file_name: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  notes: string | null;
}

export type PopRecordType = "appointment_request" | "aod_payment" | "expert_payment";

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const MAX_BYTES = 10 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function usePopAttachment() {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const uploadPop = useCallback(
    async (params: {
      record_type: PopRecordType;
      record_id: string;
      file: File;
      payment_reference?: string;
      notes?: string;
    }): Promise<PopAttachment | null> => {
      if (!ALLOWED_MIME.includes(params.file.type.toLowerCase())) {
        toast({ title: "Invalid file", description: "Only PDF, JPG and PNG are accepted.", variant: "destructive" });
        return null;
      }
      if (params.file.size > MAX_BYTES) {
        toast({ title: "File too large", description: "Maximum size is 10MB.", variant: "destructive" });
        return null;
      }
      setUploading(true);
      try {
        const file_base64 = await fileToBase64(params.file);
        const { data, error } = await supabase.functions.invoke("upload-pop-attachment", {
          body: {
            record_type: params.record_type,
            record_id: params.record_id,
            file_base64,
            file_name: params.file.name,
            mime_type: params.file.type,
            payment_reference: params.payment_reference,
            notes: params.notes,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast({ title: "POP uploaded", description: `Reference: ${data.attachment.payment_reference}` });
        return data.attachment as PopAttachment;
      } catch (err: any) {
        toast({ title: "Upload failed", description: err.message ?? "Could not upload POP.", variant: "destructive" });
        return null;
      } finally {
        setUploading(false);
      }
    },
    [toast]
  );

  const getSignedUrl = useCallback(async (attachment_id: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("get-pop-signed-url", { body: { attachment_id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.url as string;
    } catch (err: any) {
      toast({ title: "Could not open POP", description: err.message, variant: "destructive" });
      return null;
    }
  }, [toast]);

  const fetchByRecord = useCallback(
    async (record_type: PopRecordType, record_id: string): Promise<PopAttachment | null> => {
      const { data } = await (supabase as any)
        .from("payment_pop_attachments")
        .select("*")
        .eq("record_type", record_type)
        .eq("record_id", record_id)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as PopAttachment) ?? null;
    },
    []
  );

  return { uploading, uploadPop, getSignedUrl, fetchByRecord };
}
