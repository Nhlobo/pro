import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Shield, KeyRound, ArrowLeft, Briefcase, Calendar, FileText,
  CreditCard, Clock, AlertCircle, CheckCircle2, XCircle, Loader2,
  Building2, Bell, CalendarPlus, User, Mail, Phone
} from 'lucide-react';
import { format } from 'date-fns';
import ProfileNotifications from '@/components/attorney-profile/ProfileNotifications';
import ProfileAODPayments from '@/components/attorney-profile/ProfileAODPayments';
import ProfileReportsDocuments from '@/components/attorney-profile/ProfileReportsDocuments';
import ProfileRequestAppointment from '@/components/attorney-profile/ProfileRequestAppointment';
import ProfileCaseDocuments from '@/components/attorney-profile/ProfileCaseDocuments';

interface CaseData {
  id: string;
  claimant_name: string;
  appointment_date: string;
  case_status: string;
  payment_status: string;
  matter_type: string;
  expert_name: string;
  expert_type: string;
  report_status: string;
  report_submitted_date: string | null;
}

interface AttorneyInfo {
  id: string;
  name: string;
  code: string;
  contact_person: string;
}

interface AccessResponse {
  attorney: AttorneyInfo;
  cases: CaseData[];
  total_cases: number;
  message?: string;
}

const getStatusBadge = (status: string, type: 'case' | 'payment' | 'report') => {
  const normalized = status?.toLowerCase() || 'pending';

  if (type === 'case') {
    if (normalized === 'completed' || normalized === 'done') return <Badge className="bg-emerald-600 text-white">{status}</Badge>;
    if (normalized === 'in_progress' || normalized === 'in progress') return <Badge className="bg-amber-500 text-white">{status}</Badge>;
    if (normalized === 'cancelled') return <Badge variant="destructive">{status}</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  }

  if (type === 'payment') {
    if (normalized === 'paid') return <Badge className="bg-emerald-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />{status}</Badge>;
    if (normalized === 'partial') return <Badge className="bg-amber-500 text-white">{status}</Badge>;
    if (normalized === 'overdue') return <Badge variant="destructive">{status}</Badge>;
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
  }

  if (type === 'report') {
    if (normalized === 'completed' || normalized === 'taken_out' || normalized === 'taken out') return <Badge className="bg-emerald-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />{status}</Badge>;
    if (normalized === 'in_progress' || normalized === 'in progress') return <Badge className="bg-amber-500 text-white">{status}</Badge>;
    if (normalized === 'overdue') return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{status}</Badge>;
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
  }

  return <Badge variant="secondary">{status}</Badge>;
};

const CaseAccess: React.FC = () => {
  const [accessCode, setAccessCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [accessData, setAccessData] = useState<AccessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleValidateCode = async () => {
    if (!accessCode.trim()) {
      toast.error('Please enter your access code');
      return;
    }

    setIsValidating(true);
    setError(null);
    setAccessData(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('validate-access-code', {
        body: { access_code: accessCode.trim() },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to validate access code');
      }

      if (data?.error) {
        setError(data.error);
        toast.error(data.error);
        return;
      }

      setAccessData(data);
      toast.success(`Access granted — ${data.total_cases} case(s) found`);
    } catch (err: any) {
      const msg = err.message || 'Failed to validate access code';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsValidating(false);
    }
  };

  const handleReset = () => {
    setAccessCode('');
    setAccessData(null);
    setError(null);
  };

  return (
    <>
      <Helmet>
        <title>Case Access - Kutlwano & Associate</title>
        <meta name="description" content="Access your case status using your secure access code" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-teal-50/20">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-border/40 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Kutlwano & Associate</h1>
                <p className="text-xs text-muted-foreground">Medico-Legal Services</p>
              </div>
            </div>
            {accessData && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                New Code
              </Button>
            )}
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">
          {/* Code Entry View */}
          {!accessData && (
            <div className="flex items-center justify-center min-h-[60vh]">
              <Card className="w-full max-w-md shadow-xl border-border/30">
                <CardHeader className="text-center space-y-3">
                  <div className="mx-auto p-4 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10">
                    <KeyRound className="h-10 w-10 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Case Access Portal</CardTitle>
                  <CardDescription className="text-base">
                    Enter your secure access code to view your case status. The code was sent to you via email when your appointment was confirmed.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Input
                      placeholder="Enter your 12-character access code"
                      value={accessCode}
                      onChange={(e) => {
                        setAccessCode(e.target.value);
                        setError(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleValidateCode()}
                      className="text-center text-lg tracking-widest font-mono h-12"
                      maxLength={12}
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    onClick={handleValidateCode}
                    disabled={isValidating || accessCode.trim().length === 0}
                    className="w-full h-11 text-base"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        Access My Cases
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Your access code remains active until your case is paid in full and the report has been delivered.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Full Dashboard View */}
          {accessData && (
            <div className="space-y-6">
              {/* Attorney Header */}
              <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
                <CardContent className="py-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-foreground">{accessData.attorney.name}</h2>
                        <p className="text-sm text-muted-foreground">
                          Code: {accessData.attorney.code}
                          {accessData.attorney.contact_person && ` • ${accessData.attorney.contact_person}`}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      {accessData.total_cases} Case{accessData.total_cases !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Tabbed Dashboard */}
              <Tabs defaultValue="cases" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto gap-1">
                  <TabsTrigger value="cases" className="flex items-center gap-1 text-xs sm:text-sm">
                    <Building2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Cases</span>
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="flex items-center gap-1 text-xs sm:text-sm">
                    <Bell className="h-4 w-4" />
                    <span className="hidden sm:inline">Notifications</span>
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="flex items-center gap-1 text-xs sm:text-sm">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Reports</span>
                  </TabsTrigger>
                  <TabsTrigger value="aod-payments" className="flex items-center gap-1 text-xs sm:text-sm">
                    <CreditCard className="h-4 w-4" />
                    <span className="hidden sm:inline">AOD & Payments</span>
                  </TabsTrigger>
                  <TabsTrigger value="request" className="flex items-center gap-1 text-xs sm:text-sm">
                    <CalendarPlus className="h-4 w-4" />
                    <span className="hidden sm:inline">Request</span>
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="flex items-center gap-1 text-xs sm:text-sm">
                    <Briefcase className="h-4 w-4" />
                    <span className="hidden sm:inline">Documents</span>
                  </TabsTrigger>
                </TabsList>

                {/* Cases Tab */}
                <TabsContent value="cases">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card>
                      <CardContent className="py-4 text-center">
                        <Calendar className="h-5 w-5 text-primary mx-auto mb-1" />
                        <p className="text-2xl font-bold">{accessData.total_cases}</p>
                        <p className="text-xs text-muted-foreground">Total Cases</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4 text-center">
                        <CreditCard className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                        <p className="text-2xl font-bold">
                          {accessData.cases.filter((c) => c.payment_status?.toLowerCase() === 'paid').length}
                        </p>
                        <p className="text-xs text-muted-foreground">Paid</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4 text-center">
                        <FileText className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                        <p className="text-2xl font-bold">
                          {accessData.cases.filter((c) => ['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase())).length}
                        </p>
                        <p className="text-xs text-muted-foreground">Reports Delivered</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4 text-center">
                        <Clock className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                        <p className="text-2xl font-bold">
                          {accessData.cases.filter((c) => c.payment_status?.toLowerCase() !== 'paid').length}
                        </p>
                        <p className="text-xs text-muted-foreground">Pending Payment</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Cases Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Case Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {accessData.cases.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No cases found.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Claimant</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Matter Type</TableHead>
                                <TableHead>Case Status</TableHead>
                                <TableHead>Payment</TableHead>
                                <TableHead>Report</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {accessData.cases.map((c) => (
                                <TableRow key={c.id}>
                                  <TableCell className="font-medium">{c.claimant_name}</TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {c.appointment_date
                                      ? format(new Date(c.appointment_date), 'dd MMM yyyy')
                                      : 'N/A'}
                                  </TableCell>
                                  <TableCell>{c.matter_type}</TableCell>
                                  <TableCell>{getStatusBadge(c.case_status, 'case')}</TableCell>
                                  <TableCell>{getStatusBadge(c.payment_status, 'payment')}</TableCell>
                                  <TableCell>{getStatusBadge(c.report_status, 'report')}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications">
                  <ProfileNotifications referringAttorneyId={accessData.attorney.id} readOnly />
                </TabsContent>

                {/* Reports Tab */}
                <TabsContent value="reports">
                  <ProfileReportsDocuments
                    referringAttorneyId={accessData.attorney.id}
                    cases={accessData.cases.map(c => ({
                      claimant_name: c.claimant_name,
                      expert_type: c.expert_type,
                      appointment_date: c.appointment_date,
                      report_status: c.report_status,
                    }))}
                  />
                </TabsContent>

                {/* AOD & Payments Tab */}
                <TabsContent value="aod-payments">
                  <ProfileAODPayments referringAttorneyId={accessData.attorney.id} />
                </TabsContent>

                {/* Request Appointment Tab */}
                <TabsContent value="request">
                  <ProfileRequestAppointment
                    referringAttorneyId={accessData.attorney.id}
                    attorneyName={accessData.attorney.name}
                  />
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents">
                  <ProfileCaseDocuments referringAttorneyId={accessData.attorney.id} />
                </TabsContent>
              </Tabs>

              {/* Footer Note */}
              <p className="text-xs text-muted-foreground text-center pb-8">
                For any queries, please contact Kutlwano & Associate directly.
                Your access code will expire once payment is complete and the report has been delivered.
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default CaseAccess;
