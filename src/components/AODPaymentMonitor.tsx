import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bell, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

type PaymentAlert = {
  id: string;
  attorney_name: string;
  file_name: string;
  payment_status: string;
  next_payment_date: string;
  days_until_due: number;
  payment_due_date: string;
};

export const AODPaymentMonitor = () => {
  const [alerts, setAlerts] = useState<PaymentAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentAlerts();
    
    // Set up real-time subscription for payment updates
    const channel = supabase
      .channel('aod-payment-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'aod_documents'
        },
        () => {
          fetchPaymentAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPaymentAlerts = async () => {
    try {
      const { data: documents, error } = await supabase
        .from('aod_documents')
        .select(`
          id,
          file_name,
          payment_status,
          next_payment_date,
          payment_due_date,
          referring_attorney_id,
          referring_attorneys!aod_documents_referring_attorney_id_fkey (
            name
          )
        `)
        .in('payment_status', ['pending', 'upcoming', 'overdue'])
        .order('next_payment_date', { ascending: true });

      if (error) throw error;

      const now = new Date();
      const alertData: PaymentAlert[] = [];

      documents?.forEach((doc: any) => {
        if (doc.next_payment_date) {
          const dueDate = new Date(doc.next_payment_date);
          const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          // Show alerts for payments due within 15 days or overdue
          if (daysDiff <= 15) {
            alertData.push({
              id: doc.id,
              attorney_name: doc.referring_attorneys?.name || 'Unknown Referring Attorney',
              file_name: doc.file_name,
              payment_status: doc.payment_status,
              next_payment_date: doc.next_payment_date,
              days_until_due: daysDiff,
              payment_due_date: doc.payment_due_date,
            });
          }
        }
      });

      setAlerts(alertData);
    } catch (error) {
      console.error('Error fetching payment alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAlertVariant = (daysUntilDue: number) => {
    if (daysUntilDue < 0) return { variant: "destructive" as const, icon: AlertTriangle, color: "text-destructive" };
    if (daysUntilDue <= 5) return { variant: "destructive" as const, icon: AlertTriangle, color: "text-destructive" };
    if (daysUntilDue <= 15) return { variant: "default" as const, icon: Clock, color: "text-warning" };
    return { variant: "default" as const, icon: CheckCircle, color: "text-success" };
  };

  const getStatusBadge = (daysUntilDue: number) => {
    if (daysUntilDue < 0) {
      return <Badge variant="destructive">Overdue by {Math.abs(daysUntilDue)} days</Badge>;
    }
    if (daysUntilDue === 0) {
      return <Badge variant="destructive">Due Today</Badge>;
    }
    if (daysUntilDue <= 5) {
      return <Badge variant="destructive">Due in {daysUntilDue} days</Badge>;
    }
    if (daysUntilDue <= 15) {
      return <Badge variant="outline">Due in {daysUntilDue} days</Badge>;
    }
    return null;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Payment Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading payment alerts...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Payment Monitor
          {alerts.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {alerts.length} Alert{alerts.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.length === 0 ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>All Clear</AlertTitle>
            <AlertDescription>
              No payment alerts at this time. All payments are up to date.
            </AlertDescription>
          </Alert>
        ) : (
          alerts.map((alert) => {
            const { variant, icon: Icon, color } = getAlertVariant(alert.days_until_due);
            return (
              <Alert key={alert.id} variant={variant}>
                <Icon className={`h-4 w-4 ${color}`} />
                <AlertTitle className="flex items-center justify-between">
                  <span>{alert.attorney_name}</span>
                  {getStatusBadge(alert.days_until_due)}
                </AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><strong>Document:</strong> {alert.file_name}</p>
                    <p><strong>Payment Period:</strong> {alert.payment_due_date}</p>
                    <p><strong>Next Payment:</strong> {formatDistanceToNow(new Date(alert.next_payment_date), { addSuffix: true })}</p>
                    {alert.days_until_due < 0 && (
                      <p className="text-destructive font-semibold">
                        ⚠️ This payment is overdue. Please contact the referring attorney immediately.
                      </p>
                    )}
                    {alert.days_until_due >= 0 && alert.days_until_due <= 15 && (
                      <p className="text-warning font-semibold">
                        🔔 Reminder: Payment due within 15 days. Please ensure timely payment.
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
