import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Eye, Plus, Upload, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SampleReport {
  id: string;
  title: string;
  expertType: string;
  matterType: string;
  description: string;
  pages: number;
  lastUpdated: string;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
}

const SampleReports = () => {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SampleReport | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newReport, setNewReport] = useState({
    title: '',
    expertType: '',
    matterType: '',
    description: '',
    pages: 1
  });

  // Sample reports data with all expert types and matter types
  const [sampleReports, setSampleReports] = useState<SampleReport[]>([
    {
      id: '1',
      title: 'Neurological Assessment Report',
      expertType: 'Neurosurgeon',
      matterType: 'MVA',
      description: 'Comprehensive neurological assessment following motor vehicle accident with detailed cognitive and physical evaluations.',
      pages: 12,
      lastUpdated: '2024-01-15'
    },
    {
      id: '2',
      title: 'Psychiatric Evaluation Report',
      expertType: 'Psychiatrist',
      matterType: 'Med Neg',
      description: 'Detailed psychiatric evaluation report for medical negligence case including psychological impact assessment.',
      pages: 8,
      lastUpdated: '2024-01-10'
    },
    {
      id: '3',
      title: 'Orthopaedic Assessment Report',
      expertType: 'Orthopaedic Surgeon',
      matterType: 'MVA',
      description: 'Complete orthopaedic examination report with range of motion testing and surgical recommendations.',
      pages: 15,
      lastUpdated: '2024-01-12'
    },
    {
      id: '4',
      title: 'Clinical Psychology Report',
      expertType: 'Clinical Psychologist',
      matterType: 'MVA',
      description: 'Psychological assessment report including cognitive testing and emotional impact evaluation.',
      pages: 10,
      lastUpdated: '2024-01-08'
    },
    {
      id: '5',
      title: 'Neurological Consultation Report',
      expertType: 'Neurologist',
      matterType: 'Med Neg',
      description: 'Neurological consultation report for medical negligence case with EEG and imaging analysis.',
      pages: 9,
      lastUpdated: '2024-01-05'
    },
    {
      id: '6',
      title: 'Psychiatric Medical Negligence Assessment',
      expertType: 'Psychiatrist',
      matterType: 'Med Neg',
      description: 'Specialized psychiatric report addressing medical negligence claims and treatment complications.',
      pages: 11,
      lastUpdated: '2024-01-18'
   }
  ]);

  const expertTypes = ['Neurosurgeon', 'Psychiatrist', 'Orthopaedic Surgeon', 'Clinical Psychologist', 'Neurologist', 'Rheumatologist', 'Cardiologist', 'Pulmonologist', 'Gastroenterologist', 'Endocrinologist'];
  const matterTypes = ['MVA', 'Med Neg'];

  // Filter reports based on search term
  const filteredReports = useMemo(() => {
    if (!searchTerm.trim()) {
      return sampleReports;
    }
    
    const lowercaseSearch = searchTerm.toLowerCase();
    return sampleReports.filter(report =>
      report.title.toLowerCase().includes(lowercaseSearch) ||
      report.expertType.toLowerCase().includes(lowercaseSearch) ||
      report.matterType.toLowerCase().includes(lowercaseSearch) ||
      report.description.toLowerCase().includes(lowercaseSearch)
    );
  }, [sampleReports, searchTerm]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type (PDF preferred for reports)
      if (file.type !== 'application/pdf' && !file.type.startsWith('image/') && !file.type.includes('document')) {
        toast({
          title: "Invalid File Type",
          description: "Please select a PDF, document, or image file.",
          variant: "destructive"
        });
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select a file smaller than 10MB.",
          variant: "destructive"
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const uploadFile = async (file: File): Promise<{ path: string; fileName: string } | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `sample-reports/${fileName}`;

      const { error } = await supabase.storage
        .from('sample-reports')
        .upload(filePath, file);

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      return { path: filePath, fileName: file.name };
    } catch (error) {
      console.error('File upload failed:', error);
      return null;
    }
  };

  const handleAddReport = async () => {
    if (!newReport.title || !newReport.expertType || !newReport.matterType || !newReport.description) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedFile) {
      toast({
        title: "Missing File",
        description: "Please select a report file to upload.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      const uploadResult = await uploadFile(selectedFile);
      
      if (!uploadResult) {
        toast({
          title: "Upload Failed",
          description: "Failed to upload the report file. Please try again.",
          variant: "destructive"
        });
        return;
      }

      const report: SampleReport = {
        id: (sampleReports.length + 1).toString(),
        ...newReport,
        lastUpdated: new Date().toISOString().split('T')[0],
        fileName: uploadResult.fileName,
        filePath: uploadResult.path,
        fileSize: selectedFile.size
      };

      setSampleReports([...sampleReports, report]);
      setNewReport({
        title: '',
        expertType: '',
        matterType: '',
        description: '',
        pages: 1
      });
      setSelectedFile(null);
      setIsAddDialogOpen(false);
      
      toast({
        title: "Report Added",
        description: "Sample report has been successfully uploaded and added."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while adding the report. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (reportId: string, title: string) => {
    const report = sampleReports.find(r => r.id === reportId);
    
    if (report?.filePath) {
      try {
        const { data, error } = await supabase.storage
          .from('sample-reports')
          .download(report.filePath);

        if (error) {
          toast({
            title: "Download Failed",
            description: "Could not download the report file.",
            variant: "destructive"
          });
          return;
        }

        // Create download link
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = report.fileName || `${title.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Download Started",
          description: "The report file is being downloaded."
        });
      } catch (error) {
        console.error('Download error:', error);
        toast({
          title: "Download Failed",
          description: "An error occurred while downloading the file.",
          variant: "destructive"
        });
      }
    } else {
      // Fallback for demo reports without files
      const content = `Sample Report: ${title}\n\nThis is a sample report template for ${reportId}`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}_Sample.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handlePreview = (reportId: string, title: string) => {
    const report = sampleReports.find(r => r.id === reportId);
    if (report) {
      setSelectedReport(report);
      setIsPreviewOpen(true);
    }
  };

  return (
    <>
      <Helmet>
        <title>Sample Reports - KAM Medico Legal</title>
        <meta name="description" content="Access sample medical expert reports for various specialties and matter types" />
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Sample Reports</h1>
              <p className="text-muted-foreground">
                Access sample medical expert reports for reference and understanding of report formats across different specialties and matter types.
              </p>
            </div>
            
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Report
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                  <DialogTitle>Add New Sample Report</DialogTitle>
                  <DialogDescription>
                    Add a new sample report to the library for reference purposes.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Report Title</Label>
                    <Input
                      id="title"
                      value={newReport.title}
                      onChange={(e) => setNewReport({ ...newReport, title: e.target.value })}
                      placeholder="Enter report title"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="expertType">Expert Type</Label>
                      <Select value={newReport.expertType} onValueChange={(value) => setNewReport({ ...newReport, expertType: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select expert type" />
                        </SelectTrigger>
                        <SelectContent>
                          {expertTypes.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="matterType">Matter Type</Label>
                      <Select value={newReport.matterType} onValueChange={(value) => setNewReport({ ...newReport, matterType: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select matter type" />
                        </SelectTrigger>
                        <SelectContent>
                          {matterTypes.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="reportFile">Report File *</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="reportFile"
                        type="file"
                        onChange={handleFileSelect}
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        className="file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:font-medium file:bg-muted file:text-muted-foreground hover:file:bg-muted/80"
                      />
                      {selectedFile && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Upload className="h-3 w-3" />
                          {selectedFile.name}
                        </div>
                      )}
                    </div>
                    {selectedFile && (
                      <p className="text-xs text-muted-foreground">
                        Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pages">Number of Pages</Label>
                    <Input
                      id="pages"
                      type="number"
                      min="1"
                      value={newReport.pages}
                      onChange={(e) => setNewReport({ ...newReport, pages: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newReport.description}
                      onChange={(e) => setNewReport({ ...newReport, description: e.target.value })}
                      placeholder="Enter report description"
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setIsAddDialogOpen(false);
                    setSelectedFile(null);
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddReport} disabled={uploading}>
                    {uploading ? 'Uploading...' : 'Add Report'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search Filter */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reports by title, expert type, matter type, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {searchTerm && (
            <p className="text-sm text-muted-foreground mt-2">
              Showing {filteredReports.length} of {sampleReports.length} reports
            </p>
          )}
        </div>

        {/* Filter Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Available Report Types</CardTitle>
            <CardDescription>
              Sample reports are available for the following expert types and matter types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Expert Types:</h4>
                <div className="flex flex-wrap gap-2">
                  {expertTypes.map((type) => (
                    <Badge key={type} variant="outline" className="bg-primary/5">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Matter Types:</h4>
                <div className="flex flex-wrap gap-2">
                  {matterTypes.map((type) => (
                    <Badge key={type} variant="outline" className="bg-secondary/50">
                      {type === 'MVA' ? 'Motor Vehicle Accident' : 'Medical Negligence'} ({type})
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sample Reports Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredReports.map((report) => (
            <Card key={report.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <FileText className="h-6 w-6 text-primary mb-2" />
                  <div className="flex gap-1">
                    <Badge variant="outline" className="text-xs">
                      {report.expertType}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {report.matterType}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-lg leading-tight">{report.title}</CardTitle>
                <CardDescription className="text-sm">
                  {report.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{report.pages} pages</span>
                    <span>Updated: {report.lastUpdated}</span>
                  </div>
                  
                  {report.fileName && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      <FileText className="h-3 w-3" />
                      <span className="truncate">{report.fileName}</span>
                      {report.fileSize && (
                        <span>({(report.fileSize / 1024 / 1024).toFixed(2)} MB)</span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePreview(report.id, report.title)}
                      className="flex-1"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Preview
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleDownload(report.id, report.title)}
                      className="flex-1"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Preview Dialog */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {selectedReport?.title}
              </DialogTitle>
              <DialogDescription>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{selectedReport?.expertType}</Badge>
                  <Badge variant="secondary">{selectedReport?.matterType}</Badge>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <div className="bg-muted p-4 rounded-md">
                <h4 className="font-medium mb-2">Report Summary</h4>
                <p className="text-sm text-muted-foreground mb-4">{selectedReport?.description}</p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">Expert Type:</span>
                    <span>{selectedReport?.expertType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Matter Type:</span>
                    <span>{selectedReport?.matterType === 'MVA' ? 'Motor Vehicle Accident' : 'Medical Negligence'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Pages:</span>
                    <span>{selectedReport?.pages}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Last Updated:</span>
                    <span>{selectedReport?.lastUpdated}</span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-background rounded border">
                  <h5 className="font-medium text-sm mb-2">Sample Content Preview:</h5>
                  <div className="text-xs text-muted-foreground space-y-2">
                    <p><strong>CONFIDENTIAL MEDICAL REPORT</strong></p>
                    <p>Patient: [Anonymized]</p>
                    <p>Date of Examination: [Sample Date]</p>
                    <p>Referring Attorney: [Sample Attorney]</p>
                    <br />
                    <p><strong>SUMMARY OF FINDINGS:</strong></p>
                    <p>This {selectedReport?.expertType.toLowerCase()} assessment was conducted following a {selectedReport?.matterType === 'MVA' ? 'motor vehicle accident' : 'medical negligence incident'}...</p>
                    <p>[Additional content would continue here in the actual report]</p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button 
                variant="outline" 
                onClick={() => selectedReport && handleDownload(selectedReport.id, selectedReport.title)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Sample
              </Button>
              <Button onClick={() => setIsPreviewOpen(false)}>
                Close Preview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Note */}
        <Card className="mt-8 border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> These are sample reports for reference purposes only. 
              Actual reports will vary based on individual case circumstances and expert findings. 
              All sample reports are anonymized and do not contain real patient information.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default SampleReports;