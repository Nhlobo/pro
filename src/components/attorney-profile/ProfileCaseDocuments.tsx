import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText, Download, Calendar, Briefcase, FileSignature,
  Scale, ClipboardList, Loader2
} from 'lucide-react';
import { format } from 'date-fns';

interface Document {
  id: string;
  file_name: string;
  document_type: string;
  file_path: string;
  upload_date: string;
  notes: string | null;
}

interface ProfileCaseDocumentsProps {
  referringAttorneyId?: string;
}

const ProfileCaseDocuments: React.FC<ProfileCaseDocumentsProps> = ({ referringAttorneyId: propAttorneyId }) => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (user || propAttorneyId) fetchDocuments();
  }, [user, propAttorneyId]);

  const fetchDocuments = async () => {
    try {
      let attorneyId = propAttorneyId;

      if (!attorneyId && user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('referring_attorney_id')
          .eq('id', user.id)
          .single();
        attorneyId = profile?.referring_attorney_id || undefined;
      }

      if (!attorneyId) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('documents')
        .select('id, file_name, document_type, file_path, upload_date, notes')
        .eq('referring_attorney_id', attorneyId)
        .order('upload_date', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDocIcon = (type: string) => {
    if (type.toLowerCase().includes('addendum')) return <FileSignature className="h-4 w-4 text-kutlwano-blue" />;
    if (type.toLowerCase().includes('affidavit')) return <Scale className="h-4 w-4 text-kutlwano-teal" />;
    if (type.toLowerCase().includes('report') || type.toLowerCase().includes('case')) return <ClipboardList className="h-4 w-4 text-warning" />;
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  const getDocBadgeColor = (type: string) => {
    if (type.toLowerCase().includes('addendum')) return 'bg-kutlwano-blue/10 text-kutlwano-blue border-kutlwano-blue/20';
    if (type.toLowerCase().includes('affidavit')) return 'bg-kutlwano-teal/10 text-kutlwano-teal border-kutlwano-teal/20';
    if (type.toLowerCase().includes('report') || type.toLowerCase().includes('case')) return 'bg-warning/10 text-warning border-warning/20';
    return 'bg-muted text-muted-foreground';
  };

  const filteredDocs = documents.filter(d => {
    if (activeTab === 'all') return true;
    if (activeTab === 'addendum') return d.document_type.toLowerCase().includes('addendum');
    if (activeTab === 'affidavits') return d.document_type.toLowerCase().includes('affidavit');
    if (activeTab === 'case-reports') return d.document_type.toLowerCase().includes('report') || d.document_type.toLowerCase().includes('case');
    return true;
  });

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('attorney-documents')
        .download(filePath);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">All Documents</p>
            <p className="text-xl font-bold">{documents.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Addendums</p>
            <p className="text-xl font-bold text-kutlwano-blue">
              {documents.filter(d => d.document_type.toLowerCase().includes('addendum')).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Affidavits</p>
            <p className="text-xl font-bold text-kutlwano-teal">
              {documents.filter(d => d.document_type.toLowerCase().includes('affidavit')).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Case Reports</p>
            <p className="text-xl font-bold text-warning">
              {documents.filter(d => d.document_type.toLowerCase().includes('report') || d.document_type.toLowerCase().includes('case')).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All ({documents.length})</TabsTrigger>
          <TabsTrigger value="addendum">Addendum</TabsTrigger>
          <TabsTrigger value="affidavits">Affidavits</TabsTrigger>
          <TabsTrigger value="case-reports">Case Reports</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No documents found in this category</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Upload Date</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getDocIcon(doc.document_type)}
                          <span className="font-medium text-sm">{doc.file_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getDocBadgeColor(doc.document_type)}>
                          {doc.document_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(doc.upload_date), 'dd MMM yyyy')}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {doc.notes || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleDownload(doc.file_path, doc.file_name)}>
                          <Download className="h-4 w-4 mr-1" /> Download
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
    </div>
  );
};

export default ProfileCaseDocuments;
