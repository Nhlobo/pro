import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Paperclip, Eye, Download, Loader2, Upload } from "lucide-react";

export type PopRecordType = "aod_payment" | "short_term_payment";

export interface PaymentPopAttachment {
  id: string;
  record_type: string;
  record_id: string;
  payment_reference: string;
  file_path: string;
  file_name: string | null;
  uploaded_at: string;
}

interface PaymentPopUploaderProps {
  recordType: PopRecordType;
  recordId: string;
  paymentReference: string;
  /** Set to false for read-only contexts (e.g. attorney portal) */
  canUpload?: boolean;
}

const BUCKET = "payment-pop-documents";

/**
 * Upload / view Proof of Payment attachments for an AOD or Short-Term
 * Agreement payment. Used by Finance (upload) and the attorney portal
 * (view-only) - both parties benefit from having POPs on record.
 */
export function PaymentPopUploader({
  recordType,
  recordId,
  paymentReference,
  canUpload = true,
}: PaymentPopUploaderProps) {
  const [attachments, setAttachments] = useState<PaymentPopAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchAttachments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("payment_pop_attachments")
        .select("*")
        .eq("record_type", recordType)
        .eq("record_id", recordId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setAttachments((data || []) as PaymentPopAttachment[]);
    } catch (error) {
      console.error("Error fetching POP attachments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (recordId) fetchAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordType, recordId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    try {
      setUploading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const filePath = `${recordType}/${recordId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("payment_pop_attachments")
        .insert({
          record_type: recordType,
          record_id: recordId,
          payment_reference: paymentReference,
          file_path: filePath,
          file_name: file.name,
          file_size_bytes: file.size,
          mime_type: file.type || null,
          uploaded_by: userData.user.id,
        });

      if (insertError) throw insertError;

      toast.success("Proof of payment uploaded");
      await fetchAttachments();
    } catch (error: any) {
      console.error("Error uploading POP:", error);
      toast.error(error.message || "Failed to upload proof of payment");
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (attachment: PaymentPopAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(attachment.file_path, 60 * 5); // 5 minutes

      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      console.error("Error opening POP:", error);
      toast.error("Failed to open proof of payment");
    }
  };

  const handleDownload = async (attachment: PaymentPopAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name || "proof-of-payment";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading POP:", error);
      toast.error("Failed to download proof of payment");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Proof of Payment</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      {attachments.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground">No proof of payment uploaded yet.</p>
      )}

      {attachments.map((att) => (
        <div key={att.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs">
          <span className="truncate">{att.file_name || "Proof of payment"}</span>
          <div className="flex items-center gap-1 shrink-0">
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2" onClick={() => handleView(att)}>
              <Eye className="h-3 w-3" />
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2" onClick={() => handleDownload(att)}>
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}

      {canUpload && (
        <label className="flex items-center gap-2 text-xs cursor-pointer text-primary hover:underline w-fit">
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {uploading ? "Uploading..." : "Upload proof of payment"}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} accept="image/*,.pdf" />
        </label>
      )}
    </div>
  );
}
