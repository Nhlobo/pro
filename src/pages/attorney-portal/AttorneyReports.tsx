import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { useAttorneyCases } from '@/hooks/externalPortal/useAttorneyPortal';
import { useCaseDocuments, useDownloadCaseDocument } from '@/hooks/externalPortal/useCaseDocuments';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileText, Download, FolderOpen } from 'lucide-react';
import { formatDateTimeShort } from '@/utils/dateTime';

// Documents come from the External Portal Module's case-link-scoped
// list_documents / get_document_url actions — same source used by the
// OTP-authenticated new-module UI. Download opens a short-lived signed
// URL issued fresh per request; nothing is cached client-side.
const AttorneyReports: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('case') || undefined;

  const { data: casesData, isLoading: casesLoading } = useAttorneyCases();
  const cases = casesData?.cases ?? [];
  const activeId = selectedId || cases[0]?.appointment_id;

  const { data: docsData, isLoading: docsLoading, isError, error } = useCaseDocuments(activeId);
  const download = useDownloadCaseDocument();

  return (
    <AttorneyPortalLayout>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-foreground">Reports &amp; Documents</h1>
        {cases.length > 0 && (
          <Select value={activeId} onValueChange={(v) => setParams({ case: v })}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Select a case" />
            </SelectTrigger>
            <SelectContent>
              {cases.map(c => (
                <SelectItem key={c.appointment_id} value={c.appointment_id}>
                  {c.claimant ? `${c.claimant.first_name} ${c.claimant.last_name}` : 'Claimant'} — {c.matter_type || 'Matter'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {casesLoading && (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading your cases…
        </div>
      )}

      {!casesLoading && cases.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">No cases have been linked to your portal account yet.</p>
      )}

      {!casesLoading && cases.length > 0 && (
        <Card>
          <CardContent className="p-4">
            {docsLoading && (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading documents…
              </div>
            )}
            {isError && (
              <p className="text-sm text-destructive">{(error as any)?.message || 'Could not load documents for this case.'}</p>
            )}
            {!docsLoading && !isError && (!docsData?.documents || docsData.documents.length === 0) && (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
                No documents are available for this case yet.
              </div>
            )}
            {!docsLoading && !isError && docsData?.documents && docsData.documents.length > 0 && (
              <div className="space-y-2">
                {docsData.documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">{doc.document_type} · {formatDateTimeShort(doc.upload_date)}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => download.mutate(doc.id)}
                      disabled={download.isPending}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </AttorneyPortalLayout>
  );
};

export default AttorneyReports;
