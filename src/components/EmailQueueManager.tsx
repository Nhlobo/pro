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
            <div className="-mx-1 overflow-x-auto px-1">
              <TabsList className="h-auto w-max gap-1 rounded-none border border-black/15 bg-transparent p-1">
                <TabsTrigger value="all" className={flatTab}>
                  <Inbox className="mr-1.5 h-3.5 w-3.5" /> All
                </TabsTrigger>
                <TabsTrigger value="unattended" className={flatTab}>
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" /> Unattended
                  {stats.unattended > 0 && (
                    <span
                      className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                      style={{ backgroundColor: BRAND_TEAL }}
                    >
                      {stats.unattended}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="read" className={flatTab}>
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> Read
                </TabsTrigger>
                <TabsTrigger value="forwarded" className={flatTab}>
                  <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" /> Forwarded
                </TabsTrigger>
                <TabsTrigger value="sent" className={flatTab}>
                  <Send className="mr-1.5 h-3.5 w-3.5" /> Delivered
                </TabsTrigger>
              </TabsList>
            </div>
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
