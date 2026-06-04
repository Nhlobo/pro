import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  Star,
  Search,
  ArrowUpDown,
  Crown,
  Shield,
  UserPlus,
  UserX,
  Loader2,
  FileText,
  Calendar,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

import { RandSign } from "@/components/icons/RandSign";
interface AttorneyMetrics {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  totalReferrals: number;
  monthlyReferrals: number;
  totalFees: number;
  totalDeposits: number;
  outstandingDebt: number;
  paidCount: number;
  unpaidCount: number;
  paymentRate: number;
  lastReferralDate: string | null;
  firstReferralDate: string | null;
  avgDaysToPayment: number | null;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'inactive' | 'new';
}

const RISK_COLORS = {
  low: 'bg-success/10 text-success border-success/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  critical: 'bg-destructive text-destructive-foreground',
};

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--info))'];

const AttorneyReferralIntelligence: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [attorneys, setAttorneys] = useState<AttorneyMetrics[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [sortField, setSortField] = useState<keyof AttorneyMetrics>('monthlyReferrals');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [periodFilter, setPeriodFilter] = useState('3'); // months

  useEffect(() => {
    fetchAttorneyIntelligence();
  }, [periodFilter]);

  const fetchAttorneyIntelligence = async () => {
    setLoading(true);
    try {
      // Fetch referring attorneys
      const { data: raData } = await supabase
        .from('referring_attorneys')
        .select('id, name, contact_person, email, created_at')
        .eq('is_system_company', false);

      // Fetch all appointments with payment info
      const { data: aptData } = await supabase
        .from('appointments')
        .select('id, referring_attorney_id, appointment_date, service_fee, deposit_amount, payment_status, payment_date, created_at')
        .is('deleted_at', null);

      // Fetch AOD documents for outstanding debt
      const { data: aodData } = await supabase
        .from('aod_documents')
        .select('referring_attorney_id, total_contract_value, payment_status');

      if (!raData) return;

      const now = new Date();
      const periodStart = subMonths(now, parseInt(periodFilter));
      const threeMonthsAgo = subMonths(now, 3);

      const metrics: AttorneyMetrics[] = raData.map((ra) => {
        const raAppointments = (aptData || []).filter(a => a.referring_attorney_id === ra.id);
        const monthlyAppointments = raAppointments.filter(a => new Date(a.appointment_date) >= startOfMonth(subMonths(now, 1)));
        const periodAppointments = raAppointments.filter(a => new Date(a.appointment_date) >= periodStart);

        const totalFees = raAppointments.reduce((s, a) => s + (a.service_fee || 0), 0);
        const totalDeposits = raAppointments.reduce((s, a) => s + (a.deposit_amount || 0), 0);
        
        // AOD outstanding
        const raAods = (aodData || []).filter(d => d.referring_attorney_id === ra.id);
        const aodDebt = raAods.reduce((s, d) => s + (d.total_contract_value || 0), 0);
        
        const outstandingDebt = Math.max(0, totalFees - totalDeposits);
        
        const paidCount = raAppointments.filter(a => a.payment_status === 'paid').length;
        const unpaidCount = raAppointments.filter(a => a.payment_status !== 'paid').length;
        const paymentRate = raAppointments.length > 0 ? Math.round((paidCount / raAppointments.length) * 100) : 0;

        // Average days to payment
        const paidAppointments = raAppointments.filter(a => a.payment_status === 'paid' && a.payment_date);
        const avgDaysToPayment = paidAppointments.length > 0
          ? Math.round(paidAppointments.reduce((s, a) => s + differenceInDays(new Date(a.payment_date!), new Date(a.appointment_date)), 0) / paidAppointments.length)
          : null;

        const lastReferral = raAppointments.length > 0
          ? raAppointments.reduce((latest, a) => new Date(a.appointment_date) > new Date(latest.appointment_date) ? a : latest).appointment_date
          : null;

        // Determine risk level
        let riskLevel: AttorneyMetrics['riskLevel'] = 'low';
        if (outstandingDebt > 50000 || paymentRate < 30) riskLevel = 'critical';
        else if (outstandingDebt > 20000 || paymentRate < 50) riskLevel = 'high';
        else if (outstandingDebt > 5000 || paymentRate < 70) riskLevel = 'medium';

        // Determine status
        let status: AttorneyMetrics['status'] = 'active';
        const createdDate = new Date(ra.created_at);
        if (differenceInDays(now, createdDate) <= 90 && raAppointments.length <= 2) {
          status = 'new';
        } else if (!lastReferral || differenceInDays(now, new Date(lastReferral)) > 180) {
          status = 'inactive';
        }

        return {
          id: ra.id,
          name: ra.name,
          contactPerson: ra.contact_person,
          email: ra.email,
          totalReferrals: raAppointments.length,
          monthlyReferrals: monthlyAppointments.length,
          totalFees,
          totalDeposits,
          outstandingDebt,
          paidCount,
          unpaidCount,
          paymentRate,
          lastReferralDate: lastReferral,
          firstReferralDate: raAppointments.length > 0
            ? raAppointments.reduce((earliest, a) => new Date(a.appointment_date) < new Date(earliest.appointment_date) ? a : earliest).appointment_date
            : null,
          avgDaysToPayment,
          riskLevel,
          status,
        };
      });

      setAttorneys(metrics);
    } catch (err) {
      console.error('Error fetching intelligence data:', err);
      toast({ title: 'Error', description: 'Failed to load attorney intelligence data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof AttorneyMetrics) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedAttorneys = useMemo(() => {
    const filtered = attorneys.filter(a =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.contactPerson || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [attorneys, searchTerm, sortField, sortDir]);

  const topReferrers = useMemo(() =>
    [...attorneys].sort((a, b) => b.monthlyReferrals - a.monthlyReferrals).slice(0, 10),
    [attorneys]
  );
  const highRiskAttorneys = useMemo(() =>
    attorneys.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical').sort((a, b) => b.outstandingDebt - a.outstandingDebt),
    [attorneys]
  );
  const newAttorneys = useMemo(() =>
    attorneys.filter(a => a.status === 'new').sort((a, b) => (b.firstReferralDate || '').localeCompare(a.firstReferralDate || '')),
    [attorneys]
  );
  const inactiveAttorneys = useMemo(() =>
    attorneys.filter(a => a.status === 'inactive').sort((a, b) => (a.lastReferralDate || '').localeCompare(b.lastReferralDate || '')),
    [attorneys]
  );

  // Chart data
  const referralChartData = topReferrers.slice(0, 8).map(a => ({
    name: a.name.length > 15 ? a.name.substring(0, 15) + '…' : a.name,
    referrals: a.monthlyReferrals,
    total: a.totalReferrals,
  }));

  const riskDistribution = [
    { name: 'Low Risk', value: attorneys.filter(a => a.riskLevel === 'low').length, color: 'hsl(var(--success))' },
    { name: 'Medium Risk', value: attorneys.filter(a => a.riskLevel === 'medium').length, color: 'hsl(var(--warning))' },
    { name: 'High Risk', value: attorneys.filter(a => a.riskLevel === 'high').length, color: 'hsl(142, 70%, 45%)' },
    { name: 'Critical', value: attorneys.filter(a => a.riskLevel === 'critical').length, color: 'hsl(var(--destructive))' },
  ].filter(d => d.value > 0);

  const statusDistribution = [
    { name: 'Active', value: attorneys.filter(a => a.status === 'active').length, color: 'hsl(var(--success))' },
    { name: 'New', value: newAttorneys.length, color: 'hsl(var(--primary))' },
    { name: 'Inactive', value: inactiveAttorneys.length, color: 'hsl(var(--muted-foreground))' },
  ].filter(d => d.value > 0);

  const totalOutstanding = attorneys.reduce((s, a) => s + a.outstandingDebt, 0);
  const totalReferrals = attorneys.reduce((s, a) => s + a.totalReferrals, 0);
  const avgPaymentRate = attorneys.length > 0
    ? Math.round(attorneys.reduce((s, a) => s + a.paymentRate, 0) / attorneys.length)
    : 0;

  const SortHeader = ({ field, children }: { field: keyof AttorneyMetrics; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              Attorney Referral Intelligence
            </h1>
            <p className="text-muted-foreground mt-1">
              Performance analytics, payment behaviour, and risk assessment for referring attorneys
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last Month</SelectItem>
              <SelectItem value="3">Last 3 Months</SelectItem>
              <SelectItem value="6">Last 6 Months</SelectItem>
              <SelectItem value="12">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Total Attorneys</p>
            </div>
            <p className="text-2xl font-bold">{attorneys.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-info" />
              <p className="text-xs text-muted-foreground">Total Referrals</p>
            </div>
            <p className="text-2xl font-bold text-info">{totalReferrals}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <RandSign className="h-4 w-4 text-destructive" />
              <p className="text-xs text-muted-foreground">Outstanding</p>
            </div>
            <p className="text-2xl font-bold text-destructive">R{totalOutstanding.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-success" />
              <p className="text-xs text-muted-foreground">Avg Payment Rate</p>
            </div>
            <p className="text-2xl font-bold text-success">{avgPaymentRate}%</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">New Attorneys</p>
            </div>
            <p className="text-2xl font-bold text-primary">{newAttorneys.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <p className="text-xs text-muted-foreground">High Risk</p>
            </div>
            <p className="text-2xl font-bold text-warning">{highRiskAttorneys.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="gap-1 text-xs md:text-sm"><BarChart3 className="h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="top" className="gap-1 text-xs md:text-sm"><Crown className="h-4 w-4" />Top Referrers</TabsTrigger>
          <TabsTrigger value="risk" className="gap-1 text-xs md:text-sm"><Shield className="h-4 w-4" />High Risk</TabsTrigger>
          <TabsTrigger value="new" className="gap-1 text-xs md:text-sm"><UserPlus className="h-4 w-4" />New</TabsTrigger>
          <TabsTrigger value="inactive" className="gap-1 text-xs md:text-sm"><UserX className="h-4 w-4" />Inactive</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Referrers Chart */}
            <Card className="bg-gradient-card border-border/50 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Top Referring Attorneys (Monthly)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={referralChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Bar dataKey="referrals" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="This Month" />
                    <Bar dataKey="total" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Total" opacity={0.3} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Risk Distribution */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Risk Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={riskDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {riskDistribution.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {statusDistribution.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      <span className="h-2 w-2 rounded-full mr-1" style={{ backgroundColor: s.color, display: 'inline-block' }} />
                      {s.name}: {s.value}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Full Rankings Table */}
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Attorney Rankings</CardTitle>
                  <CardDescription>Comprehensive performance overview of all referring attorneys</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search attorneys..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <SortHeader field="name">Attorney</SortHeader>
                      <SortHeader field="monthlyReferrals">Monthly</SortHeader>
                      <SortHeader field="totalReferrals">Total</SortHeader>
                      <SortHeader field="paymentRate">Payment %</SortHeader>
                      <SortHeader field="outstandingDebt">Outstanding</SortHeader>
                      <SortHeader field="avgDaysToPayment">Avg Days</SortHeader>
                      <TableHead>Risk</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAttorneys.map((a, idx) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-muted-foreground">
                          {idx < 3 ? (
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-yellow-500/20 text-yellow-600' :
                              idx === 1 ? 'bg-gray-400/20 text-gray-500' :
                              'bg-amber-600/20 text-amber-700'
                            }`}>{idx + 1}</div>
                          ) : idx + 1}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-sm">{a.name}</p>
                            {a.contactPerson && <p className="text-xs text-muted-foreground">{a.contactPerson}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold">{a.monthlyReferrals}</TableCell>
                        <TableCell className="text-center">{a.totalReferrals}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={a.paymentRate} className="h-2 w-16" />
                            <span className="text-xs font-medium">{a.paymentRate}%</span>
                          </div>
                        </TableCell>
                        <TableCell className={`font-medium ${a.outstandingDebt > 0 ? 'text-destructive' : 'text-success'}`}>
                          R{a.outstandingDebt.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {a.avgDaysToPayment !== null ? `${a.avgDaysToPayment}d` : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={RISK_COLORS[a.riskLevel]}>{a.riskLevel}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={a.status === 'active' ? 'default' : 'outline'} className={
                            a.status === 'active' ? 'bg-success/10 text-success border-success/20' :
                            a.status === 'new' ? 'bg-primary/10 text-primary border-primary/20' :
                            'text-muted-foreground'
                          }>
                            {a.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Referrers Tab */}
        <TabsContent value="top">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                Top Referring Attorneys
              </CardTitle>
              <CardDescription>Attorneys ranked by monthly referral volume and total contribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topReferrers.map((a, idx) => (
                  <div key={a.id} className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      idx === 0 ? 'bg-yellow-500/20 text-yellow-600 ring-2 ring-yellow-500/30' :
                      idx === 1 ? 'bg-gray-400/20 text-gray-500' :
                      idx === 2 ? 'bg-amber-600/20 text-amber-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.contactPerson || 'No contact person'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-primary">{a.monthlyReferrals}</p>
                      <p className="text-[10px] text-muted-foreground">This Month</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold">{a.totalReferrals}</p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-success">{a.paymentRate}%</p>
                      <p className="text-[10px] text-muted-foreground">Payment Rate</p>
                    </div>
                    <Badge className={RISK_COLORS[a.riskLevel]}>{a.riskLevel}</Badge>
                  </div>
                ))}
                {topReferrers.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No referral data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* High Risk Tab */}
        <TabsContent value="risk">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-destructive" />
                High-Risk Attorneys (Late Payers)
              </CardTitle>
              <CardDescription>Attorneys with significant outstanding debt or poor payment behaviour</CardDescription>
            </CardHeader>
            <CardContent>
              {highRiskAttorneys.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No high-risk attorneys identified</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {highRiskAttorneys.map((a) => (
                      <div key={a.id} className="p-4 rounded-lg border border-destructive/20 bg-destructive/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className={`h-5 w-5 ${a.riskLevel === 'critical' ? 'text-destructive' : 'text-warning'}`} />
                            <div>
                              <p className="font-semibold">{a.name}</p>
                              <p className="text-xs text-muted-foreground">{a.contactPerson}</p>
                            </div>
                          </div>
                          <Badge className={RISK_COLORS[a.riskLevel]}>{a.riskLevel.toUpperCase()}</Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-2 rounded bg-background/50">
                            <p className="text-[10px] text-muted-foreground">Outstanding Debt</p>
                            <p className="font-bold text-destructive">R{a.outstandingDebt.toLocaleString()}</p>
                          </div>
                          <div className="p-2 rounded bg-background/50">
                            <p className="text-[10px] text-muted-foreground">Payment Rate</p>
                            <p className="font-bold">{a.paymentRate}%</p>
                          </div>
                          <div className="p-2 rounded bg-background/50">
                            <p className="text-[10px] text-muted-foreground">Unpaid Cases</p>
                            <p className="font-bold text-warning">{a.unpaidCount}</p>
                          </div>
                          <div className="p-2 rounded bg-background/50">
                            <p className="text-[10px] text-muted-foreground">Avg Days to Pay</p>
                            <p className="font-bold">{a.avgDaysToPayment !== null ? `${a.avgDaysToPayment}d` : 'N/A'}</p>
                          </div>
                        </div>
                        {a.lastReferralDate && (
                          <p className="text-xs text-muted-foreground">
                            Last referral: {format(new Date(a.lastReferralDate), 'dd MMM yyyy')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* New Attorneys Tab */}
        <TabsContent value="new">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Newly Acquired Attorneys
              </CardTitle>
              <CardDescription>Attorneys onboarded within the last 90 days</CardDescription>
            </CardHeader>
            <CardContent>
              {newAttorneys.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No new attorneys in the last 90 days</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {newAttorneys.map((a) => (
                    <div key={a.id} className="flex items-center gap-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <UserPlus className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{a.contactPerson || a.email || 'No contact info'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{a.totalReferrals}</p>
                        <p className="text-[10px] text-muted-foreground">Referrals</p>
                      </div>
                      {a.firstReferralDate && (
                        <div className="text-center">
                          <p className="text-sm font-medium">{format(new Date(a.firstReferralDate), 'dd MMM yyyy')}</p>
                          <p className="text-[10px] text-muted-foreground">First Referral</p>
                        </div>
                      )}
                      <Badge className={RISK_COLORS[a.riskLevel]}>{a.riskLevel}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inactive Attorneys Tab */}
        <TabsContent value="inactive">
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserX className="h-5 w-5 text-muted-foreground" />
                Inactive Attorneys
              </CardTitle>
              <CardDescription>Attorneys with no referrals in the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              {inactiveAttorneys.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <UserX className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No inactive attorneys found</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {inactiveAttorneys.map((a) => (
                      <div key={a.id} className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-muted/20">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <UserX className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.contactPerson || 'No contact person'}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-muted-foreground">{a.totalReferrals}</p>
                          <p className="text-[10px] text-muted-foreground">Total Referrals</p>
                        </div>
                        {a.lastReferralDate ? (
                          <div className="text-center">
                            <p className="text-sm font-medium text-muted-foreground">{format(new Date(a.lastReferralDate), 'dd MMM yyyy')}</p>
                            <p className="text-[10px] text-muted-foreground">Last Active</p>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Never referred</Badge>
                        )}
                        <div className="text-center">
                          <p className="font-bold text-destructive">R{a.outstandingDebt.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">Outstanding</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AttorneyReferralIntelligence;
