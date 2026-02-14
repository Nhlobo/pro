import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { CalendarPlus, Loader2, Send } from 'lucide-react';

const expertTypes = [
  'Orthopaedic Surgeon',
  'Neurosurgeon',
  'Neurologist',
  'Clinical Psychologist',
  'Neuropsychologist',
  'Psychiatrist',
  'Occupational Therapist',
  'Industrial Psychologist',
  'Physiotherapist',
  'Radiologist',
  'General Practitioner',
  'ENT Specialist',
  'Ophthalmologist',
  'Plastic Surgeon',
  'Maxillofacial Surgeon',
  'Paediatrician',
  'Addendum (Post-Report)',
  'Affidavits',
  'Joint Minutes (Post-Report)',
];

const provinces = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
  'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'
];

const matterTypes = [
  'Road Accident Fund (RAF)',
  'Medical Negligence',
  'Slip & Fall',
  'Unlawful Arrest',
  'Product Liability',
  'Other'
];

interface ProfileRequestAppointmentProps {
  referringAttorneyId?: string;
  attorneyName?: string;
  attorneyEmail?: string;
}

const ProfileRequestAppointment: React.FC<ProfileRequestAppointmentProps> = ({ referringAttorneyId: propAttorneyId, attorneyName, attorneyEmail }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    claimant_first_name: '',
    claimant_last_name: '',
    expert_type: '',
    matter_type: '',
    province: '',
    preferred_date_type: 'specific_date',
    suggested_date: '',
    suggested_month: '',
    is_minor: false,
    guardian_name: '',
    additional_notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    try {
      let refAttorneyId = propAttorneyId;
      let refAttorneyName = attorneyName || 'Unknown';
      let refAttorneyEmail = attorneyEmail || null;

      if (!refAttorneyId && user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('referring_attorney_id, first_name, last_name')
          .eq('id', user.id)
          .single();

        if (!profile?.referring_attorney_id) {
          throw new Error('No referring attorney linked to your account');
        }

        refAttorneyId = profile.referring_attorney_id;

        const { data: attorney } = await supabase
          .from('referring_attorneys')
          .select('name, email')
          .eq('id', profile.referring_attorney_id)
          .single();

        refAttorneyName = attorney?.name || 'Unknown';
        refAttorneyEmail = attorney?.email || null;
      }

      if (!refAttorneyId) {
        throw new Error('No referring attorney information available');
      }

      const { error } = await supabase.from('appointment_requests').insert({
        claimant_first_name: formData.claimant_first_name.trim(),
        claimant_last_name: formData.claimant_last_name.trim(),
        expert_type_requested: formData.expert_type,
        matter_type: formData.matter_type,
        province: formData.province,
        preferred_date_type: formData.preferred_date_type,
        suggested_date: formData.suggested_date || null,
        suggested_month: formData.suggested_month || null,
        is_minor: formData.is_minor,
        guardian_name: formData.is_minor ? formData.guardian_name : null,
        additional_notes: formData.additional_notes || null,
        referring_attorney_id: refAttorneyId,
        referring_attorney_name: refAttorneyName,
        attorney_email: refAttorneyEmail,
        requested_by: user?.id || refAttorneyId,
        status: 'pending',
      });

      if (error) throw error;

      toast({ title: 'Request Submitted', description: 'Your appointment request has been submitted successfully.' });
      setFormData({
        claimant_first_name: '', claimant_last_name: '', expert_type: '', matter_type: '',
        province: '', preferred_date_type: 'specific_date', suggested_date: '', suggested_month: '',
        is_minor: false, guardian_name: '', additional_notes: '',
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to submit request.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarPlus className="h-5 w-5 text-kutlwano-blue" />
          Request New Appointment
        </CardTitle>
        <CardDescription>Submit a new appointment request for assessment</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Claimant First Name *</Label>
              <Input
                value={formData.claimant_first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, claimant_first_name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Claimant Last Name *</Label>
              <Input
                value={formData.claimant_last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, claimant_last_name: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Expert Type *</Label>
              <Select value={formData.expert_type} onValueChange={(v) => setFormData(prev => ({ ...prev, expert_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Select expert type" /></SelectTrigger>
                <SelectContent>
                  {expertTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Matter Type *</Label>
              <Select value={formData.matter_type} onValueChange={(v) => setFormData(prev => ({ ...prev, matter_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Select matter type" /></SelectTrigger>
                <SelectContent>
                  {matterTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Province *</Label>
              <Select value={formData.province} onValueChange={(v) => setFormData(prev => ({ ...prev, province: v }))}>
                <SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger>
                <SelectContent>
                  {provinces.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Preferred Date</Label>
              <Input
                type="date"
                value={formData.suggested_date}
                onChange={(e) => setFormData(prev => ({ ...prev, suggested_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={formData.is_minor}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_minor: !!checked }))}
            />
            <Label>Claimant is a minor</Label>
          </div>

          {formData.is_minor && (
            <div className="space-y-2">
              <Label>Guardian Name</Label>
              <Input
                value={formData.guardian_name}
                onChange={(e) => setFormData(prev => ({ ...prev, guardian_name: e.target.value }))}
                placeholder="Parent/Guardian name"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Textarea
              value={formData.additional_notes}
              onChange={(e) => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
              placeholder="Any special requests or additional information..."
              rows={3}
            />
          </div>

          <Button type="submit" disabled={submitting || !formData.claimant_first_name || !formData.expert_type || !formData.matter_type || !formData.province} className="w-full">
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : <><Send className="h-4 w-4 mr-2" /> Submit Request</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProfileRequestAppointment;
