import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

/**
 * Checks for due/overdue pitchlog follow-ups and creates
 * in-app notifications so the bell rings for each sales consultant.
 * Runs once per session (per page mount).
 */
export const usePitchlogFollowUpReminders = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!user?.id || hasRun.current) return;
    hasRun.current = true;

    const checkFollowUps = async () => {
      try {
        // Get the current user's profile name (first_name) to filter their entries
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', user.id)
          .single();

        if (!profile?.first_name) return;

        const today = new Date().toISOString().split('T')[0]; // yyyy-MM-dd

        // Fetch pitchlog entries belonging to this user with follow_up_date <= today
        const { data: dueEntries, error } = await supabase
          .from('attorney_pitchlog')
          .select('id, law_firm_name, contact_person, follow_up_date, sales_person')
          .eq('sales_person', profile.first_name)
          .not('follow_up_date', 'is', null)
          .lte('follow_up_date', today)
          .order('follow_up_date', { ascending: true });

        if (error || !dueEntries || dueEntries.length === 0) return;

        // Check which follow-ups already have a recent notification (last 24h)
        // to avoid duplicate reminders
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: existingNotifs } = await supabase
          .from('notifications')
          .select('related_record_id')
          .eq('user_id', user.id)
          .eq('category', 'pitchlog_followup')
          .gte('created_at', yesterday);

        const alreadyNotified = new Set(
          (existingNotifs || []).map(n => n.related_record_id)
        );

        // Create notifications for entries not yet notified
        const newNotifications = dueEntries
          .filter(e => !alreadyNotified.has(e.id))
          .map(entry => {
            const isOverdue = entry.follow_up_date! < today;
            return {
              user_id: user.id,
              title: isOverdue
                ? `⚠️ Overdue Follow-up: ${entry.law_firm_name}`
                : `🔔 Follow-up Due Today: ${entry.law_firm_name}`,
              message: `Follow up with ${entry.contact_person} at ${entry.law_firm_name} (due ${entry.follow_up_date}).`,
              type: isOverdue ? 'warning' : 'info',
              category: 'pitchlog_followup',
              related_record_id: entry.id,
              related_table: 'attorney_pitchlog',
              is_read: false,
              email_sent: false,
            };
          });

        if (newNotifications.length === 0) return;

        const { error: insertError } = await supabase
          .from('notifications')
          .insert(newNotifications);

        if (insertError) {
          console.error('Error creating follow-up reminders:', insertError);
          return;
        }

        // Show a toast summary
        toast({
          title: '🔔 Follow-up Reminders',
          description: `You have ${newNotifications.length} pitchlog follow-up${newNotifications.length > 1 ? 's' : ''} due. Check your notifications.`,
        });
      } catch (err) {
        console.error('Error checking follow-up reminders:', err);
      }
    };

    checkFollowUps();
  }, [user?.id]);
};
