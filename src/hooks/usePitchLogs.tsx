import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type PitchLog = {
  id: string;
  attorney_id: string;
  pitch_date: string;
  pitch_notes: string | null;
  feedback_comments: string | null;
  follow_up_reminder: string | null;
  created_at: string;
  created_by: string;
  law_firm_id: string | null;
};

export const usePitchLogs = (attorneyId?: string) => {
  const [pitchLogs, setPitchLogs] = useState<PitchLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPitchLogs = async (targetAttorneyId?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('pitch_logs')
        .select('*')
        .order('pitch_date', { ascending: false });

      if (targetAttorneyId || attorneyId) {
        query = query.eq('attorney_id', targetAttorneyId || attorneyId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setPitchLogs(data || []);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch pitch logs';
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

  const createPitchLog = async (pitchLogData: Omit<PitchLog, 'id' | 'created_at' | 'created_by'>) => {
    try {
      const { data, error } = await supabase
        .from('pitch_logs')
        .insert([{
          ...pitchLogData,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pitch log added successfully",
      });

      fetchPitchLogs();
      return data;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to create pitch log",
        variant: "destructive",
      });
      throw err;
    }
  };

  const updatePitchLog = async (logId: string, updates: Partial<PitchLog>) => {
    try {
      const { error } = await supabase
        .from('pitch_logs')
        .update(updates)
        .eq('id', logId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pitch log updated successfully",
      });

      fetchPitchLogs();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update pitch log",
        variant: "destructive",
      });
    }
  };

  const deletePitchLog = async (logId: string) => {
    try {
      const { error } = await supabase
        .from('pitch_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pitch log deleted successfully",
      });

      fetchPitchLogs();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete pitch log",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (attorneyId) {
      fetchPitchLogs();
    }
  }, [attorneyId]);

  return {
    pitchLogs,
    loading,
    error,
    fetchPitchLogs,
    createPitchLog,
    updatePitchLog,
    deletePitchLog,
    refetch: fetchPitchLogs,
  };
};