import { useState } from "react";
import { useEmailQueue } from "@/hooks/useEmailQueue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, CheckCircle, XCircle, Clock, Send } from "lucide-react";
import { format } from "date-fns";

export const EmailQueueManager = () => {
  const { emails, isLoading, approveEmail, rejectEmail, isApproving, isRejecting } = useEmailQueue("pending");
  const [previewEmail, setPreviewEmail] = useState<any>(null);

  const getEmailTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      appointment_confirmation: "Appointment Confirmation",
      assessment_change: "Assessment Change",
      payment_change: "Payment Change",
      appointment_update: "Appointment Update",
      appointment_request: "Appointment Request",
      short_term_agreement: "Short-Term Agreement",
      aod_email: "AOD Document",
      report_email: "Report Email",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "secondary", icon: Clock, label: "Pending Review" },
      approved: { variant: "default", icon: CheckCircle, label: "Approved" },
      sent: { variant: "default", icon: Send, label: "Sent" },
      rejected: { variant: "destructive", icon: XCircle, label: "Rejected" },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Queue Management
          </CardTitle>
          <CardDescription>
            Review and approve automated emails before they are sent to recipients
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!emails || emails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending emails to review</p>
            </div>
          ) : (
            <div className="space-y-4">
              {emails.map((email) => (
                <Card key={email.id} className="border-l-4 border-l-primary">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{email.subject}</h4>
                          {getStatusBadge(email.status)}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            <span className="font-medium">Type:</span>{" "}
                            {getEmailTypeLabel(email.email_type)}
                          </p>
                          <p>
                            <span className="font-medium">To:</span>{" "}
                            {email.recipient_name ? `${email.recipient_name} <${email.recipient_email}>` : email.recipient_email}
                          </p>
                          <p>
                            <span className="font-medium">Created:</span>{" "}
                            {format(new Date(email.created_at), "PPpp")}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPreviewEmail(email)}
                        >
                          Preview
                        </Button>
                        {email.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => approveEmail(email.id)}
                              disabled={isApproving}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve & Send
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectEmail(email.id)}
                              disabled={isRejecting}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!previewEmail} onOpenChange={() => setPreviewEmail(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          {previewEmail && (
            <Tabs defaultValue="preview" className="w-full">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="html">HTML Source</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
              </TabsList>
              <TabsContent value="preview">
                <ScrollArea className="h-[60vh] border rounded-md p-4">
                  <div dangerouslySetInnerHTML={{ __html: previewEmail.html_content }} />
                </ScrollArea>
              </TabsContent>
              <TabsContent value="html">
                <ScrollArea className="h-[60vh] border rounded-md p-4">
                  <pre className="text-xs">{previewEmail.html_content}</pre>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="metadata">
                <ScrollArea className="h-[60vh] border rounded-md p-4">
                  <pre className="text-xs">{JSON.stringify(previewEmail.metadata, null, 2)}</pre>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
