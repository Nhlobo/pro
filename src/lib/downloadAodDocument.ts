import { supabase } from "@/integrations/supabase/client";

// Most aod_documents rows have never had a real file uploaded to
// Storage — document_url is '', the literal string 'pending', or (for
// a handful of older rows) a full URL pointing at a different bucket.
// Root cause: the flows that create these rows (ShortTermAgreementDialog
// -> generate-short-term-agreement-pdf) only ever returned PDF *content*
// to the caller and never uploaded anything to Storage, so document_url
// was never backfilled with a real path. See conversation notes dated
// 2026-09-05 for the full investigation.
//
// generate-aod-pdf already renders a correct, complete PDF for any
// aod_documents row on demand (it's what the admin "Generate PDF"
// button uses), and it already enforces the same tenant check we'd
// want here — server-side, via is_admin_or_employee() OR the caller's
// own profiles.referring_attorney_id matching the document's — so
// falling back to it here doesn't add any new exposure: an attorney
// can only ever regenerate their own firm's document, exactly as they
// could only ever download their own firm's stored file.
//
// This is a fallback, not a replacement: if a real stored file exists
// and downloads fine, that's still the fast path. Regeneration only
// kicks in when there's nothing usable to download.
export async function downloadAodDocument(
  aodDocumentId: string,
  documentUrl: string | null | undefined,
  fileName: string | null | undefined,
): Promise<void> {
  const hasPlausibleStoredFile =
    !!documentUrl && documentUrl !== "pending" && !documentUrl.startsWith("http");

  if (hasPlausibleStoredFile) {
    const { data, error } = await supabase.storage.from("aod-documents").download(documentUrl!);
    if (!error && data) {
      triggerBlobDownload(data, fileName || "agreement.pdf");
      return;
    }
    // Fall through to regeneration below rather than surfacing this
    // error directly — a missing/renamed storage object shouldn't be a
    // dead end when the document can be rebuilt from the database.
    console.warn("Stored AOD file unavailable, regenerating instead:", error);
  }

  const { data, error } = await supabase.functions.invoke("generate-aod-pdf", {
    body: { aodDocumentId, previewMode: false },
  });
  if (error) throw error;
  if (!data?.pdf) throw new Error(data?.error || "This document could not be generated.");

  const binaryString = atob(data.pdf);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  triggerBlobDownload(new Blob([bytes], { type: "application/pdf" }), data.fileName || fileName || "agreement.pdf");
}

function triggerBlobDownload(data: Blob, fileName: string) {
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
