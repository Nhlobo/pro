import { useEffect, useRef, useState } from "react";
import { Paperclip, FileCheck2, Download, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePopAttachment, type PopAttachment, type PopRecordType } from "@/hooks/usePopAttachment";
import { supabase } from "@/integrations/supabase/client";

interface PopAttachmentFieldProps {
  recordType: PopRecordType;
  recordId?: string; // when undefined, upload is deferred (the parent must save first)
  initialAttachmentId?: string | null;
  paymentReference?: string;
  onPaymentReferenceChange?: (value: string) => void;
  onUploaded?: (attachment: PopAttachment) => void;
  onStagedFileChange?: (file: File | null) => void; // used when recordId not yet known
  showReferenceInput?: boolean;
  required?: boolean; // if true, shows red "Missing POP"
  className?: string;
}

export function PopAttachmentField({
  recordType,
  recordId,
  initialAttachmentId,
  paymentReference,
  onPaymentReferenceChange,
  onUploaded,
  onStagedFileChange,
  showReferenceInput = true,
  required = false,
  className,
}: PopAttachmentFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploading, uploadPop, getSignedUrl, fetchByRecord } = usePopAttachment();
  const [attachment, setAttachment] = useState<PopAttachment | null>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);

  // Load existing attachment by id or by record
  useEffect(() => {
    let active = true;
    (async () => {
      if (initialAttachmentId) {
        const { data } = await (supabase as any)
          .from("payment_pop_attachments")
          .select("*")
          .eq("id", initialAttachmentId)
          .maybeSingle();
        if (active && data) setAttachment(data as PopAttachment);
      } else if (recordId) {
        const found = await fetchByRecord(recordType, recordId);
        if (active) setAttachment(found);
      }
    })();
    return () => { active = false; };
  }, [initialAttachmentId, recordId, recordType, fetchByRecord]);

  const handlePick = () => fileInputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!recordId) {
      // Stage the file; parent will upload after creating the record
      setStagedFile(file);
      onStagedFileChange?.(file);
      return;
    }
    const uploaded = await uploadPop({
      record_type: recordType,
      record_id: recordId,
      file,
      payment_reference: paymentReference,
    });
    if (uploaded) {
      setAttachment(uploaded);
      if (uploaded.payment_reference && onPaymentReferenceChange) {
        onPaymentReferenceChange(uploaded.payment_reference);
      }
      onUploaded?.(uploaded);
    }
  };

  const handleDownload = async () => {
    if (!attachment) return;
    const url = await getSignedUrl(attachment.id);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const hasFile = !!attachment || !!stagedFile;
  const status = hasFile
    ? { label: stagedFile && !attachment ? "POP Ready (will upload on submit)" : "POP Uploaded", variant: "default" as const, icon: <FileCheck2 className="h-3 w-3" /> }
    : required
    ? { label: "Missing POP", variant: "destructive" as const, icon: <AlertCircle className="h-3 w-3" /> }
    : { label: "POP Optional", variant: "secondary" as const, icon: <Paperclip className="h-3 w-3" /> };

  const displayedName = attachment?.file_name ?? stagedFile?.name;

  return (
    <div className={className}>
      <div className="space-y-3 rounded-md border p-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium">Proof of Payment</Label>
          <Badge variant={status.variant} className="gap-1">
            {status.icon}
            {status.label}
          </Badge>
        </div>

        {showReferenceInput && (
          <div className="space-y-1">
            <Label htmlFor="payment-ref" className="text-xs text-muted-foreground">
              Payment Reference (auto-generated if blank)
            </Label>
            <Input
              id="payment-ref"
              placeholder="e.g. your bank reference"
              value={paymentReference ?? ""}
              onChange={(e) => onPaymentReferenceChange?.(e.target.value)}
            />
          </div>
        )}

        {displayedName && (
          <div className="flex items-center justify-between rounded bg-muted/40 px-2 py-1 text-sm">
            <div className="truncate">
              <span className="font-medium">{displayedName}</span>
              {attachment && (
                <span className="ml-2 text-xs text-muted-foreground">Ref: {attachment.payment_reference}</span>
              )}
            </div>
            {attachment && (
              <Button type="button" size="sm" variant="ghost" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handlePick} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            {hasFile ? "Replace POP" : "Attach POP"}
          </Button>
          <span className="text-xs text-muted-foreground">PDF, JPG, PNG · max 10MB</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}
