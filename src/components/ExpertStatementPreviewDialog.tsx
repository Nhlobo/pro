import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Download } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ExpertPaymentData {
  expert_id: string;
  expert_name: string;
  expert_email: string;
  expert_type: string;
  consultation_fees: number;
  court_fees: number;
  appointments: {
    appointment_id: string;
    appointment_date: string;
    claimant_name: string;
    consultation_fee: number;
    court_fee_used: boolean;
    court_fee_amount: number;
    total_due: number;
    deposit_paid: number;
    balance_due: number;
    payment_status: string;
    payment_updated_at?: string;
  }[];
  total_owed: number;
  total_deposit: number;
  total_balance: number;
}

interface ExpertStatementPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expertData: ExpertPaymentData | null;
  onSend: (toEmail: string, ccEmails: string, subject: string, message: string, pdfBase64: string) => Promise<void>;
}

export const ExpertStatementPreviewDialog: React.FC<ExpertStatementPreviewDialogProps> = ({
  open,
  onOpenChange,
  expertData,
  onSend,
}) => {
  const [toEmail, setToEmail] = useState("");
  const [ccEmails, setCcEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  React.useEffect(() => {
    if (expertData && open) {
      setToEmail(expertData.expert_email);
      const monthYear = format(new Date(), 'MMMM yyyy');
      setSubject('Payment Statement - ' + monthYear);
      setMessage('Dear Dr. ' + expertData.expert_name + ',\n\nPlease find attached your payment statement for services rendered. This statement shows all booked appointments, fees, deposits received, and balances due.\n\nIf you have any questions regarding this statement, please contact our accounts department.\n\nBest regards,\nKutlwano & Associates\nMedico-Legal Services');
    }
  }, [expertData, open]);

  const generatePDFBase64 = (): string => {
    if (!expertData) return "";

    const doc = new jsPDF();
    
    // Add header
    doc.setFontSize(20);
    doc.text('Expert Payment Statement', 14, 20);
    
    doc.setFontSize(12);
    doc.text('Expert: ' + expertData.expert_name, 14, 30);
    doc.text('Expert Type: ' + expertData.expert_type, 14, 37);
    doc.text('Statement Date: ' + format(new Date(), 'dd MMM yyyy'), 14, 44);
    
    // Add summary section
    doc.setFontSize(10);
    doc.text('Summary', 14, 55);
    doc.text('Total Owed: R ' + expertData.total_owed.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), 14, 62);
    doc.text('Deposit Received: R ' + expertData.total_deposit.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), 14, 69);
    doc.text('Balance Due: R ' + expertData.total_balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), 14, 76);
    
    // Create table data
    const tableData = expertData.appointments.map((appointment) => [
      format(new Date(appointment.appointment_date), 'dd MMM yyyy'),
      appointment.claimant_name,
      'R ' + appointment.consultation_fee.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
      appointment.court_fee_used ? 'R ' + appointment.court_fee_amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 }) : '—',
      'R ' + appointment.total_due.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
      'R ' + appointment.deposit_paid.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
      'R ' + appointment.balance_due.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
      appointment.payment_status,
      appointment.payment_updated_at ? format(new Date(appointment.payment_updated_at), 'dd MMM yyyy HH:mm') : '—',
    ]);
    
    // Add table
    autoTable(doc, {
      startY: 83,
      head: [['Date', 'Claimant', 'Consultation', 'Court Fee', 'Total Due', 'Deposit', 'Balance', 'Status', 'Updated']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 28 },
        2: { cellWidth: 22 },
        3: { cellWidth: 20 },
        4: { cellWidth: 22 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
        7: { cellWidth: 20 },
        8: { cellWidth: 26 },
      },
    });
    
    // Convert to base64
    return doc.output('dataurlstring').split(',')[1];
  };

  const handleDownloadPDF = () => {
    if (!expertData) return;

    const doc = new jsPDF();
    
    // Add header
    doc.setFontSize(20);
    doc.text('Expert Payment Statement', 14, 20);
    
    doc.setFontSize(12);
    doc.text('Expert: ' + expertData.expert_name, 14, 30);
    doc.text('Expert Type: ' + expertData.expert_type, 14, 37);
    doc.text('Statement Date: ' + format(new Date(), 'dd MMM yyyy'), 14, 44);
    
    // Add summary section
    doc.setFontSize(10);
    doc.text('Summary', 14, 55);
    doc.text('Total Owed: R ' + expertData.total_owed.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), 14, 62);
    doc.text('Deposit Received: R ' + expertData.total_deposit.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), 14, 69);
    doc.text('Balance Due: R ' + expertData.total_balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), 14, 76);
    
    // Create table data
    const tableData = expertData.appointments.map((appointment) => [
      format(new Date(appointment.appointment_date), 'dd MMM yyyy'),
      appointment.claimant_name,
      'R ' + appointment.consultation_fee.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
      appointment.court_fee_used ? 'R ' + appointment.court_fee_amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 }) : '—',
      'R ' + appointment.total_due.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
      'R ' + appointment.deposit_paid.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
      'R ' + appointment.balance_due.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
      appointment.payment_status,
      appointment.payment_updated_at ? format(new Date(appointment.payment_updated_at), 'dd MMM yyyy HH:mm') : '—',
    ]);
    
    // Add table
    autoTable(doc, {
      startY: 83,
      head: [['Date', 'Claimant', 'Consultation', 'Court Fee', 'Total Due', 'Deposit', 'Balance', 'Status', 'Updated']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 28 },
        2: { cellWidth: 22 },
        3: { cellWidth: 20 },
        4: { cellWidth: 22 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
        7: { cellWidth: 20 },
        8: { cellWidth: 26 },
      },
    });
    
    // Save the PDF
    const fileName = 'Expert_Statement_' + expertData.expert_name.replace(/\s+/g, '_') + '_' + format(new Date(), 'yyyyMMdd') + '.pdf';
    doc.save(fileName);
  };

  const handleSend = async () => {
    if (!expertData || !toEmail) return;

    try {
      setSending(true);
      const pdfBase64 = generatePDFBase64();
      await onSend(toEmail, ccEmails, subject, message, pdfBase64);
      onOpenChange(false);
    } catch (error) {
      console.error("Error in preview dialog:", error);
    } finally {
      setSending(false);
    }
  };

  if (!expertData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Expert Statement</DialogTitle>
          <DialogDescription>
            Review and edit the email before sending to {expertData.expert_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="to-email">To</Label>
            <Input
              id="to-email"
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="expert@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc-emails">CC (comma-separated)</Label>
            <Input
              id="cc-emails"
              type="text"
              value={ccEmails}
              onChange={(e) => setCcEmails(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Payment Statement"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your message..."
              rows={8}
            />
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Attachment</h4>
            <p className="text-sm text-muted-foreground">
              PDF Statement will be attached: Expert_Statement_{expertData.expert_name.replace(/\s+/g, '_')}_{format(new Date(), 'yyyyMMdd')}.pdf
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadPDF}
            disabled={sending}
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !toEmail}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};