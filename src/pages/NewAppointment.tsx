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
import { formatExpertType, normalizeExpertType, matchesExpertType, getUniqueExpertTypes } from "@/utils/expertTypeMapping";

const NewAppointment = () => {
  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/new-appointment';
  const navigate = useNavigate();
  const [bookingType, setBookingType] = useState("single");
  const [attorneys, setAttorneys] = useState([]);
  const [claimants, setClaimants] = useState([]);
  const [experts, setExperts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appointmentQueue, setAppointmentQueue] = useState([]);
  
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

  const [filteredExperts, setFilteredExperts] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [attorneysRes, claimantsRes, expertsRes] = await Promise.all([
        supabase.rpc('get_law_firms_list'),
        supabase.rpc('get_claimants_secure'),
        supabase.rpc('get_medical_experts_secure')
      ]);
      
      if (attorneysRes.error) throw attorneysRes.error;
      if (claimantsRes.error) throw claimantsRes.error;
      if (expertsRes.error) throw expertsRes.error;
      
      setAttorneys(attorneysRes.data || []);
      setClaimants(claimantsRes.data || []);
      setExperts(expertsRes.data || []);
      setFilteredExperts(expertsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  // Filter experts based on selected expert type - handles all variations
  useEffect(() => {
    if (formData.expertType && experts.length > 0) {
      const filtered = experts.filter(expert => 
        matchesExpertType(expert.expert_type, formData.expertType)
      );
      setFilteredExperts(filtered);
    } else {
      setFilteredExperts(experts);
    }
  }, [formData.expertType, experts]);

  const addToQueue = async () => {
    // Validate required fields for queue
    if (!formData.claimantId || !formData.expertId || !formData.expertType || !formData.appointmentDate || !formData.referringAttorney) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Get claimant and expert names for display
    const selectedClaimant = claimants.find(c => c.id === formData.claimantId);
    const selectedExpert = experts.find(e => e.id === formData.expertId);
    const selectedAttorney = attorneys.find(a => a.id === formData.referringAttorney);

    const queueItem = {
      id: Date.now(), // Temporary ID for queue management
      ...formData,
      claimantName: `${selectedClaimant?.first_name} ${selectedClaimant?.last_name} (${selectedClaimant?.auto_id})`,
      expertName: `Dr. ${selectedExpert?.first_name} ${selectedExpert?.last_name}`,
      attorneyName: selectedAttorney?.name
    };

    setAppointmentQueue(prev => [...prev, queueItem]);
    
    // Reset form for next appointment
    setFormData({
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

    toast.success('Appointment added to queue');
  };

  const removeFromQueue = (id) => {
    setAppointmentQueue(prev => prev.filter(item => item.id !== id));
    toast.success('Appointment removed from queue');
  };

  const submitQueue = async () => {
    if (appointmentQueue.length === 0) {
      toast.error('No appointments in queue to submit');
      return;
    }

    setSubmitting(true);

    try {
      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        toast.error('You must be logged in to schedule appointments');
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
        return;
      }

      // Prepare all appointments for batch insert
      const appointmentsData = appointmentQueue.map(item => {
        const appointmentDateTime = new Date(`${item.appointmentDate}T${item.appointmentTime || '09:00'}`);
        
        return {
          claimant_id: item.claimantId,
          expert_id: item.expertId,
          law_firm_id: profile.law_firm_id,
          referring_attorney: item.attorneyName,
          appointment_date: appointmentDateTime.toISOString(),
          matter_type: item.assessmentType || null,
          service_fee: item.assessmentFees ? parseFloat(item.assessmentFees) : null,
          deposit_amount: item.depositMade ? parseFloat(item.depositMade) : 0,
          payment_terms: item.paymentTerms || null,
          case_status: 'scheduled',
          payment_status: 'pending'
        };
      });

      const { data: insertedAppointments, error } = await supabase
        .from('appointments')
        .insert(appointmentsData)
        .select();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      // Send confirmation emails for each appointment
      await sendAppointmentConfirmations(insertedAppointments);

      toast.success(`${appointmentQueue.length} appointments scheduled successfully!`);
      setAppointmentQueue([]);
      navigate('/scheduled-assessment');
    } catch (error) {
      console.error('Error creating appointments:', error);
      toast.error(`Failed to schedule appointments: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validate required fields
      if (!formData.claimantId || !formData.expertId || !formData.expertType || !formData.appointmentDate || !formData.referringAttorney) {
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

      const { data: insertedAppointment, error } = await supabase
        .from('appointments')
        .insert([appointmentData])
        .select();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      // Send confirmation emails
      await sendAppointmentConfirmations(insertedAppointment);

      toast.success('Appointment scheduled successfully!');
      navigate('/scheduled-assessment');
    } catch (error) {
      console.error('Error creating appointment:', error);
      toast.error(`Failed to schedule appointment: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const sendAppointmentConfirmations = async (appointments) => {
    try {
      for (const appointment of appointments) {
        // Get claimant, expert, and attorney details
        const [claimantRes, expertRes] = await Promise.all([
          supabase.from('claimants').select('first_name, last_name').eq('id', appointment.claimant_id).single(),
          supabase.rpc('get_medical_expert_display_safe', { expert_id: appointment.expert_id })
        ]);

        // Get attorney email from law_firms table
        const { data: attorneyData } = await supabase
          .from('law_firms')
          .select('email')
          .eq('name', appointment.referring_attorney)
          .single();

        if (claimantRes.data && expertRes.data && expertRes.data.length > 0) {
          const expertInfo = expertRes.data[0];
          const appointmentData = {
            id: appointment.id,
            claimant_name: `${claimantRes.data.first_name} ${claimantRes.data.last_name}`,
            expert_name: `${expertInfo.first_name} ${expertInfo.last_name}`,
            expert_email: expertInfo.email_masked,
            attorney_name: appointment.referring_attorney,
            attorney_email: attorneyData?.email,
            appointment_date: appointment.appointment_date,
            appointment_time: new Date(appointment.appointment_date).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            matter_type: appointment.matter_type,
            service_fee: appointment.service_fee,
            location: formData.location,
            notes: formData.notes
          };

          // Call the email function
          const { error: emailError } = await supabase.functions.invoke('send-appointment-confirmation', {
            body: { appointmentData }
          });

          if (emailError) {
            console.error('Error sending confirmation email:', emailError);
            // Don't fail the appointment creation if email fails
          }
        }
      }
    } catch (error) {
      console.error('Error sending confirmation emails:', error);
      // Don't fail the appointment creation if email fails
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Auto-link claimant to referring attorney
  const handleClaimantChange = (claimantId) => {
    handleInputChange('claimantId', claimantId);
    
    // Find the selected claimant
    const selectedClaimant = claimants.find(c => c.id === claimantId);
    if (selectedClaimant?.law_firm_id) {
      // Find the attorney (law firm) that matches the claimant's law_firm_id
      const matchingAttorney = attorneys.find(att => att.id === selectedClaimant.law_firm_id);
      if (matchingAttorney) {
        handleInputChange('referringAttorney', matchingAttorney.id);
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
            {bookingType === 'multiple' && appointmentQueue.length > 0 && (
              <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold mb-3">Appointment Queue ({appointmentQueue.length})</h3>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {appointmentQueue.map((item) => (
                    <div key={item.id} className="p-3 bg-background rounded border">
                      <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{item.claimantName}</span>
                              <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                                {formatExpertType(item.expertType)}
                              </span>
                            </div>
                          <div className="text-sm text-muted-foreground">
                            Expert: <span className="font-medium">{item.expertName}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Date: <span className="font-medium">{item.appointmentDate}</span>
                            {item.appointmentTime && (
                              <span> at {item.appointmentTime}</span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Attorney: <span className="font-medium">{item.attorneyName}</span>
                          </div>
                          {item.assessmentType && (
                            <div className="text-sm text-muted-foreground">
                              Type: <span className="font-medium">{item.assessmentType}</span>
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeFromQueue(item.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button 
                    type="button" 
                    onClick={submitQueue} 
                    disabled={submitting}
                    className="flex-1"
                    size="lg"
                  >
                    {submitting ? 'Submitting Queue...' : `Submit All ${appointmentQueue.length} Appointments`}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setAppointmentQueue([])}
                    size="lg"
                  >
                    Clear Queue
                  </Button>
                </div>
              </div>
            )}
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
                  <Select value={formData.claimantId} onValueChange={handleClaimantChange}>
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
                  <Label htmlFor="referring-attorney">Referring Attorney *</Label>
                  <Select value={formData.referringAttorney} onValueChange={(value) => handleInputChange('referringAttorney', value)} disabled={!formData.claimantId}>
                    <SelectTrigger>
                      <SelectValue placeholder={loading ? "Loading attorneys..." : !formData.claimantId ? "Select claimant first" : "Select referring attorney"} />
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
                  <Label htmlFor="expert-type">Type of Expert *</Label>
                  <Select value={formData.expertType} onValueChange={(value) => {
                    handleInputChange('expertType', value);
                    // Reset expert selection when type changes
                    handleInputChange('expertId', '');
                  }} disabled={!formData.claimantId}>
                    <SelectTrigger>
                      <SelectValue placeholder={!formData.claimantId ? "Select claimant first" : "Select type of expert"} />
                    </SelectTrigger>
                    <SelectContent>
                      {getUniqueExpertTypes(experts).map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medical-expert">Medical Expert *</Label>
                  <Select 
                    value={formData.expertId} 
                    onValueChange={(value) => handleInputChange('expertId', value)}
                    disabled={!formData.expertType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!formData.expertType ? "Select expert type first" : filteredExperts.length === 0 ? "No experts available for this type" : "Select medical expert"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredExperts.map((expert) => (
                        <SelectItem key={expert.id} value={expert.id}>
                          Dr. {expert.first_name} {expert.last_name} - {formatExpertType(expert.expert_type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.expertType && filteredExperts.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No {formatExpertType(formData.expertType)} experts are currently available in the system.
                    </p>
                  )}
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

              <div className="flex gap-4 pt-6">
                {bookingType === 'multiple' ? (
                  <>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={addToQueue}
                      className="flex-1"
                      disabled={!formData.claimantId || !formData.expertId || !formData.expertType || !formData.appointmentDate || !formData.referringAttorney}
                    >
                      Add to Queue ({appointmentQueue.length})
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link to="/">Cancel</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="submit" className="flex-1" disabled={submitting}>
                      {submitting ? 'Scheduling...' : 'Schedule Appointment'}
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link to="/">Cancel</Link>
                    </Button>
                  </>
                )}
              </div>

              {bookingType === 'multiple' && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Multiple Booking Instructions</h4>
                  <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <p>• Fill out the form above for each appointment you want to schedule</p>
                    <p>• Select different expert types and experts for each appointment</p>
                    <p>• Click "Add to Queue" to add each appointment to your batch</p>
                    <p>• Review your queued appointments above</p>
                    <p>• Click "Submit All Appointments" when ready to schedule all at once</p>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </main>

      <CompanyFooter />
    </div>
  );
};

export default NewAppointment;