import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ResponseRating {
  id: string;
  appointment_request_id: string;
  response_time_hours: number;
  response_rating: string; // Allow any string from database
  first_response_at: string;
  final_response_at?: string;
  notes?: string;
}

export const useResponseRatings = () => {
  const [ratings, setRatings] = useState<ResponseRating[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchRatings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointment_request_ratings')
        .select(`
          *,
          appointment_requests!inner(referring_attorney_id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRatings(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch response ratings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRecentRating = async (lawFirmId?: string): Promise<ResponseRating | null> => {
    try {
      const query = supabase
        .from('appointment_request_ratings')
        .select(`
          *,
          appointment_requests!inner(law_firm_id)
        `)
        .order('created_at', { ascending: false })
        .limit(1);

      if (lawFirmId) {
        query.eq('appointment_requests.referring_attorney_id', lawFirmId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return data || null;
    } catch (error: any) {
      console.error('Error fetching recent rating:', error);
      return null;
    }
  };

  const createRating = async (appointmentRequestId: string) => {
    try {
      // Create initial rating record
      const { error } = await supabase
        .from('appointment_request_ratings')
        .insert({
          appointment_request_id: appointmentRequestId,
          first_response_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Response Recorded",
        description: "Response time has been tracked successfully",
      });

      fetchRatings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to record response time",
        variant: "destructive",
      });
    }
  };

  const updateRating = async (
    ratingId: string, 
    updates: {
      final_response_at?: string;
      notes?: string;
    }
  ) => {
    try {
      const { error } = await supabase
        .from('appointment_request_ratings')
        .update(updates)
        .eq('id', ratingId);

      if (error) throw error;

      toast({
        title: "Rating Updated",
        description: "Response rating has been updated successfully",
      });

      fetchRatings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update response rating",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchRatings();
  }, []);

  return {
    ratings,
    loading,
    fetchRatings,
    getRecentRating,
    createRating,
    updateRating,
  };
};