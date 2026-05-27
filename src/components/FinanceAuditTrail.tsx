import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { History, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

type AuditRow = {
  id: string;
  table_name: string;
  record_id: string;
  action_type: string;
  old_values: any;
  new_values: any;
  changed_fields: any;
  user_email: string | null;
  description: string | null;
  created_at: string;
};

const FINANCE_TABLES = ["aod_documents", "aod_payments", "short_term_agreements"];

const tableLabel = (t: string) =>
  ({
    aod_documents: "AOD Document",
    aod_payments: "AOD Payment",
    short_term_agreements: "Short-term Agreement",
  } as Record<string, string>)[t] || t;

const actionColor = (a: string) =>
  a === "CREATE"
    ? "bg-green-100 text-green-700 border-green-200"
    : a === "UPDATE"
    ? "bg-blue-100 text-blue-700 border-blue-200"
    : "bg-red-100 text-red-700 border-red-200";

const formatVal = (v: any) => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

export const FinanceAuditTrail = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .in("table_name", FINANCE_TABLES)
      .order("created_at", { ascending: false })
      .limit(300);
    if (!error) setRows((data as AuditRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tableFilter !== "all" && r.table_name !== tableFilter) return false;
      if (actionFilter !== "all" && r.action_type !== actionFilter) return false;
      if (!q) return true;
      const haystack = `${r.user_email || ""} ${r.record_id} ${JSON.stringify(r.new_values || {})} ${JSON.stringify(r.old_values || {})}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, tableFilter, actionFilter]);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5" /> Finance Audit Trail
            <Badge variant="outline" className="ml-2">{filtered.length}</Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="gap-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Search by user, record id, value..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="sm:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tables</SelectItem>
              {FINANCE_TABLES.map((t) => (
                <SelectItem key={t} value={t}>{tableLabel(t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="CREATE">Create</SelectItem>
              <SelectItem value="UPDATE">Update</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[500px] overflow-y-auto space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {loading ? "Loading audit trail..." : "No audit entries found."}
            </p>
          ) : (
            filtered.map((r) => {
              const isOpen = !!expanded[r.id];
              const changed: string[] = Array.isArray(r.changed_fields) ? r.changed_fields : [];
              return (
                <Collapsible key={r.id} open={isOpen} onOpenChange={(v) => setExpanded((s) => ({ ...s, [r.id]: v }))}>
                  <div className="border rounded-md bg-card">
                    <CollapsibleTrigger className="w-full text-left p-3 hover:bg-muted/40 rounded-md">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <Badge variant="outline" className={actionColor(r.action_type)}>{r.action_type}</Badge>
                        <Badge variant="secondary">{tableLabel(r.table_name)}</Badge>
                        <span className="font-medium truncate max-w-[260px]">{r.user_email || "system"}</span>
                        {changed.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            changed: {changed.slice(0, 4).join(", ")}{changed.length > 4 ? "..." : ""}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss")}
                        </span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-3">
                      <div className="text-xs text-muted-foreground mb-2">Record ID: {r.record_id}</div>
                      {r.action_type === "UPDATE" && changed.length > 0 ? (
                        <div className="border rounded overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/40">
                              <tr>
                                <th className="text-left p-2">Field</th>
                                <th className="text-left p-2">Before</th>
                                <th className="text-left p-2">After</th>
                              </tr>
                            </thead>
                            <tbody>
                              {changed.map((f) => (
                                <tr key={f} className="border-t">
                                  <td className="p-2 font-medium">{f}</td>
                                  <td className="p-2 text-red-600">{formatVal(r.old_values?.[f])}</td>
                                  <td className="p-2 text-green-700">{formatVal(r.new_values?.[f])}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <pre className="text-xs bg-muted/30 p-2 rounded overflow-x-auto">
{JSON.stringify(r.new_values || r.old_values, null, 2)}
                        </pre>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FinanceAuditTrail;
