import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  // Sample reports data with all expert types and matter types
  const sampleReports: SampleReport[] = [
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
  ];

  const expertTypes = ['Neurosurgeon', 'Psychiatrist', 'Orthopaedic Surgeon', 'Clinical Psychologist', 'Neurologist'];
  const matterTypes = ['MVA', 'Med Neg'];

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
    // In a real implementation, this would open a preview modal or new tab
    console.log(`Previewing sample report: ${title}`);
    alert(`Preview functionality would open: ${title}`);
  };

  return (
    <>
      <Helmet>
        <title>Sample Reports - KAM Medico Legal</title>
        <meta name="description" content="Access sample medical expert reports for various specialties and matter types" />
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Sample Reports</h1>
          <p className="text-muted-foreground">
            Access sample medical expert reports for reference and understanding of report formats across different specialties and matter types.
          </p>
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