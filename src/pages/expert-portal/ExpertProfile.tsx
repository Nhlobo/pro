import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  User, Save, Calendar, ChevronLeft, ChevronRight, Plus, Trash2, Clock, CheckCircle2, Edit, AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday, isSameDay
} from 'date-fns';

const PROVINCES = ['Gauteng', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'];

const MAX_FEE = 10_000_000;
const FEE_KEYS = ['consultation_fee_mva', 'consultation_fee_med_neg', 'merit_fees', 'consultation_fee_per_hour', 'court_fees'];

const formatZAR = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  const num = Number(digits);
  if (!num) return '';
  return `R${num.toLocaleString('en-ZA')}`;
};

const validateFeeValue = (value: string): string | null => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null; // empty is valid (cleared)
  const num = Number(digits);
  if (Number.isNaN(num)) return 'Enter a valid numeric amount';
  if (num < 0) return 'Amount cannot be negative';
  if (num > MAX_FEE) return `Maximum allowed is R${MAX_FEE.toLocaleString('en-ZA')}`;
  return null;
};

const ExpertProfile: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expertId, setExpertId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feeErrors, setFeeErrors] = useState<Record<string, string>>({});
  const [feeHistory, setFeeHistory] = useState<any[]>([]);
  const [reviewRequests, setReviewRequests] = useState<any[]>([]);
  const [reviewForm, setReviewForm] = useState({
    fee_field: 'consultation_fee_mva',
    proposed_value: '',
    effective_date: format(new Date(new Date().getFullYear() + 1, 0, 1), 'yyyy-MM-dd'),
    reason: '',
  });
  const [submittingReview, setSubmittingReview] = useState(false);

  // Availability calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [availNotes, setAvailNotes] = useState('');
  const [availIsAvailable, setAvailIsAvailable] = useState(true);
  const [availStart, setAvailStart] = useState('09:00');
  const [availEnd, setAvailEnd] = useState('17:00');

  // Form state
  const [form, setForm] = useState({
    practice_address: '',
    contact_number: '',
    email: '',
    qualifications: '',
    years_experience: 0,
    availability_notes: '',
    personal_assistant_name: '',
    personal_assistant_contact: '',
    practice_company_name: '',
    province: '',
    consultation_fee_mva: '',
    consultation_fee_med_neg: '',
    merit_fees: '',
    consultation_fee_per_hour: '',
    court_fees: '',
  });

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('expert_id').eq('id', user.id).single();
      if (!prof?.expert_id) { setLoading(false); return; }
      setExpertId(prof.expert_id);

      const { data: expert } = await supabase.from('medical_experts').select('*').eq('id', prof.expert_id).single();
      if (expert) {
        setProfile(expert);
        setForm({
          practice_address: expert.practice_address || '',
          contact_number: expert.contact_number || '',
          email: expert.email || '',
          qualifications: expert.qualifications || '',
          years_experience: expert.years_experience || 0,
          availability_notes: expert.availability_notes || '',
          personal_assistant_name: expert.personal_assistant_name || '',
          personal_assistant_contact: expert.personal_assistant_contact || '',
          practice_company_name: expert.practice_company_name || '',
          province: expert.province || '',
          consultation_fee_mva: expert.consultation_fee_mva != null ? String(expert.consultation_fee_mva) : '',
          consultation_fee_med_neg: expert.consultation_fee_med_neg != null ? String(expert.consultation_fee_med_neg) : '',
          merit_fees: (expert as any).merit_fees != null ? String((expert as any).merit_fees) : '',
          consultation_fee_per_hour: expert.consultation_fee_per_hour != null ? String(expert.consultation_fee_per_hour) : '',
          court_fees: expert.court_fees != null ? String(expert.court_fees) : '',
        });
      }

      // Load availability
      const { data: avail } = await supabase
        .from('expert_availability')
        .select('*')
        .eq('expert_id', prof.expert_id)
        .order('date');
      setAvailability(avail || []);
      await loadFeeHistory(prof.expert_id);
      setLoading(false);
    };
    load();
  }, [user]);

  const loadFeeHistory = async (eid: string) => {
    const { data } = await (supabase as any)
      .from('expert_fee_history')
      .select('*')
      .eq('expert_id', eid)
      .order('changed_at', { ascending: false })
      .limit(50);
    setFeeHistory(data || []);
    const { data: reqs } = await (supabase as any)
      .from('expert_fee_review_requests')
      .select('*')
      .eq('expert_id', eid)
      .order('created_at', { ascending: false })
      .limit(50);
    setReviewRequests(reqs || []);
  };

  const submitReviewRequest = async () => {
    if (!expertId) return;
    const digits = reviewForm.proposed_value.replace(/\D/g, '');
    const proposed = Number(digits);
    if (!digits || !proposed || proposed < 0 || proposed > MAX_FEE) {
      toast({ title: 'Invalid amount', description: 'Enter a valid proposed fee amount.', variant: 'destructive' });
      return;
    }
    if (!reviewForm.effective_date) {
      toast({ title: 'Effective date required', variant: 'destructive' });
      return;
    }
    if (!reviewForm.reason.trim() || reviewForm.reason.trim().length < 5) {
      toast({ title: 'Reason required', description: 'Please provide a brief reason (at least 5 characters).', variant: 'destructive' });
      return;
    }
    setSubmittingReview(true);
    try {
      const current = (form as any)[reviewForm.fee_field];
      const currentNum = current ? Number(String(current).replace(/\D/g, '')) || null : null;
      const { error } = await (supabase as any).from('expert_fee_review_requests').insert({
        expert_id: expertId,
        submitted_by: user?.id || null,
        fee_field: reviewForm.fee_field,
        current_value: currentNum,
        proposed_value: proposed,
        effective_date: reviewForm.effective_date,
        reason: reviewForm.reason.trim(),
      });
      if (error) throw error;
      toast({ title: 'Request submitted', description: 'Your annual fee review request has been sent for approval.' });
      setReviewForm(f => ({ ...f, proposed_value: '', reason: '' }));
      await loadFeeHistory(expertId);
    } catch (e: any) {
      toast({ title: 'Submission failed', description: e?.message || 'Could not submit request.', variant: 'destructive' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const cancelReviewRequest = async (id: string) => {
    if (!expertId) return;
    const { error } = await (supabase as any).from('expert_fee_review_requests').delete().eq('id', id);
    if (error) {
      toast({ title: 'Cancel failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Request cancelled' });
    await loadFeeHistory(expertId);
  };



  const handleSaveProfile = async () => {
    if (!expertId) return;

    // Validate all fee fields before saving
    const errors: Record<string, string> = {};
    FEE_KEYS.forEach((key) => {
      const err = validateFeeValue((form as any)[key]);
      if (err) errors[key] = err;
    });
    setFeeErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast({ title: 'Validation Error', description: 'Please correct the highlighted fee fields before saving.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('medical_experts').update({
        practice_address: form.practice_address,
        contact_number: form.contact_number,
        email: form.email,
        qualifications: form.qualifications,
        years_experience: form.years_experience,
        availability_notes: form.availability_notes,
        personal_assistant_name: form.personal_assistant_name,
        personal_assistant_contact: form.personal_assistant_contact,
        practice_company_name: form.practice_company_name,
        province: form.province,
        consultation_fee_mva: form.consultation_fee_mva ? Number(form.consultation_fee_mva.replace(/\D/g, '')) || null : null,
        consultation_fee_med_neg: form.consultation_fee_med_neg ? Number(form.consultation_fee_med_neg.replace(/\D/g, '')) || null : null,
        merit_fees: form.merit_fees ? Number(form.merit_fees.replace(/\D/g, '')) || null : null,
        consultation_fee_per_hour: form.consultation_fee_per_hour ? Number(form.consultation_fee_per_hour.replace(/\D/g, '')) || null : null,
        court_fees: form.court_fees ? Number(form.court_fees.replace(/\D/g, '')) || null : null,
        consultation_fees: (form.consultation_fee_med_neg ? Number(form.consultation_fee_med_neg.replace(/\D/g, '')) : null)
          ?? (form.consultation_fee_mva ? Number(form.consultation_fee_mva.replace(/\D/g, '')) : null)
          ?? (form.consultation_fee_per_hour ? Number(form.consultation_fee_per_hour.replace(/\D/g, '')) : null),
        updated_at: new Date().toISOString(),
      }).eq('id', expertId);
      if (error) throw error;
      setFeeErrors({});
      window.dispatchEvent(new CustomEvent('medical-expert-updated', { detail: { expertId } }));
      await loadFeeHistory(expertId);
      toast({ title: 'Profile Updated', description: 'Your profile and fees have been saved and populated to the system.' });
      setEditing(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSetAvailability = async () => {
    if (!expertId || !selectedDate) return;
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const existing = availability.find(a => a.date === dateStr);

      if (existing) {
        const { error } = await supabase.from('expert_availability').update({
          is_available: availIsAvailable,
          start_time: availStart,
          end_time: availEnd,
          notes: availNotes || null,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('expert_availability').insert({
          expert_id: expertId,
          date: dateStr,
          is_available: availIsAvailable,
          start_time: availStart,
          end_time: availEnd,
          notes: availNotes || null,
        });
        if (error) throw error;
      }

      // Refresh
      const { data } = await supabase.from('expert_availability').select('*').eq('expert_id', expertId).order('date');
      setAvailability(data || []);
      toast({ title: 'Availability Updated', description: `${format(selectedDate, 'dd MMM yyyy')} updated.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleRemoveAvailability = async (id: string) => {
    try {
      await supabase.from('expert_availability').delete().eq('id', id);
      setAvailability(prev => prev.filter(a => a.id !== id));
      toast({ title: 'Removed', description: 'Availability entry removed.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Calendar
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = monthStart.getDay();
  const paddingDays = (startDay === 0 ? 6 : startDay - 1);

  const getAvailForDate = (date: Date) => availability.find(a => isSameDay(parseISO(a.date), date));

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading profile...</div>;
  if (!expertId) return <div className="text-center py-12 text-muted-foreground">Expert profile not linked. Contact an administrator.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <User className="h-6 w-6 text-primary" /> My Profile
          </h1>
          <p className="text-sm text-muted-foreground">Manage your professional details and availability</p>
        </div>
        {!editing ? (
          <Button onClick={() => setEditing(true)} variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-1" /> Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveProfile} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </div>

      {/* Profile Info */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Professional Details</CardTitle>
            <CardDescription className="text-xs">
              {profile?.first_name} {profile?.last_name} — {profile?.expert_type}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Province</Label>
                {editing ? (
                  <Select value={form.province} onValueChange={v => setForm(f => ({ ...f, province: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <p className="text-sm text-foreground">{form.province || '—'}</p>}
              </div>
              <div>
                <Label className="text-xs">Years Experience</Label>
                {editing ? (
                  <Input type="number" value={form.years_experience} onChange={e => setForm(f => ({ ...f, years_experience: parseInt(e.target.value) || 0 }))} />
                ) : <p className="text-sm text-foreground">{form.years_experience || '—'}</p>}
              </div>
            </div>
            <div>
              <Label className="text-xs">Qualifications</Label>
              {editing ? (
                <Textarea value={form.qualifications} onChange={e => setForm(f => ({ ...f, qualifications: e.target.value }))} rows={2} />
              ) : <p className="text-sm text-foreground">{form.qualifications || '—'}</p>}
            </div>
            <div>
              <Label className="text-xs">Practice / Company Name</Label>
              {editing ? (
                <Input value={form.practice_company_name} onChange={e => setForm(f => ({ ...f, practice_company_name: e.target.value }))} />
              ) : <p className="text-sm text-foreground">{form.practice_company_name || '—'}</p>}
            </div>
            <div>
              <Label className="text-xs">Practice Address</Label>
              {editing ? (
                <Textarea value={form.practice_address} onChange={e => setForm(f => ({ ...f, practice_address: e.target.value }))} rows={2} />
              ) : <p className="text-sm text-foreground">{form.practice_address || '—'}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Email</Label>
              {editing ? (
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              ) : <p className="text-sm text-foreground">{form.email || '—'}</p>}
            </div>
            <div>
              <Label className="text-xs">Contact Number</Label>
              {editing ? (
                <Input value={form.contact_number} onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))} />
              ) : <p className="text-sm text-foreground">{form.contact_number || '—'}</p>}
            </div>
            <Separator />
            <div>
              <Label className="text-xs">Personal Assistant Name</Label>
              {editing ? (
                <Input value={form.personal_assistant_name} onChange={e => setForm(f => ({ ...f, personal_assistant_name: e.target.value }))} />
              ) : <p className="text-sm text-foreground">{form.personal_assistant_name || '—'}</p>}
            </div>
            <div>
              <Label className="text-xs">PA Contact</Label>
              {editing ? (
                <Input value={form.personal_assistant_contact} onChange={e => setForm(f => ({ ...f, personal_assistant_contact: e.target.value }))} />
              ) : <p className="text-sm text-foreground">{form.personal_assistant_contact || '—'}</p>}
            </div>
            <div>
              <Label className="text-xs">Availability Notes</Label>
              {editing ? (
                <Textarea value={form.availability_notes} onChange={e => setForm(f => ({ ...f, availability_notes: e.target.value }))} rows={2} />
              ) : <p className="text-sm text-foreground">{form.availability_notes || '—'}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Consultation & Court Fees */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Consultation & Court Fees (ZAR)</CardTitle>
          <CardDescription className="text-xs">Edits save to the system directory and credit control instantly</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          {[
            { key: 'consultation_fee_mva', label: 'MVA Consultation Fee' },
            { key: 'consultation_fee_med_neg', label: 'Med-Neg Consultation Fee' },
            { key: 'merit_fees', label: 'Merit Fees' },
            { key: 'consultation_fee_per_hour', label: 'Hourly Rate' },
            { key: 'court_fees', label: 'Court Fee' },
          ].map(({ key, label }) => {
            const value = (form as any)[key] as string;
            const error = feeErrors[key];
            return (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                {editing ? (
                  <>
                    <Input
                      inputMode="numeric"
                      value={value}
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setForm(f => ({ ...f, [key]: raw }));
                        setFeeErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
                      }}
                      onBlur={() => {
                        const err = validateFeeValue(value);
                        if (err) setFeeErrors(prev => ({ ...prev, [key]: err }));
                      }}
                      placeholder="0"
                      className={error ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {error && (
                      <div className="flex items-center gap-1 mt-1 text-red-600 text-xs">
                        <AlertCircle className="h-3 w-3" />
                        {error}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-foreground">
                    {value ? formatZAR(value) : '—'}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Annual Fee Review Request */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Edit className="h-4 w-4 text-primary" /> Annual Fee Review Request
          </CardTitle>
          <CardDescription className="text-xs">
            Submit a proposed fee change with an effective date and reason. Pending requests will be reviewed by an administrator before taking effect.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Fee</Label>
              <Select value={reviewForm.fee_field} onValueChange={(v) => setReviewForm(f => ({ ...f, fee_field: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation_fee_mva">MVA Consultation Fee</SelectItem>
                  <SelectItem value="consultation_fee_med_neg">Med-Neg Consultation Fee</SelectItem>
                  <SelectItem value="merit_fees">Merit Fees</SelectItem>
                  <SelectItem value="consultation_fee_per_hour">Hourly Rate</SelectItem>
                  <SelectItem value="court_fees">Court Fee</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Current: {(() => {
                  const cv = (form as any)[reviewForm.fee_field];
                  return cv ? formatZAR(cv) : '—';
                })()}
              </p>
            </div>
            <div>
              <Label className="text-xs">Proposed Amount (ZAR)</Label>
              <Input
                inputMode="numeric"
                value={reviewForm.proposed_value ? formatZAR(reviewForm.proposed_value) : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, '');
                  setReviewForm(f => ({ ...f, proposed_value: raw }));
                }}
                placeholder="R0"
              />
            </div>
            <div>
              <Label className="text-xs">Effective Date</Label>
              <Input
                type="date"
                value={reviewForm.effective_date}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={e => setReviewForm(f => ({ ...f, effective_date: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={submitReviewRequest} disabled={submittingReview} className="w-full">
                {submittingReview ? 'Submitting…' : 'Submit Request'}
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Reason for Change</Label>
            <Textarea
              rows={2}
              value={reviewForm.reason}
              onChange={e => setReviewForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Annual inflation adjustment, increased operational costs, scope expansion…"
            />
          </div>

          <Separator />

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Your Requests</p>
            {reviewRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fee review requests submitted yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 pr-3 font-medium">Submitted</th>
                      <th className="text-left py-2 pr-3 font-medium">Fee</th>
                      <th className="text-left py-2 pr-3 font-medium">Current → Proposed</th>
                      <th className="text-left py-2 pr-3 font-medium">Effective</th>
                      <th className="text-left py-2 pr-3 font-medium">Reason</th>
                      <th className="text-left py-2 pr-3 font-medium">Status</th>
                      <th className="text-right py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewRequests.map((r) => {
                      const labels: Record<string, string> = {
                        consultation_fee_mva: 'MVA Consultation',
                        consultation_fee_med_neg: 'Med-Neg Consultation',
                        merit_fees: 'Merit Fees',
                        consultation_fee_per_hour: 'Hourly Rate',
                        court_fees: 'Court Fee',
                      };
                      const fmt = (v: any) => v == null ? '—' : `R${Number(v).toLocaleString('en-ZA')}`;
                      const variant = r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary';
                      return (
                        <tr key={r.id} className="border-b border-border/30 align-top">
                          <td className="py-2 pr-3 text-xs text-muted-foreground">{format(parseISO(r.created_at), 'dd MMM yyyy')}</td>
                          <td className="py-2 pr-3">{labels[r.fee_field] || r.fee_field}</td>
                          <td className="py-2 pr-3">{fmt(r.current_value)} → <span className="font-medium">{fmt(r.proposed_value)}</span></td>
                          <td className="py-2 pr-3 text-xs">{format(parseISO(r.effective_date), 'dd MMM yyyy')}</td>
                          <td className="py-2 pr-3 text-xs max-w-xs truncate" title={r.reason}>{r.reason}</td>
                          <td className="py-2 pr-3"><Badge variant={variant as any} className="capitalize">{r.status}</Badge></td>
                          <td className="py-2 text-right">
                            {r.status === 'pending' && (
                              <Button size="sm" variant="ghost" onClick={() => cancelReviewRequest(r.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fee Change History */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Fee Change History
          </CardTitle>
          <CardDescription className="text-xs">
            Audit log of previous fee values with timestamps (last 50 changes)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feeHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fee changes recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">When</th>
                    <th className="text-left py-2 pr-4 font-medium">Fee</th>
                    <th className="text-left py-2 pr-4 font-medium">Previous</th>
                    <th className="text-left py-2 pr-4 font-medium">New</th>
                  </tr>
                </thead>
                <tbody>
                  {feeHistory.map((h) => {
                    const labels: Record<string, string> = {
                      consultation_fee_mva: 'MVA Consultation',
                      consultation_fee_med_neg: 'Med-Neg Consultation',
                      merit_fees: 'Merit Fees',
                      consultation_fee_per_hour: 'Hourly Rate',
                      court_fees: 'Court Fee',
                    };
                    const fmt = (v: any) =>
                      v == null ? <span className="text-muted-foreground">—</span> : `R${Number(v).toLocaleString('en-ZA')}`;
                    return (
                      <tr key={h.id} className="border-b border-border/30">
                        <td className="py-2 pr-4 text-xs text-muted-foreground">
                          {format(parseISO(h.changed_at), 'dd MMM yyyy HH:mm')}
                        </td>
                        <td className="py-2 pr-4">{labels[h.fee_field] || h.fee_field}</td>
                        <td className="py-2 pr-4">{fmt(h.old_value)}</td>
                        <td className="py-2 pr-4 font-medium">{fmt(h.new_value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>



      {/* Availability Calendar */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Availability Calendar
          </CardTitle>
          <CardDescription className="text-xs">Mark your available and unavailable dates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Calendar Grid */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold text-sm">{format(currentMonth, 'MMMM yyyy')}</span>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <div key={d} className="text-[10px] font-medium text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: paddingDays }).map((_, i) => <div key={`p-${i}`} className="h-10" />)}
                {daysInMonth.map(day => {
                  const avail = getAvailForDate(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const today = isToday(day);
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => {
                        setSelectedDate(day);
                        if (avail) {
                          setAvailIsAvailable(avail.is_available);
                          setAvailStart(avail.start_time || '09:00');
                          setAvailEnd(avail.end_time || '17:00');
                          setAvailNotes(avail.notes || '');
                        } else {
                          setAvailIsAvailable(true);
                          setAvailStart('09:00');
                          setAvailEnd('17:00');
                          setAvailNotes('');
                        }
                      }}
                      className={`h-10 rounded-lg text-xs relative transition-all
                        ${isSelected ? 'ring-2 ring-primary' : ''}
                        ${avail ? (avail.is_available ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive') : today ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'}
                      `}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-success/30" /> Available</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/30" /> Unavailable</span>
              </div>
            </div>

            {/* Set Availability Panel */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm text-foreground">
                {selectedDate ? format(selectedDate, 'dd MMMM yyyy') : 'Select a date'}
              </h4>
              {selectedDate && (
                <>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={availIsAvailable ? 'available' : 'unavailable'} onValueChange={v => setAvailIsAvailable(v === 'available')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="unavailable">Unavailable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {availIsAvailable && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Start</Label>
                        <Input type="time" value={availStart} onChange={e => setAvailStart(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">End</Label>
                        <Input type="time" value={availEnd} onChange={e => setAvailEnd(e.target.value)} />
                      </div>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Textarea value={availNotes} onChange={e => setAvailNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
                  </div>
                  <Button size="sm" className="w-full" onClick={handleSetAvailability}>
                    <Save className="h-4 w-4 mr-1" /> Save Availability
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpertProfile;
