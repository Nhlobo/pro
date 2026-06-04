import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  Calendar,
  FileText,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  FileSignature
} from "lucide-react";
import { formatDistanceToNow } from 'date-fns';

import { RandSign } from "@/components/icons/RandSign";
interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string | null;
  is_read: boolean;
  created_at: string;
}

interface ProfileNotificationsProps {
  referringAttorneyId?: string;
  readOnly?: boolean;
}

const ProfileNotifications: React.FC<ProfileNotificationsProps> = ({ referringAttorneyId, readOnly = false }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (user || referringAttorneyId) fetchNotifications();
  }, [user, referringAttorneyId]);

  const fetchNotifications = async () => {
    try {
      if (user) {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100);
        if (data) setNotifications(data);
      }
      // For access-code flow (no user), notifications will be empty as they're user-bound
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    if (readOnly) return;
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    if (readOnly) return;
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', user?.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const getIcon = (type: string, category: string | null) => {
    if (category === 'aod' || type.includes('aod')) return <FileSignature className="h-5 w-5 text-kutlwano-blue" />;
    if (category === 'payment' || type.includes('payment') || type.includes('deposit')) return <RandSign className="h-5 w-5 text-success" />;
    if (category === 'instalment' || type.includes('instalment') || type.includes('overdue')) return <AlertCircle className="h-5 w-5 text-destructive" />;
    if (category === 'report' || type.includes('report')) return <FileText className="h-5 w-5 text-kutlwano-teal" />;
    if (category === 'appointment' || type.includes('appointment')) return <Calendar className="h-5 w-5 text-kutlwano-blue" />;
    return <Bell className="h-5 w-5 text-muted-foreground" />;
  };

  const filtered = notifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.is_read;
    if (activeTab === 'aod') return n.category === 'aod' || n.type.includes('aod') || n.type.includes('payment') || n.type.includes('deposit') || n.type.includes('instalment');
    if (activeTab === 'reports') return n.category === 'report' || n.type.includes('report');
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold">{notifications.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Unread</p>
              <p className="text-xl font-bold text-destructive">{unreadCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">AOD/Payments</p>
              <p className="text-xl font-bold text-kutlwano-blue">
                {notifications.filter(n => n.category === 'aod' || n.category === 'payment' || n.type.includes('payment')).length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Reports</p>
              <p className="text-xl font-bold text-kutlwano-teal">
                {notifications.filter(n => n.category === 'report' || n.type.includes('report')).length}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {unreadCount > 0 && (
        <Button variant="outline" size="sm" onClick={markAllAsRead}>
          <CheckCircle2 className="h-4 w-4 mr-2" /> Mark All as Read
        </Button>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread {unreadCount > 0 && <Badge className="ml-1 bg-destructive text-xs">{unreadCount}</Badge>}</TabsTrigger>
          <TabsTrigger value="aod">AOD & Payments</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No notifications found</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {filtered.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 rounded-lg border transition-all ${
                      n.is_read ? 'bg-muted/30 border-border/50' : 'bg-primary/5 border-primary/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${n.is_read ? 'bg-muted' : 'bg-primary/10'}`}>
                        {getIcon(n.type, n.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className={`font-medium text-sm ${!n.is_read && 'text-foreground'}`}>{n.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                          </div>
                          {!n.is_read && (
                            <Button variant="ghost" size="sm" onClick={() => markAsRead(n.id)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </span>
                          {!n.is_read && <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">New</Badge>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfileNotifications;
