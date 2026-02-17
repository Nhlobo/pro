import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Building2, User, Phone, Mail, MapPin, Hash,
  Edit3, Send, CheckCircle2, Loader2, Copy
} from 'lucide-react';

interface AttorneyInfo {
  id: string;
  name: string;
  code: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
}

interface ProfileAttorneyDetailsProps {
  attorney: AttorneyInfo;
}

const ProfileAttorneyDetails: React.FC<ProfileAttorneyDetailsProps> = ({ attorney }) => {
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copyEmail, setCopyEmail] = useState(attorney.email || '');
  const [form, setForm] = useState({
    contactPerson: attorney.contact_person || '',
    email: attorney.email || '',
    phone: attorney.phone || '',
    address: attorney.address || '',
    notes: '',
    copyToEmail: attorney.email || '',
  });

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.notes.trim() && !form.phone && !form.email) {
      toast.error('Please describe the changes you would like to request');
      return;
    }
    setSubmitting(true);
    try {
      const updateDetails = `
        Attorney: ${attorney.name} (${attorney.code})
        Contact Person: ${form.contactPerson}
        Email: ${form.email}
        Phone: ${form.phone}
        Address: ${form.address}
        Notes / Requested Changes: ${form.notes}
      `;

      // Send update request email via edge function
      await supabase.functions.invoke('send-notification', {
        body: {
          type: 'profile_update_request',
          subject: `Profile Update Request – ${attorney.name}`,
          message: updateDetails,
          attorney_id: attorney.id,
          copy_to: form.copyToEmail || undefined,
        },
      });

      setSubmitted(true);
      toast.success('Update request sent! A copy has been emailed to you.');
    } catch (err: any) {
      toast.error('Failed to send update request. Please contact us directly.');
    } finally {
      setSubmitting(false);
    }
  };

  const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value?: string }> = ({ icon, label, value }) => (
    <div className="flex items-start gap-3 py-3">
      <div className="p-1.5 rounded-md bg-primary/10 shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-foreground mt-0.5 break-words">{value || <span className="text-muted-foreground italic">Not on record</span>}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Attorney Profile Card */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15 border border-primary/20">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{attorney.name}</CardTitle>
                <CardDescription className="flex items-center gap-1 mt-0.5">
                  <Hash className="h-3 w-3" /> Attorney Code: <span className="font-mono font-semibold">{attorney.code}</span>
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs px-3 py-1">
              Active Account
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <Separator className="mb-1" />
          <InfoRow icon={<User className="h-4 w-4 text-primary" />} label="Contact Person" value={attorney.contact_person} />
          <Separator />
          <InfoRow icon={<Mail className="h-4 w-4 text-primary" />} label="Email Address" value={attorney.email} />
          <Separator />
          <InfoRow icon={<Phone className="h-4 w-4 text-primary" />} label="Telephone" value={attorney.phone} />
          <Separator />
          <InfoRow icon={<MapPin className="h-4 w-4 text-primary" />} label="Office Address" value={attorney.address} />

          <div className="mt-4">
            {!showUpdateForm && !submitted && (
              <Button
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => setShowUpdateForm(true)}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Request Profile Update
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Update Request Form */}
      {showUpdateForm && !submitted && (
        <Card className="border-secondary/30 bg-secondary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-secondary" />
              Request Profile Update
            </CardTitle>
            <CardDescription>
              Fill in the correct details below. Our team will review and update your profile. A copy of this request will be emailed to you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  value={form.contactPerson}
                  onChange={e => handleChange('contactPerson', e.target.value)}
                  placeholder="Full name of contact person"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={e => handleChange('email', e.target.value)}
                  placeholder="attorney@lawfirm.co.za"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telephone / Cell</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={e => handleChange('phone', e.target.value)}
                  placeholder="+27 ..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Office Address</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={e => handleChange('address', e.target.value)}
                  placeholder="Street, City, Province"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Description of Changes / Additional Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={e => handleChange('notes', e.target.value)}
                placeholder="Please describe what needs to be updated or corrected..."
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="copyToEmail" className="flex items-center gap-1">
                <Copy className="h-3.5 w-3.5" /> Send Copy of Request To (your email)
              </Label>
              <Input
                id="copyToEmail"
                type="email"
                value={form.copyToEmail}
                onChange={e => handleChange('copyToEmail', e.target.value)}
                placeholder="your@email.com"
              />
              <p className="text-xs text-muted-foreground">A confirmation copy of this request will be sent to this email address.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="gap-2"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Sending...</>
                ) : (
                  <><Send className="h-4 w-4" />Submit Update Request</>
                )}
              </Button>
              <Button variant="ghost" onClick={() => setShowUpdateForm(false)} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success state */}
      {submitted && (
        <Card className="border-secondary/30 bg-secondary/5">
          <CardContent className="py-8 text-center space-y-3">
            <div className="mx-auto p-4 rounded-full bg-secondary/10 w-fit">
              <CheckCircle2 className="h-8 w-8 text-secondary" />
            </div>
            <h3 className="font-semibold text-foreground">Update Request Submitted</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Your profile update request has been received. Our team will process it shortly.
              A confirmation copy has been sent to <strong>{form.copyToEmail}</strong>.
            </p>
            <Button variant="outline" size="sm" onClick={() => { setSubmitted(false); setShowUpdateForm(false); }}>
              Done
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProfileAttorneyDetails;
