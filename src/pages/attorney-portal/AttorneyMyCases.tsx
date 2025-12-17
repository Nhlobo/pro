import React, { useState, useMemo } from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { useAttorneyDashboardStats } from '@/hooks/useAttorneyDashboardStats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Briefcase,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Calendar,
  User,
  Eye
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

const AttorneyMyCases: React.FC = () => {
  const { liveCases, loading, refetchStats } = useAttorneyDashboardStats();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [caseTypeFilter, setCaseTypeFilter] = useState<string>('all');

  // Calculate prescription risk (3 years from incident)
  const calculatePrescriptionRisk = (appointmentDate: string): { status: string; daysLeft: number } => {
    const threeYearsFromNow = new Date();
    threeYearsFromNow.setFullYear(threeYearsFromNow.getFullYear() + 3);
    const appointmentDateObj = new Date(appointmentDate);
    const daysLeft = differenceInDays(threeYearsFromNow, appointmentDateObj);
    
    if (daysLeft < 90) return { status: 'critical', daysLeft };
    if (daysLeft < 180) return { status: 'warning', daysLeft };
    return { status: 'safe', daysLeft };
  };

  const getOverallStatus = (phases: any[]) => {
    if (phases.every(p => p.status === 'completed')) return 'Completed';
    if (phases.some(p => p.status === 'in_progress')) return 'In Progress';
    return 'Pending';
  };

  const filteredCases = useMemo(() => {
    return liveCases.filter(caseItem => {
      const matchesSearch = 
        caseItem.claimantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        caseItem.expertType.toLowerCase().includes(searchTerm.toLowerCase());
      
      const status = getOverallStatus(caseItem.phases);
      const matchesStatus = statusFilter === 'all' || status.toLowerCase() === statusFilter.toLowerCase();
      
      // Case type filter would need actual case type data
      const matchesCaseType = caseTypeFilter === 'all' || true;
      
      return matchesSearch && matchesStatus && matchesCaseType;
    });
  }, [liveCases, searchTerm, statusFilter, caseTypeFilter]);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>;
      case 'In Progress':
        return <Badge className="bg-info/10 text-info border-info/20">In Progress</Badge>;
      default:
        return <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
    }
  };

  const prescriptionBadge = (risk: { status: string; daysLeft: number }) => {
    if (risk.status === 'critical') {
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {risk.daysLeft} days
        </Badge>
      );
    }
    if (risk.status === 'warning') {
      return (
        <Badge className="bg-warning/10 text-warning border-warning/20 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {risk.daysLeft} days
        </Badge>
      );
    }
    return (
      <Badge className="bg-success/10 text-success border-success/20 flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Safe
      </Badge>
    );
  };

  return (
    <AttorneyPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Briefcase className="h-8 w-8 text-kutlwano-blue" />
              My Cases
            </h1>
            <p className="text-muted-foreground mt-1">
              View and track all your referred cases
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-base px-4 py-2">
              {filteredCases.length} Cases
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by claimant or expert name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={caseTypeFilter} onValueChange={setCaseTypeFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Case Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="raf">RAF</SelectItem>
                  <SelectItem value="slip-fall">Slip & Fall</SelectItem>
                  <SelectItem value="unlawful-arrest">Unlawful Arrest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Cases Table */}
        <Card className="bg-gradient-card border-border/50 shadow-soft">
          <CardHeader>
            <CardTitle>Case List</CardTitle>
            <CardDescription>All your referred cases with status and progress tracking</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No cases found matching your criteria</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Claimant</TableHead>
                      <TableHead>Expert</TableHead>
                      <TableHead>Appointment Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Report Status</TableHead>
                      <TableHead>Prescription Risk</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCases.map((caseItem, index) => {
                      const overallStatus = getOverallStatus(caseItem.phases);
                      const prescriptionRisk = calculatePrescriptionRisk(caseItem.appointmentDate);
                      const reportPhase = caseItem.phases.find(p => p.name === 'Report Ready');
                      
                      return (
                        <TableRow key={index} className="hover:bg-muted/50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-kutlwano-blue/10 flex items-center justify-center">
                                <User className="h-4 w-4 text-kutlwano-blue" />
                              </div>
                              <span className="font-medium">{caseItem.claimantName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium">{caseItem.expertType}</p>
                              <p className="text-muted-foreground">Medical Expert</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(caseItem.appointmentDate), 'dd MMM yyyy')}
                            </div>
                          </TableCell>
                          <TableCell>{statusBadge(overallStatus)}</TableCell>
                          <TableCell>
                            {reportPhase?.status === 'completed' ? (
                              <Badge className="bg-success/10 text-success border-success/20">
                                <FileText className="h-3 w-3 mr-1" />
                                Ready
                              </Badge>
                            ) : reportPhase?.status === 'in_progress' ? (
                              <Badge className="bg-info/10 text-info border-info/20">
                                <Clock className="h-3 w-3 mr-1" />
                                In Progress
                              </Badge>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>{prescriptionBadge(prescriptionRisk)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
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
      </div>
    </AttorneyPortalLayout>
  );
};

export default AttorneyMyCases;
