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
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CompanyFooter from "@/components/CompanyFooter";
import { formatExpertType, normalizeExpertType, matchesExpertType, getUniqueExpertTypes } from "@/utils/expertTypeMapping";
import { deduplicateAttorneys } from "@/utils/deduplicateAttorneys";
import { AODPreviewDialog } from "@/components/AODPreviewDialog";
import { useAODWorkflow } from "@/hooks/useAODWorkflow";
import { ShortTermAgreementPreview } from "@/components/ShortTermAgreementPreview";
import { useFormDraft } from "@/hooks/useFormDraft";

const NEW_APPOINTMENT_DEFAULTS = {
  claimantId: "",
  expertId: "", 
  expertType: "",
  appointmentDate: "",
  appointmentTime: "",
  referringAttorney: "",
  assessmentType: "",
  location: "",
  assessmentFees: "",
  discount: "",
  depositMade: "",
  fullPayment: "",
  paymentTerms: "",
  agreementDurationMonths: "",
  notes: ""
};

const NewAppointment = () => {
  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/new-appointment';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editingAppointmentId = searchParams.get('appointmentId');
  const isEditMode = !!editingAppointmentId;
  
  const [bookingType, setBookingType] = useState("single");
  const [attorneys, setAttorneys] = useState([]);
  const [claimants, setClaimants] = useState([]);
  const [experts, setExperts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appointmentQueue, setAppointmentQueue] = useState([]);
  const [userAttorneyId, setUserAttorneyId] = useState(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  // Draft persistence – only active for new appointments (not edit mode)
  const { draft, setDraft, clearDraft } = useFormDraft<typeof NEW_APPOINTMENT_DEFAULTS>(
    isEditMode ? `new-appointment-edit-${editingAppointmentId}` : 'new-appointment-new',
    NEW_APPOINTMENT_DEFAULTS
  );
  
  const [formData, setFormData] = useState(isEditMode ? NEW_APPOINTMENT_DEFAULTS : draft);

  const [filteredExperts, setFilteredExperts] = useState([]);
  const [filteredClaimants, setFilteredClaimants] = useState([]);
  const [showAODPreview, setShowAODPreview] = useState(false);
  const [pendingAODData, setPendingAODData] = useState(null);
  const { creating, aodId, createAODFromAppointment } = useAODWorkflow();
  const [showShortTermAgreement, setShowShortTermAgreement] = useState(false);
  const [shortTermAgreementData, setShortTermAgreementData] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isEditMode && editingAppointmentId && !loading) {
      loadAppointmentData(editingAppointmentId);
    }
  }, [isEditMode, editingAppointmentId, loading]);

  const loadAppointmentData = async (appointmentId: string) => {
    try {
      const { data: appointment, error } = await supabase
        .from('appointments')
        .select(`
          *,
          claimants!inner(id, auto_id, first_name, last_name, referring_attorney_id),
          referring_attorneys!inner(id, name, contact_person)
        `)
        .eq('id', appointmentId)
        .single();

      if (error) throw error;

      if (appointment) {
        // Find the expert to get the expert_type
        const expert = experts.find(e => e.id === appointment.expert_id);
        
        // Parse the appointment_date to get date and time
        const appointmentDateTime = new Date(appointment.appointment_date);
        const dateStr = appointmentDateTime.toISOString().split('T')[0];
        const timeStr = appointmentDateTime.toTimeString().slice(0, 5);

        setFormData({
          claimantId: appointment.claimant_id || "",
          expertId: appointment.expert_id || "",
          expertType: expert?.expert_type || "",
          appointmentDate: dateStr,
          appointmentTime: timeStr,
          referringAttorney: appointment.referring_attorney_id || "",
          assessmentType: appointment.matter_type || "",
          location: "",
          assessmentFees: appointment.service_fee?.toString() || "",
          discount: "",
          depositMade: appointment.deposit_amount?.toString() || "",
          fullPayment: "",
          paymentTerms: appointment.payment_terms || "",
          agreementDurationMonths: appointment.agreement_duration_months?.toString() || "",
          notes: ""
        });

        toast.success('Appointment data loaded for editing');
      }
    } catch (error) {
      console.error('Error loading appointment:', error);
      toast.error('Failed to load appointment data');
    }
  };

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to access this form');
        setLoading(false);
        return;
      }

      // Get current user's profile to check role and referring attorney
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, referring_attorney_id, email, first_name, last_name')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Profile error:', profileError);
        toast.error('Failed to load user profile. Please contact an administrator.');
        setLoading(false);
        return;
      }

      const isAdmin = profile?.role === 'admin';
      
      // Fetch all attorneys and experts first
      const [attorneysRes, expertsRes] = await Promise.all([
        supabase.rpc('get_referring_attorneys_list'),
        supabase.rpc('get_medical_experts_secure')
      ]);
      
      if (attorneysRes.error) throw attorneysRes.error;
      if (expertsRes.error) throw expertsRes.error;
      
      // Deduplicate attorneys before setting state
      const uniqueAttorneys = deduplicateAttorneys(attorneysRes.data || []);
      
      let linkedAttorneyId = profile?.referring_attorney_id;
      let finalAttorneysList = uniqueAttorneys;
      
      console.log('User profile loaded:', {
        userId: user.id,
        email: profile?.email || user.email,
        linkedAttorneyId,
        hasProfile: !!profile,
        isAdmin
      });
      
      // If not admin and no referring_attorney_id, try to find match by email or user info
      // Admin users can select any attorney from dropdown, so skip auto-linking
      if (!isAdmin && !linkedAttorneyId) {
        console.log('No linked attorney found for user, attempting to find or create one');
        
        // Try to match by email first
        const userEmail = profile?.email || user.email;
        console.log('Searching for attorney match with email:', userEmail);
        
        // Query referring_attorneys table directly for fallback lookup
        const { data: matchedAttorneys, error: lookupError } = await supabase
          .from('referring_attorneys')
          .select('id, name, email, phone, contact_person')
          .or(`email.eq.${userEmail},phone.eq.${user.phone || 'NOMATCH'}`);
        
        if (lookupError) {
          console.error('Error looking up attorneys:', lookupError);
        }
        
        if (!lookupError && matchedAttorneys && matchedAttorneys.length > 0) {
          // Found a match - use the first one
          linkedAttorneyId = matchedAttorneys[0].id;
          console.log('Found matching attorney:', matchedAttorneys[0].name, matchedAttorneys[0].id);
          
          // Update user profile to link this attorney
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ referring_attorney_id: matchedAttorneys[0].id })
            .eq('id', user.id);
          
          if (updateError) {
            console.error('Error updating profile with attorney ID:', updateError);
            toast.error('Failed to link your profile to the attorney. Please contact support.');
          } else {
            toast.info(`Auto-linked to ${matchedAttorneys[0].name} based on your email.`);
          }
        } else {
          // No match found - user needs admin to create/link attorney
          console.log('No matching attorney found - user needs admin assistance');
          toast.warning('No referring attorney profile found. Please contact an administrator to set up your account.', {
            duration: 6000
          });
        }
      }
      
      // Store the linked attorney ID in state
      if (linkedAttorneyId) {
        setUserAttorneyId(linkedAttorneyId);
        console.log('Attorney ID set successfully:', linkedAttorneyId);
      } else if (!isAdmin) {
        console.warn('No attorney ID found - user will need admin to link their profile');
        toast.warning('Your profile is not linked to a referring attorney. Please contact an administrator to link your account.', {
          duration: 5000
        });
      } else {
        // Admin users don't need a linked attorney - they can select any attorney
        console.log('Admin user - can select any referring attorney');
      }
      
      // Build claimants query based on role and linked attorney
      let claimantsData = [];
      
      if (isAdmin || linkedAttorneyId) {
        let claimantsQuery = supabase
          .from('claimants')
          .select('id, auto_id, first_name, last_name, referring_attorney_id, contact_number')
          .order('created_at', { ascending: false });
        
        // Non-admin users only see claimants from their referring attorney
        if (!isAdmin && linkedAttorneyId) {
          claimantsQuery = claimantsQuery.eq('referring_attorney_id', linkedAttorneyId);
        }
        
        const { data, error: claimantsError } = await claimantsQuery;
        
        if (claimantsError) {
          console.error('Error fetching claimants:', claimantsError);
          toast.error('Failed to load claimants list');
        } else {
          claimantsData = data || [];
        }
      }
      
      // Map claimants to use _masked suffix for compatibility with existing code
      const mappedClaimants = (claimantsData || []).map(c => ({
        ...c,
        first_name_masked: c.first_name,
        last_name_masked: c.last_name,
        contact_number_masked: c.contact_number || ''
      }));
      
      setAttorneys(finalAttorneysList);
      setClaimants(mappedClaimants);
      setFilteredClaimants(mappedClaimants); // Initialize with all claimants
      setExperts(expertsRes.data || []);
      setFilteredExperts(expertsRes.data || []);

      // Auto-populate referring attorney field with linked attorney (if not admin)
      if (!isAdmin && linkedAttorneyId) {
        const userAttorney = finalAttorneysList.find(a => a.id === linkedAttorneyId);
        if (userAttorney) {
          setFormData(prev => ({
            ...prev,
            referringAttorney: userAttorney.id
          }));
        } else {
          toast.error('Referring attorney profile not found in database. Please contact an administrator.');
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load form data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  // Filter claimants based on selected referring attorney
  useEffect(() => {
    console.log('Filtering claimants - referringAttorney:', formData.referringAttorney, 'total claimants:', claimants.length);
    
    if (formData.referringAttorney && claimants.length > 0) {
      // Filter claimants that belong to the selected referring attorney
      const filtered = claimants.filter(claimant => {
        const matches = claimant.referring_attorney_id === formData.referringAttorney;
        if (matches) {
          console.log('Matched claimant:', claimant.first_name_masked, claimant.last_name_masked, 'attorney_id:', claimant.referring_attorney_id);
        }
        return matches;
      });
      
      console.log('Filtered claimants count:', filtered.length);
      setFilteredClaimants(filtered);
      
      // Only clear selected claimant if not in edit mode and it doesn't belong to the selected attorney
      if (!isEditMode && formData.claimantId) {
        const selectedClaimant = claimants.find(c => c.id === formData.claimantId);
        if (selectedClaimant && selectedClaimant.referring_attorney_id !== formData.referringAttorney) {
          setFormData(prev => ({ ...prev, claimantId: "" }));
          toast.info('Claimant selection cleared - please select a claimant from the chosen referring attorney');
        }
      }
    } else if (claimants.length > 0) {
      // No attorney selected - show all claimants for admin users
      console.log('No attorney selected, showing all claimants');
      setFilteredClaimants(claimants);
    } else {
      setFilteredClaimants([]);
    }
  }, [formData.referringAttorney, claimants, isEditMode]);

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
      claimantName: `${selectedClaimant?.first_name_masked} ${selectedClaimant?.last_name_masked} (${selectedClaimant?.auto_id})`,
      expertName: `Dr. ${selectedExpert?.first_name} ${selectedExpert?.last_name}`,
      attorneyName: selectedAttorney?.name,
      referringAttorneyId: formData.referringAttorney
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
      discount: "",
      depositMade: "",
      fullPayment: "",
      paymentTerms: "",
      agreementDurationMonths: "",
      notes: ""
    });

    toast.success('Appointment added to queue');
  };

  const removeFromQueue = (id) => {
    setAppointmentQueue(prev => prev.filter(item => item.id !== id));
    toast.success('Appointment removed from queue');
  };

  const shouldTriggerShortTermAgreement = (paymentTerms: string): boolean => {
    const shortTermTriggers = [
      "30 days", "60 days", "90 days", "120 days",
      "6 months", "7 months", "8 months", "9 months", 
      "10 months", "11 months", "12 months"
    ];
    return shortTermTriggers.some(term => 
      paymentTerms?.toLowerCase().includes(term.toLowerCase())
    );
  };

  const handleAODCreation = async (appointmentData: any) => {
    try {
      const paymentTermsLower = appointmentData.payment_terms?.toLowerCase() || '';
      const agreementDuration = appointmentData.agreement_duration_months || 0;
      
      // Check if this requires AOD or Short-term agreement
      const requiresAgreement = paymentTermsLower.includes('aod') || 
                               paymentTermsLower.includes('short') ||
                               agreementDuration > 0;
      
      if (!requiresAgreement) return;

      const totalContractValue = appointmentData.service_fee || 0;
      const depositAmount = appointmentData.deposit_amount || 0;
      const balance = totalContractValue - depositAmount;

      if (balance <= 0) return; // No balance, no agreement needed

      // Create AOD document using the workflow hook
      await createAODFromAppointment({
        referringAttorneyId: appointmentData.referring_attorney_id,
        appointmentId: appointmentData.id,
        paymentTerms: appointmentData.payment_terms,
        serviceFee: totalContractValue,
        depositAmount: depositAmount,
        agreementDurationMonths: agreementDuration || 12,
        appointmentDate: appointmentData.appointment_date
      });

      // Show preview dialog if AOD was created
      if (aodId) {
        setShowAODPreview(true);
      }
    } catch (error) {
      console.error('Error preparing AOD:', error);
      toast.error('Failed to prepare agreement document');
    }
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

      // Validate that all items in queue have a referring attorney
      const missingAttorney = appointmentQueue.find(item => !item.referringAttorneyId);
      if (missingAttorney) {
        toast.error('Please select a referring attorney for all appointments');
        return;
      }

      // Prepare all appointments for batch insert
      const appointmentsData = appointmentQueue.map(item => {
        // Safely build the datetime - fall back to 09:00 if time is missing or invalid
        const timeStr = item.appointmentTime && /^\d{2}:\d{2}(:\d{2})?$/.test(item.appointmentTime)
          ? item.appointmentTime
          : '09:00';
        const appointmentDateTime = new Date(`${item.appointmentDate}T${timeStr}:00`);
        // Guard against invalid dates from malformed input
        if (isNaN(appointmentDateTime.getTime())) {
          throw new Error(`Invalid appointment date/time for ${item.claimantName}: "${item.appointmentDate} ${timeStr}"`);
        }
        
        const assessmentFees = item.assessmentFees ? parseFloat(item.assessmentFees) : 0;
        const discount = item.discount ? parseFloat(item.discount) : 0;
        const serviceFee = Math.max(0, assessmentFees - discount); // Final fee after discount
        const depositAmount = item.depositMade ? parseFloat(item.depositMade) : 0;
        
        let paymentStatus = 'pending';
        let paymentDate = null;
        
        if (depositAmount > 0) {
          paymentDate = new Date().toISOString();
          if (depositAmount >= serviceFee) {
            paymentStatus = 'full_payment';
          } else {
            paymentStatus = 'deposit';
          }
        }
        
        return {
          claimant_id: item.claimantId,
          expert_id: item.expertId,
          referring_attorney_id: item.referringAttorneyId,
          referring_attorney: item.attorneyName,
          appointment_date: appointmentDateTime.toISOString(),
          matter_type: item.assessmentType || null,
          service_fee: serviceFee || null,
          deposit_amount: depositAmount,
          payment_date: paymentDate,
          payment_status: paymentStatus,
          payment_terms: item.paymentTerms || null,
          agreement_duration_months: item.agreementDurationMonths ? parseInt(item.agreementDurationMonths) : null,
          case_status: 'scheduled'
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

          // Handle AOD/Short-term agreement creation for appointments with payment terms
          if (insertedAppointments && insertedAppointments.length > 0) {
            for (const appointment of insertedAppointments) {
              await handleAODCreation(appointment);
            }
            // Note: Automatic email confirmations are permanently disabled.
            // All emails must be sent manually by administrators.
          }

        toast.success(`${appointmentQueue.length} appointment(s) scheduled successfully! Please send confirmation emails manually.`);
        clearDraft(); // Wipe the draft after successful submit
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
    
    if (submitting) return;

    // Validate form before submission
    if (!validateForm()) {
      toast.error('Please fill in all required fields marked with *');
      return;
    }

    setSubmitting(true);

    try {
      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        toast.error('You must be logged in to schedule appointments');
        setSubmitting(false);
        return;
      }

      // Validate referring attorney is selected
      if (!formData.referringAttorney) {
        toast.error('Please select a referring attorney');
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

      // Combine date and time - safely normalise the time portion
      const safeTime = formData.appointmentTime && /^\d{2}:\d{2}(:\d{2})?$/.test(formData.appointmentTime)
        ? formData.appointmentTime
        : '09:00';
      const appointmentDateTime = new Date(`${formData.appointmentDate}T${safeTime}:00`);
      if (isNaN(appointmentDateTime.getTime())) {
        toast.error(`Invalid appointment date/time: "${formData.appointmentDate} ${safeTime}". Please check the date and time fields.`);
        setSubmitting(false);
        return;
      }

      // Calculate payment status and date
      const assessmentFees = formData.assessmentFees ? parseFloat(formData.assessmentFees) : 0;
      const discount = formData.discount ? parseFloat(formData.discount) : 0;
      const serviceFee = Math.max(0, assessmentFees - discount); // Final fee after discount
      const depositAmount = formData.depositMade ? parseFloat(formData.depositMade) : 0;
      
      let paymentStatus = 'pending';
      let paymentDate = null;
      
      if (depositAmount > 0) {
        paymentDate = new Date().toISOString();
        if (depositAmount >= serviceFee) {
          paymentStatus = 'full_payment';
        } else {
          paymentStatus = 'deposit';
        }
      }

      const appointmentData = {
        claimant_id: formData.claimantId,
        expert_id: formData.expertId,
        referring_attorney_id: formData.referringAttorney,
        referring_attorney: selectedAttorney.name,
        appointment_date: appointmentDateTime.toISOString(),
        matter_type: formData.assessmentType || null,
        service_fee: serviceFee || null,
        deposit_amount: depositAmount,
        payment_date: paymentDate,
        payment_status: paymentStatus,
        payment_terms: formData.paymentTerms || null,
        agreement_duration_months: formData.agreementDurationMonths ? parseInt(formData.agreementDurationMonths) : null,
        case_status: 'scheduled'
      };

      if (isEditMode && editingAppointmentId) {
        // Update existing appointment
        const { error } = await supabase
          .from('appointments')
          .update(appointmentData)
          .eq('id', editingAppointmentId);

        if (error) {
          console.error('Database error:', error);
          throw error;
        }

        toast.success('Appointment updated successfully');

        // Wait for real-time sync to propagate changes across all dashboards
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Note: Automatic email confirmations are permanently disabled.
        // All emails must be sent manually by administrators.

        toast.success('Update complete! All dashboards will refresh automatically.');
        
        // Navigate back with a slight delay to ensure all updates are visible
        setTimeout(() => {
          navigate('/scheduled-assessment');
        }, 500);
      } else {
        // Create new appointment
        const { data: insertedAppointment, error } = await supabase
          .from('appointments')
          .insert([appointmentData])
          .select();

        if (error) {
          console.error('Database error:', error);
          throw error;
        }

        // Handle AOD/Short-term agreement creation based on payment terms
        if (insertedAppointment && insertedAppointment.length > 0) {
          const newAppointment = insertedAppointment[0];
          
          // Check if short-term agreement should be triggered
          if (shouldTriggerShortTermAgreement(formData.paymentTerms)) {
            const selectedClaimant = claimants.find(c => c.id === formData.claimantId);
            const selectedExpert = experts.find(e => e.id === formData.expertId);

            setShortTermAgreementData({
              id: newAppointment.id,
              referring_attorney_id: formData.referringAttorney,
              referring_attorney_name: selectedAttorney.name,
              referring_attorney_email: selectedAttorney.email,
              claimant_name: selectedClaimant ? `${selectedClaimant.first_name} ${selectedClaimant.last_name}` : '',
              appointment_date: appointmentDateTime.toISOString(),
              expert_type: selectedExpert?.expert_type,
              service_fee: serviceFee, // Use calculated service fee after discount
              payment_terms: formData.paymentTerms
            });
            setShowShortTermAgreement(true);
            toast.success('Appointment scheduled! Please review the Short-Term Agreement.');
            return; // Don't navigate away, show the agreement dialog
          }
          
          await handleAODCreation(newAppointment);

          // Note: Automatic email confirmations are permanently disabled.
          // All emails must be sent manually by administrators.
        }

        toast.success('Appointment scheduled successfully! Please send confirmation emails manually.');
        clearDraft(); // Wipe draft after successful submit
        navigate('/scheduled-assessment');
      }
    } catch (error) {
      console.error('Error with appointment:', error);
      toast.error(`Failed to ${isEditMode ? 'update' : 'schedule'} appointment: ${error.message || 'Unknown error'}`);
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

        // Get attorney email from referring_attorneys table
        const { data: attorneyData } = await supabase
          .from('referring_attorneys')
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
            appointment_time: new Date(appointment.appointment_date).toLocaleTimeString('en-ZA', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Africa/Johannesburg',
            }),
            matter_type: appointment.matter_type,
            service_fee: appointment.service_fee,
            location: formData.location,
            notes: formData.notes
          };

          // Note: Automatic email confirmations are permanently disabled.
          // All emails must be sent manually by administrators.
        }
      }
    } catch (error) {
      console.error('Error sending confirmation emails:', error);
      // Don't fail the appointment creation if email fails
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      // Persist draft to localStorage on every change (non-edit mode only)
      if (!isEditMode) setDraft(next);
      return next;
    });
    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: false
      }));
    }
  };

  const VALID_ASSESSMENT_TYPES = ['MVA', 'Medical Negligence', 'Merit Report', 'Assault Matter', 'Slip and Fall Matter', 'Joint Minutes', 'Addendum'];

  const validateForm = () => {
    const errors: Record<string, boolean> = {};
    const requiredFields = ['claimantId', 'referringAttorney', 'expertType', 'expertId', 'appointmentDate', 'appointmentTime', 'assessmentType'];
    
    requiredFields.forEach(field => {
      if (!formData[field] || formData[field].trim() === '') {
        errors[field] = true;
      }
    });

    // Validate assessment type is one of the accepted values
    if (formData.assessmentType && !VALID_ASSESSMENT_TYPES.includes(formData.assessmentType)) {
      errors.assessmentType = true;
    }
    
    setValidationErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      // Scroll to the first error field
      const firstErrorField = requiredFields.find(f => errors[f]);
      if (firstErrorField) {
        const el = document.querySelector(`[data-field="${firstErrorField}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    
    return Object.keys(errors).length === 0;
  };

  // Auto-link claimant to referring attorney
  const handleClaimantChange = (claimantId) => {
    handleInputChange('claimantId', claimantId);
    
    // Find the selected claimant
    const selectedClaimant = claimants.find(c => c.id === claimantId);
    if (selectedClaimant?.referring_attorney_id) {
      // Find the attorney (referring attorney) that matches the claimant's referring_attorney_id
      const matchingAttorney = attorneys.find(att => att.id === selectedClaimant.referring_attorney_id);
      if (matchingAttorney) {
        handleInputChange('referringAttorney', matchingAttorney.id);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{isEditMode ? 'Edit Appointment' : 'Schedule New Appointment'} - Medico-Legal Assessment System</title>
        <meta name="description" content={isEditMode ? 'Edit an existing medical assessment appointment.' : 'Schedule a new medical assessment appointment for claimants with available medical experts.'} />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/scheduled-assessment">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Scheduled Assessments
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">{isEditMode ? 'Edit Appointment' : 'Schedule New Appointment'}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {isEditMode ? 'Edit Assessment Appointment' : 'New Assessment Appointment'}
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
                          {item.assessmentFees && (
                            <div className="text-sm text-muted-foreground">
                              Assessment Fee: <span className="font-medium">R {parseFloat(item.assessmentFees).toFixed(2)}</span>
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
              {/* Booking Type Selection - Only show when not editing */}
              {!isEditMode && (
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
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Referring Attorney FIRST - to filter claimants */}
                <div className="space-y-2" data-field="referringAttorney">
                  <Label htmlFor="referring-attorney" className={validationErrors.referringAttorney ? "text-destructive" : ""}>Referring Attorney *</Label>
                  <Select value={formData.referringAttorney} onValueChange={(value) => handleInputChange('referringAttorney', value)}>
                    <SelectTrigger className={validationErrors.referringAttorney ? "border-destructive ring-1 ring-destructive focus:ring-destructive" : ""}>
                      <SelectValue placeholder={loading ? "Loading attorneys..." : "Select referring attorney"}>
                        {formData.referringAttorney && attorneys.find(a => a.id === formData.referringAttorney) && (
                          <>
                            {attorneys.find(a => a.id === formData.referringAttorney)?.name}
                            {attorneys.find(a => a.id === formData.referringAttorney)?.contact_person && 
                              ` - ${attorneys.find(a => a.id === formData.referringAttorney)?.contact_person}`}
                          </>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {attorneys.map((attorney) => (
                        <SelectItem key={attorney.id} value={attorney.id}>
                          {attorney.name} {attorney.contact_person && `- ${attorney.contact_person}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {validationErrors.referringAttorney && <p className="text-sm text-destructive">Please select a referring attorney</p>}
                </div>

                {/* Claimant - filtered by selected referring attorney */}
                <div className="space-y-2" data-field="claimantId">
                  <Label htmlFor="claimant" className={validationErrors.claimantId ? "text-destructive" : ""}>Claimant Name *</Label>
                  <Select 
                    value={formData.claimantId} 
                    onValueChange={handleClaimantChange}
                    disabled={!isEditMode && !formData.referringAttorney}
                  >
                    <SelectTrigger className={validationErrors.claimantId ? "border-destructive ring-1 ring-destructive focus:ring-destructive" : ""}>
                      <SelectValue placeholder={
                        loading 
                          ? "Loading claimants..." 
                          : !isEditMode && !formData.referringAttorney 
                            ? "Select referring attorney first" 
                            : filteredClaimants.length === 0 
                              ? "No claimants for this attorney" 
                              : "Select claimant"
                      }>
                        {formData.claimantId ? (() => {
                          const selectedClaimant = claimants.find(c => c.id === formData.claimantId);
                          return selectedClaimant ? `${selectedClaimant.auto_id} - ${selectedClaimant.first_name_masked} ${selectedClaimant.last_name_masked}` : "Select claimant";
                        })() : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(isEditMode ? claimants : filteredClaimants).map((claimant) => (
                        <SelectItem key={claimant.id} value={claimant.id}>
                          {claimant.auto_id} - {claimant.first_name_masked} {claimant.last_name_masked}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {validationErrors.claimantId && <p className="text-sm text-destructive">Please select a claimant</p>}
                  {!isEditMode && formData.referringAttorney && filteredClaimants.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No claimants found for this referring attorney. You may need to add one first.
                    </p>
                  )}
                </div>

                <div className="space-y-2" data-field="expertType">
                  <Label htmlFor="expert-type" className={validationErrors.expertType ? "text-destructive" : ""}>Type of Expert *</Label>
                  <Select value={formData.expertType} onValueChange={(value) => {
                    handleInputChange('expertType', value);
                    handleInputChange('expertId', '');
                  }}>
                    <SelectTrigger className={validationErrors.expertType ? "border-destructive ring-1 ring-destructive focus:ring-destructive" : ""}>
                      <SelectValue placeholder="Select type of expert">
                        {formData.expertType && formatExpertType(formData.expertType)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {getUniqueExpertTypes(experts).map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {validationErrors.expertType && <p className="text-sm text-destructive">Please select an expert type</p>}
                </div>

                <div className="space-y-2" data-field="expertId">
                  <Label htmlFor="medical-expert" className={validationErrors.expertId ? "text-destructive" : ""}>Medical Expert *</Label>
                  <Select 
                    value={formData.expertId} 
                    onValueChange={(value) => handleInputChange('expertId', value)}
                    disabled={!formData.expertType}
                  >
                    <SelectTrigger className={validationErrors.expertId ? "border-destructive ring-1 ring-destructive focus:ring-destructive" : ""}>
                      <SelectValue placeholder={!formData.expertType ? "Select expert type first" : filteredExperts.length === 0 ? "No experts available for this type" : "Select medical expert"}>
                        {formData.expertId && experts.find(e => e.id === formData.expertId) && (
                          <>
                            Dr. {experts.find(e => e.id === formData.expertId)?.first_name} {experts.find(e => e.id === formData.expertId)?.last_name} - {formatExpertType(experts.find(e => e.id === formData.expertId)?.expert_type)}
                          </>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {filteredExperts.map((expert) => (
                        <SelectItem key={expert.id} value={expert.id}>
                          Dr. {expert.first_name} {expert.last_name} - {formatExpertType(expert.expert_type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {validationErrors.expertId && <p className="text-sm text-destructive">Please select a medical expert</p>}
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
                    className={validationErrors.appointmentDate ? "border-destructive focus-visible:ring-destructive" : ""}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appointment-time">Appointment Time *</Label>
                  <Input
                    type="time" 
                    id="appointment-time" 
                    value={formData.appointmentTime}
                    onChange={(e) => handleInputChange('appointmentTime', e.target.value)}
                    className={validationErrors.appointmentTime ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assessment-type">Assessment Type *</Label>
                  <Select value={formData.assessmentType} onValueChange={(value) => handleInputChange('assessmentType', value)}>
                    <SelectTrigger className={validationErrors.assessmentType ? "border-destructive focus:ring-destructive" : ""}>
                      <SelectValue placeholder="Select assessment type">
                        {formData.assessmentType}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {/* Primary Assessment Types */}
                      <SelectItem value="MVA">MVA</SelectItem>
                      <SelectItem value="Medical Negligence">Medical Negligence</SelectItem>
                      <SelectItem value="Merit Report">Merit Report</SelectItem>
                      <SelectItem value="Assault Matter">Assault Matter</SelectItem>
                      <SelectItem value="Slip and Fall Matter">Slip and Fall Matter</SelectItem>
                      {/* Post-Report Services (done after initial report completion) */}
                      <SelectItem value="Joint Minutes" className="text-muted-foreground">Joint Minutes (Post-Report)</SelectItem>
                      <SelectItem value="Addendum" className="text-muted-foreground">Addendum (Post-Report)</SelectItem>
                    </SelectContent>
                  </Select>
                  {(formData.assessmentType === 'Joint Minutes' || formData.assessmentType === 'Addendum') && (
                    <p className="text-sm text-muted-foreground">
                      ℹ️ This is a post-report service requested after the expert's initial report is complete.
                    </p>
                  )}
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
                  <Label htmlFor="discount">Discount</Label>
                  <Input 
                    id="discount" 
                    type="number" 
                    placeholder="Enter discount amount" 
                    value={formData.discount}
                    onChange={(e) => handleInputChange('discount', e.target.value)}
                  />
                  {formData.assessmentFees && formData.discount && (
                    <p className="text-sm text-primary font-medium">
                      Final Fee: R {((parseFloat(formData.assessmentFees) || 0) - (parseFloat(formData.discount) || 0)).toFixed(2)}
                    </p>
                  )}
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
                      <SelectValue placeholder="Select payment terms">
                        {formData.paymentTerms && (
                          formData.paymentTerms === 'aod' ? 'AOD (Agreement on Demand)' :
                          formData.paymentTerms === 'short-term' ? 'Short-Term Agreement' :
                          formData.paymentTerms === '30-days' ? '30 Days' :
                          formData.paymentTerms === '60-days' ? '60 Days' :
                          formData.paymentTerms === '90-days' ? '90 Days' :
                          formData.paymentTerms === 'immediate' ? 'Immediate Payment' :
                          formData.paymentTerms
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aod">AOD (Agreement on Demand)</SelectItem>
                      <SelectItem value="short-term">Short-Term Agreement</SelectItem>
                      <SelectItem value="30-days">30 Days</SelectItem>
                      <SelectItem value="60-days">60 Days</SelectItem>
                      <SelectItem value="90-days">90 Days</SelectItem>
                      <SelectItem value="immediate">Immediate Payment</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.paymentTerms && (
                    <p className="text-sm text-muted-foreground">
                      {(() => {
                        const paymentLower = formData.paymentTerms.toLowerCase();
                        const duration = parseInt(formData.agreementDurationMonths) || 0;
                        const assessmentFees = parseFloat(formData.assessmentFees) || 0;
                        const discount = parseFloat(formData.discount) || 0;
                        const finalFee = Math.max(0, assessmentFees - discount);
                        const hasBalance = finalFee - (parseFloat(formData.depositMade) || 0) > 0;
                        
                        if (paymentLower.includes('aod') && (duration === 0 || duration >= 12)) {
                          return '📋 Will be synced to AOD Documents (12+ months agreement)';
                        } else if ((duration > 0 && duration < 12) || paymentLower.includes('short')) {
                          return '📝 Will be synced to Short-Term Agreements (<12 months)';
                        } else if (hasBalance) {
                          return '💰 Outstanding balance detected - will be synced appropriately';
                        }
                        return null;
                      })()}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agreement-duration">Agreement Duration (Months)</Label>
                  <Input 
                    id="agreement-duration" 
                    type="number" 
                    placeholder="Enter duration in months (e.g., 12, 24)" 
                    value={formData.agreementDurationMonths}
                    onChange={(e) => handleInputChange('agreementDurationMonths', e.target.value)}
                    min="0"
                  />
                  <p className="text-sm text-muted-foreground">
                    Leave blank for standard AOD (defaults to 12 months). Use &lt;12 for short-term agreements.
                  </p>
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
                {bookingType === 'multiple' && !isEditMode ? (
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
                      {submitting ? (isEditMode ? 'Updating...' : 'Scheduling...') : (isEditMode ? 'Update Appointment' : 'Schedule Appointment')}
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link to="/scheduled-assessment">Cancel</Link>
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

      {showAODPreview && aodId && (
        <AODPreviewDialog
          open={showAODPreview}
          onOpenChange={setShowAODPreview}
          aodDocumentId={aodId}
          onFinalize={() => {
            setShowAODPreview(false);
            setPendingAODData(null);
            toast.success('Agreement document created successfully');
          }}
        />
      )}

      {shortTermAgreementData && (
        <ShortTermAgreementPreview
          open={showShortTermAgreement}
          onOpenChange={(open) => {
            setShowShortTermAgreement(open);
            if (!open) {
              // Navigate to scheduled assessment when dialog closes
              navigate('/scheduled-assessment');
            }
          }}
          appointmentData={shortTermAgreementData}
        />
      )}

      <CompanyFooter />
    </div>
  );
};

export default NewAppointment;