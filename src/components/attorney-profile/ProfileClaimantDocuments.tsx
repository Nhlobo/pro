import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  FileText, Download, Upload, Calendar, Loader2, Briefcase,
  FileSignature, Scale, ClipboardList, User, AlertCircle, CheckCircle2, Trash2
} from 'lucide-react';
import { format } from 'date-fns';

// --- Types ---
interface Claimant {
  id: string;
  first_name: string;
  last_name: string;
  auto_id: string;
}

interface Document {
  id: string;
  file_name: string;
  document_type: string;
  file_path: string;
  upload_date: string;
  notes: string | null;
  claimant_id: string | null;
}

// Document types attorneys can upload per claimant
const UPLOAD_DOC_TYPES = [
  'RAF1 Form',
  'RAF4 Form',
  'Claimant ID Copy',
  'Medical Records',
  'Hospital File',
  'Police Report',
  'Summons',
  'Referring Letter / Instruction Letter',
  'Supporting Affidavit',
  'Power of Attorney',
  'Death Certificate',
  'Birth Certificate',
  'Other Supporting Document',
];

// Document types that are medico-reports (doctors/expert final reports — download only)
const MEDICO_REPORT_KEYWORDS = ['medico', 'expert report', 'final report', 'report', 'addendum', 'affidavit', 'joint minutes'];

const isMedicoReport = (type: string) =>
  MEDICO_REPORT_KEYWORDS.some(kw => type.toLowerCase().includes(kw));

const getDocIcon = (type: string) => {
  if (type.toLowerCase().includes('addendum') || type.toLowerCase().includes('letter')) return <FileSignature className="h-4 w-4 text-primary" />;
  if (type.toLowerCase().includes('affidavit') || type.toLowerCase().includes('summons')) return <Scale className="h-4 w-4 text-secondary" />;
  if (type.toLowerCase().includes('report') || type.toLowerCase().includes('raf')) return <ClipboardList className="h-4 w-4 text-warning" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
};

interface ProfileClaimantDocumentsProps {
  referringAttorneyId?: string;
}

const ProfileClaimantDocuments: React.FC<ProfileClaimantDocumentsProps> = ({ referringAttorneyId: propAttorneyId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [claimants, setClaimants] = useState<Claimant[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [attorneyId, setAttorneyId] = useState<string | null>(propAttorneyId || null);
  const [selectedClaimantId, setSelectedClaimantId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all-docs');

  // Upload form
  const [uploadForm, setUploadForm] = useState({
    claimant_id: '',
    document_type: '',
    notes: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Resolve attorney ID
  useEffect(() => {
    const resolve = async () => {
      if (propAttorneyId) { setAttorneyId(propAttorneyId); return; }
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('referring_attorney_id')
        .eq('id', user.id)
        .single();
      if (profile?.referring_attorney_id) setAttorneyId(profile.referring_attorney_id);
    };
    resolve();
  }, [user, propAttorneyId]);

  // Fetch claimants + documents
  useEffect(() => {
    if (attorneyId) fetchAll();
  }, [attorneyId]);

  const fetchAll = async () => {
    if (!attorneyId) return;
    setLoading(true);
    try {
      const [{ data: claimantsData }, { data: docsData }] = await Promise.all([
        supabase.from('claimants').select('id, first_name, last_name, auto_id').eq('referring_attorney_id', attorneyId).order('last_name'),
        supabase.from('documents').select('id, file_name, document_type, file_path, upload_date, notes, claimant_id').eq('referring_attorney_id', attorneyId).order('upload_date', { ascending: false }),
      ]);
      setClaimants(claimantsData || []);
      setDocuments(docsData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.claimant_id || !uploadForm.document_type) {
      toast({ title: 'Missing Fields', description: 'Please select a claimant, document type, and file.', variant: 'destructive' });
      return;
    }
    if (!attorneyId) return;

    setUploading(true);
    try {
      const uploaderId = user?.id || attorneyId;
      const claimant = claimants.find(c => c.id === uploadForm.claimant_id);
      const slug = claimant ? `${claimant.first_name}_${claimant.last_name}`.replace(/\s+/g, '_') : 'unknown';
      const filePath = `claimant-docs/${attorneyId}/${slug}/${Date.now()}_${selectedFile.name}`;

      const { error: storageError } = await supabase.storage
        .from('attorney-documents')
        .upload(filePath, selectedFile);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from('documents').insert({
        file_name: selectedFile.name,
        document_type: uploadForm.document_type,
        file_path: filePath,
        notes: uploadForm.notes || null,
        referring_attorney_id: attorneyId,
        claimant_id: uploadForm.claimant_id,
        uploaded_by: uploaderId,
        upload_date: new Date().toISOString(),
        upload_time: new Date().toTimeString().split(' ')[0],
      });

      if (dbError) throw dbError;

      toast({ title: 'Document Uploaded', description: `${selectedFile.name} uploaded successfully.` });
      setSelectedFile(null);
      setUploadForm({ claimant_id: '', document_type: '', notes: '' });
      await fetchAll();
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({ title: 'Upload Failed', description: err.message || 'Failed to upload document.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from('attorney-documents').download(filePath);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: 'Download Failed', description: err.message || 'Could not download file.', variant: 'destructive' });
    }
  };

  // Filter documents
  const filteredDocs = documents.filter(d => {
    const matchesClaimant = selectedClaimantId === 'all' || d.claimant_id === selectedClaimantId;
    if (activeTab === 'all-docs') return matchesClaimant;
    if (activeTab === 'medico-reports') return matchesClaimant && isMedicoReport(d.document_type);
    if (activeTab === 'uploaded') return matchesClaimant && !isMedicoReport(d.document_type);
    return matchesClaimant;
  });

  const medicoCount = documents.filter(d => isMedicoReport(d.document_type)).length;
  const uploadedCount = documents.filter(d => !isMedicoReport(d.document_type)).length;

  const getClaimantName = (id: string | null) => {
    if (!id) return '—';
    const c = claimants.find(cl => cl.id === id);
    return c ? `${c.first_name} ${c.last_name}` : '—';
  };

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'All Documents', value: documents.length, color: 'text-foreground' },
          { label: 'Medico-Reports', value: medicoCount, color: 'text-secondary' },
          { label: 'Uploaded Docs', value: uploadedCount, color: 'text-primary' },
          { label: 'Claimants', value: claimants.length, color: 'text-muted-foreground' },
        ].map((s) => (
          <Card key={s.label} className="bg-gradient-card border-border/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Upload Panel */}
        <div className="lg:col-span-2">
          <Card className="border-primary/20 bg-gradient-to-b from-accent-soft/30 to-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                Upload Claimant Document
              </CardTitle>
              <CardDescription className="text-xs">
                Upload RAF forms, medical records, summons, instruction letters and other claimant documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Claimant select */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <User className="h-3 w-3" /> Select Claimant *
                </Label>
                <Select value={uploadForm.claimant_id} onValueChange={v => setUploadForm(p => ({ ...p, claimant_id: v }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={loading ? 'Loading...' : 'Select claimant'} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-[60]">
                    {claimants.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                        <span className="text-muted-foreground ml-1 text-xs">({c.auto_id})</span>
                      </SelectItem>
                    ))}
                    {claimants.length === 0 && !loading && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No claimants found</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Document type */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Document Type *
                </Label>
                <Select value={uploadForm.document_type} onValueChange={v => setUploadForm(p => ({ ...p, document_type: v }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-[60]">
                    {UPLOAD_DOC_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* File picker */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">File *</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-9 text-sm border-dashed border-primary/40 hover:border-primary hover:bg-primary/5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2 text-primary" />
                  {selectedFile ? selectedFile.name : 'Choose File'}
                </Button>
                {selectedFile && (
                  <div className="flex items-center gap-2 bg-muted/60 rounded px-2 py-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />
                    <span className="text-xs truncate">{selectedFile.name}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 ml-auto" onClick={() => setSelectedFile(null)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notes (optional)</Label>
                <Textarea
                  placeholder="Any additional notes..."
                  value={uploadForm.notes}
                  onChange={e => setUploadForm(p => ({ ...p, notes: e.target.value }))}
                  className="text-sm resize-none h-16"
                />
              </div>

              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !uploadForm.claimant_id || !uploadForm.document_type}
                className="w-full"
                size="sm"
              >
                {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</> : <><Upload className="h-4 w-4 mr-2" /> Upload Document</>}
              </Button>

              <div className="rounded-lg bg-muted/50 border border-border/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Accepted document types:
                </p>
                <div className="flex flex-wrap gap-1">
                  {['RAF1', 'RAF4', 'Med Records', 'Summons', 'ID Copy', 'Affidavit', 'Instruction Letter', 'Hospital File'].map(t => (
                    <Badge key={t} variant="outline" className="text-xs px-1.5 py-0">{t}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents list */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  Documents
                </CardTitle>
                {/* Claimant filter */}
                <Select value={selectedClaimantId} onValueChange={setSelectedClaimantId}>
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue placeholder="All claimants" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-[60]">
                    <SelectItem value="all">All Claimants</SelectItem>
                    {claimants.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="px-4">
                  <TabsList className="grid w-full grid-cols-3 h-8 text-xs mb-3">
                    <TabsTrigger value="all-docs" className="text-xs">All ({documents.length})</TabsTrigger>
                    <TabsTrigger value="medico-reports" className="text-xs flex items-center gap-1">
                      <Download className="h-3 w-3" /> Reports ({medicoCount})
                    </TabsTrigger>
                    <TabsTrigger value="uploaded" className="text-xs flex items-center gap-1">
                      <Upload className="h-3 w-3" /> Uploaded ({uploadedCount})
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value={activeTab} className="mt-0">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    </div>
                  ) : filteredDocs.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground px-4">
                      <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">No documents found</p>
                      {activeTab === 'medico-reports' && (
                        <p className="text-xs mt-1 text-muted-foreground">Medico-reports uploaded by our team will appear here for download</p>
                      )}
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Document</TableHead>
                            <TableHead className="text-xs">Claimant</TableHead>
                            <TableHead className="text-xs">Date</TableHead>
                            <TableHead className="text-xs text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDocs.map((doc) => (
                            <TableRow key={doc.id} className="group">
                              <TableCell className="py-2">
                                <div className="flex items-start gap-2">
                                  {getDocIcon(doc.document_type)}
                                  <div className="min-w-0">
                                    <p className="font-medium text-xs truncate max-w-[140px]">{doc.file_name}</p>
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] px-1 py-0 mt-0.5 ${isMedicoReport(doc.document_type) ? 'border-secondary/40 text-secondary' : 'border-primary/40 text-primary'}`}
                                    >
                                      {doc.document_type}
                                    </Badge>
                                    {isMedicoReport(doc.document_type) && (
                                      <Badge className="text-[10px] px-1 py-0 ml-1 bg-secondary/10 text-secondary border-0">Medico-Report</Badge>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-2">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <User className="h-3 w-3 shrink-0" />
                                  <span className="truncate max-w-[80px]">{getClaimantName(doc.claimant_id)}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-2">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3 shrink-0" />
                                  {format(new Date(doc.upload_date), 'dd MMM yy')}
                                </div>
                              </TableCell>
                              <TableCell className="py-2 text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleDownload(doc.file_path, doc.file_name)}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  {isMedicoReport(doc.document_type) ? 'Download Report' : 'Download'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfileClaimantDocuments;
