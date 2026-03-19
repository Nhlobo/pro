import { useState } from "react";
import { useEmailQueue, EmailQueueItem } from "@/hooks/useEmailQueue";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  RefreshCw,
  Eye,
  EyeOff,
  Forward,
  MessageSquareReply,
  AlertCircle,
  Inbox,
  MailCheck,
  ArrowUpRight,
} from "lucide-react";
import { format } from "date-fns";

export const EmailQueueManager = () => {
  const [activeTab, setActiveTab] = useState("all");
  const {
    emails,
    isLoading,
    stats,
    markAsRead,
    markAsResponded,
    forwardEmail,
    isForwarding,
    refetch,
  } = useEmailQueue(activeTab);

  const [previewEmail, setPreviewEmail] = useState<EmailQueueItem | null>(null);
  const [forwardDialog, setForwardDialog] = useState<EmailQueueItem | null>(null);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardNotes, setForwardNotes] = useState("");

  const getEmailTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      appointment_confirmation: "Appointment Confirmation",
      assessment_change: "Assessment Change",
      payment_change: "Payment Change",
      appointment_update: "Appointment Update",
      appointment_request: "Appointment Request",
      appointment_request_email: "Case Access – Email Request",
      appointment_request_email_cc: "Case Access – CC Copy",
      short_term_agreement: "Short-Term Agreement",
      aod_email: "AOD Document",
      report_email: "Report Email",
      communication_report: "Communication – Report",
      communication_document_request: "Communication – Document Request",
      communication_instruction: "Communication – Instruction",
    };
    return labels[type] || type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getAttendanceBadge = (email: EmailQueueItem) => {
    if (email.is_responded) {
      return (
        <Badge variant="outline" className="gap-1 bg-emerald-100 text-emerald-800 border-emerald-200">
          <MailCheck className="h-3 w-3" /> Responded
        </Badge>
      );
    }
    if (email.forwarded_to) {
      return (
        <Badge variant="outline" className="gap-1 bg-violet-100 text-violet-800 border-violet-200">
          <ArrowUpRight className="h-3 w-3" /> Forwarded
        </Badge>
      );
    }
    if (email.is_read) {
      return (
        <Badge variant="outline" className="gap-1 bg-blue-100 text-blue-800 border-blue-200">
          <Eye className="h-3 w-3" /> Read
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 bg-amber-100 text-amber-800 border-amber-200">
        <EyeOff className="h-3 w-3" /> Unattended
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
     const variants: Record<string, { className: string; icon: any; label: string }> = {
      pending: { className: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock, label: "Processing..." },
      sending: { className: "bg-blue-100 text-blue-800 border-blue-200", icon: Send, label: "Sending..." },
      sent: { className: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle, label: "Delivered" },
      failed: { className: "bg-red-100 text-red-800 border-red-200", icon: XCircle, label: "Failed" },
      rejected: { className: "bg-red-100 text-red-800 border-red-200", icon: XCircle, label: "Rejected" },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const handleForwardSubmit = () => {
    if (!forwardDialog || !forwardTo.trim()) return;
    forwardEmail({
      emailId: forwardDialog.id,
      forwardTo: forwardTo.trim(),
      notes: forwardNotes.trim() || undefined,
    });
    setForwardDialog(null);
    setForwardTo("");
    setForwardNotes("");
  };

  const handlePreviewOpen = (email: EmailQueueItem) => {
    setPreviewEmail(email);
    if (!email.is_read) {
      markAsRead(email.id);
    }
  };

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-600">Unattended</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-700">{stats.unattended}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-600">Read</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-blue-700">{stats.read}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <MailCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-emerald-600">Responded</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-emerald-700">{stats.responded}</p>
          </CardContent>
        </Card>
        <Card className="border-violet-200 bg-violet-50/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-violet-600" />
              <span className="text-sm text-violet-600">Forwarded</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-violet-700">{stats.forwarded}</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all" className="gap-1">
            <Inbox className="h-3.5 w-3.5" /> All
          </TabsTrigger>
          <TabsTrigger value="unattended" className="gap-1">
            <EyeOff className="h-3.5 w-3.5" /> Unattended
            {stats.unattended > 0 && (
              <Badge className="ml-1 h-5 px-1.5 bg-amber-500 text-white text-xs">{stats.unattended}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="read" className="gap-1">
            <Eye className="h-3.5 w-3.5" /> Read
          </TabsTrigger>
          <TabsTrigger value="forwarded" className="gap-1">
            <ArrowUpRight className="h-3.5 w-3.5" /> Forwarded
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-1">
            <Send className="h-3.5 w-3.5" /> Delivered
          </TabsTrigger>
        </TabsList>

        {["all", "unattended", "read", "forwarded", "sent"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            {isLoading ? (
              <Card>
                <CardContent className="py-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                </CardContent>
              </Card>
            ) : !emails || emails.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p className="text-lg font-medium">No emails found</p>
                  <p className="text-sm">
                    {tab === "unattended"
                      ? "All emails have been attended to!"
                      : `No emails in this category.`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Delivery</TableHead>
                          <TableHead>Attendance</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {emails.map((email) => (
                          <TableRow
                            key={email.id}
                            className={`group ${!email.is_read ? "bg-amber-50/30 dark:bg-amber-950/10 font-medium" : ""}`}
                          >
                            <TableCell>
                              <Badge variant="outline" className="text-xs whitespace-nowrap">
                                {getEmailTypeLabel(email.email_type)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[200px]">
                                <p className="text-sm font-medium truncate">{email.recipient_name || "—"}</p>
                                <p className="text-xs text-muted-foreground truncate">{email.recipient_email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm truncate max-w-[250px]">{email.subject}</p>
                            </TableCell>
                            <TableCell>{getStatusBadge(email.status)}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {getAttendanceBadge(email)}
                                {email.forwarded_to && (
                                  <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                                    → {email.forwarded_to}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-xs text-muted-foreground whitespace-nowrap">
                                {format(new Date(email.created_at), "dd MMM yyyy")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(email.created_at), "HH:mm")}
                              </p>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handlePreviewOpen(email)}>
                                  Preview
                                </Button>
                                {!email.is_responded && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-emerald-600 hover:text-emerald-700"
                                    onClick={() => markAsResponded(email.id)}
                                    title="Mark as responded"
                                  >
                                    <MessageSquareReply className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {!email.forwarded_to && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-violet-600 hover:text-violet-700"
                                    onClick={() => setForwardDialog(email)}
                                    title="Forward to team"
                                  >
                                    <Forward className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Email Preview Dialog */}
      <Dialog open={!!previewEmail} onOpenChange={() => setPreviewEmail(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Email Preview
              {previewEmail && getStatusBadge(previewEmail.status)}
              {previewEmail && getAttendanceBadge(previewEmail)}
            </DialogTitle>
          </DialogHeader>
          {previewEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm border rounded-lg p-4 bg-muted/30">
                <div>
                  <span className="font-medium text-muted-foreground">To:</span>{" "}
                  {previewEmail.recipient_name
                    ? `${previewEmail.recipient_name} <${previewEmail.recipient_email}>`
                    : previewEmail.recipient_email}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Type:</span>{" "}
                  {getEmailTypeLabel(previewEmail.email_type)}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Subject:</span>{" "}
                  {previewEmail.subject}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Sent:</span>{" "}
                  {previewEmail.sent_at
                    ? format(new Date(previewEmail.sent_at), "PPpp")
                    : format(new Date(previewEmail.created_at), "PPpp")}
                </div>
                {previewEmail.forwarded_to && (
                  <div className="col-span-2">
                    <span className="font-medium text-muted-foreground">Forwarded to:</span>{" "}
                    {previewEmail.forwarded_to}
                    {previewEmail.forward_notes && (
                      <span className="text-muted-foreground"> — {previewEmail.forward_notes}</span>
                    )}
                  </div>
                )}
                {previewEmail.metadata?.cc_addresses?.length > 0 && (
                  <div className="col-span-2">
                    <span className="font-medium text-muted-foreground">CC:</span>{" "}
                    {previewEmail.metadata.cc_addresses.join(", ")}
                  </div>
                )}
                {previewEmail.error_message && (
                  <div className="col-span-2 flex items-start gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{previewEmail.error_message}</span>
                  </div>
                )}
              </div>

              <Tabs defaultValue="preview" className="w-full">
                <TabsList>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="html">HTML Source</TabsTrigger>
                  {previewEmail.metadata && <TabsTrigger value="metadata">Metadata</TabsTrigger>}
                </TabsList>
                <TabsContent value="preview">
                  <ScrollArea className="h-[50vh] border rounded-md p-4">
                    <div dangerouslySetInnerHTML={{ __html: previewEmail.html_content }} />
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="html">
                  <ScrollArea className="h-[50vh] border rounded-md p-4">
                    <pre className="text-xs whitespace-pre-wrap">{previewEmail.html_content}</pre>
                  </ScrollArea>
                </TabsContent>
                {previewEmail.metadata && (
                  <TabsContent value="metadata">
                    <ScrollArea className="h-[50vh] border rounded-md p-4">
                      <pre className="text-xs">{JSON.stringify(previewEmail.metadata, null, 2)}</pre>
                    </ScrollArea>
                  </TabsContent>
                )}
              </Tabs>

              <div className="flex justify-end gap-2 pt-2 border-t">
                {!previewEmail.is_responded && (
                  <Button
                    variant="outline"
                    className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => {
                      markAsResponded(previewEmail.id);
                      setPreviewEmail(null);
                    }}
                  >
                    <MessageSquareReply className="h-4 w-4 mr-1" />
                    Mark Responded
                  </Button>
                )}
                {!previewEmail.forwarded_to && (
                  <Button
                    variant="outline"
                    className="text-violet-600 border-violet-200 hover:bg-violet-50"
                    onClick={() => {
                      setForwardDialog(previewEmail);
                      setPreviewEmail(null);
                    }}
                  >
                    <Forward className="h-4 w-4 mr-1" />
                    Forward
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Forward Dialog */}
      <Dialog open={!!forwardDialog} onOpenChange={() => { setForwardDialog(null); setForwardTo(""); setForwardNotes(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Forward className="h-5 w-5 text-violet-600" />
              Forward Email
            </DialogTitle>
          </DialogHeader>
          {forwardDialog && (
            <div className="space-y-4">
              <div className="text-sm p-3 rounded-md bg-muted/30 border">
                <p className="font-medium">{forwardDialog.subject}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Originally to: {forwardDialog.recipient_name || forwardDialog.recipient_email}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="forward-to">Forward to (Department / Team / Employee)</Label>
                <Input
                  id="forward-to"
                  placeholder="e.g. Legal Team, Finance, John Smith"
                  value={forwardTo}
                  onChange={(e) => setForwardTo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forward-notes">Notes (optional)</Label>
                <Textarea
                  id="forward-notes"
                  placeholder="Add context or instructions for the team..."
                  value={forwardNotes}
                  onChange={(e) => setForwardNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setForwardDialog(null); setForwardTo(""); setForwardNotes(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleForwardSubmit}
              disabled={!forwardTo.trim() || isForwarding}
              className="bg-violet-600 hover:bg-violet-700"
            >
              <Forward className="h-4 w-4 mr-1" />
              {isForwarding ? "Forwarding..." : "Forward"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
