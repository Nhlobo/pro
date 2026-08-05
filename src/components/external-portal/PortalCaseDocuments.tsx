import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Loader2 } from 'lucide-react';
import { usePortalDocuments, usePortalDocumentDownload } from '@/hooks/externalPortal/useExternalPortalEngagement';
import { formatDateTimeShort } from '@/utils/dateTime';

function formatSize(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Phase 5 — case documents. Read-only view of documents already stored
 * in the main system; visibility is enforced server-side by the
 * existing is_visible_to_attorney / is_visible_to_expert flags.
 */
const PortalCaseDocuments: React.FC<{ appointmentId?: string }> = ({ appointmentId }) => {
  const { data, isLoading, isError, error } = usePortalDocuments(appointmentId);
  const download = usePortalDocumentDownload();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const documents = data?.documents ?? [];

  const handleOpen = async (id: string) => {
    setBusyId(id);
    await download(id);
    setBusyId(null);
  };

  return (
    <Card className="rounded-none border-black/10 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-[#00BAAD]" /> Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && (
          <p className="flex items-center gap-2 py-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading documents…
          </p>
        )}

        {isError && (
          <p className="text-sm text-destructive">{(error as any)?.message || 'Could not load documents.'}</p>
        )}

        {!isLoading && !isError && documents.length === 0 && (
          <p className="py-4 text-sm text-slate-500">No documents have been shared with you for this case yet.</p>
        )}

        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex flex-col gap-2 border border-black/10 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-black">{doc.file_name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge variant="outline" className="rounded-none border-black/15 text-[10px] uppercase">
                  {doc.document_type}
                </Badge>
                <span>{formatSize(doc.file_size)}</span>
                <span>{doc.upload_date ? formatDateTimeShort(doc.upload_date) : '—'}</span>
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 rounded-none border-black/15"
              disabled={busyId === doc.id}
              onClick={() => handleOpen(doc.id)}
            >
              {busyId === doc.id ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              Open
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default PortalCaseDocuments;
