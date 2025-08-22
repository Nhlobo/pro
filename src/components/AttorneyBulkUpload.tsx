import React, { useState } from "react";
import { Upload, Download, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from "@/utils/pdfBranding";

interface AttorneyBulkUploadProps {
  onUploadSuccess?: () => void;
}

const AttorneyBulkUpload: React.FC<AttorneyBulkUploadProps> = ({ onUploadSuccess }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/pdf'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel (.xlsx, .xls) or PDF file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('attorney-documents')
        .upload(fileName, file);

      if (error) throw error;

      toast({
        title: "File uploaded successfully",
        description: `${file.name} has been uploaded. Processing attorney data...`,
      });

      // Here you would typically process the file content
      // For now, we'll just show success
      onUploadSuccess?.();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleExportAttorneys = async () => {
    setIsExporting(true);

    try {
      const { data: attorneys, error } = await supabase
        .rpc('get_law_firms_list');

      if (error) throw error;

      // Create PDF
      const doc = new jsPDF();
      
      // Add branding
      const startY = addBrandingToPDF(doc, 'Referring Attorneys List');
      
      // Prepare table data
      const tableHeaders = ['Name', 'Contact Person', 'Email', 'Phone', 'Province', 'Role'];
      const tableData = (attorneys || []).map(attorney => [
        attorney.name || '',
        attorney.contact_person || '',
        attorney.email_masked || '',
        attorney.phone_masked || '',
        attorney.province || '',
        attorney.attorney_role || ''
      ]);

      // Add table
      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY,
        ...getStyledTableOptions(),
        margin: { top: startY, left: 14, right: 14 },
      });

      // Add branded footer
      addBrandingFooter(doc);

      // Save the PDF
      doc.save(`attorneys-${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: "Export successful",
        description: `Downloaded PDF list of ${attorneys?.length || 0} attorneys.`,
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message || "Failed to export attorneys list.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Attorney Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h4 className="font-medium">Bulk Upload</h4>
            <p className="text-sm text-muted-foreground">
              Upload Excel or PDF files with attorney data
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".xlsx,.xls,.pdf"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
                id="attorney-upload"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('attorney-upload')?.click()}
                disabled={isUploading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? "Uploading..." : "Upload File"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Download List</h4>
            <p className="text-sm text-muted-foreground">
              Export all attorneys as PDF file
            </p>
            <Button
              variant="outline"
              onClick={handleExportAttorneys}
              disabled={isExporting}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Exporting..." : "Download List"}
            </Button>
          </div>
        </div>

        <div className="mt-4 p-3 bg-muted rounded-md">
          <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            File Format Guidelines
          </h5>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Excel files should have columns: Name, Contact Person, Email, Phone, Province, Attorney Role, Matter Type, Address</li>
            <li>• PDF files will be processed for attorney information extraction</li>
            <li>• Attorney Role: "Plaintiff" or "Defendant"</li>
            <li>• Matter Type: "MVA", "Med Neg", or "Both"</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttorneyBulkUpload;