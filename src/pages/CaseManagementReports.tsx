import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Upload, FileText, Trash2, Search } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CompanyFooter from "@/components/CompanyFooter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";

export default function CaseManagementReports() {
  console.log("CaseManagementReports component mounted");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedClaimant, setSelectedClaimant] = useState<string>("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<{ id: string; filePath: string; fileName: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch user profile to check role
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const isReferringAttorney = userProfile?.role === 'referring_attorney';
  const canUpload = !isReferringAttorney;

  // Fetch claimants
  const { data: claimants = [] } = useQuery({
    queryKey: ['claimants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claimants')
        .select('id, auto_id, first_name, last_name')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch reports with claimant info from dedicated case management reports table
  const { data: reports = [], refetch } = useQuery({
    queryKey: ['case-management-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('case_management_reports')
        .select(`
          id,
          file_name,
          file_path,
          upload_date,
          claimant_id,
          claimants!inner(
            auto_id,
            first_name,
            last_name
          )
        `)
        .order('upload_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (!selectedClaimant || uploadFiles.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select a claimant and choose at least one file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let successCount = 0;
      let errorCount = 0;

      // Upload each file to dedicated case management reports bucket
      for (const file of uploadFiles) {
        try {
          // Upload file to dedicated case management reports storage
          const fileExt = file.name.split('.').pop();
          const fileName = `${selectedClaimant}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = fileName; // No subfolder needed, using dedicated bucket

          const { error: uploadError } = await supabase.storage
            .from('case-management-reports')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          // Save to dedicated case management reports table
          const { error: insertError } = await supabase
            .from('case_management_reports')
            .insert({
              file_name: file.name,
              file_path: filePath,
              file_type: file.type,
              file_size: file.size,
              claimant_id: selectedClaimant,
              uploaded_by: user.id,
            });

          if (insertError) throw insertError;

          successCount++;
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Success",
          description: `${successCount} report${successCount > 1 ? 's' : ''} uploaded successfully.${errorCount > 0 ? ` ${errorCount} failed.` : ''}`,
        });
      }

      if (errorCount > 0 && successCount === 0) {
        toast({
          title: "Upload Failed",
          description: "Failed to upload reports. Please try again.",
          variant: "destructive",
        });
      }

      // Reset form
      setSelectedClaimant("");
      setUploadFiles([]);
      refetch();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload reports",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('case-management-reports')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Report downloaded successfully.",
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download report",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (id: string, filePath: string, fileName: string) => {
    setReportToDelete({ id, filePath, fileName });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!reportToDelete) return;

    try {
      // Delete file from dedicated case management reports storage
      const { error: storageError } = await supabase.storage
        .from('case-management-reports')
        .remove([reportToDelete.filePath]);

      if (storageError) throw storageError;

      // Delete record from dedicated table
      const { error: dbError } = await supabase
        .from('case_management_reports')
        .delete()
        .eq('id', reportToDelete.id);

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Report deleted successfully.",
      });

      refetch();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete report",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    }
  };

  const filteredReports = reports.filter((report: any) => {
    const searchLower = searchTerm.toLowerCase();
    const claimantId = report.claimants.auto_id?.toLowerCase() || '';
    const claimantName = `${report.claimants.first_name} ${report.claimants.last_name}`.toLowerCase();
    const fileName = report.file_name.toLowerCase();
    
    return claimantId.includes(searchLower) || 
           claimantName.includes(searchLower) || 
           fileName.includes(searchLower);
  });

  const canonicalUrl = `${window.location.origin}/case-management-reports`;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Case Management Reports - Upload & Track</title>
        <meta name="description" content="Upload and manage case management reports for claimants" />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Case Management Reports</h1>
          <p className="text-muted-foreground">
            {isReferringAttorney 
              ? "View and download your case management reports" 
              : "Upload and track reports for claimants"}
          </p>
        </div>

        {/* Upload Form - Only visible to non-referring attorneys */}
        {canUpload && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload New Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="claimant">Select Claimant</Label>
                  <Select value={selectedClaimant} onValueChange={setSelectedClaimant}>
                    <SelectTrigger id="claimant">
                      <SelectValue placeholder="Choose a claimant" />
                    </SelectTrigger>
                    <SelectContent>
                      {claimants.map((claimant) => (
                        <SelectItem key={claimant.id} value={claimant.id}>
                          {claimant.auto_id} - {claimant.first_name} {claimant.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file">Report Files</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    multiple
                    onChange={handleFileChange}
                  />
                  {uploadFiles.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {uploadFiles.length} file{uploadFiles.length > 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button onClick={handleUpload} disabled={isUploading}>
                  {isUploading ? "Uploading..." : "Upload Report"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Uploaded Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by claimant ID, name, or file name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claimant ID</TableHead>
                  <TableHead>Claimant Name</TableHead>
                  <TableHead>Report File</TableHead>
                  <TableHead>Date Loaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {searchTerm ? "No reports match your search" : "No reports uploaded yet"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReports.map((report: any) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.claimants.auto_id}</TableCell>
                      <TableCell>
                        {report.claimants.first_name} {report.claimants.last_name}
                      </TableCell>
                      <TableCell>{report.file_name}</TableCell>
                      <TableCell>
                        {new Date(report.upload_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownload(report.file_path, report.file_name)}
                          >
                            Download
                          </Button>
                          {canUpload && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteClick(report.id, report.file_path, report.file_name)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{reportToDelete?.fileName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CompanyFooter />
    </div>
  );
}
