import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";

export type SecureMedicalExpert = {
  id: string;
  first_name: string;
  last_name: string;
  expert_type: string;
  province: string;
  specializations: string[];
  qualifications: string;
  years_experience: number;
  status: string;
  consultation_fees: number;
  court_fees: number;
  availability_notes: string;
  created_at: string;
  updated_at: string;
  email_masked: string;
  phone_masked: string;
  address_masked: string;
  pa_name_masked: string;
  pa_phone_masked: string;
  cv_document_url: string | null;
  matter_types: string[] | null;
};

export const useSecureMedicalExperts = () => {
  const [experts, setExperts] = useState<SecureMedicalExpert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { isPageLocked, isActiveTab } = useAppointmentSync();
  const initialFetchDone = useRef(false);

  const fetchExperts = async (forceRefresh = false) => {
    // Don't refetch if page is locked (user is actively working) unless forced
    if (isPageLocked && initialFetchDone.current && !forceRefresh) {
      console.log('SecureMedicalExperts: Page locked, skipping refresh');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_medical_experts_secure');

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setExperts(data || []);
      initialFetchDone.current = true;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch medical experts';
      setError(errorMessage);
      toast({
        title: "Access Restricted",
        description: "You can only view medical experts you have appointments with.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSingleExpert = async (expertId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_medical_expert_display_safe', { expert_id: expertId });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      return data?.[0] || null;
    } catch (err: any) {
      toast({
        title: "Access Restricted",
        description: "You can only view medical experts you have appointments with.",
        variant: "destructive",
      });
      return null;
    }
  };

  // Force refresh on mount to ensure fresh data after navigating back from edit
  useEffect(() => {
    // Always fetch on initial mount
    fetchExperts(true);
  }, []);

  useEffect(() => {
    // Refresh when tab becomes active and not locked
    if (initialFetchDone.current && isActiveTab && !isPageLocked) {
      fetchExperts();
    }
  }, [isActiveTab, isPageLocked]);

  // Listen for expert profile/fee updates dispatched by MedicalExpertFormPage
  useEffect(() => {
    const handler = () => {
      fetchExperts(true);
    };
    window.addEventListener('medical-expert-updated', handler);
    return () => window.removeEventListener('medical-expert-updated', handler);
  }, []);

  return {
    experts,
    loading,
    error,
    refetch: () => fetchExperts(true),
    fetchSingle: fetchSingleExpert,
  };
};