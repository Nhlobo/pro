import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Briefcase, Search, Clock, MapPin, FileText, AlertTriangle, Calendar, User, Eye, Building2,
  Upload, CheckCircle2, XCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, differenceInDays, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface CaseAssignment {
  id: string;
  appointment_date: string;
  matter_type: string | null;
  case_status: string | null;
  claimant_name: string;
  claimant_auto_id: string;
  attorney_name: string;
  report_status: string | null;
  report_due_date: string | null;
  report_submitted_date: string | null;
  days_to_complete: number | null;
  document_count: number;
  location: string | null;
  payment_status: string | null;
}

const ExpertCases: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<CaseAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    const loadCases = async () => {
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('expert_id').eq('id', user.id).single();
      if (!profile?.expert_id) { setLoading(false); return; }

      const [apptsRes, reportsRes, docsRes] = await Promise.all([
        supabase
          .from('appointments')
          .select(`
            id, appointment_date, matter_type, case_status, payment_status,
            claimants(first_name, last_name, auto_id),
            referring_attorneys:referring_attorney_id(name),
            medical_experts:expert_id(practice_address)
          `)
          .eq('expert_id', profile.expert_id)
          .is('deleted_at', null)
          .order('appointment_date', { ascending: false }),
        supabase.from('expert_reports').select('*').eq('expert_id', profile.expert_id),
        supabase.from('documents').select('id, appointment_id').eq('expert_id', profile.expert_id),
      ]);

      const appointments = apptsRes.data || [];
      const reports = reportsRes.data || [];
      const docs = docsRes.data || [];

      const mapped: CaseAssignment[] = appointments.map(a => {
        const report = reports.find(r => r.appointment_id === a.id);
        const docCount = docs.filter(d => d.appointment_id === a.id).length;
        return {
          id: a.id,
          appointment_date: a.appointment_date,
          matter_type: a.matter_type,
          case_status: a.case_status,
          claimant_name: a.claimants ? `${a.claimants.first_name} ${a.claimants.last_name}` : 'Unknown',
          claimant_auto_id: a.claimants?.auto_id || '',
          attorney_name: (a as any).referring_attorneys?.name || 'N/A',
          report_status: report?.report_status || null,
          report_due_date: report?.report_due_date || null,
          report_submitted_date: report?.report_submitted_date || null,
          days_to_complete: report?.days_to_complete || null,
          document_count: docCount,
          location: (a as any).medical_experts?.practice_address || null,
          payment_status: a.payment_status,
        };
      });
      setCases(mapped);
      setLoading(false);
    };
    loadCases();
  }, [user]);

  const now = new Date();

  const getUrgencyLevel = (dueDate: string | null, status: string | null): string => {
    if (status === 'completed' || status === 'taken_out') return 'completed';
    if (!dueDate) return 'normal';
    const days = differenceInDays(parseISO(dueDate), now);
    if (days < 0) return 'overdue';
    if (days <= 3) return 'critical';
    if (days <= 7) return 'urgent';
    return 'normal';
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'overdue': return <Badge className="bg-destructive text-destructive-foreground text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>;
      case 'critical': return <Badge className="bg-destructive/80 text-destructive-foreground text-[10px]"><Clock className="h-3 w-3 mr-1" />Critical</Badge>;
      case 'urgent': return <Badge className="bg-warning text-warning-foreground text-[10px]"><Clock className="h-3 w-3 mr-1" />Urgent</Badge>;
      case 'completed': return <Badge className="bg-success/20 text-success text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">Normal</Badge>;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed': return <Badge className="bg-success/20 text-success text-[10px]">Completed</Badge>;
      case 'taken_out': return <Badge className="bg-primary/20 text-primary text-[10px]">Taken Out</Badge>;
      case 'in_progress': return <Badge className="bg-warning/20 text-warning text-[10px]">In Progress</Badge>;
      case 'under_review': return <Badge className="bg-primary/20 text-primary text-[10px]">Under Review</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">Pending</Badge>;
    }
  };

  const tabFilteredCases = useMemo(() => {
    return cases.filter(c => {
      if (activeTab === 'upcoming') return new Date(c.appointment_date) >= now;
      if (activeTab === 'pending') return !['completed', 'taken_out'].includes(c.report_status || '') && new Date(c.appointment_date) < now;
      if (activeTab === 'overdue') {
        const urgency = getUrgencyLevel(c.report_due_date, c.report_status);
        return urgency === 'overdue' || urgency === 'critical';
      }
      if (activeTab === 'completed') return ['completed', 'taken_out'].includes(c.report_status || '');
      return true;
    });
  }, [cases, activeTab]);

  const filteredCases = useMemo(() => {
    return tabFilteredCases.filter(c => {
      const matchSearch = !searchTerm ||
        c.claimant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.claimant_auto_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.attorney_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || c.report_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tabFilteredCases, searchTerm, statusFilter]);

  const tabCounts = useMemo(() => ({
    all: cases.length,
    upcoming: cases.filter(c => new Date(c.appointment_date) >= now).length,
    pending: cases.filter(c => !['completed', 'taken_out'].includes(c.report_status || '') && new Date(c.appointment_date) < now).length,
    overdue: cases.filter(c => {
      const urgency = getUrgencyLevel(c.report_due_date, c.report_status);
      return urgency === 'overdue' || urgency === 'critical';
    }).length,
    completed: cases.filter(c => ['completed', 'taken_out'].includes(c.report_status || '')).length,
  }), [cases]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading cases...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" /> My Case Assignments
        </h1>
        <p className="text-sm text-muted-foreground">View assigned cases, upload reports, and track deadlines</p>
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="all">All ({tabCounts.all})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({tabCounts.upcoming})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({tabCounts.pending})</TabsTrigger>
          <TabsTrigger value="overdue" className={tabCounts.overdue > 0 ? 'text-destructive' : ''}>
            Overdue ({tabCounts.overdue})
          </TabsTrigger>
          <TabsTrigger value="completed">Done ({tabCounts.completed})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search claimant, attorney..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="not_received">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="taken_out">Taken Out</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Case Cards */}
      {filteredCases.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="text-center py-12">
            <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No cases match your filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredCases.map(c => {
            const urgency = getUrgencyLevel(c.report_due_date, c.report_status);
            const isUpcoming = new Date(c.appointment_date) >= now;
            return (
              <Card
                key={c.id}
                className={`border-border/50 cursor-pointer hover:shadow-md transition-shadow ${
                  urgency === 'overdue' || urgency === 'critical' ? 'border-l-4 border-l-destructive' :
                  urgency === 'urgent' ? 'border-l-4 border-l-warning' :
                  isUpcoming ? 'border-l-4 border-l-primary' : ''
                }`}
                onClick={() => navigate(`/expert-portal/case/${c.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{c.claimant_name}</h3>
                        <Badge variant="outline" className="text-[10px]">{c.claimant_auto_id}</Badge>
                        {getUrgencyBadge(urgency)}
                        {getStatusBadge(c.report_status)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(parseISO(c.appointment_date), 'dd MMM yyyy')}</span>
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{c.attorney_name}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.matter_type || 'General'}</span>
                        <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{c.document_count} docs</span>
                        {c.location && (
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{c.location}</span>
                        )}
                        {c.report_due_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />Due: {format(parseISO(c.report_due_date), 'dd MMM yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!['completed', 'taken_out'].includes(c.report_status || '') && (
                        <Button variant="default" size="sm" className="text-xs shrink-0" onClick={e => { e.stopPropagation(); navigate(`/expert-portal/case/${c.id}`); }}>
                          <Upload className="h-3 w-3 mr-1" /> Upload Report
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="text-xs shrink-0" onClick={e => { e.stopPropagation(); navigate(`/expert-portal/case/${c.id}`); }}>
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExpertCases;
