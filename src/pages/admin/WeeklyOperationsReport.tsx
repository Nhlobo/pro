import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileText, Send, RefreshCw, Mail } from 'lucide-react';
import { format } from 'date-fns';
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminPill,
  AdminEmptyState,
  AdminLoadingState,
} from '@/components/admin/ui/AdminUI';

type WeeklyOpsReport = {
  id: string;
  period_start: string;
  period_end: string;
  payments_count: number;
  payments_total: number;
  assessments_booked_count: number;
  recipients: string[];
  delivery_status: string;
  delivery_error: string | null;
  sent_at: string | null;
  created_at: string;
};

const ZAR = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(Number(n) || 0);

const STATUS_TONE: Record<string, 'neutral' | 'teal' | 'success' | 'warning' | 'destructive'> = {
  sent: 'success',
  sample_sent: 'teal',
  failed: 'destructive',
  skipped: 'warning',
  pending: 'neutral',
};

const WeeklyOperationsReport: React.FC = () => {
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);

  const { data: reports, isLoading } = useQuery({
    queryKey: ['weekly-operations-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_operations_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data || []) as WeeklyOpsReport[];
    },
  });

  const sendTestReport = async () => {
    setSending(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const adminEmail = auth.user?.email;
      if (!adminEmail) throw new Error('No admin email on session');

      const { data, error } = await supabase.functions.invoke('send-weekly-operations-report', {
        body: { sample_to: adminEmail },
      });
      if (error) throw error;

      if (data?.delivery_status === 'sample_sent') {
        toast.success(`Test report sent to ${adminEmail}`);
      } else {
        toast.error(`Test send failed: ${data?.delivery_error || data?.delivery_status || 'unknown error'}`);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to send test report');
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminPage className="brand-legal-theme max-w-6xl">
      <AdminHeader
        eyebrow="System"
        title="Weekly Operations Report"
        icon={Mail}
        description="Automated weekly email summarising expert payments made and assessments booked — sent every Monday and kept here as a record."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="rounded-none"
              onClick={() => qc.invalidateQueries({ queryKey: ['weekly-operations-reports'] })}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              size="sm"
              className="rounded-none gradient-teal text-white"
              onClick={sendTestReport}
              disabled={sending}
            >
              <Send className="mr-2 h-4 w-4" />
              {sending ? 'Sending…' : 'Send Test Report'}
            </Button>
          </>
        }
      />

      <p className="text-xs text-slate-500">
        "Send Test Report" emails a preview of this week's data to your own account only — it does not
        send to the real recipient list and is not saved to the history below.
      </p>

      <AdminCard>
        <AdminCardHeader
          title="Report History"
          description="Every automatic weekly send is logged here for audit trail purposes."
          icon={FileText}
        />
        <AdminCardBody className="p-0">
          {isLoading ? (
            <AdminLoadingState label="Loading report history…" />
          ) : !reports?.length ? (
            <AdminEmptyState
              icon={Mail}
              title="No reports sent yet"
              description="The first automatic weekly report will appear here after it runs on Monday, or send a test above to check the setup now."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-black/10 hover:bg-transparent">
                  <TableHead>Period</TableHead>
                  <TableHead>Payments</TableHead>
                  <TableHead>Total Paid</TableHead>
                  <TableHead>Assessments Booked</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id} className="border-black/10">
                    <TableCell>
                      {format(new Date(r.period_start), 'dd MMM yyyy')} – {format(new Date(r.period_end), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>{r.payments_count}</TableCell>
                    <TableCell>{ZAR(r.payments_total)}</TableCell>
                    <TableCell>{r.assessments_booked_count}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={(r.recipients || []).join(', ')}>
                      {(r.recipients || []).length} recipient{(r.recipients || []).length === 1 ? '' : 's'}
                    </TableCell>
                    <TableCell>
                      <AdminPill tone={STATUS_TONE[r.delivery_status] || 'neutral'}>
                        {r.delivery_status}
                      </AdminPill>
                    </TableCell>
                    <TableCell>
                      {r.sent_at ? format(new Date(r.sent_at), 'dd MMM yyyy HH:mm') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </AdminCardBody>
      </AdminCard>
    </AdminPage>
  );
};

export default WeeklyOperationsReport;
