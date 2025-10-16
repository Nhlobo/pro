import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2, Plus, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const EVENT_TYPES = [
  { value: "appointment_created", label: "Appointment Created" },
  { value: "appointment_updated", label: "Appointment Updated" },
  { value: "report_submitted", label: "Report Submitted" },
  { value: "payment_received", label: "Payment Received" },
  { value: "user_login", label: "User Login" },
  { value: "custom", label: "Custom Event" },
];

export function WebhookManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: "",
    url: "",
    event_type: "",
    secret: "",
  });

  const queryClient = useQueryClient();

  // Fetch user's webhooks
  const { data: webhooks, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_configs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Create webhook mutation
  const createWebhook = useMutation({
    mutationFn: async (webhook: typeof newWebhook) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("webhook_configs")
        .insert({
          user_id: user.id,
          name: webhook.name,
          url: webhook.url,
          event_type: webhook.event_type,
          secret: webhook.secret || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook created successfully");
      setIsAddDialogOpen(false);
      setNewWebhook({ name: "", url: "", event_type: "", secret: "" });
    },
    onError: (error) => {
      toast.error(`Failed to create webhook: ${error.message}`);
    },
  });

  // Toggle webhook active status
  const toggleWebhook = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("webhook_configs")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook updated");
    },
    onError: (error) => {
      toast.error(`Failed to update webhook: ${error.message}`);
    },
  });

  // Delete webhook mutation
  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webhook_configs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete webhook: ${error.message}`);
    },
  });

  // Test webhook mutation
  const testWebhook = useMutation({
    mutationFn: async (webhook: any) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await supabase.functions.invoke("webhook-trigger", {
        body: {
          event_type: webhook.event_type,
          payload: {
            test: true,
            message: "This is a test webhook",
            timestamp: new Date().toISOString(),
          },
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      toast.success("Test webhook sent successfully");
    },
    onError: (error) => {
      toast.error(`Failed to send test webhook: ${error.message}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Webhook Management</h2>
          <p className="text-muted-foreground">
            Configure webhooks to send data to external services like Zapier
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Webhook</DialogTitle>
              <DialogDescription>
                Configure a webhook to send event data to an external URL
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">Webhook Name</Label>
                <Input
                  id="name"
                  placeholder="My Zapier Webhook"
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="url">Webhook URL</Label>
                <Input
                  id="url"
                  placeholder="https://hooks.zapier.com/..."
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="event_type">Event Type</Label>
                <Select
                  value={newWebhook.event_type}
                  onValueChange={(value) =>
                    setNewWebhook({ ...newWebhook, event_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="secret">Secret (Optional)</Label>
                <Input
                  id="secret"
                  type="password"
                  placeholder="Optional webhook secret"
                  value={newWebhook.secret}
                  onChange={(e) => setNewWebhook({ ...newWebhook, secret: e.target.value })}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Will be sent as X-Webhook-Secret header
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => createWebhook.mutate(newWebhook)}
                disabled={!newWebhook.name || !newWebhook.url || !newWebhook.event_type}
              >
                Create Webhook
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div>Loading webhooks...</div>
      ) : webhooks && webhooks.length > 0 ? (
        <div className="grid gap-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{webhook.name}</CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-2">
                      <ExternalLink className="w-3 h-3" />
                      {webhook.url}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={webhook.is_active}
                      onCheckedChange={(checked) =>
                        toggleWebhook.mutate({ id: webhook.id, is_active: checked })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteWebhook.mutate(webhook.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">Event:</span>{" "}
                      {EVENT_TYPES.find((t) => t.value === webhook.event_type)?.label ||
                        webhook.event_type}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Created: {new Date(webhook.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testWebhook.mutate(webhook)}
                  >
                    Test Webhook
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No webhooks configured yet</p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Webhook
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}