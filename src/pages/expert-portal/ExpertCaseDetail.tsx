import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, User, Briefcase, FileText, Upload, Clock, CheckCircle2, AlertTriangle,
  Calendar, Download, Building2, Send, XCircle, Check, DollarSign, Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useParams, useNavigate } from 'react-router-dom';
import { format, differenceInDays, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const STORAGE_BUCKETS = ['documents', 'expert-documents', 'attorney-documents'];

const ExpertCaseDetail: React.FC = () => {
  const { user } = useAuth();
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [expertId, setExpertId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reportNotes, setReportNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [expertDebt, setExpertDebt] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!user || !appointmentId) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('expert_id')
        .eq('id', user.id)
        .single();

      if (!profile?.expert_id) { setLoading(false); return; }
      setExpertId(profile.expert_id);

      // Load appointment with claimant and attorney info
      const { data: appt } = await supabase
        .from('appointments')
        .select(`
          *, 
          claimants(first_name, last_name, auto_id, contact_number),
          referring_attorneys:referring_attorney_id(name, email, phone, contact_person),
          medical_experts:expert_id(first_name, last_name, expert_type, practice_address)
        `)
        .eq('id', appointmentId)
        .eq('expert_id', profile.expert_id)
        .is('deleted_at', null)
        .single();

      if (!appt) {
        toast({ title: 'Access Denied', description: 'Case not found or not assigned to you.', variant: 'destructive' });
        navigate('/expert-portal/cases');
        return;
      }
      setAppointment(appt);

      // Load report, documents, and debt in parallel
      const [rptRes, docsRes, debtRes] = await Promise.all([
        supabase
          .from('expert_reports')
          .select('*')
          .eq('appointment_id', appointmentId)
          .eq('expert_id', profile.expert_id)
          .maybeSingle(),
        supabase
          .from('documents')
          .select('*')
          .eq('appointment_id', appointmentId)
          .eq('is_visible_to_expert', true)
          .neq('document_type', 'Expert Report')
          .order('created_at', { ascending: false }),
        supabase
          .from('expert_payments')
          .select('payment_amount, payment_date, payment_notes')
          .eq('expert_id', profile.expert_id)
          .eq('appointment_id', appointmentId),
      ]);

      setReport(rptRes.data);
      if (rptRes.data?.notes) setReportNotes(rptRes.data.notes);
      setDocuments(docsRes.data || []);
      setExpertDebt(debtRes.data || []);

      setLoading(false);
    };
    load();
  }, [user, appointmentId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadReport = async () => {
    if (!selectedFile || !expertId || !appointmentId || !user) return;
    setUploading(true);

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `expert-reports/${expertId}/${appointmentId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('expert-documents')
        .upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { error: docError } = await supabase.from('documents').insert({
        file_name: selectedFile.name,
        file_path: filePath,
        file_size: selectedFile.size,
        file_type: selectedFile.type,
        document_type: 'Expert Report',
        appointment_id: appointmentId,
        expert_id: expertId,
        claimant_id: appointment?.claimant_id,
        referring_attorney_id: appointment?.referring_attorney_id,
        uploaded_by: user.id,
        is_visible_to_expert: true,
        is_visible_to_attorney: false,
        access_level: 'internal',
        approval_status: 'pending',
        notes: reportNotes || null,
      });
      if (docError) throw docError;

      // Update or create expert_report record
      if (report) {
        await supabase.from('expert_reports').update({
          report_status: 'completed',
          report_submitted_date: new Date().toISOString(),
          notes: reportNotes || null,
          days_to_complete: report.report_due_date
            ? differenceInDays(new Date(), parseISO(report.created_at))
            : null,
          updated_at: new Date().toISOString(),
        }).eq('id', report.id);
      }

      // Update appointment case_status
      await supabase.from('appointments').update({
        case_status: 'report submitted',
        updated_at: new Date().toISOString(),
      }).eq('id', appointmentId);

      toast({ title: 'Report Uploaded', description: 'Your report has been submitted successfully and is now visible in the main system.' });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Refresh report state
      const { data: rpt } = await supabase
        .from('expert_reports')
        .select('*')
        .eq('appointment_id', appointmentId)
        .eq('expert_id', expertId)
        .maybeSingle();
      setReport(rpt);
    } catch (err: any) {
      toast({ title: 'Upload Error', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleAcceptAppointment = async () => {
    if (!appointmentId) return;
    setAccepting(true);
    try {
      await supabase.from('appointments').update({
        case_status: 'confirmed',
        updated_at: new Date().toISOString(),
      }).eq('id', appointmentId);
      setAppointment((prev: any) => ({ ...prev, case_status: 'confirmed' }));
      toast({ title: 'Appointment Accepted', description: 'You have confirmed your availability for this assessment.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAccepting(false);
    }
  };

  const handleDeclineAppointment = async () => {
    if (!appointmentId || !declineReason.trim()) return;
    setDeclining(true);
    try {
      await supabase.from('appointments').update({
        case_status: 'declined by expert',
        updated_at: new Date().toISOString(),
      }).eq('id', appointmentId);
      
      // Log the decline reason
      await supabase.from('audit_logs').insert({
        action_type: 'appointment_declined',
        table_name: 'appointments',
        record_id: appointmentId,
        function_area: 'expert_portal',
        description: `Expert declined appointment. Reason: ${declineReason}`,
        user_id: user?.id,
      });

      setAppointment((prev: any) => ({ ...prev, case_status: 'declined by expert' }));
      setShowDeclineForm(false);
      toast({ title: 'Appointment Declined', description: 'The administrator has been notified.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDeclining(false);
    }
  };

  const handleDownloadDocument = async (doc: any) => {
    for (const bucket of STORAGE_BUCKETS) {
      try {
        const { data } = await supabase.storage.from(bucket).createSignedUrl(doc.file_path, 604800);
        if (data?.signedUrl) {
          window.open(data.signedUrl, '_blank');
          return;
        }
      } catch { /* try next bucket */ }
    }
    toast({ title: 'Error', description: 'Could not download file.', variant: 'destructive' });
  };

  const getDocTypeIcon = (type: string) => {
    if (type?.toLowerCase().includes('medical')) return '🏥';
    if (type?.toLowerCase().includes('instruction')) return '📋';
    if (type?.toLowerCase().includes('report')) return '📄';
    if (type?.toLowerCase().includes('summons')) return '⚖️';
    if (type?.toLowerCase().includes('id')) return '🪪';
    if (type?.toLowerCase().includes('raf') || type?.toLowerCase().includes('police') || type?.toLowerCase().includes('hospital')) return '📁';
    return '📎';
  };

  const getDocCategory = (type: string) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('medical')) return 'Medical Records';
    if (t.includes('instruction')) return 'Instruction Letter';
    if (t.includes('report') && !t.includes('expert')) return 'Previous Reports';
    return 'Supporting Documentation';
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading case...</div>;
  if (!appointment) return null;

  const daysRemaining = report?.report_due_date
    ? differenceInDays(parseISO(report.report_due_date), new Date())
    : null;

  const isUpcoming = new Date(appointment.appointment_date) >= new Date();
  const canAcceptDecline = isUpcoming && !['confirmed', 'declined by expert', 'report submitted', 'completed'].includes(appointment.case_status?.toLowerCase() || '');

  // Group documents by category
  const groupedDocs = documents.reduce((acc: Record<string, any[]>, doc) => {
    const cat = getDocCategory(doc.document_type);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/expert-portal/cases')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {appointment.claimants?.first_name} {appointment.claimants?.last_name}
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">{appointment.claimants?.auto_id}</Badge>
            <span>•</span>
            <span>{appointment.matter_type || 'General Assessment'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canAcceptDecline && (
            <>
              <Button size="sm" variant="default" onClick={handleAcceptAppointment} disabled={accepting}>
                <Check className="h-3 w-3 mr-1" /> {accepting ? 'Accepting...' : 'Accept'}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setShowDeclineForm(!showDeclineForm)} disabled={declining}>
                <XCircle className="h-3 w-3 mr-1" /> Decline
              </Button>
            </>
          )}
          <Badge className={`text-xs ${
            report?.report_status === 'completed' ? 'bg-success/20 text-success' :
            appointment.case_status === 'confirmed' ? 'bg-primary/20 text-primary' :
            appointment.case_status === 'declined by expert' ? 'bg-destructive/20 text-destructive' :
            daysRemaining !== null && daysRemaining < 0 ? 'bg-destructive text-destructive-foreground' :
            'bg-warning/20 text-warning'
          }`}>
            {report?.report_status || appointment.case_status || 'Scheduled'}
          </Badge>
        </div>
      </div>

      {/* Decline Form */}
      {showDeclineForm && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-medium text-destructive">Reason for declining this appointment</Label>
            <Textarea
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              placeholder="Please provide a reason for declining (e.g., scheduling conflict, not available on this date)..."
              rows={3}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={handleDeclineAppointment} disabled={declining || !declineReason.trim()}>
                {declining ? 'Declining...' : 'Confirm Decline'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowDeclineForm(false); setDeclineReason(''); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Column: Claimant & Attorney Info */}
        <div className="md:col-span-1 space-y-6">
          {/* A. Claimant Information */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Claimant Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Name of Claimant</Label>
                <p className="font-medium text-foreground">{appointment.claimants?.first_name} {appointment.claimants?.last_name}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Referring Attorney</Label>
                <p className="font-medium text-foreground">{appointment.referring_attorneys?.name || 'N/A'}</p>
                {appointment.referring_attorneys?.contact_person && (
                  <p className="text-xs text-muted-foreground">Contact: {appointment.referring_attorneys.contact_person}</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Referred by</Label>
                <p className="font-medium text-foreground">Kutlwano & Associates</p>
              </div>
              <Separator />
              <div>
                <Label className="text-xs text-muted-foreground">Appointment Date</Label>
                <p className="font-medium text-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(parseISO(appointment.appointment_date), 'dd MMMM yyyy, HH:mm')}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Matter Type</Label>
                <p className="font-medium text-foreground">{appointment.matter_type || 'General'}</p>
              </div>
              {appointment.medical_experts?.practice_address && (
                <div>
                  <Label className="text-xs text-muted-foreground">Location</Label>
                  <p className="text-foreground text-xs flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {appointment.medical_experts.practice_address}
                  </p>
                </div>
              )}
              {appointment.assessment_code && (
                <div>
                  <Label className="text-xs text-muted-foreground">Assessment Code</Label>
                  <p className="font-mono text-foreground text-xs">{appointment.assessment_code}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* D. Report Status Tracking */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" /> Report Status Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className="text-[10px]">
                  {report?.report_status || 'Not Started'}
                </Badge>
              </div>
              {report?.report_due_date && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date</span>
                    <span className="font-medium text-foreground">{format(parseISO(report.report_due_date), 'dd MMM yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Days Remaining / Overdue</span>
                    <span className={`font-bold ${
                      daysRemaining !== null && daysRemaining < 0 ? 'text-destructive' :
                      daysRemaining !== null && daysRemaining <= 7 ? 'text-warning' : 'text-success'
                    }`}>
                      {daysRemaining !== null ? (daysRemaining < 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d remaining`) : '—'}
                    </span>
                  </div>
                </>
              )}
              {report?.report_submitted_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted</span>
                  <span className="text-success font-medium">{format(parseISO(report.report_submitted_date), 'dd MMM yyyy')}</span>
                </div>
              )}
              {report?.days_to_complete && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days to Complete</span>
                  <span className="font-medium">{report.days_to_complete}d</span>
                </div>
              )}
              {/* Progress indicator */}
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Report Pipeline</Label>
                {['Scheduled', 'Assessed', 'Report In Progress', 'Submitted', 'Completed'].map((stage, i) => {
                  const currentStage = report?.report_status === 'completed' ? 4 :
                    report?.report_submitted_date ? 3 :
                    report?.report_status === 'in_progress' ? 2 :
                    new Date(appointment.appointment_date) < new Date() ? 1 : 0;
                  const isActive = i <= currentStage;
                  return (
                    <div key={stage} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-success' : 'bg-muted'}`} />
                      <span className={`text-xs ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{stage}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Expert Debt for this case */}
          {expertDebt.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-warning" /> Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {expertDebt.map((d: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-muted-foreground">Payment Made</span>
                    <span className="font-medium text-foreground">R{(d.payment_amount || 0).toLocaleString()}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Documents & Report Upload */}
        <div className="md:col-span-2 space-y-6">
          {/* B. Documents Available - Grouped by category */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Documents Available
              </CardTitle>
              <CardDescription className="text-xs">Only documents relevant to this case and your assignment</CardDescription>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No documents available for this case yet.</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedDocs).map(([category, docs]) => (
                    <div key={category}>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{category}</h4>
                      <div className="space-y-2">
                        {(docs as any[]).map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/10 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-lg">{getDocTypeIcon(doc.document_type)}</span>
                              <div className="min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">{doc.file_name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline" className="text-[9px]">{doc.document_type}</Badge>
                                  <span>{doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : ''}</span>
                                  <span>{format(parseISO(doc.created_at), 'dd MMM yyyy')}</span>
                                </div>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="text-xs shrink-0" onClick={() => handleDownloadDocument(doc)}>
                              <Download className="h-3 w-3 mr-1" /> Download
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* C. Report Submission Section */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" /> Report Submission
              </CardTitle>
              <CardDescription className="text-xs">
                {report?.report_status === 'completed'
                  ? 'Report has been submitted. Upload a revised version if needed.'
                  : 'Upload your report and mark as complete. The report will be visible in the main system.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {report?.report_status === 'completed' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Report Submitted</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted on {report.report_submitted_date ? format(parseISO(report.report_submitted_date), 'dd MMM yyyy') : '—'}
                      {report.days_to_complete ? ` • Completed in ${report.days_to_complete} days` : ''}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs font-medium">Upload Report File</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileSelect}
                  className="mt-1"
                />
                {selectedFile && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs font-medium">Notes</Label>
                <Textarea
                  value={reportNotes}
                  onChange={e => setReportNotes(e.target.value)}
                  placeholder="Add any notes about the report, findings, or recommendations..."
                  rows={4}
                  className="mt-1"
                />
              </div>

              <Button
                onClick={handleUploadReport}
                disabled={!selectedFile || uploading}
                className="w-full"
                size="lg"
              >
                {uploading ? (
                  <>Uploading...</>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Report & Mark Complete
                  </>
                )}
              </Button>

              <p className="text-[10px] text-muted-foreground text-center">
                Once submitted, the report will be visible to the admin team for review and delivery.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ExpertCaseDetail;
