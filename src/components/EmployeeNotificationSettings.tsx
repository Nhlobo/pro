import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";

interface EmployeeNotification {
  id: string;
  user_id: string;
  email: string;
  receive_appointment_requests: boolean;
  receive_assessment_changes: boolean;
  receive_payment_changes: boolean;
  is_active: boolean;
  created_at: string;
}

export default function EmployeeNotificationSettings() {
  const [notifications, setNotifications] = useState<EmployeeNotification[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { isAdmin } = usePermissions();

  useEffect(() => {
    if (isAdmin) {
      fetchNotifications();
    }
  }, [isAdmin]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({
        title: "Error",
        description: "Failed to fetch notification settings",
        variant: "destructive",
      });
    }
  };

  const addEmployee = async () => {
    if (!newEmail.trim()) return;

    try {
      setLoading(true);
      
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('employee_notifications')
        .insert({
          user_id: user?.id,
          email: newEmail.trim(),
          receive_appointment_requests: true,
          receive_assessment_changes: true,
          receive_payment_changes: true,
          is_active: true
        });

      if (error) throw error;

      setNewEmail("");
      fetchNotifications();
      
      toast({
        title: "Success",
        description: "Employee notification settings added successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add employee",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateNotificationSetting = async (
    id: string, 
    field: keyof EmployeeNotification, 
    value: boolean
  ) => {
    try {
      const { error } = await supabase
        .from('employee_notifications')
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(notif => 
          notif.id === id ? { ...notif, [field]: value } : notif
        )
      );

      toast({
        title: "Success",
        description: "Notification setting updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update setting",
        variant: "destructive",
      });
    }
  };

  const deleteEmployee = async (id: string) => {
    try {
      const { error } = await supabase
        .from('employee_notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      fetchNotifications();
      
      toast({
        title: "Success",
        description: "Employee notification settings removed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove employee",
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">
            Only administrators can manage employee notification settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Employee Notification Settings
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage which employees receive notifications for appointment requests, assessment changes, and payment updates.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Add New Employee */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter employee email address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              type="email"
              className="flex-1"
            />
            <Button onClick={addEmployee} disabled={loading || !newEmail.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </div>

          {/* Employees Table */}
          {notifications.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Appointment Requests</TableHead>
                    <TableHead className="text-center">Assessment Changes</TableHead>
                    <TableHead className="text-center">Payment Changes</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell className="font-medium">{notification.email}</TableCell>
                      <TableCell>
                        <Badge variant={notification.is_active ? "default" : "secondary"}>
                          {notification.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={notification.receive_appointment_requests}
                          onCheckedChange={(checked) =>
                            updateNotificationSetting(notification.id, 'receive_appointment_requests', checked)
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={notification.receive_assessment_changes}
                          onCheckedChange={(checked) =>
                            updateNotificationSetting(notification.id, 'receive_assessment_changes', checked)
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={notification.receive_payment_changes}
                          onCheckedChange={(checked) =>
                            updateNotificationSetting(notification.id, 'receive_payment_changes', checked)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteEmployee(notification.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No employee notification settings configured yet.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Add employee email addresses to start sending notifications.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}