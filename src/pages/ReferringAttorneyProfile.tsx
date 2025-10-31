import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Save, Loader2, Building2, Mail, Phone, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import CompanyFooter from '@/components/CompanyFooter';

type ReferringAttorneyProfile = {
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
  const [profile, setProfile] = useState<ReferringAttorneyProfile | null>(null);
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

      // Get user's referring attorney ID
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('referring_attorney_id, role')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      // Check if user is a referring attorney
      if (userProfile.role !== 'referring_attorney' || !userProfile.referring_attorney_id) {
        toast({
          title: 'Access Denied',
          description: 'Only referring attorneys can access this page.',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      // Fetch referring attorney profile
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
      toast({
        title: 'Error',
        description: 'Failed to load your profile information.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile) return;

    try {
      setSaving(true);

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (formData.email && !emailRegex.test(formData.email)) {
        toast({
          title: 'Invalid Email',
          description: 'Please enter a valid email address.',
          variant: 'destructive',
        });
        return;
      }

      // Validate phone (basic validation)
      if (formData.phone && formData.phone.length < 10) {
        toast({
          title: 'Invalid Phone',
          description: 'Please enter a valid phone number.',
          variant: 'destructive',
        });
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

      toast({
        title: 'Profile Updated',
        description: 'Your company information has been successfully updated.',
      });

      // Refresh profile data
      await fetchProfile();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update your profile. Please try again.',
        variant: 'destructive',
      });
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
        <title>Company Profile - Medico-Legal Assessment System</title>
        <meta name="description" content="Update your company profile information" />
      </Helmet>

      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Company Profile</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Update your company contact information
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {profile && (
          <>
            {/* Company Info Card */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Information
                </CardTitle>
                <CardDescription>
                  Basic company details (read-only)
                </CardDescription>
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

            {/* Editable Contact Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Contact Information
                </CardTitle>
                <CardDescription>
                  Update your company contact details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="contact_person" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Contact Person
                    </Label>
                    <Input
                      id="contact_person"
                      value={formData.contact_person}
                      onChange={(e) => handleInputChange('contact_person', e.target.value)}
                      placeholder="Enter contact person name"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      The main contact person for your company
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="company@example.com"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Your company's primary email address
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="0123456789"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Your company's primary contact number
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="submit"
                      disabled={saving}
                      className="flex-1"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={fetchProfile}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <CompanyFooter />
    </div>
  );
};

export default ReferringAttorneyProfile;
