import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Save, Loader2, Building2, Mail, Phone, User, Bell, FileText, CreditCard, CalendarPlus, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import CompanyFooter from '@/components/CompanyFooter';
import AttorneyBrandedHeader from '@/components/attorney-portal/AttorneyBrandedHeader';
import ProfileNotifications from '@/components/attorney-profile/ProfileNotifications';
import ProfileAODPayments from '@/components/attorney-profile/ProfileAODPayments';
import ProfileReportsDocuments from '@/components/attorney-profile/ProfileReportsDocuments';
import ProfileRequestAppointment from '@/components/attorney-profile/ProfileRequestAppointment';
import ProfileClaimantDocuments from '@/components/attorney-profile/ProfileClaimantDocuments';

type ReferringAttorneyProfileData = {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  attorney_role: string;
  province: string;
  code: string;
};

const ReferringAttorneyProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState<ReferringAttorneyProfileData | null>(null);
  const [formData, setFormData] = useState({
    contact_person: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('referring_attorney_id, role')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      if (userProfile.role !== 'referring_attorney' || !userProfile.referring_attorney_id) {
        toast({ title: 'Access Denied', description: 'Only referring attorneys can access this page.', variant: 'destructive' });
        navigate('/');
        return;
      }

      const { data: attorneyData, error: attorneyError } = await supabase
        .from('referring_attorneys')
        .select('*')
        .eq('id', userProfile.referring_attorney_id)
        .single();

      if (attorneyError) throw attorneyError;

      setProfile(attorneyData);
      setFormData({
        contact_person: attorneyData.contact_person || '',
        email: attorneyData.email || '',
        phone: attorneyData.phone || '',
      });
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast({ title: 'Error', description: 'Failed to load your profile information.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      setSaving(true);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (formData.email && !emailRegex.test(formData.email)) {
        toast({ title: 'Invalid Email', description: 'Please enter a valid email address.', variant: 'destructive' });
        return;
      }
      if (formData.phone && formData.phone.length < 10) {
        toast({ title: 'Invalid Phone', description: 'Please enter a valid phone number.', variant: 'destructive' });
        return;
      }

      const { error } = await supabase
        .from('referring_attorneys')
        .update({
          contact_person: formData.contact_person.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;
      toast({ title: 'Profile Updated', description: 'Your company information has been successfully updated.' });
      await fetchProfile();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({ title: 'Update Failed', description: error.message || 'Failed to update your profile.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Attorney Profile - Medico-Legal Assessment System</title>
        <meta name="description" content="Manage your attorney profile, notifications, reports, and payments" />
      </Helmet>

      <AttorneyBrandedHeader
        attorneyName={profile?.name}
        onTabChange={setActiveTab}
        activeTab={activeTab}
        showBackButton
        backTo="/"
      />

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto gap-1">
            <TabsTrigger value="profile" className="flex items-center gap-1 text-xs sm:text-sm">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
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

          {/* Profile Tab */}
          <TabsContent value="profile">
            {profile && (
              <div className="max-w-4xl space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Company Information
                    </CardTitle>
                    <CardDescription>Basic company details (read-only)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Company Name</Label>
                        <p className="font-medium text-lg">{profile.name}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Company Code</Label>
                        <p className="font-medium text-lg">{profile.code}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Province</Label>
                        <p className="font-medium">{profile.province}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Attorney Role</Label>
                        <p className="font-medium">{profile.attorney_role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Contact Information
                    </CardTitle>
                    <CardDescription>Update your company contact details</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="contact_person" className="flex items-center gap-2">
                          <User className="h-4 w-4" /> Contact Person
                        </Label>
                        <Input id="contact_person" value={formData.contact_person} onChange={(e) => handleInputChange('contact_person', e.target.value)} placeholder="Enter contact person name" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="flex items-center gap-2">
                          <Mail className="h-4 w-4" /> Email Address
                        </Label>
                        <Input id="email" type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="company@example.com" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="flex items-center gap-2">
                          <Phone className="h-4 w-4" /> Phone Number
                        </Label>
                        <Input id="phone" type="tel" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} placeholder="0123456789" required />
                      </div>
                      <div className="flex gap-3 pt-4">
                        <Button type="submit" disabled={saving} className="flex-1">
                          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Save className="h-4 w-4 mr-2" /> Save Changes</>}
                        </Button>
                        <Button type="button" variant="outline" onClick={fetchProfile} disabled={saving}>Cancel</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <ProfileNotifications />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <ProfileReportsDocuments />
          </TabsContent>

          {/* AOD & Payments Tab */}
          <TabsContent value="aod-payments">
            <ProfileAODPayments />
          </TabsContent>

          {/* Request Appointment Tab */}
          <TabsContent value="request">
            <ProfileRequestAppointment />
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <ProfileClaimantDocuments />
          </TabsContent>
        </Tabs>
      </main>

      <CompanyFooter />
    </div>
  );
};

export default ReferringAttorneyProfile;
