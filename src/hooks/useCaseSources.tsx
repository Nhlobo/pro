import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';

export interface CaseSource {
  id: string;
  appointment_id: string;
  referring_attorney_id: string;
  source_type: 'MVA' | 'Medical Negligence' | 'Workers Compensation' | 'Other';
  source_details?: string;
  assessment_date: string;
  created_at: string;
}

export interface CaseSourceSummary {
  source_type: string;
  count: number;
  percentage: number;
  recent_cases: number; // last 30 days
  trend: 'up' | 'down' | 'stable';
}

export const useCaseSources = () => {
  const { user } = useAuth();
  const { lastUpdate, isActiveTab, isPageLocked } = useAppointmentSync();
  const [caseSources, setCaseSources] = useState<CaseSource[]>([]);
  const [summary, setSummary] = useState<CaseSourceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCaseSources = async () => {
    if (!user) return;

    try {
      // Get case sources using generic query until types are updated
      const { data: caseSourcesData, error: caseSourcesError } = await supabase
        .from('case_sources' as any)
        .select('*')
        .order('assessment_date', { ascending: false });

      if (caseSourcesError) throw caseSourcesError;

      setCaseSources((caseSourcesData as unknown as CaseSource[]) || []);

      // Calculate summary statistics
      const sourceTypes = ['MVA', 'Medical Negligence', 'Workers Compensation', 'Other'];
      const total = caseSourcesData?.length || 0;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const summaryData = sourceTypes.map(sourceType => {
        const typeData = caseSourcesData?.filter((cs: any) => cs.source_type === sourceType) || [];
        const recentCases = typeData.filter((cs: any) => 
          new Date(cs.assessment_date) >= thirtyDaysAgo
        ).length;
        
        // Simple trend calculation (could be enhanced with historical data)
        const trend: 'up' | 'down' | 'stable' = recentCases > typeData.length / 2 ? 'up' : 
                   recentCases < typeData.length / 4 ? 'down' : 'stable';

        return {
          source_type: sourceType,
          count: typeData.length,
          percentage: total > 0 ? Math.round((typeData.length / total) * 100) : 0,
          recent_cases: recentCases,
          trend
        };
      });

      setSummary(summaryData);
    } catch (error) {
      console.error('Error fetching case sources:', error);
      toast.error('Failed to load case sources');
    } finally {
      setLoading(false);
    }
  };

  const createCaseSource = async (caseSourceData: {
    appointment_id: string;
    source_type: 'MVA' | 'Medical Negligence' | 'Workers Compensation' | 'Other';
    source_details?: string;
    assessment_date: string;
  }) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('case_sources' as any)
        .insert(caseSourceData);

      if (error) throw error;

      toast.success('Case source recorded successfully');
      await fetchCaseSources();
      return true;
    } catch (error) {
      console.error('Error creating case source:', error);
      toast.error('Failed to record case source');
      return false;
    }
  };

  const updateCaseSource = async (id: string, caseSourceData: {
    source_type?: 'MVA' | 'Medical Negligence' | 'Workers Compensation' | 'Other';
    source_details?: string;
  }) => {
    try {
      const { error } = await supabase
        .from('case_sources' as any)
        .update(caseSourceData)
        .eq('id', id);

      if (error) throw error;

      toast.success('Case source updated successfully');
      await fetchCaseSources();
      return true;
    } catch (error) {
      console.error('Error updating case source:', error);
      toast.error('Failed to update case source');
      return false;
    }
  };

  const deleteCaseSource = async (id: string) => {
    try {
      const { error } = await supabase
        .from('case_sources' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Case source deleted successfully');
      await fetchCaseSources();
      return true;
    } catch (error) {
      console.error('Error deleting case source:', error);
      toast.error('Failed to delete case source');
      return false;
    }
  };

  // Only refetch when lastUpdate changes AND tab is active AND page is NOT locked
  useEffect(() => {
    if (isActiveTab && !isPageLocked) {
      fetchCaseSources();
    }
  }, [user, lastUpdate, isActiveTab, isPageLocked]);

  return {
    caseSources,
    summary,
    loading,
    createCaseSource,
    updateCaseSource,
    deleteCaseSource,
    refetch: fetchCaseSources
  };
};