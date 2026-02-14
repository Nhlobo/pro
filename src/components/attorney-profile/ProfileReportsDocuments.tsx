import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAttorneyDashboardStats } from '@/hooks/useAttorneyDashboardStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText, Search, Download, Clock, CheckCircle2, AlertCircle,
  Calendar, User, Eye, Receipt, FileSpreadsheet
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from '@/utils/pdfBranding';

type ReportStatus = 'pending' | 'in_progress' | 'taken_out' | 'completed';

interface ReportItem {
  claimantName: string;
  expertName: string;
  expertType: string;
  appointmentDate: string;
  status: ReportStatus;
  issueDate?: string;
}

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' },
  in_progress: { label: 'In Progress', icon: AlertCircle, color: 'text-info', bg: 'bg-info/10', border: 'border-info/20' },
  taken_out: { label: 'Taken Out', icon: FileText, color: 'text-kutlwano-teal', bg: 'bg-kutlwano-teal/10', border: 'border-kutlwano-teal/20' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' }
};

const ProfileReportsDocuments: React.FC = () => {
  const { toast } = useToast();
  const { liveCases, loading, stats } = useAttorneyDashboardStats();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('reports');

  const reports: ReportItem[] = useMemo(() => {
    return liveCases.map(c => {
      const reportPhase = c.phases.find(p => p.name === 'Report Ready');
      let status: ReportStatus = 'pending';
      if (reportPhase?.status === 'completed') status = 'completed';
      else if (reportPhase?.status === 'in_progress') status = 'in_progress';
      else if (c.phases.some(p => p.status === 'in_progress' || p.status === 'completed')) status = 'in_progress';

      return {
        claimantName: c.claimantName,
        expertName: c.expertType,
        expertType: c.expertType,
        appointmentDate: c.appointmentDate,
        status,
        issueDate: status === 'completed' ? c.appointmentDate : undefined
      };
    });
  }, [liveCases]);

  const filteredReports = useMemo(() => {
    if (!searchTerm) return reports;
    return reports.filter(r =>
      r.claimantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.expertName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [reports, searchTerm]);

  const statusCounts = useMemo(() => ({
    all: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
    in_progress: reports.filter(r => r.status === 'in_progress').length,
    completed: reports.filter(r => r.status === 'completed').length
  }), [reports]);

  const generateStatement = () => {
    const doc = new jsPDF();
    addBrandingToPDF(doc, 'ACCOUNT STATEMENT');

    const tableData = reports.map(r => [
      r.claimantName,
      r.expertType,
      format(new Date(r.appointmentDate), 'dd MMM yyyy'),
      statusConfig[r.status].label
    ]);

    autoTable(doc, {
      ...getStyledTableOptions(),
      head: [['Claimant', 'Expert Type', 'Assessment Date', 'Report Status']],
      body: tableData,
      startY: 60,
    });

    addBrandingFooter(doc);
    doc.save('account-statement.pdf');
    toast({ title: 'Statement Downloaded', description: 'Your account statement has been generated.' });
  };

  const generateTaxInvoice = () => {
    const doc = new jsPDF();
    addBrandingToPDF(doc, 'TAX INVOICE');

    const completedReports = reports.filter(r => r.status === 'completed');
    const tableData = completedReports.map((r, i) => [
      String(i + 1),
      r.claimantName,
      r.expertType,
      format(new Date(r.appointmentDate), 'dd MMM yyyy'),
      'R0.00'
    ]);

    autoTable(doc, {
      ...getStyledTableOptions(),
      head: [['#', 'Claimant', 'Service', 'Date', 'Amount']],
      body: tableData,
      startY: 60,
    });

    addBrandingFooter(doc);
    doc.save('tax-invoice.pdf');
    toast({ title: 'Tax Invoice Downloaded', description: 'Your tax invoice has been generated.' });
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(statusConfig).map(([key, config]) => (
          <Card key={key} className="bg-gradient-card border-border/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{config.label}</p>
                  <p className={`text-xl font-bold ${config.color}`}>
                    {statusCounts[key as keyof typeof statusCounts] || 0}
                  </p>
                </div>
                <config.icon className={`h-5 w-5 ${config.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={generateStatement}>
          <Receipt className="h-4 w-4 mr-2" /> View Statement
        </Button>
        <Button variant="outline" size="sm" onClick={generateTaxInvoice}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> View Tax Invoice
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by claimant or expert..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Reports Table */}
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
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claimant</TableHead>
                <TableHead>Expert</TableHead>
                <TableHead>Assessment Date</TableHead>
                <TableHead>Status</TableHead>
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
                        <span className="font-medium text-sm">{report.claimantName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{report.expertType}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(report.appointmentDate), 'dd MMM yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${config.bg} ${config.color} ${config.border}`}>
                        <config.icon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {report.status === 'completed' && (
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-1" /> Download
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </div>
  );
};

export default ProfileReportsDocuments;
