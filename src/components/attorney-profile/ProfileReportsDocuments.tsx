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
  serviceFee: number;
  depositAmount: number;
}

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' },
  in_progress: { label: 'In Progress', icon: AlertCircle, color: 'text-info', bg: 'bg-info/10', border: 'border-info/20' },
  taken_out: { label: 'Taken Out', icon: FileText, color: 'text-kutlwano-teal', bg: 'bg-kutlwano-teal/10', border: 'border-kutlwano-teal/20' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' }
};

interface ProfileReportsDocumentsProps {
  referringAttorneyId?: string;
  cases?: Array<{ claimant_name: string; expert_type: string; appointment_date: string; report_status: string; service_fee?: number; deposit_amount?: number; }>;
}

const ProfileReportsDocuments: React.FC<ProfileReportsDocumentsProps> = ({ referringAttorneyId, cases: propCases }) => {
  const { toast } = useToast();
  const { liveCases, loading, stats } = useAttorneyDashboardStats();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('reports');
  const [appointmentFees, setAppointmentFees] = useState<Record<string, { service_fee: number; deposit_amount: number }>>({});

  // Fetch service fees from appointments
  useEffect(() => {
    const fetchFees = async () => {
      const { data } = await supabase
        .from('appointments')
        .select('id, service_fee, deposit_amount, claimant_id, claimants(first_name, last_name), medical_experts(expert_type), appointment_date')
        .is('deleted_at', null);
      if (data) {
        const fees: Record<string, { service_fee: number; deposit_amount: number }> = {};
        data.forEach((a: any) => {
          const claimant = Array.isArray(a.claimants) ? a.claimants[0] : a.claimants;
          const name = claimant ? `${claimant.first_name || ''} ${claimant.last_name || ''}`.trim() : '';
          // Key by claimant name + date for matching
          const key = `${name}_${a.appointment_date}`;
          fees[key] = { service_fee: a.service_fee || 0, deposit_amount: a.deposit_amount || 0 };
        });
        setAppointmentFees(fees);
      }
    };
    fetchFees();
  }, []);

  const reports: ReportItem[] = useMemo(() => {
    if (propCases && propCases.length > 0) {
      return propCases.map(c => {
        const normalized = c.report_status?.toLowerCase() || 'pending';
        let status: ReportStatus = 'pending';
        if (normalized === 'completed' || normalized === 'taken_out' || normalized === 'taken out') status = 'completed';
        else if (normalized === 'in_progress' || normalized === 'in progress') status = 'in_progress';
        const key = `${c.claimant_name}_${c.appointment_date}`;
        const fees = appointmentFees[key];
        return {
          claimantName: c.claimant_name,
          expertName: c.expert_type,
          expertType: c.expert_type,
          appointmentDate: c.appointment_date,
          status,
          issueDate: status === 'completed' ? c.appointment_date : undefined,
          serviceFee: c.service_fee ?? fees?.service_fee ?? 0,
          depositAmount: c.deposit_amount ?? fees?.deposit_amount ?? 0,
        };
      });
    }

    return liveCases.map(c => {
      const reportPhase = c.phases.find(p => p.name === 'Report Ready');
      let status: ReportStatus = 'pending';
      if (reportPhase?.status === 'completed') status = 'completed';
      else if (reportPhase?.status === 'in_progress') status = 'in_progress';
      else if (c.phases.some(p => p.status === 'in_progress' || p.status === 'completed')) status = 'in_progress';
      const key = `${c.claimantName}_${c.appointmentDate}`;
      const fees = appointmentFees[key];
      return {
        claimantName: c.claimantName,
        expertName: c.expertType,
        expertType: c.expertType,
        appointmentDate: c.appointmentDate,
        status,
        issueDate: status === 'completed' ? c.appointmentDate : undefined,
        serviceFee: fees?.service_fee ?? 0,
        depositAmount: fees?.deposit_amount ?? 0,
      };
    });
  }, [liveCases, propCases, appointmentFees]);

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

    // Group reports by month
    const grouped: Record<string, ReportItem[]> = {};
    reports.forEach(r => {
      const monthKey = format(new Date(r.appointmentDate), 'MMMM yyyy');
      if (!grouped[monthKey]) grouped[monthKey] = [];
      grouped[monthKey].push(r);
    });

    let startY = 60;

    Object.entries(grouped).forEach(([month, items]) => {
      const monthTotal = items.reduce((sum, r) => sum + r.serviceFee, 0);
      const monthDeposit = items.reduce((sum, r) => sum + r.depositAmount, 0);
      const monthBalance = monthTotal - monthDeposit;

      // Month header
      doc.setFontSize(12);
      doc.setTextColor(31, 182, 206);
      doc.text(month, 14, startY);
      startY += 6;

      const tableData = items.map(r => [
        r.claimantName,
        r.expertType,
        format(new Date(r.appointmentDate), 'dd MMM yyyy'),
        statusConfig[r.status].label,
        `R ${r.serviceFee.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
        `R ${r.depositAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
        `R ${(r.serviceFee - r.depositAmount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      ]);

      // Add month total row
      tableData.push([
        '', '', '', `Total (${month})`,
        `R ${monthTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
        `R ${monthDeposit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
        `R ${monthBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      ]);

      autoTable(doc, {
        ...getStyledTableOptions(),
        head: [['Claimant', 'Expert Type', 'Date', 'Status', 'Fee', 'Deposit', 'Balance']],
        body: tableData,
        startY,
        didParseCell: (data: any) => {
          // Bold the total row
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [220, 240, 245];
          }
        },
      });

      startY = (doc as any).lastAutoTable.finalY + 10;

      // Add new page if needed
      if (startY > 250) {
        doc.addPage();
        startY = 20;
      }
    });

    // Grand total
    const grandTotal = reports.reduce((sum, r) => sum + r.serviceFee, 0);
    const grandDeposit = reports.reduce((sum, r) => sum + r.depositAmount, 0);
    const grandBalance = grandTotal - grandDeposit;

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Grand Total Fee: R ${grandTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 14, startY);
    doc.text(`Total Deposits: R ${grandDeposit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 14, startY + 7);
    doc.text(`Outstanding Balance: R ${grandBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 14, startY + 14);

    addBrandingFooter(doc);
    doc.save('account-statement.pdf');
    toast({ title: 'Statement Downloaded', description: 'Your account statement has been generated.' });
  };

  const generateTaxInvoice = () => {
    const doc = new jsPDF();
    addBrandingToPDF(doc, 'TAX INVOICE');

    let startY = 60;
    const vatRate = 0.15;

    reports.forEach((r, i) => {
      const subtotal = r.serviceFee;
      const vat = subtotal * vatRate;
      const total = subtotal + vat;
      const deposit = r.depositAmount;
      const balance = total - deposit;

      // Check if we need a new page
      if (startY > 230) {
        doc.addPage();
        startY = 20;
      }

      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`Invoice #${String(i + 1).padStart(3, '0')} — ${r.claimantName}`, 14, startY);
      startY += 6;

      autoTable(doc, {
        ...getStyledTableOptions(),
        head: [['Description', 'Amount']],
        body: [
          ['Expert Type', r.expertType],
          ['Assessment Date', format(new Date(r.appointmentDate), 'dd MMM yyyy')],
          ['Consultation Fee (excl. VAT)', `R ${subtotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`],
          ['VAT (15%)', `R ${vat.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`],
          ['Total (incl. VAT)', `R ${total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`],
          ['Deposit Paid', `R ${deposit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`],
          ['Balance Due', `R ${balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`],
        ],
        startY,
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 80 },
          1: { halign: 'right' as const },
        },
        didParseCell: (data: any) => {
          if (data.row.index >= 4) {
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });

      startY = (doc as any).lastAutoTable.finalY + 12;
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
                <TableHead>Fee</TableHead>
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
                    <TableCell className="text-sm font-medium">
                      R {report.serviceFee.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
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
