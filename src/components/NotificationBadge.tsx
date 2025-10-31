import React, { useEffect, useState } from 'react';
import { Bell, Calendar, AlertCircle } from 'lucide-react';
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

interface NewAttorney {
  id: string;
  name: string;
  contact_person: string;
  province: string;
  created_at: string;
}

export const NotificationBadge = () => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const [totalCount, setTotalCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [newAttorneys, setNewAttorneys] = useState<NewAttorney[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user || !isAdmin()) return;

    const fetchPendingData = async () => {
      try {
        // Fetch pending appointment requests
        const { data: requestsData, error: requestsError } = await supabase
          .from('appointment_requests')
          .select('id, claimant_first_name, claimant_last_name, expert_type_requested, matter_type, created_at, status')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        // Fetch new attorneys (added in last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { data: attorneysData, error: attorneysError } = await supabase
          .from('referring_attorneys')
          .select('id, name, contact_person, province, created_at')
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: false });

        if (!requestsError && requestsData) {
          setPendingRequests(requestsData);
        }

        if (!attorneysError && attorneysData) {
          setNewAttorneys(attorneysData);
        }

        const requestCount = requestsData?.length || 0;
        const attorneyCount = attorneysData?.length || 0;
        setTotalCount(requestCount + attorneyCount);

      } catch (error) {
        console.error('Error fetching notification data:', error);
      }
    };

    fetchPendingData();

    // Set up real-time subscriptions for both tables
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
          fetchPendingData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'referring_attorneys'
        },
        () => {
          fetchPendingData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin]);

  // Don't show notification badge if user is not admin or there are no notifications
  if (!isAdmin() || totalCount === 0) {
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
          className="relative flex items-center gap-2 border-orange-500/30 hover:bg-orange-50 hover:border-orange-500/50 transition-all duration-200"
        >
          <div className="relative">
            <Bell className="h-4 w-4 text-orange-600" />
            {totalCount > 0 && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs bg-red-500 text-white font-bold shadow-md animate-pulse"
          >
            {totalCount}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b p-3 bg-gradient-to-r from-orange-50 to-red-50">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-foreground">Notifications</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {totalCount} notification{totalCount !== 1 ? 's' : ''} require{totalCount === 1 ? 's' : ''} your attention
          </p>
        </div>
        <ScrollArea className="max-h-64">
          <div className="p-2">
            {/* Pending Appointment Requests */}
            {pendingRequests.length > 0 && (
              <div className="mb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Pending Requests ({pendingRequests.length})
                </h4>
                {pendingRequests.map((request) => (
                  <div
                    key={`request-${request.id}`}
                    className="flex items-start gap-3 p-2 rounded-md hover:bg-orange-50 transition-colors cursor-pointer border-l-2 border-transparent hover:border-orange-300"
                  >
                    <div className="p-1.5 bg-orange-100 rounded-lg">
                      <Calendar className="h-3 w-3 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {request.claimant_first_name} {request.claimant_last_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {request.expert_type_requested} • {request.matter_type}
                      </div>
                      <div className="text-xs text-orange-600 font-medium mt-1">
                        {formatTimeAgo(request.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* New Attorneys */}
            {newAttorneys.length > 0 && (
              <div className="mb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  New Attorneys ({newAttorneys.length})
                </h4>
                {newAttorneys.map((attorney) => (
                  <div
                    key={`attorney-${attorney.id}`}
                    className="flex items-start gap-3 p-2 rounded-md hover:bg-blue-50 transition-colors cursor-pointer border-l-2 border-transparent hover:border-blue-300"
                  >
                    <div className="p-1.5 bg-blue-100 rounded-lg">
                      <AlertCircle className="h-3 w-3 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {attorney.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {attorney.contact_person} • {attorney.province}
                      </div>
                      <div className="text-xs text-blue-600 font-medium mt-1">
                        {formatTimeAgo(attorney.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="border-t p-3 bg-gray-50">
          <Link to="/appointment-request-dashboard">
            <Button 
              variant="default" 
              size="sm" 
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => setIsOpen(false)}
            >
              View Dashboard
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};