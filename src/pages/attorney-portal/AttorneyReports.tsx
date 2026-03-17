import React, { useState, useMemo, useEffect } from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { useAttorneyDashboardStats } from '@/hooks/useAttorneyDashboardStats';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  FileText, Search, Download, Clock, CheckCircle2, AlertCircle,
  Calendar, User, Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type ReportStatus = 'pending' | 'in_progress' | 'taken_out' | 'completed';

interface ReportItem {
  claimantName: string;
  expertName: string;
  expertType: string;
  appointmentDate: string;
  appointmentId: string | null;
  status: ReportStatus;
  caseStatus: string | null;
  issueDate?: string;
  reportVersions: { file_name: string; file_path: string; version_number: number; created_at: string }[];
}

const AttorneyReports: React.FC = () => {
  const { liveCases, loading, stats } = useAttorneyDashboardStats();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [caseStatusDialogOpen, setCaseStatusDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  // Transform cases to reports
  const reports: ReportItem[] = useMemo(() => {
    return liveCases.map(c => {
      const reportPhase = c.phases.find(p => p.name === 'Report Ready');
      let status: ReportStatus = 'pending';
      
      if (reportPhase?.status === 'completed') {
        status = 'completed';
      } else if (reportPhase?.status === 'in_progress') {
        status = 'in_progress';
      } else {
        const anyInProgress = c.phases.some(p => p.status === 'in_progress' || p.status === 'completed');
        if (anyInProgress) {
          status = 'in_progress';
        }
      }

      return {
        claimantName: c.claimantName,
        expertName: c.expertType,
        expertType: c.expertType,
        appointmentDate: c.appointmentDate,
        appointmentId: (c as any).appointmentId || null,
        status,
        caseStatus: (c as any).caseStatus || null,
        issueDate: status === 'completed' ? c.appointmentDate : undefined,
        reportVersions: [],
      };
    });
  }, [liveCases]);

  const filteredReports = useMemo(() => {
    let filtered = reports;
    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.claimantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.expertName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (activeTab !== 'all') {
      filtered = filtered.filter(r => r.status === activeTab);
    }
    return filtered;
  }, [reports, searchTerm, activeTab]);

  const handleDownloadReport = async (report: ReportItem) => {
    if (!report.reportVersions.length) {
      toast({ title: "No Report Available", description: "Report file has not been uploaded yet.", variant: "destructive" });
      return;
    }
    const latestVersion = report.reportVersions[0];
    setDownloading(latestVersion.file_path);
    try {
      const { data, error } = await supabase.storage.from('documents').download(latestVersion.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = latestVersion.file_name;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: `${latestVersion.file_name} downloaded.` });
    } catch (err: any) {
      console.error("Download error:", err);
      toast({ title: "Error", description: "Failed to download report.", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const getCaseStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline" className="text-muted-foreground">Not Set</Badge>;
    const formatted = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const colorMap: Record<string, string> = {
      assessment_scheduled: 'bg-primary/10 text-primary border-primary/20',
      assessment_completed: 'bg-primary/10 text-primary border-primary/20',
      report_in_progress: 'bg-warning/10 text-warning border-warning/20',
      report_submitted: 'bg-success/10 text-success border-success/20',
      report_delivered: 'bg-success/10 text-success border-success/20',
      finalised: 'bg-success/10 text-success border-success/20',
      closed: 'bg-muted text-muted-foreground',
      under_review: 'bg-warning/10 text-warning border-warning/20',
      revision_requested: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    return <Badge className={colorMap[status] || 'bg-muted text-muted-foreground'}>{formatted}</Badge>;
  };

  const statusConfig = {
    pending: { label: 'Pending', icon: Clock, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' },
    in_progress: { label: 'In Progress', icon: AlertCircle, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
    taken_out: { label: 'Taken Out', icon: FileText, color: 'text-kutlwano-teal', bg: 'bg-kutlwano-teal/10', border: 'border-kutlwano-teal/20' },
    completed: { label: 'Completed', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
  };

  const statusCounts = useMemo(() => ({
    all: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
    in_progress: reports.filter(r => r.status === 'in_progress').length,
    taken_out: reports.filter(r => r.status === 'taken_out').length,
    completed: reports.filter(r => r.status === 'completed').length,
  }), [reports]);

  return (
    <AttorneyPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-8 w-8 text-kutlwano-blue" />
              Reports
            </h1>
            <p className="text-muted-foreground mt-1">
              Track, download and view case status for your assessment reports
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(statusConfig).map(([key, config]) => (
            <Card key={key} className="bg-gradient-card border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{config.label}</p>
                    <p className={`text-2xl font-bold ${config.color}`}>
                      {statusCounts[key as keyof typeof statusCounts]}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${config.bg}`}>
                    <config.icon className={`h-6 w-6 ${config.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by claimant or expert..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Reports Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({statusCounts.pending})</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress ({statusCounts.in_progress})</TabsTrigger>
            <TabsTrigger value="taken_out">Taken Out ({statusCounts.taken_out})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({statusCounts.completed})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="pt-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : filteredReports.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No reports found</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Claimant</TableHead>
                          <TableHead>Expert</TableHead>
                          <TableHead>Assessment Date</TableHead>
                          <TableHead>Report Status</TableHead>
                          <TableHead>Case Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredReports.map((report, index) => {
                          const config = statusConfig[report.status];
                          return (
                            <TableRow key={index}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{report.claimantName}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{report.expertName}</p>
                                  <p className="text-sm text-muted-foreground">{report.expertType}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  {format(new Date(report.appointmentDate), 'dd MMM yyyy')}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={`${config.bg} ${config.color} ${config.border}`}>
                                  <config.icon className="h-3 w-3 mr-1" />
                                  {config.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {getCaseStatusBadge(report.caseStatus)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setSelectedReport(report); setCaseStatusDialogOpen(true); }}
                                    title="View case status"
                                  >
                                    <Activity className="h-4 w-4" />
                                  </Button>
                                  {report.status === 'completed' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDownloadReport(report)}
                                      disabled={downloading === report.reportVersions?.[0]?.file_path}
                                    >
                                      <Download className="h-4 w-4 mr-1" />
                                      Download
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Case Status Dialog */}
        <Dialog open={caseStatusDialogOpen} onOpenChange={setCaseStatusDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Case Status
              </DialogTitle>
              <DialogDescription>
                {selectedReport?.claimantName} — {selectedReport?.expertName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Case Status:</span>
                  {getCaseStatusBadge(selectedReport?.caseStatus || null)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Report Status:</span>
                  <span className="text-sm capitalize">{selectedReport?.status?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Expert Type:</span>
                  <span className="text-sm">{selectedReport?.expertType}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Assessment Date:</span>
                  <span className="text-sm">{selectedReport?.appointmentDate ? format(new Date(selectedReport.appointmentDate), 'dd MMM yyyy') : '—'}</span>
                </div>
                {selectedReport?.issueDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Issue Date:</span>
                    <span className="text-sm">{format(new Date(selectedReport.issueDate), 'dd MMM yyyy')}</span>
                  </div>
                )}
              </div>
              {selectedReport?.status === 'completed' && selectedReport.reportVersions.length > 0 && (
                <Button className="w-full" onClick={() => selectedReport && handleDownloadReport(selectedReport)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Report
                </Button>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCaseStatusDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AttorneyPortalLayout>
  );
};

export default AttorneyReports;
