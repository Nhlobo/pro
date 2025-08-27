import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Eye, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface SampleReport {
  id: string;
  title: string;
  expertType: string;
  matterType: string;
  description: string;
  pages: number;
  lastUpdated: string;
}

const SampleReports = () => {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SampleReport | null>(null);
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

  const handleAddReport = () => {
    if (!newReport.title || !newReport.expertType || !newReport.matterType || !newReport.description) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    const report: SampleReport = {
      id: (sampleReports.length + 1).toString(),
      ...newReport,
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    setSampleReports([...sampleReports, report]);
    setNewReport({
      title: '',
      expertType: '',
      matterType: '',
      description: '',
      pages: 1
    });
    setIsAddDialogOpen(false);
    
    toast({
      title: "Report Added",
      description: "Sample report has been successfully added."
    });
  };

  const handleDownload = (reportId: string, title: string) => {
    // In a real implementation, this would download the actual sample report
    console.log(`Downloading sample report: ${title}`);
    // Create a simple text file for demo purposes
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
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddReport}>Add Report</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
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
          {sampleReports.map((report) => (
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