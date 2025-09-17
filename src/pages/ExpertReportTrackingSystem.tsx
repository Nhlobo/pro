import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Clock, FileText, AlertCircle, CheckCircle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useExpertReportTracking, REPORT_STAGES, ReportStage } from "@/hooks/useExpertReportTracking";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Helmet } from "react-helmet-async";
import CompanyFooter from "@/components/CompanyFooter";

const ExpertReportTrackingSystem = () => {
  const navigate = useNavigate();
  const { reports, loading, error, refetch, updateReportStage } = useExpertReportTracking();
  const { toast } = useToast();
  
  const [selectedExpertType, setSelectedExpertType] = useState("all");
  const [selectedStage, setSelectedStage] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [newStage, setNewStage] = useState<ReportStage>("initial_stage");
  const [stageNotes, setStageNotes] = useState("");

  // Filter reports based on selected filters
  const filteredReports = reports.filter(report => {
    const matchesExpertType = selectedExpertType === "all" || report.expert_type === selectedExpertType;
    const matchesStage = selectedStage === "all" || report.report_stage === selectedStage;
    const matchesSearch = searchTerm === "" || 
      report.claimant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.claimant_auto_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesExpertType && matchesStage && matchesSearch;
  });

  // Get unique expert types for filter
  const expertTypes = Array.from(new Set(reports.map(report => report.expert_type)));

  // Get stage badge styling
  const getStageInfo = (stage: ReportStage) => {
    return REPORT_STAGES.find(s => s.value === stage) || REPORT_STAGES[0];
  };

  const handleStageUpdate = async () => {
    if (!selectedReport) return;

    const success = await updateReportStage(selectedReport, newStage, stageNotes);
    if (success) {
      setUpdateDialogOpen(false);
      setSelectedReport(null);
      setStageNotes("");
      setNewStage("initial_stage");
    }
  };

  const openUpdateDialog = (reportId: string, currentStage: ReportStage) => {
    setSelectedReport(reportId);
    setNewStage(currentStage);
    setStageNotes("");
    setUpdateDialogOpen(true);
  };

  // Calculate summary statistics
  const totalReports = reports.length;
  const stageStats = REPORT_STAGES.map(stage => ({
    stage: stage.label,
    count: reports.filter(report => report.report_stage === stage.value).length,
    color: stage.color
  }));

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading expert report tracking data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Expert Report Tracking System - Medical Expert Platform</title>
        <meta name="description" content="Track and manage expert report progress through different stages of completion" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="hover:bg-muted"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Expert Report Tracking System</h1>
                <p className="text-muted-foreground">Monitor and manage expert report progress through completion stages</p>
              </div>
            </div>
            <Button
              onClick={refetch}
              disabled={loading}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Reports</p>
                    <p className="text-2xl font-bold text-foreground">{totalReports}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {stageStats.slice(0, 4).map((stat, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${stat.color.split(' ')[0]}`} />
                    <div>
                      <p className="text-xs text-muted-foreground truncate">{stat.stage}</p>
                      <p className="text-xl font-bold text-foreground">{stat.count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Filter className="h-5 w-5" />
                <span>Filters & Search</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="search">Search Reports</Label>
                  <Input
                    id="search"
                    placeholder="Search by claimant or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Expert Type</Label>
                  <Select value={selectedExpertType} onValueChange={setSelectedExpertType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select expert type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Expert Types</SelectItem>
                      {expertTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Report Stage</Label>
                  <Select value={selectedStage} onValueChange={setSelectedStage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select report stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages</SelectItem>
                      {REPORT_STAGES.map(stage => (
                        <SelectItem key={stage.value} value={stage.value}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Active Filters Display */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Active filters:</span>
                {selectedExpertType !== "all" && (
                  <Badge variant="secondary">{selectedExpertType}</Badge>
                )}
                {selectedStage !== "all" && (
                  <Badge variant="secondary">
                    {REPORT_STAGES.find(s => s.value === selectedStage)?.label}
                  </Badge>
                )}
                {searchTerm && (
                  <Badge variant="secondary">Search: "{searchTerm}"</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Reports Table */}
          <Card>
            <CardHeader>
              <CardTitle>Expert Reports ({filteredReports.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Claimant</TableHead>
                      <TableHead>Expert Type</TableHead>
                      <TableHead>Assessment Date</TableHead>
                      <TableHead>Current Stage</TableHead>
                      <TableHead>Stage Updated</TableHead>
                      <TableHead>Referring Attorney</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          No reports found matching your filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredReports.map((report) => {
                        const stageInfo = getStageInfo(report.report_stage);
                        return (
                          <TableRow key={report.appointment_id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{report.claimant_name}</div>
                                <div className="text-sm text-muted-foreground">{report.claimant_auto_id}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{report.expert_type}</Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(report.appointment_date), 'MMM dd, yyyy')}
                            </TableCell>
                            <TableCell>
                              <Badge className={stageInfo.color}>
                                {stageInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {report.stage_updated_date 
                                    ? format(new Date(report.stage_updated_date), 'MMM dd, yyyy')
                                    : 'Not updated'
                                  }
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{report.referring_attorney}</div>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openUpdateDialog(report.appointment_id, report.report_stage)}
                              >
                                Update Stage
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Update Stage Dialog */}
          <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Update Report Stage</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>New Report Stage</Label>
                  <Select value={newStage} onValueChange={(value) => setNewStage(value as ReportStage)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORT_STAGES.map(stage => (
                        <SelectItem key={stage.value} value={stage.value}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any notes about this stage update..."
                    value={stageNotes}
                    onChange={(e) => setStageNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleStageUpdate}>
                  Update Stage
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <CompanyFooter />
      </div>
    </>
  );
};

export default ExpertReportTrackingSystem;