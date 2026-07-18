import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  CalendarIcon,
  ArrowLeft,
  AlertTriangle,
  UserSquare2,
  Stethoscope,
  Wallet,
  NotebookPen,
  ListChecks,
  X,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CompanyFooter from "@/components/CompanyFooter";
import { generateAssessmentCode } from "@/utils/idGenerators";
import { formatExpertType, normalizeExpertType, matchesExpertType, getUniqueExpertTypes } from "@/utils/expertTypeMapping";
import { deduplicateAttorneys } from "@/utils/deduplicateAttorneys";
import { AODPreviewDialog } from "@/components/AODPreviewDialog";
import { useAODWorkflow } from "@/hooks/useAODWorkflow";
import { ShortTermAgreementPreview } from "@/components/ShortTermAgreementPreview";
import { useFormDraft } from "@/hooks/useFormDraft";
import { DraftStatusIndicator } from "@/components/DraftStatusIndicator";
import DebtTrackerPanel from "@/components/DebtTrackerPanel";
import { AdminCard, AdminSectionLabel, BRAND_TEAL } from "@/components/admin/ui/AdminUI";

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
  discountType: "amount", // 'amount' | 'percentage'
  depositMade: "",
  fullPayment: "",
  paymentTerms: "",
  agreementDurationMonths: "",
  notes: "",
  salesConsultantId: ""
};

/**
 * `embedded` drops the page's own header, Helmet tags, and footer when this
 * form is hosted inside another surface's chrome — e.g. the Appointment
 * Engine's "New Appointment" side panel, which already renders its own
 * SheetHeader/title. Standalone route usage (`/new-appointment`) is
 * unaffected; it still gets the full page shell. Same pattern already used
 * by UserManagement's `embedded` prop.
 */
const NewAppointment = ({ embedded = false }: { embedded?: boolean } = {}) => {
  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://example.com/new-appointment';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editingAppointmentId = searchParams.get('appointmentId');
  const isEditMode = !!editingAppointmentId;
  
  const [bookingType, setBookingType] = useState("single");
  const [attorneys, setAttorneys] = useState([]);
  const [claimants, setClaimants] = useState([]);
  const [experts, setExperts] = useState([]);
  const [salesConsultants, setSalesConsultants] = useState<{id: string; name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appointmentQueue, setAppointmentQueue] = useState([]);
  const [userAttorneyId, setUserAttorneyId] = useState(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [claimantsLoading, setClaimantsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  // Draft persistence – only active for new appointments (not edit mode)
  const { draft, setDraft, clearDraft, lastSavedAt, saveStatus } = useFormDraft<typeof NEW_APPOINTMENT_DEFAULTS>(
    isEditMode ? `new-appointment-edit-${editingAppointmentId}` : 'new-appointment-new',
    NEW_APPOINTMENT_DEFAULTS
  );
  
  const [formData, setFormData] = useState(isEditMode ? NEW_APPOINTMENT_DEFAULTS : draft);
  // Tracks whether the user has manually changed the attorney in edit mode.
  // We use this to avoid clearing the originally-loaded claimant on first sync.
  const hasUserChangedAttorneyRef = useRef(false);

  const [filteredExperts, setFilteredExperts] = useState([]);
  const [filteredClaimants, setFilteredClaimants] = useState([]);
  const [editAppointmentDetails, setEditAppointmentDetails] = useState<{
    claimant: any | null;
    attorney: any | null;
  }>({ claimant: null, attorney: null });
  const [showAODPreview, setShowAODPreview] = useState(false);
  const [pendingAODData, setPendingAODData] = useState(null);
  const { creating, aodId, createAODFromAppointment } = useAODWorkflow();
  const [showShortTermAgreement, setShowShortTermAgreement] = useState(false);
  const [shortTermAgreementData, setShortTermAgreementData] = useState<any>(null);

  const normalizeClaimant = (claimant: any) => claimant ? ({
    ...claimant,
    first_name_masked: claimant.first_name_masked ?? claimant.first_name ?? '',
    last_name_masked: claimant.last_name_masked ?? claimant.last_name ?? '',
    contact_number_masked: claimant.contact_number_masked ?? claimant.contact_number ?? '',
  }) : null;

  const mergeClaimantsById = (existing: any[], incoming: any[]) => {
    const byId = new Map((existing || []).map((c: any) => [c.id, c]));
    (incoming || []).filter(Boolean).forEach((claimant: any) => {
      byId.set(claimant.id, { ...(byId.get(claimant.id) || {}), ...claimant });
    });
    return Array.from(byId.values());
  };

  const formatAttorneyDisplay = (attorney: any) => {
    if (!attorney) return '';
    return [attorney.name, attorney.contact_person].filter(Boolean).join(' - ');
  };

  const formatClaimantDisplay = (claimant: any) => {
    if (!claimant) return '';
    const firstName = claimant.first_name_masked ?? claimant.first_name ?? '';
    const lastName = claimant.last_name_masked ?? claimant.last_name ?? '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    return [claimant.auto_id, fullName].filter(Boolean).join(' - ');
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Mirror every formData change to localStorage draft so the user can
  // navigate away, switch tabs, or reload and resume capture immediately.
  useEffect(() => {
    if (!isEditMode) setDraft(formData);
  }, [formData, isEditMode, setDraft]);

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
          claimants(id, auto_id, first_name, last_name, referring_attorney_id, contact_number),
          referring_attorneys(id, name, contact_person)
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

        // Restore original (pre-discount) assessment fees so the user can edit
        // without double-applying the discount. service_fee in the DB is the
        // post-discount amount; add back the saved discount_amount.
        const savedServiceFee = Number(appointment.service_fee) || 0;
        const savedDiscountAmount = Number((appointment as any).discount_amount) || 0;
        const savedDiscountRate = Number((appointment as any).discount_rate) || 0;
        const savedDiscountType = (appointment as any).discount_type || 'amount';
        const originalFees = savedServiceFee + savedDiscountAmount;
        const discountFieldValue = savedDiscountType === 'percentage'
          ? (savedDiscountRate ? String(savedDiscountRate) : '')
          : (savedDiscountAmount ? String(savedDiscountAmount) : '');

        hasUserChangedAttorneyRef.current = false;

        let apptClaimant: any = Array.isArray((appointment as any).claimants)
          ? (appointment as any).claimants[0]
          : (appointment as any).claimants;

        if (!apptClaimant && appointment.claimant_id) {
          const { data: claimantRow } = await supabase
            .from('claimants')
            .select('id, auto_id, first_name, last_name, referring_attorney_id, contact_number')
            .eq('id', appointment.claimant_id)
            .maybeSingle();
          apptClaimant = claimantRow;
        }

        const normalizedClaimant = normalizeClaimant(apptClaimant);
        const apptAttorney = (appointment as any).referring_attorneys
          || attorneys.find(a => a.id === appointment.referring_attorney_id)
          || null;

        setEditAppointmentDetails({
          claimant: normalizedClaimant,
          attorney: apptAttorney,
        });

        setFormData({
          claimantId: appointment.claimant_id || "",
          expertId: appointment.expert_id || "",
          expertType: expert?.expert_type || "",
          appointmentDate: dateStr,
          appointmentTime: timeStr,
          referringAttorney: appointment.referring_attorney_id || "",
          assessmentType: appointment.matter_type || "",
          location: "",
          assessmentFees: originalFees ? String(originalFees) : "",
          discount: discountFieldValue,
          discountType: savedDiscountType,
          depositMade: appointment.deposit_amount?.toString() || "",
          fullPayment: "",
          paymentTerms: appointment.payment_terms || "",
          agreementDurationMonths: appointment.agreement_duration_months?.toString() || "",
          notes: "",
          salesConsultantId: appointment.sales_consultant_id || ""
        });

        // Merge the appointment's claimant into the cache so the Select can
        // display the full name immediately in edit mode (even before the
        // attorney's linked-claimant list finishes loading, or if the
        // claimant's referring_attorney_id has since changed).
        if (normalizedClaimant?.id) {
          setClaimants(prev => mergeClaimantsById(prev, [normalizedClaimant]));
          setFilteredClaimants(prev => mergeClaimantsById(prev, [normalizedClaimant]));
        }

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

      // Determine full internal access from the authoritative user_roles table
      // (not just profiles.role). Any internal staff role can pick any
      // referring attorney and triggers the on-demand claimant fetch.
      const INTERNAL_ROLES = ['admin', 'employee', 'finance', 'director'];
      const { data: rolesRows } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const userRoleSet = new Set([
        ...(rolesRows || []).map((r: any) => r.role),
        profile?.role,
      ].filter(Boolean));
      const isAdmin = INTERNAL_ROLES.some(r => userRoleSet.has(r));
      
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
      
      setIsAdminUser(isAdmin);

      // Build claimants query based on role and linked attorney.
      // Admin users do NOT prefetch all claimants — we fetch on demand when an
      // attorney is selected. Non-admin users only ever see their attorney's
      // claimants, so we load those once here.
      let claimantsData: any[] = [];

      if (!isAdmin && linkedAttorneyId) {
        const { data, error: claimantsError } = await supabase
          .from('claimants')
          .select('id, auto_id, first_name, last_name, referring_attorney_id, contact_number')
          .eq('referring_attorney_id', linkedAttorneyId)
          .order('created_at', { ascending: false });

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
      
      // Fetch sales consultants
      const { data: consultantsData } = await supabase
        .from('sales_consultants')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      setAttorneys(finalAttorneysList);
      setClaimants(mappedClaimants);
      setFilteredClaimants(mappedClaimants);
      setExperts(expertsRes.data || []);
      setFilteredExperts(expertsRes.data || []);
      setSalesConsultants(consultantsData || []);


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

  // Load claimants for the selected referring attorney. For admin users we
  // fetch on demand from the API so we never hold the full claimant list in
  // memory. Non-admin users already have their attorney's claimants loaded.
  useEffect(() => {
    let cancelled = false;

    const loadClaimantsForAttorney = async () => {
      if (!formData.referringAttorney) {
        setFilteredClaimants([]);
        return;
      }

      if (!isAdminUser) {
        // Non-admin: claimants array is already scoped to their attorney
        const filtered = claimants.filter(
          c => c.referring_attorney_id === formData.referringAttorney
        );
        const current = editAppointmentDetails.claimant?.id === formData.claimantId
          ? editAppointmentDetails.claimant
          : claimants.find(c => c.id === formData.claimantId);
        setFilteredClaimants(isEditMode && current && !filtered.some(c => c.id === current.id)
          ? [current, ...filtered]
          : filtered);
        return;
      }

      // Admin: fetch claimants linked to this attorney
      setClaimantsLoading(true);
      try {
        const { data, error } = await supabase
          .from('claimants')
          .select('id, auto_id, first_name, last_name, referring_attorney_id, contact_number')
          .eq('referring_attorney_id', formData.referringAttorney)
          .order('created_at', { ascending: false });

        if (cancelled) return;

        if (error) {
          console.error('Error fetching claimants for attorney:', error);
          toast.error('Failed to load claimants for the selected attorney');
          setFilteredClaimants([]);
          return;
        }

        const mapped = (data || []).map(c => ({
          ...c,
          first_name_masked: c.first_name,
          last_name_masked: c.last_name,
          contact_number_masked: c.contact_number || '',
        }));

        const current = editAppointmentDetails.claimant?.id === formData.claimantId
          ? editAppointmentDetails.claimant
          : claimants.find(c => c.id === formData.claimantId);
        const displayList = isEditMode && current && !mapped.some(c => c.id === current.id)
          ? [current, ...mapped]
          : mapped;

        setFilteredClaimants(displayList);

        // Merge into the cache so lookups by id (selected claimant display,
        // queue items, etc.) keep working without holding all claimants.
        setClaimants(prev => {
          const byId = new Map(prev.map(c => [c.id, c]));
          displayList.forEach(c => byId.set(c.id, c));
          return Array.from(byId.values());
        });
      } finally {
        if (!cancelled) setClaimantsLoading(false);
      }
    };

    loadClaimantsForAttorney();

    return () => {
      cancelled = true;
    };
  }, [formData.referringAttorney, formData.claimantId, isAdminUser, isEditMode, editAppointmentDetails.claimant]);

  // Clear stale claimant selection when the loaded claimant list no longer
  // includes it (skipping the very first sync in edit mode where attorney +
  // claimant arrive together).
  useEffect(() => {
    if (!formData.claimantId || !formData.referringAttorney) return;
    if (claimantsLoading) return;
    const stillValid = filteredClaimants.some(c => c.id === formData.claimantId);
    if (stillValid) return;
    if (isEditMode && !hasUserChangedAttorneyRef.current) return;
    setFormData(prev => ({ ...prev, claimantId: "" }));
    toast.info('Claimant selection cleared - please select a claimant from the chosen referring attorney');
  }, [filteredClaimants, claimantsLoading, formData.claimantId, formData.referringAttorney, isEditMode]);


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
      discountType: "amount",
      depositMade: "",
      fullPayment: "",
      paymentTerms: "",
      agreementDurationMonths: "",
      notes: "",
      salesConsultantId: ""
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
        appointmentDate: appointmentData.appointment_date,
        discountAmount: appointmentData.discount_amount || 0,
        discountRate: appointmentData.discount_rate || 0,
        discountType: appointmentData.discount_type || 'amount'
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
        const rawDiscount = item.discount ? parseFloat(item.discount) : 0;
        const discount = (item as any).discountType === 'percentage'
          ? (assessmentFees * rawDiscount) / 100
          : rawDiscount;
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
        
        // Extract claimant names for assessment code
        const queueClaimant = claimants.find(c => c.id === item.claimantId);
        const assessmentCode = item.assessmentType && item.appointmentDate
          ? generateAssessmentCode(
              item.assessmentType,
              `${item.appointmentDate}T${item.appointmentTime || '09:00'}`,
              queueClaimant?.first_name_masked || queueClaimant?.first_name,
              queueClaimant?.last_name_masked || queueClaimant?.last_name
            )
          : null;

        return {
          claimant_id: item.claimantId,
          expert_id: item.expertId,
          referring_attorney_id: item.referringAttorneyId,
          referring_attorney: item.attorneyName,
          appointment_date: appointmentDateTime.toISOString(),
          matter_type: item.assessmentType || null,
          service_fee: serviceFee || null,
          deposit_amount: depositAmount,
          discount_amount: discount,
          discount_rate: (item as any).discountType === 'percentage' ? (parseFloat(item.discount) || 0) : 0,
          discount_type: (item as any).discountType || 'amount',
          payment_date: paymentDate,
          payment_status: paymentStatus,
          payment_terms: item.paymentTerms || null,
          agreement_duration_months: item.agreementDurationMonths ? parseInt(item.agreementDurationMonths) : null,
          case_status: 'scheduled',
          assessment_code: assessmentCode,
          sales_consultant_id: item.salesConsultantId || null
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

      // Authoritative server-side check: verify the claimant is linked to the
      // selected referring attorney before persisting the appointment.
      const { data: claimantRow, error: claimantCheckError } = await supabase
        .from('claimants')
        .select('id, referring_attorney_id')
        .eq('id', formData.claimantId)
        .maybeSingle();

      if (claimantCheckError) {
        console.error('Error verifying claimant linkage:', claimantCheckError);
        toast.error('Could not verify claimant. Please try again.');
        setSubmitting(false);
        return;
      }
      if (!claimantRow) {
        toast.error('Selected claimant no longer exists');
        setValidationErrors(prev => ({ ...prev, claimantId: true }));
        setSubmitting(false);
        return;
      }
      if (claimantRow.referring_attorney_id !== formData.referringAttorney) {
        toast.error('Selected claimant is not linked to the chosen referring attorney');
        setValidationErrors(prev => ({ ...prev, claimantId: true }));
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
      const rawDiscount = formData.discount ? parseFloat(formData.discount) : 0;
      const discount = formData.discountType === 'percentage'
        ? (assessmentFees * rawDiscount) / 100
        : rawDiscount;
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

      const selectedClaimantForCode = claimants.find(c => c.id === formData.claimantId);
      const assessmentCode = formData.assessmentType
        ? generateAssessmentCode(
            formData.assessmentType,
            appointmentDateTime.toISOString(),
            selectedClaimantForCode?.first_name_masked || selectedClaimantForCode?.first_name,
            selectedClaimantForCode?.last_name_masked || selectedClaimantForCode?.last_name
          )
        : null;

      const appointmentData = {
        claimant_id: formData.claimantId,
        expert_id: formData.expertId,
        referring_attorney_id: formData.referringAttorney,
        referring_attorney: selectedAttorney.name,
        appointment_date: appointmentDateTime.toISOString(),
        matter_type: formData.assessmentType || null,
        service_fee: serviceFee || null,
        deposit_amount: depositAmount,
        discount_amount: discount,
        discount_rate: formData.discountType === 'percentage' ? (parseFloat(formData.discount) || 0) : 0,
        discount_type: formData.discountType || 'amount',
        payment_date: paymentDate,
        payment_status: paymentStatus,
        payment_terms: formData.paymentTerms || null,
        agreement_duration_months: formData.agreementDurationMonths ? parseInt(formData.agreementDurationMonths) : null,
        case_status: 'scheduled',
        assessment_code: assessmentCode,
        sales_consultant_id: formData.salesConsultantId || null
      };

      if (isEditMode && editingAppointmentId) {
        // Fetch previous values so we can compute deltas for linked finance records
        const { data: prevAppt } = await supabase
          .from('appointments')
          .select('service_fee, deposit_amount, discount_amount, referring_attorney_id, appointment_date')
          .eq('id', editingAppointmentId)
          .maybeSingle();

        // Update existing appointment
        const { error } = await supabase
          .from('appointments')
          .update(appointmentData)
          .eq('id', editingAppointmentId);

        if (error) {
          console.error('Database error:', error);
          throw error;
        }

        // Propagate financial corrections to linked AOD document(s) for the
        // same attorney/month so Finance, Debt Tracker and Attorney Portal reflect
        // the corrected values immediately.
        try {
          const apptDate = new Date(appointmentDateTime);
          const monthStart = new Date(apptDate.getFullYear(), apptDate.getMonth(), 1).toISOString().split('T')[0];
          const monthEnd = new Date(apptDate.getFullYear(), apptDate.getMonth() + 1, 0).toISOString().split('T')[0];

          const { data: linkedAod } = await supabase
            .from('aod_documents')
            .select('id, total_contract_value, deposit_amount, discount_amount')
            .eq('referring_attorney_id', formData.referringAttorney)
            .gte('contract_start_date', monthStart)
            .lte('contract_start_date', monthEnd)
            .maybeSingle();

          if (linkedAod) {
            const prevFee = Number(prevAppt?.service_fee) || 0;
            const prevDep = Number(prevAppt?.deposit_amount) || 0;
            const prevDisc = Number((prevAppt as any)?.discount_amount) || 0;

            const newValue = Math.max(0, (Number(linkedAod.total_contract_value) || 0) - prevFee + serviceFee);
            const newDeposit = Math.max(0, (Number(linkedAod.deposit_amount) || 0) - prevDep + depositAmount);
            const newDiscount = Math.max(0, (Number(linkedAod.discount_amount) || 0) - prevDisc + discount);

            await supabase
              .from('aod_documents')
              .update({
                total_contract_value: newValue,
                deposit_amount: newDeposit,
                discount_amount: newDiscount,
                payment_status: newDeposit >= newValue && newValue > 0 ? 'paid' : 'pending',
                updated_at: new Date().toISOString(),
              })
              .eq('id', linkedAod.id);
          }

          // Sync linked short-term agreement(s) for this appointment
          const stPayload: any = {
            service_fee: serviceFee,
            deposit_amount: depositAmount,
            discount_amount: discount,
            discount_rate: formData.discountType === 'percentage' ? (parseFloat(formData.discount) || 0) : 0,
            discount_reason: formData.discountType === 'percentage' ? 'Percentage discount' : 'Flat discount',
            updated_at: new Date().toISOString(),
          };
          await (supabase as any)
            .from('short_term_agreements')
            .update(stPayload)
            .eq('appointment_id', editingAppointmentId);
        } catch (syncErr) {
          console.warn('Linked finance record sync warning:', syncErr);
        }

        toast.success('Appointment updated successfully');

        // Broadcast so Finance/AOD/Short-Term/Debt-Tracker dashboards refresh.
        window.dispatchEvent(new CustomEvent('agreement-data-updated', {
          detail: { source: 'appointment-edit', appointmentId: editingAppointmentId }
        }));
        window.dispatchEvent(new CustomEvent('appointment-financials-updated', {
          detail: { appointmentId: editingAppointmentId, serviceFee, depositAmount, discount }
        }));

        // Wait for real-time sync to propagate changes across all dashboards
        await new Promise(resolve => setTimeout(resolve, 800));

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
              deposit_amount: depositAmount,
              discount_amount: discount,
              discount_rate: formData.discountType === 'percentage' ? (parseFloat(formData.discount) || 0) : 0,
              discount_type: formData.discountType || 'amount',
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
    if (field === 'referringAttorney') {
      hasUserChangedAttorneyRef.current = true;
    }
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

  const VALID_ASSESSMENT_TYPES = ['MVA', 'Medical Negligence', 'Merit Report', 'Assault Matter', 'Slip and Fall Matter', 'Mitigation', 'Joint Minutes', 'Addendum', 'Affidavits', 'Court Preparation', 'Court Attendance'];

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

    // Validate the selected claimant is linked to the selected referring attorney
    if (formData.claimantId && formData.referringAttorney) {
      const selected = claimants.find(c => c.id === formData.claimantId);
      if (selected && selected.referring_attorney_id && selected.referring_attorney_id !== formData.referringAttorney) {
        errors.claimantId = true;
        toast.error('Selected claimant is not linked to the chosen referring attorney');
      }
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
    <div className={embedded ? '' : 'min-h-screen bg-background'}>
      {!embedded && (
        <Helmet>
          <title>{isEditMode ? 'Edit Appointment' : 'Schedule New Appointment'} - Medico-Legal Assessment System</title>
          <meta name="description" content={isEditMode ? 'Edit an existing medical assessment appointment.' : 'Schedule a new medical assessment appointment for claimants with available medical experts.'} />
          <link rel="canonical" href={canonicalUrl} />
        </Helmet>
      )}

      {!embedded && (
        <header className="border-b border-black/10 bg-white">
          <div className="container mx-auto flex items-center gap-4 px-4 py-6">
            <Button variant="outline" size="sm" className="rounded-none border-black/15 hover:bg-black/5" asChild>
              <Link to="/scheduled-assessment">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Scheduled Assessments
              </Link>
            </Button>
            <h1 className="text-2xl font-bold text-black">{isEditMode ? 'Edit Appointment' : 'Schedule New Appointment'}</h1>
          </div>
        </header>
      )}

      <main className={embedded ? '' : 'container mx-auto px-4 py-8'}>
        <div className={embedded ? 'space-y-6' : 'mx-auto max-w-5xl space-y-6'}>
          {/* Page-level title row — only for embedded mode, since the panel's
              own SheetHeader already carries the title in that context. In
              standalone mode the same information is covered by the page
              header above, so this row only shows here. */}
          {!embedded && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg font-semibold text-black">
                <CalendarIcon className="h-5 w-5" style={{ color: BRAND_TEAL }} />
                {isEditMode ? 'Edit Assessment Appointment' : 'New Assessment Appointment'}
              </div>
              {!isEditMode && <DraftStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />}
            </div>
          )}
          {embedded && !isEditMode && (
            <div className="flex justify-end">
              <DraftStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
            </div>
          )}

          {/* Queue panel — capped scroll instead of growing the page, so
              staff batching several bookings never lose the form itself
              off the bottom of the screen. */}
          {bookingType === 'multiple' && appointmentQueue.length > 0 && (
            <AdminCard>
              <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-black">
                  <ListChecks className="h-4 w-4" style={{ color: BRAND_TEAL }} />
                  Appointment Queue ({appointmentQueue.length})
                </div>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto p-4">
                {appointmentQueue.map((item) => (
                  <div key={item.id} className="border border-black/10 bg-black/[0.015] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-black">{item.claimantName}</span>
                          <span
                            className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                            style={{ color: BRAND_TEAL, backgroundColor: `${BRAND_TEAL}14` }}
                          >
                            {formatExpertType(item.expertType)}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Expert: <span className="font-medium text-black">{item.expertName}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Date: <span className="font-medium text-black">{item.appointmentDate}</span>
                          {item.appointmentTime && <span> at {item.appointmentTime}</span>}
                        </div>
                        <div className="text-xs text-slate-500">
                          Attorney: <span className="font-medium text-black">{item.attorneyName}</span>
                        </div>
                        {item.assessmentType && (
                          <div className="text-xs text-slate-500">
                            Type: <span className="font-medium text-black">{item.assessmentType}</span>
                          </div>
                        )}
                        {item.assessmentFees && (
                          <div className="text-xs text-slate-500">
                            Assessment Fee: <span className="font-medium text-black">R {parseFloat(item.assessmentFees).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromQueue(item.id)}
                        className="h-7 w-7 shrink-0 rounded-none text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove from queue"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 border-t border-black/10 p-4">
                <Button
                  type="button"
                  onClick={submitQueue}
                  disabled={submitting}
                  className="flex-1 rounded-none bg-black text-white hover:bg-black/90"
                  size="lg"
                >
                  {submitting ? 'Submitting Queue...' : `Submit All ${appointmentQueue.length} Appointments`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAppointmentQueue([])}
                  size="lg"
                  className="rounded-none border-black/15 hover:bg-black/5"
                >
                  Clear Queue
                </Button>
              </div>
            </AdminCard>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Booking Type — only shown when creating, styled as a compact
                segmented toggle rather than a bare radio pair. */}
            {!isEditMode && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Booking Type</Label>
                <RadioGroup value={bookingType} onValueChange={setBookingType} className="flex gap-2">
                  {[
                    { value: 'single', label: 'Single Booking' },
                    { value: 'multiple', label: 'Multiple Booking' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      htmlFor={opt.value}
                      className={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-sm transition-colors ${
                        bookingType === opt.value
                          ? 'border-black bg-black text-white'
                          : 'border-black/15 text-black hover:bg-black/5'
                      }`}
                    >
                      <RadioGroupItem value={opt.value} id={opt.value} className="sr-only" />
                      {opt.label}
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}

            {isEditMode && (editAppointmentDetails.attorney || editAppointmentDetails.claimant) && (
              <AdminCard className="bg-black/[0.015]">
                <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Saved referring attorney</p>
                    <p className="text-sm font-semibold text-black">
                      {formatAttorneyDisplay(editAppointmentDetails.attorney) || 'Not available'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Saved claimant</p>
                    <p className="text-sm font-semibold text-black">
                      {formatClaimantDisplay(editAppointmentDetails.claimant) || 'Not available'}
                    </p>
                  </div>
                </div>
              </AdminCard>
            )}

            {/* ---------------------------------------------------------- */}
            {/* Section: Case & Attorney                                   */}
            {/* ---------------------------------------------------------- */}
            <div className="space-y-4">
              <AdminSectionLabel>
                <span className="flex items-center gap-1.5">
                  <UserSquare2 className="h-3.5 w-3.5" />
                  Case &amp; Attorney
                </span>
              </AdminSectionLabel>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Referring Attorney FIRST - to filter claimants */}
                <div className="space-y-2" data-field="referringAttorney">
                  <Label htmlFor="referring-attorney" className={validationErrors.referringAttorney ? "text-destructive" : ""}>Referring Attorney *</Label>
                  <Select value={formData.referringAttorney} onValueChange={(value) => handleInputChange('referringAttorney', value)}>
                    <SelectTrigger className={`rounded-none ${validationErrors.referringAttorney ? "border-destructive ring-1 ring-destructive focus:ring-destructive" : ""}`}>
                      <SelectValue placeholder={loading ? "Loading attorneys..." : "Select referring attorney"}>
                        {formData.referringAttorney && (() => {
                          const selectedAttorney = attorneys.find(a => a.id === formData.referringAttorney)
                            || (editAppointmentDetails.attorney?.id === formData.referringAttorney ? editAppointmentDetails.attorney : null);
                          return selectedAttorney ? formatAttorneyDisplay(selectedAttorney) : null;
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {editAppointmentDetails.attorney?.id && !attorneys.some(a => a.id === editAppointmentDetails.attorney.id) && (
                        <SelectItem key={editAppointmentDetails.attorney.id} value={editAppointmentDetails.attorney.id}>
                          {formatAttorneyDisplay(editAppointmentDetails.attorney)}
                        </SelectItem>
                      )}
                      {attorneys.map((attorney) => (
                        <SelectItem key={attorney.id} value={attorney.id}>
                          {formatAttorneyDisplay(attorney)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {validationErrors.referringAttorney && <p className="text-sm text-destructive">Please select a referring attorney</p>}
                </div>

                {/* Claimant - filtered by selected referring attorney (in both new + edit modes) */}
                <div className="space-y-2" data-field="claimantId">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="claimant" className={validationErrors.claimantId ? "text-destructive" : ""}>Claimant Name *</Label>
                    {formData.referringAttorney && (
                      <span className="text-xs text-slate-500">
                        {filteredClaimants.length} linked claimant{filteredClaimants.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <Select
                    value={formData.claimantId}
                    onValueChange={handleClaimantChange}
                    disabled={!formData.referringAttorney || claimantsLoading}
                  >
                    <SelectTrigger className={`rounded-none ${validationErrors.claimantId ? "border-destructive ring-1 ring-destructive focus:ring-destructive" : ""}`}>
                      <SelectValue placeholder={
                        loading || claimantsLoading
                          ? "Loading claimants..."
                          : !formData.referringAttorney
                            ? "Select referring attorney first"
                            : filteredClaimants.length === 0
                              ? "No claimants for this attorney"
                              : "Select claimant"
                      }>
                        {formData.claimantId ? (() => {
                          const selectedClaimant = claimants.find(c => c.id === formData.claimantId)
                            || (editAppointmentDetails.claimant?.id === formData.claimantId ? editAppointmentDetails.claimant : null);
                          return selectedClaimant ? formatClaimantDisplay(selectedClaimant) : "Select claimant";
                        })() : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        // Always show claimants linked to the selected attorney.
                        // In edit mode, also include the currently-selected claimant
                        // even if its referring_attorney_id is stale/mismatched, so
                        // the form never loses its current value.
                        const list = [...filteredClaimants];
                        if (isEditMode && formData.claimantId && !list.some(c => c.id === formData.claimantId)) {
                          const current = claimants.find(c => c.id === formData.claimantId)
                            || (editAppointmentDetails.claimant?.id === formData.claimantId ? editAppointmentDetails.claimant : null);
                          if (current) list.unshift(current);
                        }
                        return list.map((claimant) => (
                          <SelectItem key={claimant.id} value={claimant.id}>
                            {formatClaimantDisplay(claimant)}
                          </SelectItem>
                        ));
                      })()}
                    </SelectContent>
                  </Select>
                  {validationErrors.claimantId && <p className="text-sm text-destructive">Please select a claimant</p>}
                  {formData.referringAttorney && !claimantsLoading && filteredClaimants.length === 0 && (
                    <p className="text-sm text-slate-500">
                      No claimants found for this referring attorney. You may need to add one first.
                    </p>
                  )}
                  {(() => {
                    if (!formData.claimantId || !formData.referringAttorney || claimantsLoading) return null;
                    const selected = claimants.find(c => c.id === formData.claimantId)
                      || (editAppointmentDetails.claimant?.id === formData.claimantId ? editAppointmentDetails.claimant : null);
                    if (!selected || !selected.referring_attorney_id) return null;
                    if (selected.referring_attorney_id === formData.referringAttorney) return null;
                    const correctAttorney = attorneys.find(a => a.id === selected.referring_attorney_id);
                    return (
                      <div
                        role="alert"
                        className="mt-2 flex items-start gap-2 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <div className="space-y-1">
                          <p className="font-medium">
                            This claimant is not linked to the selected referring attorney.
                          </p>
                          <p className="text-destructive/90">
                            {correctAttorney
                              ? <>The claimant is currently linked to <span className="font-semibold">{correctAttorney.name}</span>.</>
                              : 'The claimant is linked to a different referring attorney.'}
                            {' '}To fix this, either change the Referring Attorney above to match,
                            pick a claimant from the dropdown that belongs to this attorney,
                            or update the claimant's referring attorney from the Claimants list.
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="Assessment location"
                    className="rounded-none"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sales-consultant">Sales Consultant</Label>
                  <Select value={formData.salesConsultantId} onValueChange={(value) => handleInputChange('salesConsultantId', value)}>
                    <SelectTrigger className="rounded-none">
                      <SelectValue placeholder={salesConsultants.length === 0 ? "No consultants available" : "Select sales consultant"}>
                        {formData.salesConsultantId && salesConsultants.find(sc => sc.id === formData.salesConsultantId)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {salesConsultants.map((consultant) => (
                        <SelectItem key={consultant.id} value={consultant.id}>
                          {consultant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    Attribute this appointment to a sales consultant for tracking.
                  </p>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------------- */}
            {/* Section: Expert & Assessment                               */}
            {/* ---------------------------------------------------------- */}
            <div className="space-y-4">
              <AdminSectionLabel>
                <span className="flex items-center gap-1.5">
                  <Stethoscope className="h-3.5 w-3.5" />
                  Expert &amp; Assessment
                </span>
              </AdminSectionLabel>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2" data-field="expertType">
                  <Label htmlFor="expert-type" className={validationErrors.expertType ? "text-destructive" : ""}>Type of Expert *</Label>
                  <Select value={formData.expertType} onValueChange={(value) => {
                    handleInputChange('expertType', value);
                    handleInputChange('expertId', '');
                  }}>
                    <SelectTrigger className={`rounded-none ${validationErrors.expertType ? "border-destructive ring-1 ring-destructive focus:ring-destructive" : ""}`}>
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
                    <SelectTrigger className={`rounded-none ${validationErrors.expertId ? "border-destructive ring-1 ring-destructive focus:ring-destructive" : ""}`}>
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
                    <p className="text-sm text-slate-500">
                      No {formatExpertType(formData.expertType)} experts are currently available in the system.
                    </p>
                  )}
                </div>

                <div className="space-y-2" data-field="appointmentDate">
                  <Label htmlFor="appointment-date" className={validationErrors.appointmentDate ? "text-destructive" : ""}>Appointment Date *</Label>
                  <Input
                    type="date"
                    id="appointment-date"
                    className={`rounded-none ${validationErrors.appointmentDate ? "border-destructive ring-1 ring-destructive focus-visible:ring-destructive" : ""}`}
                    value={formData.appointmentDate}
                    onChange={(e) => handleInputChange('appointmentDate', e.target.value)}
                    required
                  />
                  {validationErrors.appointmentDate && <p className="text-sm text-destructive">Please select an appointment date</p>}
                </div>

                <div className="space-y-2" data-field="appointmentTime">
                  <Label htmlFor="appointment-time" className={validationErrors.appointmentTime ? "text-destructive" : ""}>Appointment Time *</Label>
                  <Input
                    type="time"
                    id="appointment-time"
                    className={`rounded-none ${validationErrors.appointmentTime ? "border-destructive ring-1 ring-destructive focus-visible:ring-destructive" : ""}`}
                    value={formData.appointmentTime}
                    onChange={(e) => handleInputChange('appointmentTime', e.target.value)}
                  />
                  {validationErrors.appointmentTime && <p className="text-sm text-destructive">Please select an appointment time</p>}
                </div>

                <div className="space-y-2 md:col-span-2" data-field="assessmentType">
                  <Label htmlFor="assessment-type" className={validationErrors.assessmentType ? "text-destructive" : ""}>Assessment Type *</Label>
                  <Select value={formData.assessmentType} onValueChange={(value) => handleInputChange('assessmentType', value)}>
                    <SelectTrigger className={`rounded-none ${validationErrors.assessmentType ? "border-destructive ring-1 ring-destructive focus:ring-destructive" : ""}`}>
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
                      <SelectItem value="Mitigation">Mitigation</SelectItem>
                      {/* Post-Report Services (done after initial report completion) */}
                      <SelectItem value="Joint Minutes" className="text-muted-foreground">Joint Minutes (Post-Report)</SelectItem>
                      <SelectItem value="Addendum" className="text-muted-foreground">Addendum (Post-Report)</SelectItem>
                      {/* Court-Related Services */}
                      <SelectItem value="Affidavits" className="text-muted-foreground">Affidavits (Alternative to Court Attendance)</SelectItem>
                      {/* Court-Related Services */}
                      <SelectItem value="Court Preparation" className="text-muted-foreground">Court Preparation</SelectItem>
                      <SelectItem value="Court Attendance" className="text-muted-foreground">Court Attendance</SelectItem>
                    </SelectContent>
                  </Select>
                  {validationErrors.assessmentType && !formData.assessmentType && <p className="text-sm text-destructive">Please select an assessment type</p>}
                  {validationErrors.assessmentType && formData.assessmentType && <p className="text-sm text-destructive">"{formData.assessmentType}" is not an accepted assessment type. Please select a valid option.</p>}
                  {formData.assessmentType && formData.appointmentDate && (
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="rounded-none font-mono text-xs">
                        Auto Code: {(() => {
                          const sc = claimants.find(c => c.id === formData.claimantId);
                          return generateAssessmentCode(
                            formData.assessmentType,
                            `${formData.appointmentDate}T${formData.appointmentTime || '09:00'}`,
                            sc?.first_name_masked || sc?.first_name,
                            sc?.last_name_masked || sc?.last_name
                          );
                        })()}
                      </Badge>
                    </div>
                  )}
                  {(formData.assessmentType === 'Joint Minutes' || formData.assessmentType === 'Addendum') && (
                    <p className="text-sm text-slate-500">
                      ℹ️ This is a post-report service requested after the expert's initial report is complete.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------------- */}
            {/* Section: Payment & Terms                                   */}
            {/* ---------------------------------------------------------- */}
            <div className="space-y-4">
              <AdminSectionLabel>
                <span className="flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" />
                  Payment &amp; Terms
                </span>
              </AdminSectionLabel>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="assessment-fees">Assessment Fees</Label>
                  <Input
                    id="assessment-fees"
                    type="number"
                    placeholder="Enter assessment fees"
                    className="rounded-none"
                    value={formData.assessmentFees}
                    onChange={(e) => handleInputChange('assessmentFees', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discount">Discount</Label>
                  <div className="flex gap-2">
                    <Input
                      id="discount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={formData.discountType === 'percentage' ? 'Enter discount %' : 'Enter discount amount'}
                      value={formData.discount}
                      onChange={(e) => handleInputChange('discount', e.target.value)}
                      className="flex-1 rounded-none"
                    />
                    <Select
                      value={formData.discountType}
                      onValueChange={(value) => handleInputChange('discountType', value)}
                    >
                      <SelectTrigger className="w-32 rounded-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amount">Amount (R)</SelectItem>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deposit-made">Deposit Made</Label>
                  <Input
                    id="deposit-made"
                    type="number"
                    placeholder="Enter deposit amount"
                    className="rounded-none"
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
                    className="rounded-none"
                    value={formData.fullPayment}
                    onChange={(e) => handleInputChange('fullPayment', e.target.value)}
                  />
                </div>

                {/* Live calculation: Assessment fees - discount - deposit = outstanding balance */}
                {formData.assessmentFees && (
                  (() => {
                    const fees = parseFloat(formData.assessmentFees) || 0;
                    const rawDisc = parseFloat(formData.discount) || 0;
                    const discValue = formData.discountType === 'percentage'
                      ? (fees * rawDisc) / 100
                      : rawDisc;
                    const finalFee = Math.max(0, fees - discValue);
                    const deposit = parseFloat(formData.depositMade) || 0;
                    const outstanding = Math.max(0, finalFee - deposit);
                    const isFullyPaid = deposit > 0 && deposit >= finalFee;
                    return (
                      <AdminCard className="space-y-1 p-3 text-sm md:col-span-2">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Assessment Fees</span>
                          <span className="text-black">R {fees.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">
                            Discount {formData.discountType === 'percentage' ? `(${rawDisc || 0}%)` : ''}
                          </span>
                          <span className="text-black">- R {discValue.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-t border-black/10 pt-1">
                          <span className="text-slate-500">Final Fee</span>
                          <span className="font-medium text-black">R {finalFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Deposit Made</span>
                          <span className="text-black">- R {deposit.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-t border-black/10 pt-1">
                          <span className="font-semibold text-black">
                            {isFullyPaid ? 'Status' : 'Outstanding Balance'}
                          </span>
                          <span className={`font-bold ${isFullyPaid ? 'text-success' : 'text-destructive'}`}>
                            {isFullyPaid ? '✓ Fully Paid' : `R ${outstanding.toFixed(2)}`}
                          </span>
                        </div>
                      </AdminCard>
                    );
                  })()
                )}

                <div className="space-y-2">
                  <Label htmlFor="payment-terms">Terms of Payment</Label>
                  <Select value={formData.paymentTerms} onValueChange={(value) => handleInputChange('paymentTerms', value)}>
                    <SelectTrigger className="rounded-none">
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
                    <p className="text-xs text-slate-500">
                      {(() => {
                        const paymentLower = formData.paymentTerms.toLowerCase();
                        const duration = parseInt(formData.agreementDurationMonths) || 0;
                        const assessmentFees = parseFloat(formData.assessmentFees) || 0;
                        const rawDiscount = parseFloat(formData.discount) || 0;
                        const discount = formData.discountType === 'percentage'
                          ? (assessmentFees * rawDiscount) / 100
                          : rawDiscount;
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
                    className="rounded-none"
                    value={formData.agreementDurationMonths}
                    onChange={(e) => handleInputChange('agreementDurationMonths', e.target.value)}
                    min="0"
                  />
                  <p className="text-xs text-slate-500">
                    Leave blank for standard AOD (defaults to 12 months). Use &lt;12 for short-term agreements.
                  </p>
                </div>

                {/* Debt Tracker Panel - shows when payment terms selected */}
                {formData.paymentTerms && formData.referringAttorney && (
                  <div className="md:col-span-2">
                    <DebtTrackerPanel
                      referringAttorneyId={formData.referringAttorney}
                      paymentTerms={formData.paymentTerms}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ---------------------------------------------------------- */}
            {/* Section: Notes                                             */}
            {/* ---------------------------------------------------------- */}
            <div className="space-y-4">
              <AdminSectionLabel>
                <span className="flex items-center gap-1.5">
                  <NotebookPen className="h-3.5 w-3.5" />
                  Notes
                </span>
              </AdminSectionLabel>
              <div className="space-y-2">
                <Label htmlFor="notes">Special Instructions/Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special instructions or notes for the assessment"
                  rows={4}
                  className="rounded-none"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                />
              </div>
            </div>

            {bookingType === 'multiple' && (
              <div className="border border-black/10 bg-black/[0.02] p-4">
                <h4 className="mb-2 text-sm font-semibold text-black">Multiple Booking Instructions</h4>
                <div className="space-y-1 text-sm text-slate-600">
                  <p>• Fill out the form above for each appointment you want to schedule</p>
                  <p>• Select different expert types and experts for each appointment</p>
                  <p>• Click "Add to Queue" to add each appointment to your batch</p>
                  <p>• Review your queued appointments above</p>
                  <p>• Click "Submit All Appointments" when ready to schedule all at once</p>
                </div>
              </div>
            )}

            {/* Sticky action bar — stays reachable at the bottom of the
                viewport instead of getting lost after a long scroll, the
                same "always-visible controls" principle as the sticky tab
                switcher on the Appointment Engine and System Control. */}
            <div className={embedded ? 'sticky bottom-0 -mx-6 border-t border-black/10 bg-white/95 px-6 py-4 backdrop-blur' : 'sticky bottom-0 -mx-4 border-t border-black/10 bg-white/95 px-4 py-4 backdrop-blur'}>
              <div className="flex gap-3">
                {bookingType === 'multiple' && !isEditMode ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addToQueue}
                      className="flex-1 rounded-none border-black/15 hover:bg-black/5"
                      disabled={!formData.claimantId || !formData.expertId || !formData.expertType || !formData.appointmentDate || !formData.referringAttorney}
                    >
                      Add to Queue ({appointmentQueue.length})
                    </Button>
                    <Button type="button" variant="outline" className="rounded-none border-black/15 hover:bg-black/5" asChild>
                      <Link to="/">Cancel</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="submit" className="flex-1 rounded-none bg-black text-white hover:bg-black/90" disabled={submitting}>
                      {submitting ? (isEditMode ? 'Updating...' : 'Scheduling...') : (isEditMode ? 'Update Appointment' : 'Schedule Appointment')}
                    </Button>
                    <Button type="button" variant="outline" className="rounded-none border-black/15 hover:bg-black/5" asChild>
                      <Link to="/scheduled-assessment">Cancel</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </form>
        </div>
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

      {!embedded && <CompanyFooter />}
    </div>
  );
};

export default NewAppointment;
