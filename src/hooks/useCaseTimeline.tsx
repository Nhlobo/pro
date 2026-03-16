import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";

export interface TimelinePhase {
  id: string;
  appointment_id: string;
  phase_name: string;
  phase_order: number;
  status: 'pending' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useCaseTimeline = (appointmentId?: string) => {
  const [timeline, setTimeline] = useState<TimelinePhase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { lastUpdate, isActiveTab, isPageLocked } = useAppointmentSync();

  const fetchTimeline = async (apptId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('case_timelines')
        .select('*')
        .eq('appointment_id', apptId)
        .order('phase_order', { ascending: true });

      if (fetchError) throw fetchError;

      setTimeline((data || []) as TimelinePhase[]);
    } catch (err) {
      console.error('Error fetching timeline:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch timeline');
    } finally {
      setLoading(false);
    }
  };

  const updatePhaseNotes = async (phaseId: string, notes: string) => {
    try {
      const { error: updateError } = await supabase
        .from('case_timelines')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('id', phaseId);

      if (updateError) throw updateError;

      toast.success('Phase notes updated successfully');
      
      // Refresh timeline
      if (appointmentId) {
        await fetchTimeline(appointmentId);
      }
    } catch (err) {
      console.error('Error updating phase notes:', err);
      toast.error('Failed to update phase notes');
    }
  };

  // Always fetch on initial mount, then respect sync conditions for updates
  const initialFetchDoneTimeline = useRef(false);
  useEffect(() => {
    if (appointmentId && !initialFetchDoneTimeline.current) {
      fetchTimeline(appointmentId);
      initialFetchDoneTimeline.current = true;
    } else if (appointmentId && isActiveTab && !isPageLocked) {
      fetchTimeline(appointmentId);
    }
  }, [appointmentId, lastUpdate, isActiveTab, isPageLocked]);

  return {
    timeline,
    loading,
    error,
    fetchTimeline,
    updatePhaseNotes,
    refetch: () => appointmentId && fetchTimeline(appointmentId)
  };
};
