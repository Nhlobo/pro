import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { deduplicateAttorneys } from "@/utils/deduplicateAttorneys";

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

  const fetchReferringAttorneys = async () => {
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
    fetchReferringAttorneys();
  }, []);

  return {
    referringAttorneys,
    loading,
    error,
    refetch: fetchReferringAttorneys,
    fetchSingle: fetchSingle,
  };
};