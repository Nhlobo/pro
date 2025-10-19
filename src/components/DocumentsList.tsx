import React, { useState, useEffect, useMemo } from "react";
import { FileText, Eye, Download, Trash2, Clock, User, Edit, Save, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

interface DocumentsListProps {
  className?: string;
}

interface DocumentRecord {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  upload_date: string;
  upload_time: string;
  notes: string;
  claimants?: { first_name: string; last_name: string; auto_id: string };
  law_firms?: { name: string; contact_person: string };
  medical_experts?: { first_name: string; last_name: string };
}

interface ClaimantOption {
  id: string;
  first_name: string;
  last_name: string;
  auto_id: string;
}

interface AttorneyOption {
  id: string;
  name: string;
  contact_person: string;
}

const DocumentsList: React.FC<DocumentsListProps> = ({ className }) => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [claimants, setClaimants] = useState<ClaimantOption[]>([]);
  const [attorneys, setAttorneys] = useState<AttorneyOption[]>([]);
  const [editingDocument, setEditingDocument] = useState<string | null>(null);
  const [editClaimant, setEditClaimant] = useState<string>("");
  const [editAttorney, setEditAttorney] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { toast } = useToast();
  const { user } = useAuth();
  const { isReferringAttorney } = usePermissions();

  const documentTypes = [
    { value: "instruction_letter", label: "Instruction Letter" },
    { value: "claimant_id_copy", label: "Claimant ID Copy" },
    { value: "medical_records", label: "Medical Records" },
    { value: "xray", label: "Xray" },
    { value: "medico_report", label: "Medico-report/s" }
  ];

  useEffect(() => {
    loadDocuments();
    loadDropdownData();
  }, []);

  const loadDropdownData = async () => {
    try {
      // Load claimants using secure function
      const { data: claimantsData, error: claimantsError } = await supabase
        .rpc('get_claimants_secure');

      if (claimantsError) throw claimantsError;
      
      // Transform secure data to match expected format
      let transformedClaimants = (claimantsData || []).map(claimant => ({
        id: claimant.id,
        first_name: claimant.first_name_masked,
        last_name: claimant.last_name_masked,
        auto_id: claimant.auto_id
      }));

      // If user is referring attorney, filter claimants by their appointments
      if (isReferringAttorney()) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, law_firm_id')
          .eq('id', user?.id)
          .single();

        if (profile) {
          const attorneyName = `${profile.first_name} ${profile.last_name}`;
          
          // Get appointments for this attorney to find their claimant IDs
          const { data: appointments } = await supabase
            .from('appointments')
            .select('claimant_id')
            .eq('referring_attorney', attorneyName)
            .eq('law_firm_id', profile.law_firm_id);

          const allowedClaimantIds = appointments?.map(apt => apt.claimant_id) || [];
          transformedClaimants = transformedClaimants.filter(claimant => 
            allowedClaimantIds.includes(claimant.id)
          );
        }
      }

      setClaimants(transformedClaimants);

      // Load attorneys using secure function
      const { data: attorneysData, error: attorneysError } = await supabase
        .rpc('get_law_firms_list');

      if (attorneysError) throw attorneysError;
      setAttorneys(attorneysData || []);

    } catch (error: any) {
      console.error('Error loading dropdown data:', error);
      toast({
        title: "Error loading data",
        description: error.message || "Failed to load dropdown options.",
        variant: "destructive",
      });
    }
  };

  const loadDocuments = async () => {
    try {
      let documentsQuery = supabase
        .from('documents')
        .select(`
          *,
          claimants(first_name, last_name, auto_id),
          law_firms(name, contact_person)
        `)
        .neq('document_type', 'expert_report_sent')
        .order('upload_date', { ascending: false });

      // If user is referring attorney, filter documents by appointments they're involved in
      if (isReferringAttorney()) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, law_firm_id')
          .eq('id', user?.id)
          .single();

        if (profile) {
          const attorneyName = `${profile.first_name} ${profile.last_name}`;
          
          // Get appointments for this attorney to find their claimant IDs
          const { data: appointments } = await supabase
            .from('appointments')
            .select('claimant_id')
            .eq('referring_attorney', attorneyName)
            .eq('law_firm_id', profile.law_firm_id);

          const claimantIds = appointments?.map(apt => apt.claimant_id) || [];

          if (claimantIds.length > 0) {
            documentsQuery = documentsQuery.in('claimant_id', claimantIds);
          } else {
            // No clients for this attorney, return empty result
            setDocuments([]);
            return;
          }
        }
      }

      const { data, error } = await documentsQuery;

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error('Error loading documents:', error);
      toast({
        title: "Error loading documents",
        description: error.message || "Failed to load document list.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (document: DocumentRecord) => {
    try {
      const { data, error } = await supabase.storage
        .from('attorney-documents')
        .download(document.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = globalThis.document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      globalThis.document.body.appendChild(a);
      a.click();
      globalThis.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: `Downloading ${document.file_name}...`,
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: error.message || "Failed to download document.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (documentId: string, filePath: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('attorney-documents')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      toast({
        title: "Document deleted",
        description: "Document has been permanently deleted.",
      });

      loadDocuments();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete document.",
        variant: "destructive",
      });
    }
  };

  const startEditDocument = (doc: DocumentRecord) => {
    setEditingDocument(doc.id);
    setEditClaimant(doc.claimants ? doc.claimants.auto_id : "none");
    setEditAttorney(doc.law_firms ? doc.law_firms.name : "none");
  };

  const cancelEdit = () => {
    setEditingDocument(null);
    setEditClaimant("none");
    setEditAttorney("none");
  };

  const saveDocumentAssociation = async (documentId: string) => {
    try {
      // Find the actual IDs for the associations
      const claimantId = editClaimant !== "none" ? claimants.find(c => c.auto_id === editClaimant)?.id || null : null;
      const attorneyId = editAttorney !== "none" ? attorneys.find(a => a.name === editAttorney)?.id || null : null;

      const { error } = await supabase
        .from('documents')
        .update({
          claimant_id: claimantId,
          referring_attorney_id: attorneyId,
          expert_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (error) throw error;

      toast({
        title: "Document updated",
        description: "Document associations have been updated successfully.",
      });

      cancelEdit();
      loadDocuments();
    } catch (error: any) {
      console.error('Update error:', error);
      toast({
        title: "Update failed",
        description: error.message || "Failed to update document associations.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDocumentTypeLabel = (type: string): string => {
    return documentTypes.find(dt => dt.value === type)?.label || type;
  };

  const getDocumentTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'instruction_letter': return 'default';
      case 'claimant_id_copy': return 'secondary';
      case 'medical_records': return 'outline';
      case 'xray': return 'secondary';
      case 'medico_report': return 'outline';
      default: return 'default';
    }
  };

  // Filter documents based on search term
  const filteredDocuments = useMemo(() => {
    if (!searchTerm.trim()) return documents;
    
    const searchLower = searchTerm.toLowerCase();
    return documents.filter((doc) => {
      // Search in claimant name and auto_id
      const claimantMatch = doc.claimants && (
        doc.claimants.first_name.toLowerCase().includes(searchLower) ||
        doc.claimants.last_name.toLowerCase().includes(searchLower) ||
        doc.claimants.auto_id.toLowerCase().includes(searchLower) ||
        `${doc.claimants.first_name} ${doc.claimants.last_name}`.toLowerCase().includes(searchLower)
      );
      
      // Search in attorney/law firm name
      const attorneyMatch = doc.law_firms && (
        doc.law_firms.name.toLowerCase().includes(searchLower) ||
        doc.law_firms.contact_person.toLowerCase().includes(searchLower)
      );
      
      // Search in file name and document type
      const fileMatch = doc.file_name.toLowerCase().includes(searchLower);
      const typeMatch = getDocumentTypeLabel(doc.document_type).toLowerCase().includes(searchLower);
      
      return claimantMatch || attorneyMatch || fileMatch || typeMatch;
    });
  }, [documents, searchTerm]);

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Uploaded Documents ({filteredDocuments.length}{filteredDocuments.length !== documents.length ? ` of ${documents.length}` : ''})
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Click the edit icon to associate expert reports with claimants or attorneys later
          </p>
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by claimant name, auto ID, attorney name, or document type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Type</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Claimant</TableHead>
                  <TableHead>Attorney</TableHead>
                  <TableHead>Upload Date/Time</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {searchTerm ? "No documents match your search criteria" : "No documents uploaded yet"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <Badge variant={getDocumentTypeBadgeVariant(doc.document_type)}>
                          {getDocumentTypeLabel(doc.document_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{doc.file_name}</TableCell>
                      <TableCell>
                        {editingDocument === doc.id ? (
                          <Select value={editClaimant} onValueChange={setEditClaimant}>
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Select claimant" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {claimants.map((claimant) => (
                                <SelectItem key={claimant.id} value={claimant.auto_id}>
                                  {claimant.first_name} {claimant.last_name} ({claimant.auto_id})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          doc.claimants ? 
                            `${doc.claimants.first_name} ${doc.claimants.last_name} (${doc.claimants.auto_id})` : 
                            <span className="text-muted-foreground">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingDocument === doc.id ? (
                          <Select value={editAttorney} onValueChange={setEditAttorney}>
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Select attorney" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {attorneys.map((attorney) => (
                                <SelectItem key={attorney.id} value={attorney.name}>
                                  {attorney.name} ({attorney.contact_person})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          doc.law_firms ? 
                            `${doc.law_firms.name} (${doc.law_firms.contact_person})` : 
                            <span className="text-muted-foreground">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          <span>
                            {new Date(doc.upload_date).toLocaleDateString()} {doc.upload_time}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {editingDocument === doc.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => saveDocumentAssociation(doc.id)}
                                title="Save associations"
                                className="text-green-600 hover:text-green-700"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEdit}
                                title="Cancel edit"
                                className="text-gray-600 hover:text-gray-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditDocument(doc)}
                                title="Edit associations"
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(doc)}
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(doc.id, doc.file_path)}
                                title="Delete"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentsList;