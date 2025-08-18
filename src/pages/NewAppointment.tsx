import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CalendarIcon, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CompanyFooter from "@/components/CompanyFooter";

const NewAppointment = () => {
  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/new-appointment';
  const navigate = useNavigate();
  const [bookingType, setBookingType] = useState("single");
  const [attorneys, setAttorneys] = useState([]);
  const [claimants, setClaimants] = useState([]);
  const [experts, setExperts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    claimantId: "",
    expertId: "", 
    expertType: "",
    appointmentDate: "",
    appointmentTime: "",
    referringAttorney: "",
    assessmentType: "",
    location: "",
    assessmentFees: "",
    depositMade: "",
    fullPayment: "",
    paymentTerms: "",
    notes: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [attorneysRes, claimantsRes, expertsRes] = await Promise.all([
        supabase.from('law_firms').select('id, name, contact_person').order('name'),
        supabase.from('claimants').select('id, first_name, last_name, auto_id').order('first_name'),
        supabase.from('medical_experts').select('id, first_name, last_name, specializations, expert_type').order('first_name')
      ]);
      
      if (attorneysRes.error) throw attorneysRes.error;
      if (claimantsRes.error) throw claimantsRes.error;
      if (expertsRes.error) throw expertsRes.error;
      
      setAttorneys(attorneysRes.data || []);
      setClaimants(claimantsRes.data || []);
      setExperts(expertsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validate required fields
      if (!formData.claimantId || !formData.expertId || !formData.appointmentDate || !formData.referringAttorney) {
        toast.error('Please fill in all required fields');
        setSubmitting(false);
        return;
      }

      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        toast.error('You must be logged in to schedule appointments');
        setSubmitting(false);
        return;
      }

      // Get current user's law firm
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('law_firm_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.law_firm_id) {
        toast.error('User profile not found or no law firm associated');
        setSubmitting(false);
        return;
      }

      // Get attorney name instead of ID for the referring_attorney field
      const selectedAttorney = attorneys.find(att => att.id === formData.referringAttorney);
      if (!selectedAttorney) {
        toast.error('Selected attorney not found');
        setSubmitting(false);
        return;
      }

      // Combine date and time
      const appointmentDateTime = new Date(`${formData.appointmentDate}T${formData.appointmentTime || '09:00'}`);

      const appointmentData = {
        claimant_id: formData.claimantId,
        expert_id: formData.expertId,
        law_firm_id: profile.law_firm_id,
        referring_attorney: selectedAttorney.name, // Use attorney name, not ID
        appointment_date: appointmentDateTime.toISOString(),
        matter_type: formData.assessmentType || null, // This might be the issue - ensure it matches enum values
        service_fee: formData.assessmentFees ? parseFloat(formData.assessmentFees) : null,
        deposit_amount: formData.depositMade ? parseFloat(formData.depositMade) : 0,
        payment_terms: formData.paymentTerms || null,
        case_status: 'scheduled',
        payment_status: 'pending'
      };

      console.log('Submitting appointment data:', appointmentData);

      const { error } = await supabase
        .from('appointments')
        .insert([appointmentData]);

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      toast.success('Appointment scheduled successfully!');
      navigate('/scheduled-assessment');
    } catch (error) {
      console.error('Error creating appointment:', error);
      toast.error(`Failed to schedule appointment: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // When expert is selected, auto-populate expert type
    if (field === 'expertId' && value) {
      const selectedExpert = experts.find(expert => expert.id === value);
      if (selectedExpert) {
        setFormData(prev => ({
          ...prev,
          [field]: value,
          expertType: selectedExpert.expert_type || ''
        }));
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Schedule New Appointment - Medico-Legal Assessment System</title>
        <meta name="description" content="Schedule a new medical assessment appointment for claimants with available medical experts." />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Schedule New Appointment</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              New Assessment Appointment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Booking Type Selection */}
              <div className="space-y-3">
                <Label>Booking Type</Label>
                <RadioGroup value={bookingType} onValueChange={setBookingType} className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="single" id="single" />
                    <Label htmlFor="single">Single Booking</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="multiple" id="multiple" />
                    <Label htmlFor="multiple">Multiple Booking</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="claimant">Claimant Name *</Label>
                  <Select value={formData.claimantId} onValueChange={(value) => handleInputChange('claimantId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={loading ? "Loading claimants..." : "Select claimant"} />
                    </SelectTrigger>
                    <SelectContent>
                      {claimants.map((claimant) => (
                        <SelectItem key={claimant.id} value={claimant.id}>
                          {claimant.first_name} {claimant.last_name} ({claimant.auto_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medical-expert">Medical Expert *</Label>
                  <Select value={formData.expertId} onValueChange={(value) => handleInputChange('expertId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={loading ? "Loading experts..." : "Select medical expert"} />
                    </SelectTrigger>
                    <SelectContent>
                      {experts.map((expert) => (
                        <SelectItem key={expert.id} value={expert.id}>
                          Dr. {expert.first_name} {expert.last_name} - {expert.expert_type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expert-type">Type of Expert</Label>
                  <Input 
                    id="expert-type" 
                    placeholder="Expert type" 
                    value={formData.expertType}
                    onChange={(e) => handleInputChange('expertType', e.target.value)}
                    readOnly
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appointment-date">Appointment Date *</Label>
                  <Input 
                    type="date" 
                    id="appointment-date" 
                    value={formData.appointmentDate}
                    onChange={(e) => handleInputChange('appointmentDate', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appointment-time">Appointment Time</Label>
                  <Input 
                    type="time" 
                    id="appointment-time" 
                    value={formData.appointmentTime}
                    onChange={(e) => handleInputChange('appointmentTime', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="referring-attorney">Referring Attorney *</Label>
                  <Select value={formData.referringAttorney} onValueChange={(value) => handleInputChange('referringAttorney', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={loading ? "Loading attorneys..." : "Select referring attorney"} />
                    </SelectTrigger>
                    <SelectContent>
                      {attorneys.map((attorney) => (
                        <SelectItem key={attorney.id} value={attorney.id}>
                          {attorney.name} {attorney.contact_person && `- ${attorney.contact_person}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assessment-type">Assessment Type</Label>
                  <Select value={formData.assessmentType} onValueChange={(value) => handleInputChange('assessmentType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assessment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MVA">MVA</SelectItem>
                      <SelectItem value="Medical Negligence">Medical Negligence</SelectItem>
                      <SelectItem value="Assault Matter">Assault Matter</SelectItem>
                      <SelectItem value="Slip and Fall Matter">Slip and Fall Matter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input 
                    id="location" 
                    placeholder="Assessment location" 
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assessment-fees">Assessment Fees</Label>
                  <Input 
                    id="assessment-fees" 
                    type="number" 
                    placeholder="Enter assessment fees" 
                    value={formData.assessmentFees}
                    onChange={(e) => handleInputChange('assessmentFees', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deposit-made">Deposit Made</Label>
                  <Input 
                    id="deposit-made" 
                    type="number" 
                    placeholder="Enter deposit amount" 
                    value={formData.depositMade}
                    onChange={(e) => handleInputChange('depositMade', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full-payment">Full Payment</Label>
                  <Input 
                    id="full-payment" 
                    type="number" 
                    placeholder="Enter full payment amount" 
                    value={formData.fullPayment}
                    onChange={(e) => handleInputChange('fullPayment', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-terms">Terms of Payment</Label>
                  <Select value={formData.paymentTerms} onValueChange={(value) => handleInputChange('paymentTerms', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aod">AOD (Agreement on Demand)</SelectItem>
                      <SelectItem value="30-days">30 Days</SelectItem>
                      <SelectItem value="60-days">60 Days</SelectItem>
                      <SelectItem value="90-days">90 Days</SelectItem>
                      <SelectItem value="immediate">Immediate Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Special Instructions/Notes</Label>
                <Textarea 
                  id="notes" 
                  placeholder="Any special instructions or notes for the assessment"
                  rows={4}
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? 'Scheduling...' : 'Schedule Appointment'}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to="/">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>

      <CompanyFooter />
    </div>
  );
};

export default NewAppointment;