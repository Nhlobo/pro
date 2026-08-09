import React, { useState, useMemo, useCallback } from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { useAttorneyDashboardStats } from '@/hooks/useAttorneyDashboardStats';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Calendar, Clock, User, FileText, Download, Filter,
  ChevronRight, CalendarDays, Plus, Mail, Send, Loader2, Paperclip
} from 'lucide-react';
import { format, isToday, isTomorrow, isThisWeek, isThisMonth, parseISO } from 'date-fns';
import { formatExpertType } from '@/utils/expertTypeMapping';

const AttorneyAppointments: React.FC = () => {
  const { liveCases, loading, refetchStats } = useAttorneyDashboardStats();
  const { user } = useAuth();
  const { toast } = useToast();
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  
  // System request dialog
  const [systemRequestOpen, setSystemRequestOpen] = useState(false);
  const [systemRequest, setSystemRequest] = useState({
    firstName: '', lastName: '', matterType: 'raf',
    expertType: 'orthopaedic_surgeon', province: 'Gauteng',
    preferredDate: '', notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Email request dialog
  const [emailRequestOpen, setEmailRequestOpen] = useState(false);
  const [emailRequest, setEmailRequest] = useState({
    firstName: '', lastName: '', matterType: 'raf',
    expertType: 'orthopaedic_surgeon', province: 'Gauteng',
    preferredDate: '', notes: '', attachments: [] as File[]
  });
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  // Group appointments by date
  const groupedAppointments = useMemo(() => {
    let filtered = [...liveCases];
    if (filterPeriod !== 'all') {
      const now = new Date();
      filtered = filtered.filter(c => {
        const date = new Date(c.appointmentDate);
        switch (filterPeriod) {
          case 'today': return isToday(date);
          case 'tomorrow': return isTomorrow(date);
          case 'week': return isThisWeek(date);
          case 'month': return isThisMonth(date);
          case 'upcoming': return date >= now;
          case 'past': return date < now;
          default: return true;
        }
      });
    }
    filtered.sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime());
    const grouped: Record<string, typeof filtered> = {};
    filtered.forEach(appointment => {
      const dateKey = format(new Date(appointment.appointmentDate), 'yyyy-MM-dd');
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(appointment);
    });
    return grouped;
  }, [liveCases, filterPeriod]);

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, dd MMMM yyyy');
  };

  const todayCount = liveCases.filter(c => isToday(new Date(c.appointmentDate))).length;
  const upcomingCount = liveCases.filter(c => new Date(c.appointmentDate) >= new Date()).length;

  // Handle system appointment request
  const handleSystemRequest = async () => {
    if (!user || !systemRequest.firstName || !systemRequest.lastName) return;
    setSubmitting(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('referring_attorney_id')
        .eq('id', user.id)
        .single();

      if (!profile?.referring_attorney_id) {
        toast({ title: 'Error', description: 'No referring attorney linked to your profile.', variant: 'destructive' });
        return;
      }

      const { data: attorney } = await supabase
        .from('referring_attorneys')
        .select('name')
        .eq('id', profile.referring_attorney_id)
        .single();

      const { error } = await supabase.from('appointment_requests').insert({
        claimant_first_name: systemRequest.firstName,
        claimant_last_name: systemRequest.lastName,
        matter_type: systemRequest.matterType,
        expert_type_requested: systemRequest.expertType,
        province: systemRequest.province,
        preferred_date_type: systemRequest.preferredDate ? 'specific' : 'any',
        suggested_date: systemRequest.preferredDate || null,
        additional_notes: systemRequest.notes || null,
        referring_attorney_id: profile.referring_attorney_id,
        referring_attorney_name: attorney?.name || 'Unknown',
        requested_by: user.id,
      });

      if (error) throw error;

      toast({ title: 'Request Submitted', description: `Appointment request for ${systemRequest.firstName} ${systemRequest.lastName} submitted.` });
      setSystemRequestOpen(false);
      setSystemRequest({ firstName: '', lastName: '', matterType: 'raf', expertType: 'orthopaedic_surgeon', province: 'Gauteng', preferredDate: '', notes: '' });
      refetchStats();
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to submit request.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle email appointment request
  const handleEmailRequest = async () => {
    if (!user || !emailRequest.firstName || !emailRequest.lastName) return;
    setEmailSubmitting(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('referring_attorney_id')
        .eq('id', user.id)
        .single();

      if (!profile?.referring_attorney_id) {
        toast({ title: 'Error', description: 'No referring attorney linked.', variant: 'destructive' });
        return;
      }

      const { data: attorney } = await supabase
        .from('referring_attorneys')
        .select('name, email')
        .eq('id', profile.referring_attorney_id)
        .single();

      // Upload attachments if any
      const attachmentPaths: string[] = [];
      for (const file of emailRequest.attachments) {
        const filePath = `appointment-request-attachments/${profile.referring_attorney_id}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage.from('documents').upload(filePath, file);
        if (!uploadErr) attachmentPaths.push(filePath);
      }

      // Create the request with email flag
      const { error } = await supabase.from('appointment_requests').insert({
        claimant_first_name: emailRequest.firstName,
        claimant_last_name: emailRequest.lastName,
        matter_type: emailRequest.matterType,
        expert_type_requested: emailRequest.expertType,
        province: emailRequest.province,
        preferred_date_type: emailRequest.preferredDate ? 'specific' : 'any',
        suggested_date: emailRequest.preferredDate || null,
        additional_notes: `[EMAIL REQUEST] ${emailRequest.notes || ''}\n\nAttachments: ${attachmentPaths.length > 0 ? attachmentPaths.join(', ') : 'None'}`,
        referring_attorney_id: profile.referring_attorney_id,
        referring_attorney_name: attorney?.name || 'Unknown',
        attorney_email: attorney?.email || null,
        requested_by: user.id,
      });

      if (error) throw error;

      // Trigger email notification to admin
      try {
        await supabase.functions.invoke('send-appointment-request', {
          body: {
            claimantName: `${emailRequest.firstName} ${emailRequest.lastName}`,
            attorneyName: attorney?.name || 'Unknown',
            attorneyEmail: attorney?.email || '',
            matterType: emailRequest.matterType,
            expertType: emailRequest.expertType,
            province: emailRequest.province,
            preferredDate: emailRequest.preferredDate || 'Any available date',
            notes: emailRequest.notes || '',
            attachmentCount: attachmentPaths.length,
          }
        });
      } catch {
        // Email sending is best-effort
      }

      toast({ title: 'Email Request Sent', description: `Your appointment request with attachments has been emailed to the admin team.` });
      setEmailRequestOpen(false);
      setEmailRequest({ firstName: '', lastName: '', matterType: 'raf', expertType: 'orthopaedic_surgeon', province: 'Gauteng', preferredDate: '', notes: '', attachments: [] });
      refetchStats();
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to send email request.', variant: 'destructive' });
    } finally {
      setEmailSubmitting(false);
    }
  };

  const RequestFormFields = ({ data, setData }: { data: any; setData: (fn: (prev: any) => any) => void }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>First Name *</Label>
          <Input value={data.firstName} onChange={e => setData((p: any) => ({ ...p, firstName: e.target.value }))} placeholder="Claimant first name" />
        </div>
        <div>
          <Label>Last Name *</Label>
          <Input value={data.lastName} onChange={e => setData((p: any) => ({ ...p, lastName: e.target.value }))} placeholder="Claimant last name" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Matter Type</Label>
          <Select value={data.matterType} onValueChange={v => setData((p: any) => ({ ...p, matterType: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="raf">RAF</SelectItem>
              <SelectItem value="slip_and_fall">Slip & Fall</SelectItem>
              <SelectItem value="medical_negligence">Medical Negligence</SelectItem>
              <SelectItem value="unlawful_arrest">Unlawful Arrest</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Expert Type</Label>
          <Select value={data.expertType} onValueChange={v => setData((p: any) => ({ ...p, expertType: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="orthopaedic_surgeon">Orthopaedic Surgeon</SelectItem>
              <SelectItem value="neurosurgeon">Neurosurgeon</SelectItem>
              <SelectItem value="psychologist">Psychologist</SelectItem>
              <SelectItem value="psychiatrist">Psychiatrist</SelectItem>
              <SelectItem value="occupational_therapist">Occupational Therapist</SelectItem>
              <SelectItem value="general_surgeon">General Surgeon</SelectItem>
              <SelectItem value="neurologist">Neurologist</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Province</Label>
          <Select value={data.province} onValueChange={v => setData((p: any) => ({ ...p, province: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'].map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Preferred Date</Label>
          <Input type="date" value={data.preferredDate} onChange={e => setData((p: any) => ({ ...p, preferredDate: e.target.value }))} />
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea value={data.notes} onChange={e => setData((p: any) => ({ ...p, notes: e.target.value }))} placeholder="Any additional information..." />
      </div>
    </div>
  );

  return (
    <AttorneyPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-8 w-8 text-kutlwano-blue" />
              Appointments
            </h1>
            <p className="text-muted-foreground mt-1">
              View appointments and request new bookings
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setSystemRequestOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> System Request
            </Button>
            <Button onClick={() => setEmailRequestOpen(true)} variant="outline" className="gap-2">
              <Mail className="h-4 w-4" /> Email Request
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today</p>
                  <p className="text-2xl font-bold text-kutlwano-blue">{todayCount}</p>
                </div>
                <div className="p-3 bg-kutlwano-blue/10 rounded-lg">
                  <CalendarDays className="h-6 w-6 text-kutlwano-blue" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming</p>
                  <p className="text-2xl font-bold text-kutlwano-teal">{upcomingCount}</p>
                </div>
                <div className="p-3 bg-kutlwano-teal/10 rounded-lg">
                  <Clock className="h-6 w-6 text-kutlwano-teal" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-foreground">{liveCases.length}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <Calendar className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Appointments</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="upcoming">Upcoming Only</SelectItem>
                  <SelectItem value="past">Past Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Appointments List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : Object.keys(groupedAppointments).length === 0 ? (
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No appointments found for the selected period</p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-6">
              {Object.entries(groupedAppointments).map(([dateKey, appointments]) => (
                <div key={dateKey}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary rounded-lg">
                      <CalendarDays className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{getDateLabel(dateKey)}</h3>
                      <p className="text-xs text-muted-foreground">{appointments.length} appointment(s)</p>
                    </div>
                  </div>
                  <div className="space-y-3 ml-6 border-l-2 border-border pl-6">
                    {appointments.map((appointment, index) => (
                      <Card key={index} className="bg-gradient-card border-border/50 hover:shadow-soft transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-kutlwano-blue" />
                                <span className="font-medium text-foreground">{appointment.claimantName}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FileText className="h-4 w-4" />
                                <span>{formatExpertType(appointment.expertType)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>{format(new Date(appointment.appointmentDate), 'HH:mm')}</span>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {appointment.currentPhase}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* System Request Dialog */}
      <Dialog open={systemRequestOpen} onOpenChange={setSystemRequestOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> System Appointment Request
            </DialogTitle>
            <DialogDescription>Submit a booking request through the system</DialogDescription>
          </DialogHeader>
          <RequestFormFields data={systemRequest} setData={setSystemRequest} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSystemRequestOpen(false)}>Cancel</Button>
            <Button onClick={handleSystemRequest} disabled={submitting || !systemRequest.firstName || !systemRequest.lastName}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Request Dialog */}
      <Dialog open={emailRequestOpen} onOpenChange={setEmailRequestOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Email Appointment Request
            </DialogTitle>
            <DialogDescription>Send a booking request via email with attachments</DialogDescription>
          </DialogHeader>
          <RequestFormFields data={emailRequest} setData={setEmailRequest} />
          <div>
            <Label className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" /> Attachments
            </Label>
            <Input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={e => {
                const files = Array.from(e.target.files || []);
                setEmailRequest(p => ({ ...p, attachments: [...p.attachments, ...files] }));
              }}
            />
            {emailRequest.attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {emailRequest.attachments.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Paperclip className="h-3 w-3" />
                    <span>{f.name}</span>
                    <Button size="sm" variant="ghost" className="h-5 px-1" onClick={() => {
                      setEmailRequest(p => ({ ...p, attachments: p.attachments.filter((_, idx) => idx !== i) }));
                    }}>×</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailRequestOpen(false)}>Cancel</Button>
            <Button onClick={handleEmailRequest} disabled={emailSubmitting || !emailRequest.firstName || !emailRequest.lastName}>
              {emailSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Send Email Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AttorneyPortalLayout>
  );
};

export default AttorneyAppointments;
