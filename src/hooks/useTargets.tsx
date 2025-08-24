import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Target {
  id: string;
  law_firm_id: string;
  period_type: 'monthly' | 'quarterly' | 'yearly';
  period_start: string;
  period_end: string;
  target_assessments: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface TargetWithActuals extends Target {
  actual_assessments: number;
  difference: number;
  achievement_percentage: number;
  is_achieved: boolean;
}

export const useTargets = () => {
  const { user } = useAuth();
  const [targets, setTargets] = useState<TargetWithActuals[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTargets = async () => {
    if (!user) return;

    try {
      // Get targets
      const { data: targetsData, error: targetsError } = await supabase
        .from('targets' as any)
        .select('*')
        .order('period_start', { ascending: false });

      if (targetsError) throw targetsError;

      // Get actual assessment counts for each target period
      const targetsWithActuals = await Promise.all(
        ((targetsData as unknown as Target[]) || []).map(async (target: Target) => {
          const { data: appointmentsData, error: appointmentsError } = await supabase
            .from('appointments')
            .select('id, case_status')
            .gte('appointment_date', target.period_start)
            .lte('appointment_date', target.period_end)
            .in('case_status', ['scheduled', 'booked', 'confirmed']);

          if (appointmentsError) {
            console.error('Error fetching appointments:', appointmentsError);
          }

          const actual_assessments = appointmentsData?.length || 0;
          const difference = actual_assessments - target.target_assessments;
          const achievement_percentage = target.target_assessments > 0 
            ? Math.round((actual_assessments / target.target_assessments) * 100)
            : 0;
          const is_achieved = actual_assessments >= target.target_assessments;

          return {
            ...target,
            actual_assessments,
            difference,
            achievement_percentage,
            is_achieved
          } as TargetWithActuals;
        })
      );

      setTargets(targetsWithActuals);
    } catch (error) {
      console.error('Error fetching targets:', error);
      toast.error('Failed to load targets');
    } finally {
      setLoading(false);
    }
  };

  const createTarget = async (targetData: {
    period_type: 'monthly' | 'quarterly' | 'yearly';
    period_start: string;
    period_end: string;
    target_assessments: number;
  }) => {
    if (!user) return false;

    try {
      // Get user's law firm ID
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('law_firm_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        toast.error('Failed to fetch user profile');
        return false;
      }

      if (!userProfile?.law_firm_id) {
        toast.error('User law firm not found');
        return false;
      }

      const { error } = await supabase
        .from('targets' as any)
        .insert({
          ...targetData,
          law_firm_id: userProfile.law_firm_id,
          created_by: user.id
        });

      if (error) throw error;

      // Log audit trail for target creation
      await supabase.rpc('log_audit_trail', {
        p_table_name: 'targets',
        p_record_id: null, // Will be filled by the audit function
        p_action_type: 'INSERT',
        p_function_area: 'Target Management',
        p_old_values: null,
        p_new_values: {
          ...targetData,
          law_firm_id: userProfile.law_firm_id,
          created_by: user.id
        },
        p_description: `Target created: ${targetData.target_assessments} assessments for ${targetData.period_type} period`
      });

      toast.success('Target created successfully');
      await fetchTargets();
      return true;
    } catch (error) {
      console.error('Error creating target:', error);
      toast.error('Failed to create target');
      return false;
    }
  };

  const updateTarget = async (id: string, targetData: {
    target_assessments: number;
    period_start?: string;
    period_end?: string;
  }) => {
    try {
      // Get the original target data for audit trail
      const { data: originalTarget, error: fetchError } = await supabase
        .from('targets' as any)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching target for update:', fetchError);
        toast.error('Failed to fetch target data');
        return false;
      }

      const { error } = await supabase
        .from('targets' as any)
        .update(targetData)
        .eq('id', id);

      if (error) throw error;

      // Log audit trail
      if (originalTarget) {
        const updatedValues = Object.assign({}, originalTarget, targetData);
        await supabase.rpc('log_audit_trail', {
          p_table_name: 'targets',
          p_record_id: id,
          p_action_type: 'UPDATE',
          p_function_area: 'Target Management',
          p_old_values: originalTarget,
          p_new_values: updatedValues,
          p_description: `Target updated: ${targetData.target_assessments} assessments`
        });
      }

      toast.success('Target updated successfully');
      await fetchTargets();
      return true;
    } catch (error) {
      console.error('Error updating target:', error);
      toast.error('Failed to update target');
      return false;
    }
  };

  const deleteTarget = async (id: string) => {
    try {
      // Get the original target data for audit trail
      const { data: originalTarget, error: fetchError } = await supabase
        .from('targets' as any)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching target for deletion:', fetchError);
        toast.error('Failed to fetch target data');
        return false;
      }

      const { error } = await supabase
        .from('targets' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Log audit trail
      if (originalTarget && 'target_assessments' in originalTarget && 'period_type' in originalTarget) {
        await supabase.rpc('log_audit_trail', {
          p_table_name: 'targets',
          p_record_id: id,
          p_action_type: 'DELETE',
          p_function_area: 'Target Management',
          p_old_values: originalTarget,
          p_new_values: null,
          p_description: `Target deleted: ${originalTarget.target_assessments} assessments for ${originalTarget.period_type} period`
        });
      }

      toast.success('Target deleted successfully');
      await fetchTargets();
      return true;
    } catch (error) {
      console.error('Error deleting target:', error);
      toast.error('Failed to delete target');
      return false;
    }
  };

  // Helper function to spread yearly target into monthly/quarterly
  const spreadYearlyTarget = async (yearlyTarget: number, year: number) => {
    const monthlyTarget = Math.round(yearlyTarget / 12);
    const quarterlyTarget = Math.round(yearlyTarget / 4);

    const targets = [];

    // Create monthly targets
    for (let month = 0; month < 12; month++) {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
      targets.push({
        period_type: 'monthly' as const,
        period_start: startDate.toISOString().split('T')[0],
        period_end: endDate.toISOString().split('T')[0],
        target_assessments: monthlyTarget
      });
    }

    // Create quarterly targets (only for 2025 and beyond)
    if (year >= 2025) {
      // Define quarters with explicit month ranges to ensure December is included
      const quarters = [
        { start: 0, end: 2 },   // Q1: January to March
        { start: 3, end: 5 },   // Q2: April to June
        { start: 6, end: 8 },   // Q3: July to September
        { start: 9, end: 11 }   // Q4: October to December
      ];

      quarters.forEach((q, index) => {
        const startDate = new Date(year, q.start, 1);
        const endDate = new Date(year, q.end + 1, 0); // Last day of end month
        
        targets.push({
          period_type: 'quarterly' as const,
          period_start: startDate.toISOString().split('T')[0],
          period_end: endDate.toISOString().split('T')[0],
          target_assessments: quarterlyTarget
        });
      });
    }

    // Create yearly target
    targets.push({
      period_type: 'yearly' as const,
      period_start: `${year}-01-01`,
      period_end: `${year}-12-31`,
      target_assessments: yearlyTarget
    });

    // Create all targets
    for (const target of targets) {
      await createTarget(target);
    }

    return true;
  };

  const clearAllTargets = async () => {
    if (!user) return false;

    try {
      // Get user's law firm ID
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('law_firm_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        toast.error('Failed to fetch user profile');
        return false;
      }

      if (!userProfile?.law_firm_id) {
        toast.error('User law firm not found');
        return false;
      }

      // Delete all targets for the law firm
      const { error } = await supabase
        .from('targets' as any)
        .delete()
        .eq('law_firm_id', userProfile.law_firm_id);

      if (error) throw error;

      // Log audit trail for clearing targets
      await supabase.rpc('log_audit_trail', {
        p_table_name: 'targets',
        p_record_id: null,
        p_action_type: 'DELETE',
        p_function_area: 'Target Management',
        p_old_values: null,
        p_new_values: null,
        p_description: `All targets cleared for law firm: ${userProfile.law_firm_id}`
      });

      toast.success('All targets cleared successfully');
      await fetchTargets();
      return true;
    } catch (error) {
      console.error('Error clearing targets:', error);
      toast.error('Failed to clear targets');
      return false;
    }
  };

  useEffect(() => {
    fetchTargets();
  }, [user]);

  return {
    targets,
    loading,
    createTarget,
    updateTarget,
    deleteTarget,
    spreadYearlyTarget,
    clearAllTargets,
    refetch: fetchTargets
  };
};