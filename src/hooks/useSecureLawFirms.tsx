import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { deduplicateAttorneys } from "@/utils/deduplicateAttorneys";

export type SecureLawFirm = {
  id: string;
  name: string;
  contact_person: string;
  attorney_role: string;
  province: string;
  code: string;
  created_at: string;
  phone_masked: string;
  email_masked: string;
};

export const useSecureLawFirms = () => {
  const [lawFirms, setLawFirms] = useState<SecureLawFirm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchLawFirms = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_law_firms_list');

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Deduplicate attorneys before setting state
      const uniqueLawFirms = deduplicateAttorneys(data || []);
      setLawFirms(uniqueLawFirms);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch law firms';
      setError(errorMessage);
      toast({
        title: "Error",
        description: "Failed to load law firm data. You may not have permission to access this information.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSingleLawFirm = async (firmId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_law_firm_safe', { firm_id: firmId });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      return data?.[0] || null;
    } catch (err: any) {
      toast({
        title: "Error",
        description: "Failed to load law firm details. Access may be restricted.",
        variant: "destructive",
      });
      return null;
    }
  };

  useEffect(() => {
    fetchLawFirms();
  }, []);

  return {
    lawFirms,
    loading,
    error,
    refetch: fetchLawFirms,
    fetchSingle: fetchSingleLawFirm,
  };
};