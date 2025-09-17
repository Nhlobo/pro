import React, { useEffect, useState } from 'react';
import { Bell, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';

interface PendingRequest {
  id: string;
  claimant_first_name: string;
  claimant_last_name: string;
  expert_type_requested: string;
  matter_type: string;
  created_at: string;
  status: string;
}

export const NotificationBadge = () => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user || !isAdmin()) return;

    const fetchPendingRequests = async () => {
      try {
        const { data, error } = await supabase
          .from('appointment_requests')
          .select('id, claimant_first_name, claimant_last_name, expert_type_requested, matter_type, created_at, status')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setPendingRequests(data);
          setPendingCount(data.length);
        }
      } catch (error) {
        console.error('Error fetching pending requests:', error);
      }
    };

    fetchPendingRequests();

    // Set up real-time subscription for count updates
    const channel = supabase
      .channel('notification-badge-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointment_requests'
        },
        () => {
          // Re-fetch when any appointment request changes
          fetchPendingRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin]);

  // Don't show notification badge if user is not admin or there are no pending requests
  if (!isAdmin() || pendingCount === 0) {
    return null;
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="relative flex items-center gap-2 border-kutlwano-blue/20 hover:bg-kutlwano-blue/10"
        >
          <Bell className="h-4 w-4" />
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-kutlwano-blue text-white"
          >
            {pendingCount}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b p-3">
          <h3 className="font-semibold text-foreground">Pending Requests</h3>
          <p className="text-sm text-muted-foreground">
            {pendingCount} appointment request{pendingCount !== 1 ? 's' : ''} awaiting review
          </p>
        </div>
        <ScrollArea className="max-h-64">
          <div className="p-2">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-start gap-3 p-2 rounded-md hover:bg-kutlwano-blue/5 transition-colors cursor-pointer"
              >
                <div className="p-1.5 bg-kutlwano-blue/10 rounded-lg">
                  <Calendar className="h-3 w-3 text-kutlwano-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {request.claimant_first_name} {request.claimant_last_name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {request.expert_type_requested} • {request.matter_type}
                  </div>
                  <div className="text-xs text-kutlwano-blue mt-1">
                    {formatTimeAgo(request.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="border-t p-3">
          <Link to="/appointment-request-dashboard">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-kutlwano-blue border-kutlwano-blue/20 hover:bg-kutlwano-blue/10"
              onClick={() => setIsOpen(false)}
            >
              View All Requests
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};