import React, { useState, useRef } from "react";
// Docked sliding panel, not a centered pop-up — consistent with every other
// panel in the Admin Portal (Sheet is the same Radix dialog primitive under
// the hood, only the presentation differs).
import {
  Sheet as Dialog,
  SheetContent as DialogContent,
  SheetHeader as DialogHeader,
  SheetTitle as DialogTitle,
  SheetDescription as DialogDescription,
  SheetFooter as DialogFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Download, Paperclip, X, FileText, File } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
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

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  base64: string;
}

interface ExpertStatementPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expertData: ExpertPaymentData | null;
  onSend: (toEmail: string, ccEmails: string, subject: string, message: string, pdfBase64: string, additionalAttachments?: UploadedFile[]) => Promise<void>;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [includeAppointmentLetter, setIncludeAppointmentLetter] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (expertData && open) {
      setToEmail(expertData.expert_email);
      const monthYear = format(new Date(), 'MMMM yyyy');
      setSubject('Payment Statement - ' + monthYear);
      setMessage('Dear Dr. ' + expertData.expert_name + ',\n\nPlease find attached your payment statement for services rendered. This statement shows all booked appointments, fees, deposits received, and balances due.\n\nThe following documents are attached for your reference:\n• Payment Statement PDF\n• Appointment Letter(s)\n\nIf you have any questions regarding this statement or the attached documents, please contact our accounts department.\n\nBest regards,\nKutlwano & Associates\nMedico-Legal Services');
      setUploadedFiles([]);
      setIncludeAppointmentLetter(true);
    }
  }, [expertData, open]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 50MB limit`);
        continue;
      }

      if (!ALLOWED_FILE_TYPES.includes(file.type) && !file.name.endsWith('.pdf')) {
        toast.error(`${file.name} is not a supported file type`);
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        newFiles.push({
          name: file.name,
          size: file.size,
          type: file.type,
          base64,
        });
      } catch {
        toast.error(`Failed to process ${file.name}`);
      }
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />;
    if (type.includes('image')) return <File className="h-4 w-4 text-blue-500" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const generateAppointmentLetterBase64 = (): string => {
    if (!expertData) return "";

    const doc = new jsPDF();

    // Header
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('Appointment Letter', 14, 20);
    doc.setFontSize(10);
    doc.text('Kutlwano & Associates Medico-Legal Services', 14, 30);

    doc.setTextColor(55, 65, 81);
    doc.setFontSize(12);
    doc.text('Date: ' + format(new Date(), 'dd MMMM yyyy'), 14, 55);
    doc.text('To: Dr. ' + expertData.expert_name, 14, 65);
    doc.text('Expert Type: ' + expertData.expert_type, 14, 75);

    doc.setFontSize(11);
    doc.text('Dear Dr. ' + expertData.expert_name + ',', 14, 90);

    const bodyText = 'We write to confirm the following scheduled appointments for medico-legal assessments. ' +
      'Please review the details below and ensure availability on the indicated dates.';
    const splitBody = doc.splitTextToSize(bodyText, 180);
    doc.text(splitBody, 14, 100);

    // Appointments table
    const tableData = expertData.appointments.map(apt => [
      format(new Date(apt.appointment_date), 'dd MMM yyyy'),
      apt.claimant_name,
      'R ' + apt.consultation_fee.toLocaleString('en-ZA', { minimumFractionDigits: 2 }),
      apt.payment_status,
    ]);

    autoTable(doc, {
      startY: 115,
      head: [['Date', 'Claimant', 'Consultation Fee', 'Status']],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 64, 175] },
    });

    // POPIA notice
    const finalY = (doc as any).lastAutoTable?.finalY || 160;
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    const popiaText = 'POPIA Notice: This correspondence contains confidential information intended solely for the named recipient. ' +
      'Any unauthorized review, use, disclosure, or distribution is prohibited.';
    const splitPopia = doc.splitTextToSize(popiaText, 180);
    doc.text(splitPopia, 14, finalY + 15);

    // Footer
    doc.setFontSize(8);
    doc.text('© ' + new Date().getFullYear() + ' Kutlwano & Associates Medico-Legal. All rights reserved.', 14, 285);

    return doc.output('dataurlstring').split(',')[1];
  };

  const generatePDFBase64 = (): string => {
    if (!expertData) return "";

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Expert Payment Statement', 14, 20);
    doc.setFontSize(12);
    doc.text('Expert: ' + expertData.expert_name, 14, 30);
    doc.text('Expert Type: ' + expertData.expert_type, 14, 37);
    doc.text('Statement Date: ' + format(new Date(), 'dd MMM yyyy'), 14, 44);
    doc.setFontSize(10);
    doc.text('Summary', 14, 55);
    doc.text('Total Owed: R ' + expertData.total_owed.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), 14, 62);
    doc.text('Deposit Received: R ' + expertData.total_deposit.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), 14, 69);
    doc.text('Balance Due: R ' + expertData.total_balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 }), 14, 76);

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

    autoTable(doc, {
      startY: 83,
      head: [['Date', 'Claimant', 'Consultation', 'Court Fee', 'Total Due', 'Deposit', 'Balance', 'Status', 'Updated']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        0: { cellWidth: 22 }, 1: { cellWidth: 28 }, 2: { cellWidth: 22 },
        3: { cellWidth: 20 }, 4: { cellWidth: 22 }, 5: { cellWidth: 20 },
        6: { cellWidth: 20 }, 7: { cellWidth: 20 }, 8: { cellWidth: 26 },
      },
    });

    return doc.output('dataurlstring').split(',')[1];
  };

  const handleDownloadPDF = () => {
    if (!expertData) return;
    const base64 = generatePDFBase64();
    const link = document.createElement('a');
    link.href = 'data:application/pdf;base64,' + base64;
    link.download = 'Expert_Statement_' + expertData.expert_name.replace(/\s+/g, '_') + '_' + format(new Date(), 'yyyyMMdd') + '.pdf';
    link.click();
  };

  const handleSend = async () => {
    if (!expertData || !toEmail) return;

    try {
      setSending(true);
      const pdfBase64 = generatePDFBase64();

      // Build additional attachments list
      const allAdditionalAttachments: UploadedFile[] = [...uploadedFiles];

      // Include appointment letter if toggled on
      if (includeAppointmentLetter) {
        const appointmentLetterBase64 = generateAppointmentLetterBase64();
        allAdditionalAttachments.unshift({
          name: 'Appointment_Letter_Dr_' + expertData.expert_name.replace(/\s+/g, '_') + '_' + format(new Date(), 'yyyyMMdd') + '.pdf',
          size: 0,
          type: 'application/pdf',
          base64: appointmentLetterBase64,
        });
      }

      await onSend(toEmail, ccEmails, subject, message, pdfBase64, allAdditionalAttachments);
      onOpenChange(false);
    } catch (error) {
      console.error("Error in preview dialog:", error);
    } finally {
      setSending(false);
    }
  };

  if (!expertData) return null;

  const totalAttachments = 1 + (includeAppointmentLetter ? 1 : 0) + uploadedFiles.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" className="brand-legal-theme flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-2xl">
        <DialogHeader className="space-y-0 border-b border-black/10 px-5 py-4 text-left">
          <DialogTitle className="text-base font-bold text-black">Preview Expert Statement</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Review and edit the email before sending to {expertData.expert_name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 px-5 py-5">
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

          {/* Attachments Section */}
          <div className="border border-black/10 rounded-none p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments
                <Badge variant="secondary">{totalAttachments}</Badge>
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4 mr-1" />
                Add Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {/* Auto-included: Payment Statement */}
            <div className="bg-muted/50 rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-red-500" />
                <span className="font-medium">Expert_Statement_{expertData.expert_name.replace(/\s+/g, '_')}_{format(new Date(), 'yyyyMMdd')}.pdf</span>
                <Badge variant="outline" className="text-xs">Auto-included</Badge>
              </div>

              {/* Appointment Letter toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Appointment_Letter_Dr_{expertData.expert_name.replace(/\s+/g, '_')}_{format(new Date(), 'yyyyMMdd')}.pdf</span>
                </div>
                <Button
                  type="button"
                  variant={includeAppointmentLetter ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setIncludeAppointmentLetter(!includeAppointmentLetter)}
                >
                  {includeAppointmentLetter ? 'Included' : 'Excluded'}
                </Button>
              </div>
            </div>

            {/* Uploaded files list */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Additional Documents</p>
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2">
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      {getFileIcon(file.type)}
                      <span className="truncate">{file.name}</span>
                      <span className="text-muted-foreground text-xs flex-shrink-0">({formatFileSize(file.size)})</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Supported: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX · Max 50MB per file · Receiver can download all attachments directly from the email
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-black/10 px-5 py-4 sm:justify-end">
          <Button
            variant="outline"
            className="rounded-none border-black/15"
            onClick={handleDownloadPDF}
            disabled={sending}
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button
            variant="outline"
            className="rounded-none border-black/15"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button className="rounded-none" onClick={handleSend} disabled={sending || !toEmail}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email ({totalAttachments} attachment{totalAttachments !== 1 ? 's' : ''})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
