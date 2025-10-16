import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface BulkAppointmentUploadProps {
  onUploadComplete: () => void;
}

interface AppointmentRow {
  claimantFirstName: string;
  claimantLastName: string;
  expertFirstName: string;
  expertLastName: string;
  expertType: string;
  appointmentDate: string;
  appointmentTime: string;
  referringAttorney: string;
  matterType?: string;
  depositAmount?: number;
  paymentStatus?: string;
  caseStatus?: string;
}

export const BulkAppointmentUpload: React.FC<BulkAppointmentUploadProps> = ({ onUploadComplete }) => {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
      ];
      
      if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv')) {
        toast({
          title: "Invalid file type",
          description: "Please upload an Excel (.xlsx, .xls) or CSV file.",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
      setResults(null);
    }
  };

  const parseExcelFile = async (file: File): Promise<AppointmentRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
          
          // Assume first row is headers
          const headers = jsonData[0];
          const rows = jsonData.slice(1);
          
          const appointments: AppointmentRow[] = rows
            .filter(row => row.length > 0 && row.some(cell => cell)) // Skip empty rows
            .map(row => {
              const rowObj: any = {};
              headers.forEach((header, index) => {
                rowObj[header] = row[index];
              });
              
              return {
                claimantFirstName: rowObj['Claimant First Name'] || rowObj['claimant_first_name'] || '',
                claimantLastName: rowObj['Claimant Last Name'] || rowObj['claimant_last_name'] || '',
                expertFirstName: rowObj['Expert First Name'] || rowObj['expert_first_name'] || '',
                expertLastName: rowObj['Expert Last Name'] || rowObj['expert_last_name'] || '',
                expertType: rowObj['Expert Type'] || rowObj['expert_type'] || '',
                appointmentDate: rowObj['Appointment Date'] || rowObj['appointment_date'] || '',
                appointmentTime: rowObj['Appointment Time'] || rowObj['appointment_time'] || '09:00',
                referringAttorney: rowObj['Referring Attorney'] || rowObj['referring_attorney'] || '',
                matterType: rowObj['Matter Type'] || rowObj['matter_type'] || 'MVA',
                depositAmount: parseFloat(rowObj['Deposit Amount'] || rowObj['deposit_amount'] || '0'),
                paymentStatus: rowObj['Payment Status'] || rowObj['payment_status'] || 'pending',
                caseStatus: rowObj['Case Status'] || rowObj['case_status'] || 'scheduled'
              };
            });
          
          resolve(appointments);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const findOrCreateClaimant = async (firstName: string, lastName: string, lawFirmId: string) => {
    // Try to find existing claimant
    const { data: existingClaimants } = await supabase
      .from('claimants')
      .select('*')
      .eq('law_firm_id', lawFirmId)
      .ilike('first_name', firstName)
      .ilike('last_name', lastName)
      .limit(1);
    
    if (existingClaimants && existingClaimants.length > 0) {
      return existingClaimants[0].id;
    }
    
    // Create new claimant with auto-generated ID
    const { data: newClaimant, error } = await supabase
      .from('claimants')
      .insert({
        first_name: firstName,
        last_name: lastName,
        law_firm_id: lawFirmId,
        auto_id: `BULK-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
      })
      .select()
      .single();
    
    if (error) throw error;
    return newClaimant.id;
  };

  const findExpert = async (firstName: string, lastName: string, expertType: string) => {
    const { data: experts } = await supabase
      .rpc('get_medical_experts_secure');
    
    if (!experts) return null;
    
    const expert = experts.find((e: any) => 
      e.first_name?.toLowerCase().includes(firstName.toLowerCase()) &&
      e.last_name?.toLowerCase().includes(lastName.toLowerCase()) &&
      e.expert_type?.toLowerCase().includes(expertType.toLowerCase())
    );
    
    return expert?.id || null;
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    const errors: string[] = [];
    let successCount = 0;
    let failedCount = 0;

    try {
      // Get user's law firm
      const { data: profile } = await supabase
        .from('profiles')
        .select('law_firm_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.law_firm_id) {
        throw new Error('No law firm associated with your account');
      }

      // Parse the file
      const appointments = await parseExcelFile(file);
      const totalAppointments = appointments.length;

      if (totalAppointments === 0) {
        throw new Error('No valid appointments found in the file');
      }

      // Process each appointment
      for (let i = 0; i < appointments.length; i++) {
        const apt = appointments[i];
        setProgress(Math.round(((i + 1) / totalAppointments) * 100));

        try {
          // Validate required fields
          if (!apt.claimantFirstName || !apt.claimantLastName || !apt.expertFirstName || 
              !apt.expertLastName || !apt.appointmentDate || !apt.referringAttorney) {
            errors.push(`Row ${i + 2}: Missing required fields`);
            failedCount++;
            continue;
          }

          // Find or create claimant
          const claimantId = await findOrCreateClaimant(
            apt.claimantFirstName,
            apt.claimantLastName,
            profile.law_firm_id
          );

          // Find expert
          const expertId = await findExpert(apt.expertFirstName, apt.expertLastName, apt.expertType);
          if (!expertId) {
            errors.push(`Row ${i + 2}: Expert not found (${apt.expertFirstName} ${apt.expertLastName})`);
            failedCount++;
            continue;
          }

          // Parse date (handle various formats)
          let appointmentDate: Date;
          try {
            // Try parsing Excel date number
            if (typeof apt.appointmentDate === 'number') {
              appointmentDate = new Date((apt.appointmentDate - 25569) * 86400 * 1000);
            } else {
              appointmentDate = new Date(apt.appointmentDate);
            }
            
            if (isNaN(appointmentDate.getTime())) {
              throw new Error('Invalid date');
            }
          } catch {
            errors.push(`Row ${i + 2}: Invalid date format (${apt.appointmentDate})`);
            failedCount++;
            continue;
          }

          // Combine date and time
          const [hours, minutes] = apt.appointmentTime.split(':');
          appointmentDate.setHours(parseInt(hours) || 9, parseInt(minutes) || 0, 0, 0);

          // Insert appointment
          const { error: insertError } = await supabase
            .from('appointments')
            .insert({
              claimant_id: claimantId,
              expert_id: expertId,
              law_firm_id: profile.law_firm_id,
              appointment_date: appointmentDate.toISOString(),
              referring_attorney: apt.referringAttorney,
              matter_type: apt.matterType || 'MVA',
              deposit_amount: apt.depositAmount || 0,
              payment_status: apt.paymentStatus || 'pending',
              case_status: apt.caseStatus || 'scheduled'
            });

          if (insertError) {
            errors.push(`Row ${i + 2}: ${insertError.message}`);
            failedCount++;
          } else {
            successCount++;
          }
        } catch (error: any) {
          errors.push(`Row ${i + 2}: ${error.message}`);
          failedCount++;
        }
      }

      setResults({ success: successCount, failed: failedCount, errors });

      if (successCount > 0) {
        toast({
          title: "Upload completed",
          description: `Successfully created ${successCount} appointment(s).`,
        });
        onUploadComplete();
      }

      if (failedCount > 0) {
        toast({
          title: "Some appointments failed",
          description: `${failedCount} appointment(s) could not be created. Check the results for details.`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Bulk upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to process file.",
        variant: "destructive",
      });
      setResults({ success: 0, failed: 0, errors: [error.message] });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setFile(null);
    setResults(null);
    setProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Bulk Upload Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Appointment Upload</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file with appointment data. The file should include columns for:
            Claimant First Name, Claimant Last Name, Expert First Name, Expert Last Name, 
            Expert Type, Appointment Date, Appointment Time, Referring Attorney.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-upload">Select File</Label>
            <Input
              id="bulk-upload"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected: {file.name}
              </p>
            )}
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <Label>Processing...</Label>
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground text-center">{progress}%</p>
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <Alert variant={results.failed > 0 ? "destructive" : "default"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>{results.success} appointment(s) created successfully</span>
                    </div>
                    {results.failed > 0 && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span>{results.failed} appointment(s) failed</span>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              {results.errors.length > 0 && (
                <div className="space-y-2">
                  <Label>Errors:</Label>
                  <div className="max-h-48 overflow-y-auto bg-muted p-3 rounded text-sm space-y-1">
                    {results.errors.map((error, index) => (
                      <div key={index} className="text-destructive">• {error}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              {results ? 'Close' : 'Cancel'}
            </Button>
            {!results && (
              <Button onClick={handleUpload} disabled={!file || isProcessing}>
                <Upload className="h-4 w-4 mr-2" />
                {isProcessing ? 'Processing...' : 'Upload & Create Appointments'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
