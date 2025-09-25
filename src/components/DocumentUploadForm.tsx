import React, { useState, useEffect } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useNavigate } from "react-router-dom";

interface DocumentUploadFormProps {
  className?: string;
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

const DocumentUploadForm: React.FC<DocumentUploadFormProps> = ({ className }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>("");
  const [selectedClaimant, setSelectedClaimant] = useState<string>("");
  const [selectedAttorney, setSelectedAttorney] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [claimants, setClaimants] = useState<ClaimantOption[]>([]);
  const [attorneys, setAttorneys] = useState<AttorneyOption[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isReferringAttorney } = usePermissions();
  const navigate = useNavigate();

  const documentTypes = [
    { value: "instruction_letter", label: "Instruction Letter" },
    { value: "claimant_id_copy", label: "Claimant ID Copy" },
    { value: "medical_records", label: "Medical Records" },
    { value: "xray", label: "Xray" },
    { value: "medico_report", label: "Medico-report/s" }
  ];

  useEffect(() => {
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/tiff'
    ];

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];
    const oversizedFiles: string[] = [];

    files.forEach(file => {
      if (!allowedTypes.includes(file.type)) {
        invalidFiles.push(file.name);
      } else if (file.size > 50 * 1024 * 1024) { // 50MB limit
        oversizedFiles.push(file.name);
      } else {
        validFiles.push(file);
      }
    });

    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid file types",
        description: `The following files have invalid types: ${invalidFiles.join(', ')}. Please upload PDF, Word, or image files only.`,
        variant: "destructive",
      });
    }

    if (oversizedFiles.length > 0) {
      toast({
        title: "Files too large",
        description: `The following files are too large: ${oversizedFiles.join(', ')}. Please select files smaller than 50MB.`,
        variant: "destructive",
      });
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      if (invalidFiles.length > 0 || oversizedFiles.length > 0) {
        toast({
          title: "Some files selected",
          description: `${validFiles.length} valid file(s) selected. ${invalidFiles.length + oversizedFiles.length} file(s) were skipped.`,
        });
      }
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    const fileInput = document.getElementById('document-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !selectedDocumentType || !user) {
      toast({
        title: "Missing information",
        description: "Please select files, document type, and ensure you're logged in.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const uploadedDocuments: any[] = [];
      let successCount = 0;
      let failureCount = 0;

      // Upload all files first
      for (const file of selectedFiles) {
        try {
          const fileName = `${Date.now()}-${selectedDocumentType}-${file.name}`;
          const filePath = `documents/${selectedDocumentType}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('attorney-documents')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          // Prepare document metadata for batch insert
          const now = new Date();
          uploadedDocuments.push({
            document_type: selectedDocumentType,
            claimant_id: selectedClaimant || null,
            referring_attorney_id: selectedAttorney || null,
            expert_id: null,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: user.id,
            upload_date: now.toISOString(),
            upload_time: now.toTimeString().split(' ')[0],
            notes: notes || null
          });

          successCount++;
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          failureCount++;
        }
      }

      // Save all document metadata to database at once
      if (uploadedDocuments.length > 0) {
        const { error: dbError } = await supabase
          .from('documents')
          .insert(uploadedDocuments);

        if (dbError) throw dbError;
      }

      if (successCount > 0) {
        toast({
          title: "Upload completed",
          description: `Successfully uploaded ${successCount} document(s)${failureCount > 0 ? `, ${failureCount} failed` : ''}.`,
        });
      }

      if (failureCount > 0 && successCount === 0) {
        toast({
          title: "Upload failed",
          description: "All file uploads failed. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Reset form
      setSelectedFiles([]);
      setSelectedDocumentType("");
      setSelectedClaimant("");
      setSelectedAttorney("");
      setNotes("");
      
      // Reset file input
      const fileInput = document.getElementById('document-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Redirect to uploaded documents page
      navigate('/document-uploading');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload documents.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Documents
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload multiple documents at once. Select the document type and files, then click upload to save all documents.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="document-upload">Select File</Label>
              <Input
                id="document-upload"
                type="file"
                multiple
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff"
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Supported formats: PDF, Word documents, JPEG, PNG, TIFF (Max: 50MB per file)
              </p>
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {selectedFiles.length} file(s) selected:
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearAllFiles}
                      className="text-xs"
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                        <span className="truncate flex-1">
                          {file.name} ({formatFileSize(file.size)})
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="document-type">Document Type</Label>
              <Select value={selectedDocumentType} onValueChange={setSelectedDocumentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            disabled={isUploading || selectedFiles.length === 0 || !selectedDocumentType}
            className="w-full mt-6"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? "Uploading..." : selectedFiles.length > 0 ? `Upload ${selectedFiles.length} Document(s)` : "Select Files and Type"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentUploadForm;