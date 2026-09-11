import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminCard, AdminEmptyState, AdminLoadingState } from "@/components/admin/ui/AdminUI";
import { PaymentPopUploader } from "@/components/finance/PaymentPopUploader";
import { AlertCircle } from "lucide-react";

interface PendingPopAppointment {
  id: string;
  assessment_code: string | null;
  deposit_amount: number | null;
  service_fee: number | null;
  payment_status: string | null;
  pop_pending_reason: string | null;
  appointment_date: string;
  claimants: { first_name: string | null; last_name: string | null } | null;
  referring_attorneys: { name: string | null } | null;
}

/**
 * Finance-side view of appointments where a deposit/payment was captured at
 * booking but the Proof of Payment hasn't been attached yet. This is the
 * "Appears on Finance & Payment" hop in the client's requested flow:
 *   New Appointment > POP Uploaded > Finance & Payment > Referring Attorney.
 * Staff can attach the POP directly from here -- appointments.pop_status
 * flips to 'uploaded' automatically (trg_sync_appointment_pop_status) and
 * the row drops off this list on next refresh.
 */
export default function PendingPopUploadsPanel() {
  const [rows, setRows] = useState<PendingPopAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, assessment_code, deposit_amount, service_fee, payment_status, pop_pending_reason, appointment_date, claimants(first_name, last_name), referring_attorneys(name)"
        )
        .eq("pop_status", "pending_upload")
        .is("deleted_at", null)
        .order("appointment_date", { ascending: false })
        .limit(200);

      if (error) throw error;
      setRows((data || []) as unknown as PendingPopAppointment[]);
    } catch (error) {
      console.error("Error fetching pending POP appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();

    const channel = supabase
      .channel("pending-pop-appointments")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "appointments" },
        () => fetchRows()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payment_pop_attachments" },
        () => fetchRows()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <AdminLoadingState />;

  if (rows.length === 0) {
    return (
      <AdminEmptyState
        icon={AlertCircle}
        title="Nothing pending"
        description="Every appointment with a captured payment has its proof of payment attached."
      />
    );
  }

  return (
    <AdminCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Assessment Code</TableHead>
            <TableHead>Claimant</TableHead>
            <TableHead>Referring Attorney</TableHead>
            <TableHead>Deposit</TableHead>
            <TableHead>Reason Pending</TableHead>
            <TableHead>Proof of Payment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs">{row.assessment_code || "\u2014"}</TableCell>
              <TableCell>
                {row.claimants ? `${row.claimants.first_name || ""} ${row.claimants.last_name || ""}`.trim() : "\u2014"}
              </TableCell>
              <TableCell>{row.referring_attorneys?.name || "\u2014"}</TableCell>
              <TableCell>R {Number(row.deposit_amount || 0).toFixed(2)}</TableCell>
              <TableCell className="max-w-[220px]">
                <Badge variant="outline" className="rounded-none border-amber-300 bg-amber-50 text-amber-800 mb-1">
                  Pending POP Upload
                </Badge>
                <p className="text-xs text-muted-foreground italic">{row.pop_pending_reason}</p>
              </TableCell>
              <TableCell className="min-w-[220px]">
                <PaymentPopUploader
                  recordType="appointment_payment"
                  recordId={row.id}
                  paymentReference={row.assessment_code || row.id}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminCard>
  );
}
