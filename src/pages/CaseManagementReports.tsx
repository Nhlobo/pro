import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Upload, FileText } from "lucide-react";
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
  const [selectedClaimant, setSelectedClaimant] = useState<string>("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

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

  // Fetch reports with claimant info
  const { data: reports = [], refetch } = useQuery({
    queryKey: ['case-management-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
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
        .eq('document_type', 'case_management_report')
        .order('upload_date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Group reports by claimant
  const groupedReports = reports.reduce((acc: any, report: any) => {
    const claimantId = report.claimant_id;
    if (!acc[claimantId]) {
      acc[claimantId] = {
        claimant: report.claimants,
        reports: [],
      };
    }
    acc[claimantId].reports.push(report);
    return acc;
  }, {});

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

      // Upload each file
      for (const file of uploadFiles) {
        try {
          // Upload file to storage
          const fileExt = file.name.split('.').pop();
          const fileName = `${selectedClaimant}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `case-management-reports/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('attorney-documents')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          // Save document record
          const { error: insertError } = await supabase
            .from('documents')
            .insert({
              file_name: file.name,
              file_path: filePath,
              file_type: file.type,
              file_size: file.size,
              document_type: 'case_management_report',
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
        .from('attorney-documents')
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
          <p className="text-muted-foreground">Upload and track reports for claimants</p>
        </div>

        {/* Upload Form */}
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

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Uploaded Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claimant ID</TableHead>
                  <TableHead>Claimant Name</TableHead>
                  <TableHead>Number of Reports</TableHead>
                  <TableHead>Reports</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(groupedReports).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No reports uploaded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  Object.entries(groupedReports).map(([claimantId, data]: [string, any]) => (
                    <TableRow key={claimantId}>
                      <TableCell className="font-medium">{data.claimant.auto_id}</TableCell>
                      <TableCell>
                        {data.claimant.first_name} {data.claimant.last_name}
                      </TableCell>
                      <TableCell>{data.reports.length}</TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          {data.reports.map((report: any) => (
                            <div key={report.id} className="flex items-center justify-between p-2 bg-muted rounded">
                              <div className="flex-1">
                                <p className="text-sm font-medium">{report.file_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(report.upload_date).toLocaleDateString()}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDownload(report.file_path, report.file_name)}
                              >
                                Download
                              </Button>
                            </div>
                          ))}
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

      <CompanyFooter />
    </div>
  );
}
