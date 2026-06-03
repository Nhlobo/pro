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
  User, Save, Calendar, ChevronLeft, ChevronRight, Plus, Trash2, Clock, CheckCircle2, Edit
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday, isSameDay
} from 'date-fns';

const PROVINCES = ['Gauteng', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'];

const ExpertProfile: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expertId, setExpertId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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
        });
      }

      // Load availability
      const { data: avail } = await supabase
        .from('expert_availability')
        .select('*')
        .eq('expert_id', prof.expert_id)
        .order('date');
      setAvailability(avail || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!expertId) return;
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
        updated_at: new Date().toISOString(),
      }).eq('id', expertId);
      if (error) throw error;
      toast({ title: 'Profile Updated', description: 'Your profile has been saved and populated to the system.' });
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
