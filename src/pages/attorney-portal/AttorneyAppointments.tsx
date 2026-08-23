import React, { useState, useMemo, useCallback } from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { useAttorneyDashboardStats } from '@/hooks/useAttorneyDashboardStats';
import { useAttorneyLinkStatus } from '@/hooks/useAttorneyLinkStatus';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AttorneyNotLinkedState } from '@/components/portal/AttorneyNotLinkedState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Calendar, Clock, User, FileText, Filter,
  CalendarDays, Plus, Mail, Send, Loader2, Paperclip, X,
} from 'lucide-react';
import { format, isToday, isTomorrow, isThisWeek, isThisMonth, parseISO } from 'date-fns';
import { formatExpertType } from '@/utils/expertTypeMapping';
import { BRAND_TEAL } from '@/components/admin/ui/AdminUI';
import {
  PortalPage,
  PortalHeader,
  SyncStatus,
  PortalStatStrip,
  PortalCard,
  PortalCardHeader,
  PortalCardBody,
  PortalPill,
  PortalEmptyState,
  PortalLoadingState,
} from '@/components/attorney-portal/ui/PortalPrimitives';

const FIELD_CLASS = 'rounded-none border-black/15 focus-visible:ring-[#00BAAD]/30';

const AttorneyAppointments: React.FC = () => {
  const { liveCases, loading, refetchStats } = useAttorneyDashboardStats();
  const { user } = useAuth();
  const { toast } = useToast();
  const [filterPeriod, setFilterPeriod] = useState<string>('all');

  // Case-link check. Resolved before the real page ever paints, so a
  // not-linked account goes straight to the "not linked" state on first
  // render instead of flashing the appointments UI and then swapping to
  // it — mirrors the pattern already used by the Expert Portal's Schedule
  // page (see ExpertNotLinkedState / ExpertSchedule).
  const linkStatus = useAttorneyLinkStatus();

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
  const pastCount = liveCases.filter(c => new Date(c.appointmentDate) < new Date()).length;

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
          <Label className="text-xs text-slate-500">First Name *</Label>
          <Input className={cn(FIELD_CLASS, 'mt-1')} value={data.firstName} onChange={e => setData((p: any) => ({ ...p, firstName: e.target.value }))} placeholder="Claimant first name" />
        </div>
        <div>
          <Label className="text-xs text-slate-500">Last Name *</Label>
          <Input className={cn(FIELD_CLASS, 'mt-1')} value={data.lastName} onChange={e => setData((p: any) => ({ ...p, lastName: e.target.value }))} placeholder="Claimant last name" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-slate-500">Matter Type</Label>
          <Select value={data.matterType} onValueChange={v => setData((p: any) => ({ ...p, matterType: v }))}>
            <SelectTrigger className={cn(FIELD_CLASS, 'mt-1')}><SelectValue /></SelectTrigger>
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
          <Label className="text-xs text-slate-500">Expert Type</Label>
          <Select value={data.expertType} onValueChange={v => setData((p: any) => ({ ...p, expertType: v }))}>
            <SelectTrigger className={cn(FIELD_CLASS, 'mt-1')}><SelectValue /></SelectTrigger>
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
          <Label className="text-xs text-slate-500">Province</Label>
          <Select value={data.province} onValueChange={v => setData((p: any) => ({ ...p, province: v }))}>
            <SelectTrigger className={cn(FIELD_CLASS, 'mt-1')}><SelectValue /></SelectTrigger>
            <SelectContent>
              {['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'].map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-slate-500">Preferred Date</Label>
          <Input className={cn(FIELD_CLASS, 'mt-1')} type="date" value={data.preferredDate} onChange={e => setData((p: any) => ({ ...p, preferredDate: e.target.value }))} />
        </div>
      </div>
      <div>
        <Label className="text-xs text-slate-500">Notes</Label>
        <Textarea className={cn(FIELD_CLASS, 'mt-1')} value={data.notes} onChange={e => setData((p: any) => ({ ...p, notes: e.target.value }))} placeholder="Any additional information..." />
      </div>
    </div>
  );

  if (linkStatus === 'checking') {
    return (
      <AttorneyPortalLayout>
        <PortalPage>
          <PortalHeader eyebrow="Attorney Portal" title="Appointments" icon={Calendar} />
          <PortalLoadingState label="Checking your account…" />
        </PortalPage>
      </AttorneyPortalLayout>
    );
  }

  if (linkStatus === 'not_linked') {
    return (
      <AttorneyPortalLayout>
        <PortalPage>
          <PortalHeader eyebrow="Attorney Portal" title="Appointments" icon={Calendar} />
          <AttorneyNotLinkedState description="Your account isn't linked to a firm's referrals yet, so there's nothing to show here. Contact an administrator or get help below." />
        </PortalPage>
      </AttorneyPortalLayout>
    );
  }

  return (
    <AttorneyPortalLayout>
      <PortalPage>
        <PortalHeader
          eyebrow="Attorney Portal"
          title="Appointments"
          description="View scheduled appointments and request new bookings"
          icon={Calendar}
          actions={
            <>
              <SyncStatus loading={loading} onRefresh={refetchStats} label="Live data" />
              <Button variant="outline" className="rounded-none gap-2" onClick={() => setEmailRequestOpen(true)}>
                <Mail className="h-4 w-4" /> Email Request
              </Button>
              <Button className="rounded-none gap-2" onClick={() => setSystemRequestOpen(true)}>
                <Plus className="h-4 w-4" /> System Request
              </Button>
            </>
          }
        />

        {/* KPI ledger — one bordered panel, matches Dashboard/My Cases */}
        <PortalStatStrip
          loading={loading}
          tiles={[
            { label: 'Today', value: todayCount, icon: CalendarDays },
            { label: 'Upcoming', value: upcomingCount, icon: Clock },
            { label: 'Past', value: pastCount, icon: FileText },
            { label: 'Total', value: liveCases.length, icon: Calendar },
          ]}
        />

        {/* Filter */}
        <PortalCard>
          <PortalCardBody className="flex items-center gap-3">
            <Filter className="h-4 w-4 shrink-0 text-slate-400" />
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className={cn(FIELD_CLASS, 'w-full sm:w-[220px]')}>
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
          </PortalCardBody>
        </PortalCard>

        {/* Appointments list */}
        <PortalCard>
          <PortalCardHeader
            icon={CalendarDays}
            title="Scheduled Appointments"
            description={`${Object.values(groupedAppointments).reduce((n, g) => n + g.length, 0)} appointment(s) in view`}
          />
          <PortalCardBody className={loading || Object.keys(groupedAppointments).length === 0 ? 'p-0' : undefined}>
            {loading ? (
              <PortalLoadingState label="Loading appointments…" />
            ) : Object.keys(groupedAppointments).length === 0 ? (
              <PortalEmptyState icon={Calendar} title="No appointments found" description="No appointments match the selected period." />
            ) : (
              <div className="max-h-[600px] space-y-6 overflow-y-auto pr-1">
                {Object.entries(groupedAppointments).map(([dateKey, appointments]) => (
                  <div key={dateKey}>
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-black/10 bg-black/[0.03]">
                        <CalendarDays className="h-4 w-4" style={{ color: BRAND_TEAL }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-black">{getDateLabel(dateKey)}</h3>
                        <p className="text-[11px] text-slate-500">{appointments.length} appointment(s)</p>
                      </div>
                    </div>
                    <div className="ml-4 space-y-2 border-l border-black/10 pl-5">
                      {appointments.map((appointment, index) => (
                        <div
                          key={index}
                          className="flex items-start justify-between gap-3 border border-black/10 bg-white px-4 py-3 transition-colors hover:border-black/25"
                        >
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <span className="truncate text-sm font-medium text-black">{appointment.claimantName}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{formatExpertType(appointment.expertType)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              <span>{format(new Date(appointment.appointmentDate), 'HH:mm')}</span>
                            </div>
                          </div>
                          <PortalPill className="shrink-0">{appointment.currentPhase}</PortalPill>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PortalCardBody>
        </PortalCard>
      </PortalPage>

      {/* System Request Dialog */}
      <Sheet open={systemRequestOpen} onOpenChange={setSystemRequestOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-lg"
        >
          <SheetHeader className="border-b border-black/10 px-4 py-4 text-left sm:px-6">
            <SheetTitle className="flex items-center gap-2 text-black">
              <Plus className="h-4 w-4" style={{ color: BRAND_TEAL }} /> System Appointment Request
            </SheetTitle>
            <SheetDescription>Submit a booking request through the system</SheetDescription>
          </SheetHeader>
          <div className="flex-1 px-4 py-4 sm:px-6">
            <RequestFormFields data={systemRequest} setData={setSystemRequest} />
          </div>
          <SheetFooter className="border-t border-black/10 px-4 py-4 sm:px-6">
            <Button variant="outline" className="rounded-none" onClick={() => setSystemRequestOpen(false)}>Cancel</Button>
            <Button className="rounded-none" onClick={handleSystemRequest} disabled={submitting || !systemRequest.firstName || !systemRequest.lastName}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit Request
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Email Request Dialog */}
      <Sheet open={emailRequestOpen} onOpenChange={setEmailRequestOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-lg"
        >
          <SheetHeader className="border-b border-black/10 px-4 py-4 text-left sm:px-6">
            <SheetTitle className="flex items-center gap-2 text-black">
              <Mail className="h-4 w-4" style={{ color: BRAND_TEAL }} /> Email Appointment Request
            </SheetTitle>
            <SheetDescription>Send a booking request via email with attachments</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
          <RequestFormFields data={emailRequest} setData={setEmailRequest} />
          <div>
            <Label className="flex items-center gap-2 text-xs text-slate-500">
              <Paperclip className="h-3.5 w-3.5" /> Attachments
            </Label>
            <Input
              className={cn(FIELD_CLASS, 'mt-1')}
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
                  <div key={i} className="flex items-center gap-2 border border-black/10 px-2 py-1 text-xs text-slate-500">
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <span className="truncate">{f.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="ml-auto h-5 w-5 shrink-0 rounded-none"
                      onClick={() => {
                        setEmailRequest(p => ({ ...p, attachments: p.attachments.filter((_, idx) => idx !== i) }));
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
          <SheetFooter className="border-t border-black/10 px-4 py-4 sm:px-6">
            <Button variant="outline" className="rounded-none" onClick={() => setEmailRequestOpen(false)}>Cancel</Button>
            <Button className="rounded-none" onClick={handleEmailRequest} disabled={emailSubmitting || !emailRequest.firstName || !emailRequest.lastName}>
              {emailSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Send Email Request
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AttorneyPortalLayout>
  );
};

export default AttorneyAppointments;
