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
import { Checkbox } from "@/components/ui/checkbox";
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
  Zap,
  RefreshCw,
  CheckCheck,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

export const EmailQueueManager = () => {
  const [activeTab, setActiveTab] = useState("pending");
  const {
    emails,
    isLoading,
    approveEmail,
    rejectEmail,
    bulkApprove,
    autoApproveAll,
    isApproving,
    isRejecting,
    isBulkApproving,
    isAutoApproving,
    refetch,
  } = useEmailQueue(activeTab);

  const [previewEmail, setPreviewEmail] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; icon: any; label: string }> = {
      pending: { className: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock, label: "Pending" },
      approved: { className: "bg-blue-100 text-blue-800 border-blue-200", icon: CheckCircle, label: "Approved" },
      sent: { className: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: Send, label: "Sent" },
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!emails) return;
    if (selectedIds.size === emails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map((e) => e.id)));
    }
  };

  const handleBulkApprove = () => {
    if (selectedIds.size === 0) return;
    bulkApprove(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const pendingCount = emails?.filter((e) => e.status === "pending").length || 0;

  const stats = {
    total: emails?.length || 0,
    pending: emails?.filter((e) => e.status === "pending").length || 0,
    sent: emails?.filter((e) => e.status === "sent").length || 0,
    rejected: emails?.filter((e) => e.status === "rejected").length || 0,
  };

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-600">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-700">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-emerald-600">Sent</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-emerald-700">{stats.sent}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-600">Rejected</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-700">{stats.rejected}</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>

        {activeTab === "pending" && (
          <>
            <Button
              size="sm"
              onClick={() => autoApproveAll()}
              disabled={isAutoApproving || pendingCount === 0}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Zap className="h-4 w-4 mr-1" />
              {isAutoApproving ? "Processing..." : `Auto-Approve All (${pendingCount})`}
            </Button>

            {selectedIds.size > 0 && (
              <Button
                size="sm"
                onClick={handleBulkApprove}
                disabled={isBulkApproving}
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                {isBulkApproving ? "Sending..." : `Approve Selected (${selectedIds.size})`}
              </Button>
            )}
          </>
        )}
      </div>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedIds(new Set()); }}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="h-3.5 w-3.5" /> Pending
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-1">
            <Send className="h-3.5 w-3.5" /> Sent
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1">
            <XCircle className="h-3.5 w-3.5" /> Rejected
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1">
            <Mail className="h-3.5 w-3.5" /> All
          </TabsTrigger>
        </TabsList>

        {["pending", "sent", "rejected", "all"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            {isLoading ? (
              <Card>
                <CardContent className="py-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                </CardContent>
              </Card>
            ) : !emails || emails.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p className="text-lg font-medium">No {tab === "all" ? "" : tab + " "}emails</p>
                  <p className="text-sm">
                    {tab === "pending"
                      ? "All caught up! No emails waiting for review."
                      : `No emails with status "${tab}" found.`}
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
                          {activeTab === "pending" && (
                            <TableHead className="w-[40px]">
                              <Checkbox
                                checked={selectedIds.size === emails.length && emails.length > 0}
                                onCheckedChange={toggleSelectAll}
                              />
                            </TableHead>
                          )}
                          <TableHead>Type</TableHead>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {emails.map((email) => (
                          <TableRow key={email.id} className="group">
                            {activeTab === "pending" && (
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.has(email.id)}
                                  onCheckedChange={() => toggleSelect(email.id)}
                                />
                              </TableCell>
                            )}
                            <TableCell>
                              <Badge variant="outline" className="text-xs whitespace-nowrap">
                                {getEmailTypeLabel(email.email_type)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[200px]">
                                <p className="text-sm font-medium truncate">
                                  {email.recipient_name || "—"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {email.recipient_email}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm truncate max-w-[250px]">{email.subject}</p>
                            </TableCell>
                            <TableCell>{getStatusBadge(email.status)}</TableCell>
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
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setPreviewEmail(email)}
                                >
                                  Preview
                                </Button>
                                {email.status === "pending" && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() => approveEmail(email.id)}
                                      disabled={isApproving}
                                      className="bg-emerald-600 hover:bg-emerald-700"
                                    >
                                      <CheckCircle className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => rejectEmail(email.id)}
                                      disabled={isRejecting}
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
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
                  <span className="font-medium text-muted-foreground">Created:</span>{" "}
                  {format(new Date(previewEmail.created_at), "PPpp")}
                </div>
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
                  {previewEmail.metadata && (
                    <TabsTrigger value="metadata">Metadata</TabsTrigger>
                  )}
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

              {previewEmail.status === "pending" && (
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      rejectEmail(previewEmail.id);
                      setPreviewEmail(null);
                    }}
                    disabled={isRejecting}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      approveEmail(previewEmail.id);
                      setPreviewEmail(null);
                    }}
                    disabled={isApproving}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve & Send
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
