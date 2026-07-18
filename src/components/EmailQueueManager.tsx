import { useMemo, useState } from "react";
import { useEmailQueue, EmailQueueItem } from "@/hooks/useEmailQueue";
import { Button } from "@/components/ui/button";
// Every panel on this page is a docked side panel, not a centered modal —
// Sheet is the same Radix dialog primitive under the hood (behaviour, focus
// trapping and state wiring are unchanged), only the presentation differs.
// Aliased to the old Dialog* names so downstream JSX reads the same as any
// other Dialog usage in the codebase.
import {
  Sheet as Dialog,
  SheetContent as DialogContent,
  SheetDescription as DialogDescription,
  SheetHeader as DialogHeader,
  SheetTitle as DialogTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Search,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import {
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminStatCard,
  AdminPill,
  AdminEmptyState,
  AdminLoadingState,
  AdminTabList,
  AdminTabTrigger,
  BRAND_TEAL,
} from "@/components/admin/ui/AdminUI";

type PillTone = "neutral" | "teal" | "success" | "warning" | "destructive";

const EMAIL_TYPE_LABEL: Record<string, string> = {
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

const getEmailTypeLabel = (type: string) =>
  EMAIL_TYPE_LABEL[type] || type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

const STATUS_CONFIG: Record<string, { tone: PillTone; icon: any; label: string }> = {
  pending: { tone: "warning", icon: Clock, label: "Processing" },
  sending: { tone: "teal", icon: Send, label: "Sending" },
  sent: { tone: "success", icon: CheckCircle, label: "Delivered" },
  failed: { tone: "destructive", icon: XCircle, label: "Failed" },
  rejected: { tone: "destructive", icon: XCircle, label: "Rejected" },
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;
  return (
    <AdminPill tone={config.tone}>
      <Icon className="h-3 w-3" />
      {config.label}
    </AdminPill>
  );
};

const AttendancePill: React.FC<{ email: EmailQueueItem }> = ({ email }) => {
  if (email.is_responded) {
    return (
      <AdminPill tone="success">
        <MailCheck className="h-3 w-3" /> Responded
      </AdminPill>
    );
  }
  if (email.forwarded_to) {
    return (
      <AdminPill tone="teal">
        <ArrowUpRight className="h-3 w-3" /> Forwarded
      </AdminPill>
    );
  }
  if (email.is_read) {
    return (
      <AdminPill tone="neutral">
        <Eye className="h-3 w-3" /> Read
      </AdminPill>
    );
  }
  return (
    <AdminPill tone="warning">
      <EyeOff className="h-3 w-3" /> Unattended
    </AdminPill>
  );
};

/** Flat, rounded-none active/inactive treatment shared with every other admin screen's tabs. */
const flatTab =
  "rounded-none border border-transparent px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-black data-[state=active]:border-black/15 data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-none";

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

  const [searchTerm, setSearchTerm] = useState("");
  const [previewEmail, setPreviewEmail] = useState<EmailQueueItem | null>(null);
  const [forwardDialog, setForwardDialog] = useState<EmailQueueItem | null>(null);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardNotes, setForwardNotes] = useState("");

  const visibleEmails = useMemo(() => {
    if (!emails) return emails;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return emails;
    return emails.filter((e) =>
      (e.recipient_name || "").toLowerCase().includes(term) ||
      (e.recipient_email || "").toLowerCase().includes(term) ||
      (e.subject || "").toLowerCase().includes(term)
    );
  }, [emails, searchTerm]);

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
      {/* Queue at a glance — always the true totals across the whole queue, not just the active tab. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <AdminStatCard label="Total" value={stats.total} icon={Mail} loading={isLoading} />
        <AdminStatCard label="Unattended" value={stats.unattended} icon={EyeOff} loading={isLoading} />
        <AdminStatCard label="Read" value={stats.read} icon={Eye} loading={isLoading} />
        <AdminStatCard label="Responded" value={stats.responded} icon={MailCheck} loading={isLoading} />
        <AdminStatCard label="Forwarded" value={stats.forwarded} icon={ArrowUpRight} loading={isLoading} />
      </div>

      {/* Search & Filter */}
      <AdminCard className="mt-3 md:mt-6">
        <AdminCardHeader
          icon={Search}
          title="Search & Filter"
          description="Narrow the queue below."
          actions={
            <>
              <AdminPill tone="neutral">{visibleEmails?.length ?? 0} of {stats.total}</AdminPill>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
                className="rounded-none border-black/15 text-black hover:bg-black/5"
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </>
          }
        />
        <AdminCardBody className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by recipient or subject…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-none pl-8"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <AdminTabList>
              <AdminTabTrigger value="all" label="All" icon={Inbox} />
              <AdminTabTrigger value="unattended" label="Unattended" icon={EyeOff} badge={stats.unattended} />
              <AdminTabTrigger value="read" label="Read" icon={Eye} />
              <AdminTabTrigger value="forwarded" label="Forwarded" icon={ArrowUpRight} />
              <AdminTabTrigger value="sent" label="Delivered" icon={Send} />
            </AdminTabList>
          </Tabs>
        </AdminCardBody>
      </AdminCard>

      {/* Queue */}
      <AdminCard className="mt-3 md:mt-6">
        <AdminCardHeader
          icon={Mail}
          title="Emails"
          description={searchTerm ? "Filtered results from this tab." : "Every email logged in this tab."}
        />

        {isLoading ? (
          <AdminLoadingState label="Loading email history…" />
        ) : !visibleEmails || visibleEmails.length === 0 ? (
          <AdminEmptyState
            icon={Mail}
            title="No emails found"
            description={
              searchTerm
                ? "No emails match your search."
                : activeTab === "unattended"
                  ? "All emails have been attended to!"
                  : "No emails in this category."
            }
          />
        ) : (
          <>
            {/* Desktop / tablet-landscape table */}
            <div className="hidden overflow-x-auto lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-black/10 hover:bg-transparent">
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
                  {visibleEmails.map((email) => (
                    <TableRow
                      key={email.id}
                      className={`border-black/10 ${!email.is_read ? "bg-black/[0.02]" : ""}`}
                    >
                      <TableCell>
                        <AdminPill tone="neutral" className="whitespace-nowrap normal-case tracking-normal">
                          {getEmailTypeLabel(email.email_type)}
                        </AdminPill>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <p className="truncate text-sm font-medium text-black">{email.recipient_name || "—"}</p>
                          <p className="truncate text-xs text-slate-500">{email.recipient_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-[250px] truncate text-sm text-slate-600">{email.subject}</p>
                      </TableCell>
                      <TableCell><StatusPill status={email.status} /></TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <AttendancePill email={email} />
                          {email.forwarded_to && (
                            <p className="max-w-[140px] truncate text-xs text-slate-500">→ {email.forwarded_to}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="whitespace-nowrap text-xs text-slate-500">
                          {format(new Date(email.created_at), "dd MMM yyyy")}
                        </p>
                        <p className="text-xs text-slate-400">{format(new Date(email.created_at), "HH:mm")}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePreviewOpen(email)}
                            className="rounded-none border-black/15 text-black hover:bg-black/5"
                          >
                            Preview
                          </Button>
                          {!email.is_responded && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-none text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
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
                              className="rounded-none hover:bg-black/5"
                              style={{ color: BRAND_TEAL }}
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

            {/* Mobile / tablet-portrait card list — same data, no horizontal scroll. */}
            <div className="divide-y divide-black/10 lg:hidden">
              {visibleEmails.map((email) => (
                <button
                  key={email.id}
                  type="button"
                  onClick={() => handlePreviewOpen(email)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.03] ${!email.is_read ? "bg-black/[0.02]" : ""}`}
                >
                  <div
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: BRAND_TEAL }}
                  >
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-black">{email.recipient_name || email.recipient_email}</p>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {format(new Date(email.created_at), "dd MMM")}
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-500">{email.subject}</p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <StatusPill status={email.status} />
                      <AttendancePill email={email} />
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                </button>
              ))}
            </div>
          </>
        )}
      </AdminCard>

      {/* Email Preview panel */}
      <Dialog open={!!previewEmail} onOpenChange={() => setPreviewEmail(null)}>
        <DialogContent side="right" className="brand-legal-theme flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-2xl">
          <DialogHeader className="space-y-0 border-b border-black/10 px-5 py-4">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-bold text-black">
              <Mail className="h-4 w-4" style={{ color: BRAND_TEAL }} />
              Email Preview
              {previewEmail && <StatusPill status={previewEmail.status} />}
              {previewEmail && <AttendancePill email={previewEmail} />}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {previewEmail?.subject}
            </DialogDescription>
          </DialogHeader>

          {previewEmail && (
            <div className="space-y-4 px-5 py-5">
              <div className="grid grid-cols-1 gap-3 border border-black/10 bg-black/[0.02] p-4 text-sm sm:grid-cols-2">
                <div>
                  <span className="font-medium text-slate-500">To:</span>{" "}
                  <span className="text-black">
                    {previewEmail.recipient_name
                      ? `${previewEmail.recipient_name} <${previewEmail.recipient_email}>`
                      : previewEmail.recipient_email}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-slate-500">Type:</span>{" "}
                  <span className="text-black">{getEmailTypeLabel(previewEmail.email_type)}</span>
                </div>
                <div>
                  <span className="font-medium text-slate-500">Subject:</span>{" "}
                  <span className="text-black">{previewEmail.subject}</span>
                </div>
                <div>
                  <span className="font-medium text-slate-500">Sent:</span>{" "}
                  <span className="text-black">
                    {previewEmail.sent_at
                      ? format(new Date(previewEmail.sent_at), "PPpp")
                      : format(new Date(previewEmail.created_at), "PPpp")}
                  </span>
                </div>
                {previewEmail.forwarded_to && (
                  <div className="sm:col-span-2">
                    <span className="font-medium text-slate-500">Forwarded to:</span>{" "}
                    <span className="text-black">{previewEmail.forwarded_to}</span>
                    {previewEmail.forward_notes && (
                      <span className="text-slate-500"> — {previewEmail.forward_notes}</span>
                    )}
                  </div>
                )}
                {previewEmail.metadata?.cc_addresses?.length > 0 && (
                  <div className="sm:col-span-2">
                    <span className="font-medium text-slate-500">CC:</span>{" "}
                    <span className="text-black">{previewEmail.metadata.cc_addresses.join(", ")}</span>
                  </div>
                )}
                {previewEmail.error_message && (
                  <div className="flex items-start gap-2 text-destructive sm:col-span-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{previewEmail.error_message}</span>
                  </div>
                )}
              </div>

              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="h-auto w-max gap-1 rounded-none border border-black/15 bg-transparent p-1">
                  <TabsTrigger value="preview" className={flatTab}>Preview</TabsTrigger>
                  <TabsTrigger value="html" className={flatTab}>HTML Source</TabsTrigger>
                  {previewEmail.metadata && <TabsTrigger value="metadata" className={flatTab}>Metadata</TabsTrigger>}
                </TabsList>
                <TabsContent value="preview" className="mt-3">
                  <ScrollArea className="h-[45vh] border border-black/10">
                    {/* Sandboxed iframe prevents stored-XSS from arbitrary html_content */}
                    <iframe
                      title="Email preview"
                      sandbox=""
                      srcDoc={previewEmail.html_content || ""}
                      className="h-[45vh] w-full border-0 bg-white"
                    />
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="html" className="mt-3">
                  <ScrollArea className="h-[45vh] border border-black/10 p-4">
                    <pre className="whitespace-pre-wrap text-xs">{previewEmail.html_content}</pre>
                  </ScrollArea>
                </TabsContent>
                {previewEmail.metadata && (
                  <TabsContent value="metadata" className="mt-3">
                    <ScrollArea className="h-[45vh] border border-black/10 p-4">
                      <pre className="text-xs">{JSON.stringify(previewEmail.metadata, null, 2)}</pre>
                    </ScrollArea>
                  </TabsContent>
                )}
              </Tabs>
            </div>
          )}

          {previewEmail && (
            <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-black/10 px-5 py-4">
              {!previewEmail.is_responded && (
                <Button
                  variant="outline"
                  className="rounded-none border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                  onClick={() => {
                    markAsResponded(previewEmail.id);
                    setPreviewEmail(null);
                  }}
                >
                  <MessageSquareReply className="mr-1.5 h-4 w-4" />
                  Mark Responded
                </Button>
              )}
              {!previewEmail.forwarded_to && (
                <Button
                  variant="outline"
                  className="rounded-none border-black/15 hover:bg-black/5"
                  style={{ color: BRAND_TEAL }}
                  onClick={() => {
                    setForwardDialog(previewEmail);
                    setPreviewEmail(null);
                  }}
                >
                  <Forward className="mr-1.5 h-4 w-4" />
                  Forward
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Forward panel */}
      <Dialog
        open={!!forwardDialog}
        onOpenChange={() => { setForwardDialog(null); setForwardTo(""); setForwardNotes(""); }}
      >
        <DialogContent side="right" className="brand-legal-theme flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-md">
          <DialogHeader className="space-y-0 border-b border-black/10 px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-black">
              <Forward className="h-4 w-4" style={{ color: BRAND_TEAL }} />
              Forward Email
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Route this email to a department, team, or employee for follow-up.
            </DialogDescription>
          </DialogHeader>

          {forwardDialog && (
            <div className="space-y-4 px-5 py-5">
              <div className="border border-black/10 bg-black/[0.02] p-3 text-sm">
                <p className="font-medium text-black">{forwardDialog.subject}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Originally to: {forwardDialog.recipient_name || forwardDialog.recipient_email}
                </p>
              </div>
              <div>
                <Label htmlFor="forward-to">Forward to (Department / Team / Employee)</Label>
                <Input
                  id="forward-to"
                  placeholder="e.g. Legal Team, Finance, John Smith"
                  value={forwardTo}
                  onChange={(e) => setForwardTo(e.target.value)}
                  className="mt-1 rounded-none"
                />
              </div>
              <div>
                <Label htmlFor="forward-notes">Notes (optional)</Label>
                <Textarea
                  id="forward-notes"
                  placeholder="Add context or instructions for the team..."
                  value={forwardNotes}
                  onChange={(e) => setForwardNotes(e.target.value)}
                  rows={3}
                  className="mt-1 rounded-none"
                />
              </div>

              <div className="flex gap-2 border-t border-black/10 pt-4">
                <Button
                  variant="outline"
                  onClick={() => { setForwardDialog(null); setForwardTo(""); setForwardNotes(""); }}
                  className="flex-1 rounded-none border-black/15 text-black hover:bg-black/5"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleForwardSubmit}
                  disabled={!forwardTo.trim() || isForwarding}
                  className="flex-1 rounded-none text-white hover:opacity-90"
                  style={{ backgroundColor: BRAND_TEAL }}
                >
                  <Forward className="mr-1.5 h-4 w-4" />
                  {isForwarding ? "Forwarding..." : "Forward"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
