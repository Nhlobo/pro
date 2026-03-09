import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Scale, FileText, Users, BookOpen, Gavel, FileCheck,
  Plus, Clock, CheckCircle2, AlertCircle, Loader2, Send
} from 'lucide-react';
import { format } from 'date-fns';

interface ServiceRequest {
  id: string;
  service_type: string;
  claimant_name: string;
  case_reference: string | null;
  urgency: string;
  status: string;
  description: string | null;
  requested_at: string;
  completed_at: string | null;
  notes: string | null;
}

const SERVICE_TYPES = [
  {
    value: 'bundle_preparation',
    label: 'Medico-Legal Bundle Preparation',
    description: 'Compilation and indexing of all medico-legal documents into a court-ready paginated bundle',
    icon: BookOpen,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    value: 'report_summary',
    label: 'Report Summaries',
    description: 'Concise summary of expert reports highlighting key findings, prognosis, and recommendations',
    icon: FileText,
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
  {
    value: 'trial_coordination',
    label: 'Expert Trial Coordination',
    description: 'Scheduling and coordinating medical experts for trial attendance, including availability and logistics',
    icon: Users,
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  {
    value: 'joint_minutes',
    label: 'Joint Minutes Coordination',
    description: 'Facilitating and coordinating joint minutes meetings between opposing medical experts',
    icon: Gavel,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  {
    value: 'court_formatting',
    label: 'Court-Ready Report Formatting',
    description: 'Reformatting expert reports to comply with court requirements including proper pagination, annexures, and certification',
    icon: FileCheck,
    color: 'text-accent-foreground',
    bgColor: 'bg-accent/10',
  },
];

const URGENCY_OPTIONS = [
  { value: 'standard', label: 'Standard (5-7 business days)' },
  { value: 'urgent', label: 'Urgent (2-3 business days)' },
  { value: 'critical', label: 'Critical (24-48 hours)' },
];

interface LitigationTrialServicesProps {
  liveCases: any[];
}

export const LitigationTrialServices: React.FC<LitigationTrialServicesProps> = ({ liveCases }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedService, setSelectedService] = useState('');

  const [formData, setFormData] = useState({
    serviceType: '',
    claimantName: '',
    caseReference: '',
    urgency: 'standard',
    description: '',
    trialDate: '',
  });

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('litigation_service_requests' as any)
        .select('*')
        .order('requested_at', { ascending: false });
      if (!error && data) {
        setRequests(data as unknown as ServiceRequest[]);
      }
    } catch (err) {
      console.error('Error fetching service requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleOpenRequest = (serviceType: string) => {
    setFormData(prev => ({ ...prev, serviceType }));
    setSelectedService(serviceType);
    setDialogOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (!user || !formData.claimantName || !formData.serviceType) return;
    setSubmitting(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('referring_attorney_id')
        .eq('id', user.id)
        .single();

      const { error } = await supabase.from('litigation_service_requests' as any).insert({
        service_type: formData.serviceType,
        claimant_name: formData.claimantName,
        case_reference: formData.caseReference || null,
        urgency: formData.urgency,
        description: formData.description || null,
        trial_date: formData.trialDate || null,
        requested_by: user.id,
        referring_attorney_id: profile?.referring_attorney_id || null,
        status: 'pending',
      } as any);

      if (error) throw error;

      toast({ title: 'Service Requested', description: `Your ${SERVICE_TYPES.find(s => s.value === formData.serviceType)?.label} request has been submitted.` });
      setDialogOpen(false);
      setFormData({ serviceType: '', claimantName: '', caseReference: '', urgency: 'standard', description: '', trialDate: '' });
      fetchRequests();
    } catch (err: any) {
      console.error('Service request error:', err);
      toast({ title: 'Error', description: 'Failed to submit service request.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>;
      case 'in_progress': return <Badge className="bg-primary/10 text-primary border-primary/20">In Progress</Badge>;
      case 'cancelled': return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Cancelled</Badge>;
      default: return <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'critical': return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Critical</Badge>;
      case 'urgent': return <Badge className="bg-warning/10 text-warning border-warning/20">Urgent</Badge>;
      default: return <Badge variant="outline">Standard</Badge>;
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const inProgressCount = requests.filter(r => r.status === 'in_progress').length;
  const completedCount = requests.filter(r => r.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Services Overview */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Litigation & Trial Preparation Services
          </CardTitle>
          <CardDescription>
            Request additional services to help prepare your cases for trial. Select a service below to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-3 rounded-lg bg-warning/10 text-center">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-warning">{pendingCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 text-center">
              <p className="text-xs text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold text-primary">{inProgressCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-success/10 text-center">
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-success">{completedCount}</p>
            </div>
          </div>

          {/* Service Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICE_TYPES.map((service) => {
              const Icon = service.icon;
              return (
                <Card
                  key={service.value}
                  className="border-border/50 hover:border-primary/30 transition-all cursor-pointer group"
                  onClick={() => handleOpenRequest(service.value)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${service.bgColor} group-hover:scale-110 transition-transform`}>
                        <Icon className={`h-5 w-5 ${service.color}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm text-foreground">{service.label}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{service.description}</p>
                        <Button size="sm" variant="ghost" className="mt-2 h-7 text-xs gap-1 text-primary">
                          <Plus className="h-3 w-3" />Request Service
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Active & Past Requests */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Service Requests</CardTitle>
          <CardDescription>Track the status of your litigation service requests</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No service requests yet</p>
              <p className="text-xs mt-1">Select a service above to submit your first request</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {requests.map((req) => {
                  const serviceInfo = SERVICE_TYPES.find(s => s.value === req.service_type);
                  const Icon = serviceInfo?.icon || FileText;
                  return (
                    <div key={req.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors">
                      <div className={`p-2 rounded-lg ${serviceInfo?.bgColor || 'bg-muted'}`}>
                        <Icon className={`h-4 w-4 ${serviceInfo?.color || 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{serviceInfo?.label || req.service_type}</span>
                          {getStatusBadge(req.status)}
                          {getUrgencyBadge(req.urgency)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Claimant: <span className="font-medium text-foreground">{req.claimant_name}</span>
                          {req.case_reference && <> • Ref: {req.case_reference}</>}
                        </p>
                        {req.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{req.description}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Requested: {format(new Date(req.requested_at), 'dd MMM yyyy HH:mm')}
                          {req.completed_at && <> • Completed: {format(new Date(req.completed_at), 'dd MMM yyyy')}</>}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Request Service Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Request Service
            </DialogTitle>
            <DialogDescription>
              {SERVICE_TYPES.find(s => s.value === selectedService)?.description || 'Submit a litigation service request'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Service Type</label>
              <Select value={formData.serviceType} onValueChange={v => setFormData(p => ({ ...p, serviceType: v }))}>
                <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Claimant Name *</label>
                {liveCases.length > 0 ? (
                  <Select value={formData.claimantName} onValueChange={v => setFormData(p => ({ ...p, claimantName: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select claimant" /></SelectTrigger>
                    <SelectContent>
                      {liveCases.map(c => (
                        <SelectItem key={c.id} value={c.claimantName}>{c.claimantName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={formData.claimantName} onChange={e => setFormData(p => ({ ...p, claimantName: e.target.value }))} placeholder="Enter claimant name" />
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Case Reference</label>
                <Input value={formData.caseReference} onChange={e => setFormData(p => ({ ...p, caseReference: e.target.value }))} placeholder="e.g. CASE-2026-001" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Urgency</label>
                <Select value={formData.urgency} onValueChange={v => setFormData(p => ({ ...p, urgency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {URGENCY_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Trial Date (if applicable)</label>
                <Input type="date" value={formData.trialDate} onChange={e => setFormData(p => ({ ...p, trialDate: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Additional Details</label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                placeholder="Provide any specific requirements, deadlines, or special instructions..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitRequest} disabled={submitting || !formData.claimantName || !formData.serviceType}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
