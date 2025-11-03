import { FileText, Clock, DollarSign, CheckCircle, Download, Calendar, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAttorneyDebts } from '@/hooks/useAttorneyDebts';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Helmet } from 'react-helmet-async';

const ReferringAttorneyDebts = () => {
  const navigate = useNavigate();
  const { debtSummary, debtCases, loading } = useAttorneyDebts();

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'report fully paid & submitted':
      case 'taken_out':
        return 'default';
      case 'in_progress':
      case 'under_review':
        return 'secondary';
      case 'pending':
      case 'not_received':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  const downloadPDFSummary = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('Referring Attorney Debts Summary', 14, 20);
    
    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 30);
    
    // Summary Section
    doc.setFontSize(14);
    doc.text('Summary Overview', 14, 45);
    
    const summaryData = [
      ['Total Reports Issued', debtSummary.total_reports_issued.toString()],
      ['Pending Reports', debtSummary.pending_reports.toString()],
      ['Assessments Completed', debtSummary.assessments_completed.toString()],
      ['Average Pending Time', `${debtSummary.average_pending_days} days`],
      ['Total Outstanding Debt', formatCurrency(debtSummary.total_owed)],
    ];
    
    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    // Cases Table
    doc.setFontSize(14);
    const finalY = (doc as any).lastAutoTable.finalY || 100;
    doc.text('Detailed Cases', 14, finalY + 15);
    
    const casesData = debtCases.map(c => [
      c.claimant_auto_id,
      c.claimant_name,
      c.expert_name,
      c.report_status,
      format(new Date(c.appointment_date), 'PP'),
      c.days_pending.toString(),
      formatCurrency(c.amount_due),
    ]);
    
    autoTable(doc, {
      startY: finalY + 20,
      head: [['Claimant ID', 'Claimant Name', 'Expert', 'Status', 'Date', 'Days Pending', 'Amount Due']],
      body: casesData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
    });
    
    doc.save(`attorney-debts-summary-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Referring Attorney Debts Management - Case Management</title>
        <meta name="description" content="View and manage outstanding debts, pending reports, and assessment summaries for referring attorneys" />
      </Helmet>

      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Referring Attorney Debts Management</h1>
              <p className="text-muted-foreground mt-2">
                Track reports, assessments, and balances from scheduled appointments
              </p>
            </div>
          </div>
          <Button onClick={downloadPDFSummary} className="gap-2">
            <Download className="h-4 w-4" />
            Download Summary
          </Button>
        </div>

        {/* Summary Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reports Issued</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{debtSummary.total_reports_issued}</div>
              <p className="text-xs text-muted-foreground">Completed & delivered</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reports</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{debtSummary.pending_reports}</div>
              <p className="text-xs text-muted-foreground">Awaiting completion</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assessments Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{debtSummary.assessments_completed}</div>
              <p className="text-xs text-muted-foreground">Total completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Pending Time</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{debtSummary.average_pending_days}</div>
              <p className="text-xs text-muted-foreground">Days average</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Owed</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(debtSummary.total_owed)}</div>
              <p className="text-xs text-muted-foreground">Outstanding balance</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Cases Table */}
        <Card>
          <CardHeader>
            <CardTitle>Individual Case Details</CardTitle>
            <CardDescription>
              Detailed breakdown of all cases with report status and pending durations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claimant ID</TableHead>
                    <TableHead>Claimant Name</TableHead>
                    <TableHead>Expert</TableHead>
                    <TableHead>Report Status</TableHead>
                    <TableHead>Date Issued</TableHead>
                    <TableHead>Days Pending</TableHead>
                    <TableHead>Case Status</TableHead>
                    <TableHead className="text-right">Amount Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtCases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No cases found
                      </TableCell>
                    </TableRow>
                  ) : (
                    debtCases.map((debtCase) => (
                      <TableRow key={debtCase.id}>
                        <TableCell className="font-medium">{debtCase.claimant_auto_id}</TableCell>
                        <TableCell>{debtCase.claimant_name}</TableCell>
                        <TableCell>{debtCase.expert_name}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(debtCase.report_status)}>
                            {debtCase.report_status}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(debtCase.appointment_date), 'PP')}</TableCell>
                        <TableCell>
                          <span className={debtCase.days_pending > 45 ? 'text-destructive font-semibold' : ''}>
                            {debtCase.days_pending} days
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{debtCase.case_status}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(debtCase.amount_due)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ReferringAttorneyDebts;
