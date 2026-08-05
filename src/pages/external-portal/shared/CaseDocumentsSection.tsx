import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2 } from 'lucide-react';
import { useCaseDocuments, useDownloadCaseDocument } from '@/hooks/externalPortal/useCaseDocuments';
import { formatDateTimeShort } from '@/utils/dateTime';

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CaseDocumentsSection: React.FC<{ appointmentId: string }> = ({ appointmentId }) => {
  const { data, isLoading } = useCaseDocuments(appointmentId);
  const downloadDoc = useDownloadCaseDocument();

  return (
    <Card className="rounded-none border-black/10">
      <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading documents…
          </div>
        ) : !data || data.documents.length === 0 ? (
          <p className="py-2 text-sm text-slate-400">No documents have been shared for this case yet.</p>
        ) : (
          <div className="space-y-1.5">
            {data.documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-2 border border-black/10 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-black">{doc.file_name}</p>
                    <p className="text-xs text-slate-500">
                      {doc.document_type} · {formatFileSize(doc.file_size)} · {formatDateTimeShort(doc.upload_date)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 rounded-none border-black/15"
                  disabled={downloadDoc.isPending}
                  onClick={() => downloadDoc.mutate(doc.id)}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CaseDocumentsSection;
