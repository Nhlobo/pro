import React, { useState, useEffect } from "react";
import { Upload, FileText, Eye, Download, Trash2, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DocumentUploadSystemProps {
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

interface ExpertOption {
  id: string;
  first_name: string;
  last_name: string;
}

const DocumentUploadSystem: React.FC<DocumentUploadSystemProps> = ({ className }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocumentTypes, setSelectedDocumentTypes] = useState<string[]>([]);
  const [selectedClaimant, setSelectedClaimant] = useState<string>("");
  const [selectedAttorney, setSelectedAttorney] = useState<string>("");
  const [selectedExpert, setSelectedExpert] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [claimants, setClaimants] = useState<ClaimantOption[]>([]);
  const [attorneys, setAttorneys] = useState<AttorneyOption[]>([]);
  const [experts, setExperts] = useState<ExpertOption[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  const documentTypes = [
    { value: "instruction_letter", label: "Instruction Letter" },
    { value: "claimant_id_copy", label: "Claimant ID Copy" },
    { value: "medical_records", label: "Medical Records" },
    { value: "expert_report_sent", label: "Expert Report Sent to Attorney" }
  ];

  useEffect(() => {
    loadDocuments();
    loadDropdownData();
  }, []);

  const loadDropdownData = async () => {
    try {
      // Load claimants
      const { data: claimantsData, error: claimantsError } = await supabase
        .from('claimants')
        .select('id, first_name, last_name, auto_id')
        .order('first_name', { ascending: true });

      if (claimantsError) throw claimantsError;
      setClaimants(claimantsData || []);

      // Load attorneys
      const { data: attorneysData, error: attorneysError } = await supabase
        .from('law_firms')
        .select('id, name, contact_person')
        .order('name', { ascending: true });

      if (attorneysError) throw attorneysError;
      setAttorneys(attorneysData || []);

      // Load medical experts
      const { data: expertsData, error: expertsError } = await supabase
        .from('medical_experts')
        .select('id, first_name, last_name')
        .order('first_name', { ascending: true });

      if (expertsError) throw expertsError;
      setExperts(expertsData || []);
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
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          claimants(first_name, last_name, auto_id),
          law_firms(name, contact_person),
          medical_experts(first_name, last_name)
        `)
        .order('upload_date', { ascending: false });

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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/tiff'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload PDF, Word, or image files (JPEG, PNG, TIFF).",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      toast({
        title: "File too large",
        description: "Please select a file smaller than 50MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleDocumentTypeChange = (documentType: string, checked: boolean) => {
    setSelectedDocumentTypes(prev => 
      checked 
        ? [...prev, documentType]
        : prev.filter(type => type !== documentType)
    );
  };

  const handleUpload = async () => {
    if (!selectedFile || selectedDocumentTypes.length === 0 || !user) {
      toast({
        title: "Missing information",
        description: "Please select a file, at least one document type, and ensure you're logged in.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Upload multiple documents (one for each selected type)
      const uploadPromises = selectedDocumentTypes.map(async (documentType) => {
        const fileName = `${Date.now()}-${documentType}-${selectedFile.name}`;
        const filePath = `documents/${documentType}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('attorney-documents')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        // Save document metadata to database
        const now = new Date();
        const { error: dbError } = await supabase
          .from('documents')
          .insert({
            document_type: documentType,
            claimant_id: selectedClaimant || null,
            referring_attorney_id: selectedAttorney || null,
            expert_id: selectedExpert || null,
            file_name: selectedFile.name,
            file_path: filePath,
            file_size: selectedFile.size,
            file_type: selectedFile.type,
            uploaded_by: user.id,
            upload_date: now.toISOString(),
            upload_time: now.toTimeString().split(' ')[0],
            notes: notes || null
          });

        if (dbError) throw dbError;
        return documentType;
      });

      await Promise.all(uploadPromises);

      toast({
        title: "Upload successful",
        description: `${selectedFile.name} has been uploaded for ${selectedDocumentTypes.length} document type(s).`,
      });

      // Reset form
      setSelectedFile(null);
      setSelectedDocumentTypes([]);
      setSelectedClaimant("");
      setSelectedAttorney("");
      setSelectedExpert("");
      setNotes("");
      
      // Reset file input
      const fileInput = document.getElementById('document-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Reload documents
      loadDocuments();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
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
      case 'expert_report_sent': return 'destructive';
      default: return 'default';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Document Upload System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="document-upload">Select Document</Label>
              <Input
                type="file"
                id="document-upload"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Document Type Checklist</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border rounded-lg bg-card">
                {documentTypes.map((type) => (
                  <div key={type.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={type.value}
                      checked={selectedDocumentTypes.includes(type.value)}
                      onCheckedChange={(checked) => 
                        handleDocumentTypeChange(type.value, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={type.value}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {type.label}
                    </Label>
                  </div>
                ))}
              </div>
              {selectedDocumentTypes.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedDocumentTypes.length} document type(s)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="claimant">Related Claimant (Optional)</Label>
              <Select value={selectedClaimant} onValueChange={setSelectedClaimant}>
                <SelectTrigger>
                  <SelectValue placeholder="Select claimant" />
                </SelectTrigger>
                <SelectContent>
                  {claimants.map((claimant) => (
                    <SelectItem key={claimant.id} value={claimant.id}>
                      {claimant.first_name} {claimant.last_name} ({claimant.auto_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="attorney">Referring Attorney</Label>
              <Select value={selectedAttorney} onValueChange={setSelectedAttorney}>
                <SelectTrigger>
                  <SelectValue placeholder="Select referring attorney" />
                </SelectTrigger>
                <SelectContent>
                  {attorneys.map((attorney) => (
                    <SelectItem key={attorney.id} value={attorney.id}>
                      {attorney.name} ({attorney.contact_person})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expert">Related Expert (Optional)</Label>
              <Select value={selectedExpert} onValueChange={setSelectedExpert}>
                <SelectTrigger>
                  <SelectValue placeholder="Select expert" />
                </SelectTrigger>
                <SelectContent>
                  {experts.map((expert) => (
                    <SelectItem key={expert.id} value={expert.id}>
                      {expert.first_name} {expert.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this document..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <Button 
            onClick={handleUpload} 
            disabled={isUploading || !selectedFile || selectedDocumentTypes.length === 0}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? "Uploading..." : "Upload Document"}
          </Button>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Uploaded Documents ({documents.length})
          </CardTitle>
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
                {documents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No documents uploaded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <Badge variant={getDocumentTypeBadgeVariant(doc.document_type)}>
                          {getDocumentTypeLabel(doc.document_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{doc.file_name}</TableCell>
                      <TableCell>
                        {doc.claimants ? 
                          `${doc.claimants.first_name} ${doc.claimants.last_name} (${doc.claimants.auto_id})` : 
                          '-'
                        }
                      </TableCell>
                      <TableCell>
                        {doc.law_firms ? 
                          `${doc.law_firms.name} (${doc.law_firms.contact_person})` : 
                          '-'
                        }
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
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

export default DocumentUploadSystem;