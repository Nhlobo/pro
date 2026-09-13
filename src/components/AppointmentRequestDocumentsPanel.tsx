import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Eye, Download, Loader2, FileText } from "lucide-react";

interface AppointmentRequestDocument {
  id: string;
  document_type: string;
  file_path: string;
  file_name: string;
  uploaded_at: string;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  medical_record: "Medical record",
  instruction_letter: "Instruction letter",
  summons: "Summons",
  other: "Other",
};

const BUCKET = "appointment-request-documents";

interface AppointmentRequestDocumentsPanelProps {
  appointmentRequestId: string;
}

/**
 * Read-only list of supporting documents (medical records, instruction
 * letters, summonses, etc.) an attorney attached when submitting an
 * appointment request. See appointment_request_documents (12 Sep 2026
 * migration) - these exist independently of the confirmed-case `documents`
 * table since no claimant/appointment record exists yet at request stage.
 * Pairs with PaymentPopUploader (canUpload=false) for the proof-of-payment
 * side of the same client request.
 */
export function AppointmentRequestDocumentsPanel({ appointmentRequestId }: AppointmentRequestDocumentsPanelProps) {
  const [documents, setDocuments] = useState<AppointmentRequestDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchDocuments = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("appointment_request_documents")
          .select("id, document_type, file_path, file_name, uploaded_at")
          .eq("appointment_request_id", appointmentRequestId)
          .order("uploaded_at", { ascending: false });

        if (error) throw error;
        if (!cancelled) setDocuments((data || []) as AppointmentRequestDocument[]);
      } catch (error) {
        console.error("Error fetching appointment request documents:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (appointmentRequestId) fetchDocuments();
    return () => {
      cancelled = true;
    };
  }, [appointmentRequestId]);

  const handleView = async (doc: AppointmentRequestDocument) => {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 60 * 5);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error opening document:", error);
    }
  };

  const handleDownload = async (doc: AppointmentRequestDocument) => {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(doc.file_path);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name || "document";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading document:", error);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Supporting Documents</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      {documents.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground">No supporting documents attached.</p>
      )}

      {documents.map((doc) => (
        <div key={doc.id} className="rounded border px-2 py-1 text-xs space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate pr-2">
              <span className="font-medium">{DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}:</span>{" "}
              {doc.file_name}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2" onClick={() => handleView(doc)}>
                <Eye className="h-3 w-3" />
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2" onClick={() => handleDownload(doc)}>
                <Download className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
