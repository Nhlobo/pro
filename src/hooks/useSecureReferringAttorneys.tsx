import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { deduplicateAttorneys } from "@/utils/deduplicateAttorneys";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";

export type SecureReferringAttorney = {
  id: string;
  name: string;
  contact_person: string;
  attorney_role: string;
  province: string;
  code: string;
  created_at: string;
  phone_masked: string;
  email_masked: string;
  claimant_count?: number;
  appointment_count?: number;
};

export const useSecureReferringAttorneys = () => {
  const [referringAttorneys, setReferringAttorneys] = useState<SecureReferringAttorney[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { isPageLocked, isActiveTab } = useAppointmentSync();
  const initialFetchDone = useRef(false);

  const fetchReferringAttorneys = async () => {
    // Don't refetch if page is locked (user is actively working)
    if (isPageLocked && initialFetchDone.current) {
      console.log('SecureReferringAttorneys: Page locked, skipping refresh');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_referring_attorneys_list');

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Deduplicate attorneys before setting state
      const uniqueAttorneys = deduplicateAttorneys(data || []);
      setReferringAttorneys(uniqueAttorneys);
      initialFetchDone.current = true;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch referring attorneys';
      setError(errorMessage);
      toast({
        title: "Error",
        description: "Failed to load referring attorney data. You may not have permission to access this information.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSingle = async (firmId: string) => {
    try {
      // Since there's no get_referring_attorney_safe function yet, get from list
      const { data, error: fetchError } = await supabase
        .rpc('get_referring_attorneys_list');

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      return data?.find((attorney: any) => attorney.id === firmId) || null;
    } catch (err: any) {
      toast({
        title: "Error",
        description: "Failed to load referring attorney details. Access may be restricted.",
        variant: "destructive",
      });
      return null;
    }
  };

  useEffect(() => {
    // Only fetch on initial load or when tab becomes active and not locked
    if (!initialFetchDone.current || (isActiveTab && !isPageLocked)) {
      fetchReferringAttorneys();
    }
  }, [isActiveTab, isPageLocked]);

  return {
    referringAttorneys,
    loading,
    error,
    refetch: fetchReferringAttorneys,
    fetchSingle: fetchSingle,
  };
};