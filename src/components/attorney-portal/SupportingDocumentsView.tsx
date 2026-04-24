import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderOpen, Download, Search, Loader2, FileText, RefreshCw, Filter, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface VaultDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  document_type: string;
  upload_date: string;
  upload_time: string;
  notes: string | null;
  claimant_id: string | null;
  claimant_name: string | null;
  claimant_auto_id: string | null;
  signed_url: string | null;
  approval_status: string;
}

interface SupportingDocumentsViewProps {
  accessCode: string;
  preselectedClaimantName?: string | null;
}

const formatSize = (bytes?: number | null) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const getApprovalBadge = (status: string) => {
  const s = (status || 'pending').toLowerCase();
  if (s === 'approved') {
    return (
      <Badge className="bg-success/10 text-success border-success/20 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Approved
      </Badge>
    );
  }
  if (s === 'rejected' || s === 'denied') {
    return (
      <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
        <XCircle className="h-3 w-3" /> Not Approved
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground gap-1">
      <Clock className="h-3 w-3" /> Pending
    </Badge>
  );
};

const SupportingDocumentsView: React.FC<SupportingDocumentsViewProps> = ({
  accessCode,
  preselectedClaimantName,
}) => {
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');

  const loadDocuments = async (silent = false) => {
    if (!accessCode) return;
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('get-attorney-documents', {
        body: { access_code: accessCode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDocs(data?.documents ?? []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load supporting documents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessCode]);

  useEffect(() => {
    if (preselectedClaimantName) setSearch(preselectedClaimantName);
  }, [preselectedClaimantName]);

  const docTypes = useMemo(() => {
    const set = new Set<string>();
    docs.forEach(d => d.document_type && set.add(d.document_type));
    return Array.from(set).sort();
  }, [docs]);

  const filtered = useMemo(() => {
    return docs.filter(d => {
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        d.file_name.toLowerCase().includes(term) ||
        (d.claimant_name?.toLowerCase().includes(term) ?? false) ||
        (d.claimant_auto_id?.toLowerCase().includes(term) ?? false) ||
        d.document_type.toLowerCase().includes(term);
      const matchesType = typeFilter === 'all' || d.document_type === typeFilter;
      const status = (d.approval_status || 'pending').toLowerCase();
      const matchesApproval =
        approvalFilter === 'all' ||
        (approvalFilter === 'approved' && status === 'approved') ||
        (approvalFilter === 'pending' && status !== 'approved' && status !== 'rejected' && status !== 'denied') ||
        (approvalFilter === 'rejected' && (status === 'rejected' || status === 'denied'));
      return matchesSearch && matchesType && matchesApproval;
    });
  }, [docs, search, typeFilter, approvalFilter]);

  const counts = useMemo(() => {
    const out = { approved: 0, pending: 0, rejected: 0 };
    docs.forEach(d => {
      const s = (d.approval_status || 'pending').toLowerCase();
      if (s === 'approved') out.approved++;
      else if (s === 'rejected' || s === 'denied') out.rejected++;
      else out.pending++;
    });
    return out;
  }, [docs]);

  const handleDownload = (doc: VaultDocument) => {
    if (!doc.signed_url) {
      toast.error('Download link unavailable. Please refresh and try again.');
      return;
    }
    window.open(doc.signed_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-5 w-5 text-primary" />
              Supporting Documents
            </CardTitle>
            <CardDescription>
              Sourced directly from the secure Document Vault, matched by claimant full name and ID code.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDocuments(true)}
            disabled={refreshing || loading}
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Approval summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border bg-success/5 px-3 py-2">
            <div className="flex items-center gap-1 text-xs text-success font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Approved
            </div>
            <p className="text-lg font-semibold">{counts.approved}</p>
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
              <Clock className="h-3.5 w-3.5" /> Pending
            </div>
            <p className="text-lg font-semibold">{counts.pending}</p>
          </div>
          <div className="rounded-md border bg-destructive/5 px-3 py-2">
            <div className="flex items-center gap-1 text-xs text-destructive font-medium">
              <XCircle className="h-3.5 w-3.5" /> Not Approved
            </div>
            <p className="text-lg font-semibold">{counts.rejected}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by claimant name, ID code, file name or type…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All document types</SelectItem>
              {docTypes.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={approvalFilter} onValueChange={setApprovalFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter by approval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All approval statuses</SelectItem>
              <SelectItem value="approved">Approved only</SelectItem>
              <SelectItem value="pending">Pending only</SelectItem>
              <SelectItem value="rejected">Not Approved only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading documents…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No supporting documents found</p>
            <p className="text-xs mt-1">Documents uploaded to your matters in the Document Vault will appear here.</p>
          </div>
        ) : (
          <ScrollArea className="h-[520px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Claimant (ID Code)</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(doc => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate max-w-[260px]" title={doc.file_name}>
                          {doc.file_name}
                        </span>
                      </div>
                      {doc.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{doc.notes}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium">{doc.claimant_name || '—'}</span>
                        {doc.claimant_auto_id && (
                          <span className="text-xs text-muted-foreground font-mono">{doc.claimant_auto_id}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{doc.document_type}</Badge>
                    </TableCell>
                    <TableCell>{getApprovalBadge(doc.approval_status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {doc.upload_date ? format(new Date(doc.upload_date), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatSize(doc.file_size)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => handleDownload(doc)}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>{filtered.length} of {docs.length} documents</span>
          <span>Use Refresh to fetch the latest from the Document Vault</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default SupportingDocumentsView;
