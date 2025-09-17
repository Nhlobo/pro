import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type Attorney = {
  id: string;
  name: string;
  location: string | null;
  specialization: string[];
  email: string | null;
  phone: string | null;
  law_firm: string | null;
  address: string | null;
  status: 'potential' | 'pitched' | 'interested' | 'closed';
  created_at: string;
  updated_at: string;
  created_by: string;
  law_firm_id: string | null;
};


export const useAttorneys = (fetchAllForAdminEmployees: boolean = false) => {
  const [attorneys, setAttorneys] = useState<Attorney[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAttorneys = async (searchParams?: {
    name?: string;
    location?: string;
    specialization?: string;
    status?: string;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('attorneys')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply search filters
      if (searchParams?.name) {
        query = query.ilike('name', `%${searchParams.name}%`);
      }
      if (searchParams?.location) {
        query = query.ilike('location', `%${searchParams.location}%`);
      }
      if (searchParams?.specialization) {
        query = query.contains('specialization', [searchParams.specialization]);
      }
      if (searchParams?.status) {
        query = query.eq('status', searchParams.status);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setAttorneys((data as Attorney[]) || []);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch attorneys';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createAttorney = async (attorneyData: Omit<Attorney, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    try {
      const { data, error } = await supabase
        .from('attorneys')
        .insert([{
          ...attorneyData,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Attorney added successfully",
      });

      fetchAttorneys();
      return data;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to create attorney",
        variant: "destructive",
      });
      throw err;
    }
  };

  const updateAttorneyStatus = async (attorneyId: string, status: Attorney['status']) => {
    try {
      const { error } = await supabase
        .from('attorneys')
        .update({ status })
        .eq('id', attorneyId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Attorney status updated successfully",
      });

      fetchAttorneys();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update attorney status",
        variant: "destructive",
      });
    }
  };

  const getAttorneyStats = async () => {
    try {
      const { data, error } = await supabase
        .from('attorneys')
        .select('status');

      if (error) throw error;

      const stats = {
        total: data.length,
        potential: data.filter(a => a.status === 'potential').length,
        pitched: data.filter(a => a.status === 'pitched').length,
        interested: data.filter(a => a.status === 'interested').length,
        closed: data.filter(a => a.status === 'closed').length,
      };

      const statsWithConversion = {
        ...stats,
        conversionRate: stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0
      };

      return statsWithConversion;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to fetch attorney statistics",
        variant: "destructive",
      });
      return null;
    }
  };

  useEffect(() => {
    fetchAttorneys();
  }, []);

  return {
    attorneys,
    loading,
    error,
    fetchAttorneys,
    createAttorney,
    updateAttorneyStatus,
    getAttorneyStats,
    refetch: fetchAttorneys,
  };
};