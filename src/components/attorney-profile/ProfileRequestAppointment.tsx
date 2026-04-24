import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { CalendarPlus, Loader2, Send, Upload, X, FileText, Plus, Trash2, Users, Mail, ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getClaimPhraseForMatterType } from '@/utils/matterTypeClaimPhrase';

const expertTypes = [
  'Orthopaedic Surgeon',
  'Neurosurgeon',
  'Neurologist',
  'Clinical Psychologist',
  'Neuropsychologist',
  'Psychiatrist',
  'Occupational Therapist',
  'Industrial Psychologist',
  'Physiotherapist',
  'Radiologist',
  'General Practitioner',
  'ENT Specialist',
  'Ophthalmologist',
  'Plastic Surgeon',
  'Maxillofacial Surgeon',
  'Paediatrician',
  'Addendum (Post-Report)',
  'Affidavits',
  'Joint Minutes (Post-Report)',
];

const provinces = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
  'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'
];

const matterTypes = [
  'Road Accident Fund (RAF)',
  'Medical Negligence',
  'Slip & Fall',
  'Unlawful Arrest',
  'Product Liability',
  'Addendum (Post-Report)',
  'Affidavits',
  'Joint Minutes (Post-Report)',
  'Other'
];

interface LinkedClaimant {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
}

interface QueuedRequest {
  id: string;
  claimant_name: string;
  claimant_source: 'linked' | 'new';
  linked_claimant_id?: string;
  expert_type: string;
  matter_type: string;
  province: string;
  suggested_date: string;
  is_minor: boolean;
  guardian_name: string;
  additional_notes: string;
  files: File[];
}

interface ProfileRequestAppointmentProps {
  referringAttorneyId?: string;
  attorneyName?: string;
  attorneyEmail?: string;
  preselectedClaimantName?: string | null;
  preselectedExpertType?: string | null;
  preselectedRequestType?: string | null;
  preselectedMatterType?: string | null;
  accessCode?: string;
}

const ProfileRequestAppointment: React.FC<ProfileRequestAppointmentProps> = ({
  referringAttorneyId: propAttorneyId,
  attorneyName,
  attorneyEmail,
  preselectedClaimantName,
  preselectedExpertType,
  preselectedRequestType,
  preselectedMatterType,
  accessCode,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [linkedClaimants, setLinkedClaimants] = useState<LinkedClaimant[]>([]);
  const [loadingClaimants, setLoadingClaimants] = useState(false);
  const [queuedRequests, setQueuedRequests] = useState<QueuedRequest[]>([]);
  const [resolvedAttorneyId, setResolvedAttorneyId] = useState<string | null>(propAttorneyId || null);
  const [resolvedAttorneyName, setResolvedAttorneyName] = useState<string>(attorneyName || 'Unknown');
  const [resolvedAttorneyEmail, setResolvedAttorneyEmail] = useState<string | null>(attorneyEmail || null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    claimant_source: 'linked' as 'linked' | 'new',
    linked_claimant_id: '',
    claimant_name: '',
    expert_type: '',
    matter_type: '',
    province: '',
    suggested_date: '',
    is_minor: false,
    guardian_name: '',
    additional_notes: '',
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Resolve attorney ID on mount
  useEffect(() => {
    const resolveAttorney = async () => {
      if (propAttorneyId) {
        setResolvedAttorneyId(propAttorneyId);
        return;
      }
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('referring_attorney_id, first_name, last_name')
        .eq('id', user.id)
        .single();

      if (profile?.referring_attorney_id) {
        setResolvedAttorneyId(profile.referring_attorney_id);
        const { data: attorney } = await supabase
          .from('referring_attorneys')
          .select('name, email')
          .eq('id', profile.referring_attorney_id)
          .single();
        setResolvedAttorneyName(attorney?.name || 'Unknown');
        setResolvedAttorneyEmail(attorney?.email || null);
      }
    };
    resolveAttorney();
  }, [user, propAttorneyId]);

  // Fetch linked claimants
  useEffect(() => {
    const fetchClaimants = async () => {
      if (!resolvedAttorneyId) return;
      setLoadingClaimants(true);
      try {
        const { data, error } = await supabase
          .from('claimants')
          .select('id, first_name, last_name')
          .eq('referring_attorney_id', resolvedAttorneyId)
          .order('last_name');
        if (!error && data) {
          setLinkedClaimants(data.map(c => ({
            ...c,
            full_name: `${c.first_name} ${c.last_name}`,
          })));
        }
      } catch { /* ignore */ }
      setLoadingClaimants(false);
    };
    fetchClaimants();
  }, [resolvedAttorneyId]);

  // Apply preselected claimant name and expert type when navigated from cases table
  useEffect(() => {
    if (preselectedClaimantName) {
      setFormData(prev => ({ ...prev, claimant_source: 'new', claimant_name: preselectedClaimantName }));
    }
    if (preselectedExpertType !== undefined && preselectedExpertType !== null) {
      setFormData(prev => ({ ...prev, expert_type: preselectedExpertType }));
    }
  }, [preselectedClaimantName, preselectedExpertType]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getClaimantDisplayName = (): string => {
    if (formData.claimant_source === 'linked' && formData.linked_claimant_id) {
      return linkedClaimants.find(c => c.id === formData.linked_claimant_id)?.full_name || '';
    }
    return formData.claimant_name.trim();
  };

  const canAddToQueue = (): boolean => {
    const hasClaimant = formData.claimant_source === 'linked'
      ? !!formData.linked_claimant_id
      : !!formData.claimant_name.trim();
    return hasClaimant && !!formData.expert_type && !!formData.matter_type && !!formData.province;
  };

  const addToQueue = () => {
    if (!canAddToQueue()) return;
    const claimantName = getClaimantDisplayName();
    const newRequest: QueuedRequest = {
      id: crypto.randomUUID(),
      claimant_name: claimantName,
      claimant_source: formData.claimant_source,
      linked_claimant_id: formData.claimant_source === 'linked' ? formData.linked_claimant_id : undefined,
      expert_type: formData.expert_type,
      matter_type: formData.matter_type,
      province: formData.province,
      suggested_date: formData.suggested_date,
      is_minor: formData.is_minor,
      guardian_name: formData.is_minor ? formData.guardian_name : '',
      additional_notes: formData.additional_notes,
      files: [...selectedFiles],
    };
    setQueuedRequests(prev => [...prev, newRequest]);

    // Reset form for next entry
    setFormData({
      claimant_source: 'linked',
      linked_claimant_id: '',
      claimant_name: '',
      expert_type: '',
      matter_type: '',
      province: '',
      suggested_date: '',
      is_minor: false,
      guardian_name: '',
      additional_notes: '',
    });
    setSelectedFiles([]);
    toast({ title: 'Added to Queue', description: `Request for ${claimantName} added. You can add more or submit all.` });
  };

  const removeFromQueue = (id: string) => {
    setQueuedRequests(prev => prev.filter(r => r.id !== id));
  };

  const handleSubmitAll = async () => {
    // If there's a filled form not yet queued, add it first
    const allRequests = [...queuedRequests];
    if (canAddToQueue()) {
      const claimantName = getClaimantDisplayName();
      allRequests.push({
        id: crypto.randomUUID(),
        claimant_name: claimantName,
        claimant_source: formData.claimant_source,
        linked_claimant_id: formData.claimant_source === 'linked' ? formData.linked_claimant_id : undefined,
        expert_type: formData.expert_type,
        matter_type: formData.matter_type,
        province: formData.province,
        suggested_date: formData.suggested_date,
        is_minor: formData.is_minor,
        guardian_name: formData.is_minor ? formData.guardian_name : '',
        additional_notes: formData.additional_notes,
        files: [...selectedFiles],
      });
    }

    if (allRequests.length === 0) {
      toast({ title: 'No Requests', description: 'Please add at least one request.', variant: 'destructive' });
      return;
    }

    if (!resolvedAttorneyId) {
      toast({ title: 'Error', description: 'No referring attorney linked to your account.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const isAccessCodeMode = accessCode && !user;

      if (isAccessCodeMode) {
        // Use edge function to bypass RLS for access-code authenticated attorneys
        const requestPayloads = allRequests.map(req => {
          const nameParts = req.claimant_name.trim().split(/\s+/);
          return {
            claimant_first_name: nameParts[0] || '',
            claimant_last_name: nameParts.slice(1).join(' ') || '',
            expert_type_requested: req.expert_type,
            matter_type: req.matter_type,
            province: req.province,
            preferred_date_type: req.suggested_date ? 'specific_date' : 'any_date',
            suggested_date: req.suggested_date || null,
            is_minor: req.is_minor,
            guardian_name: req.is_minor ? req.guardian_name : null,
            additional_notes: req.additional_notes || null,
          };
        });

        const { data, error } = await supabase.functions.invoke('submit-appointment-request', {
          body: { access_code: accessCode, requests: requestPayloads },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Upload files for each request
        for (const req of allRequests) {
          if (req.files.length > 0) {
            const claimantSlug = req.claimant_name.trim().replace(/\s+/g, '_');
            for (const file of req.files) {
              const filePath = `appointment-requests/${resolvedAttorneyId}/${claimantSlug}/${Date.now()}_${file.name}`;
              await supabase.storage.from('attorney-documents').upload(filePath, file);
            }
          }
        }
      } else {
        // Direct insert for authenticated users
        for (const req of allRequests) {
          const nameParts = req.claimant_name.trim().split(/\s+/);
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';

          const { error } = await supabase.from('appointment_requests').insert({
            claimant_first_name: firstName,
            claimant_last_name: lastName,
            expert_type_requested: req.expert_type,
            matter_type: req.matter_type,
            province: req.province,
            preferred_date_type: req.suggested_date ? 'specific_date' : 'any_date',
            suggested_date: req.suggested_date || null,
            is_minor: req.is_minor,
            guardian_name: req.is_minor ? req.guardian_name : null,
            additional_notes: req.additional_notes || null,
            referring_attorney_id: resolvedAttorneyId,
            referring_attorney_name: resolvedAttorneyName,
            attorney_email: resolvedAttorneyEmail,
            requested_by: user?.id || resolvedAttorneyId,
            status: 'pending',
          });
          if (error) throw error;

          if (req.files.length > 0) {
            const claimantSlug = req.claimant_name.trim().replace(/\s+/g, '_');
            for (const file of req.files) {
              const filePath = `appointment-requests/${resolvedAttorneyId}/${claimantSlug}/${Date.now()}_${file.name}`;
              await supabase.storage.from('attorney-documents').upload(filePath, file);
            }
          }
        }
      }

      toast({ title: 'All Requests Submitted', description: `${allRequests.length} request(s) submitted successfully.` });
      setQueuedRequests([]);
      setSelectedFiles([]);
      setFormData({
        claimant_source: 'linked',
        linked_claimant_id: '',
        claimant_name: '',
        expert_type: '',
        matter_type: '',
        province: '',
        suggested_date: '',
        is_minor: false,
        guardian_name: '',
        additional_notes: '',
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to submit requests.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Email Request Mode ──
  const [emailRequestMode, setEmailRequestMode] = useState(false);
  const [emailBody, setEmailBody] = useState('');
  const [emailSubject, setEmailSubject] = useState('New Appointment Request');
  const [emailFiles, setEmailFiles] = useState<File[]>([]);
  const [emailCc, setEmailCc] = useState('');
  const emailFileRef = React.useRef<HTMLInputElement>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Auto-populate editable subject + body when navigated from a case action
  // (Request Appointment / Addendum / Affidavit / Joint Minute). The attorney
  // can still edit before sending. We only prefill — never overwrite content
  // the attorney has already typed.
  const autoPrefilledRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!preselectedRequestType) return;
    const claimant = (preselectedClaimantName || '').trim();
    const matter = preselectedMatterType || '';
    const claimPhrase = getClaimPhraseForMatterType(matter);
    const reqType = preselectedRequestType;
    const key = `${reqType}|${claimant}|${matter}`;
    // Avoid re-overwriting if attorney has already edited / same prefill applied
    if (autoPrefilledRef.current === key) return;

    let subject = 'New Appointment Request';
    let intro = '';
    switch (reqType) {
      case 'Addendum':
        subject = `Request for Addendum${claimant ? ` — ${claimant}` : ''}`;
        intro = `We hereby request an Addendum to the previously issued medico-legal report${claimant ? ` in respect of our client, ${claimant}` : ''}, in relation to ${claimPhrase}.`;
        break;
      case 'Affidavit':
        subject = `Request for Affidavit${claimant ? ` — ${claimant}` : ''}`;
        intro = `We hereby request an Affidavit${claimant ? ` in respect of our client, ${claimant}` : ''}, in support of ${claimPhrase}.`;
        break;
      case 'Joint Minute':
        subject = `Request for Joint Minute${claimant ? ` — ${claimant}` : ''}`;
        intro = `We hereby request that a Joint Minute be arranged${claimant ? ` in respect of our client, ${claimant}` : ''}, following the medico-legal assessment in relation to ${claimPhrase}.`;
        break;
      case 'New Appointment':
      default:
        subject = `Request for New Appointment${claimant ? ` — ${claimant}` : ''}`;
        intro = `We hereby request a new appointment to be scheduled${claimant ? ` for our client, ${claimant}` : ''}, in relation to ${claimPhrase}.`;
        break;
    }

    const body = [
      intro,
      '',
      'Kindly find below the relevant details:',
      claimant ? `• Claimant: ${claimant}` : '• Claimant: ',
      `• Matter Type: ${matter || 'To be confirmed'}`,
      `• Request Type: ${reqType}`,
      '• Preferred Date / Month: ',
      '• Province: ',
      '• Special Requirements: ',
      '',
      'Please review and revert with confirmation or any further requirements.',
      '',
      'Kind regards,',
    ].join('\n');

    // Only prefill when the field is empty or holds a previous auto-prefill
    setEmailSubject(prev => (prev && prev !== 'New Appointment Request' && autoPrefilledRef.current === null ? prev : subject));
    setEmailBody(prev => (prev && autoPrefilledRef.current === null ? prev : body));
    autoPrefilledRef.current = key;
  }, [preselectedRequestType, preselectedClaimantName, preselectedMatterType]);

  const handleEmailFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const oversized = files.filter(f => f.size > 20 * 1024 * 1024);
    if (oversized.length > 0) {
      toast({ title: 'File too large', description: 'Maximum file size is 20MB.', variant: 'destructive' });
      return;
    }
    setEmailFiles(prev => [...prev, ...files]);
  };

  const handleSendEmailRequest = async () => {
    if (!emailBody.trim()) {
      toast({ title: 'Missing Details', description: 'Please enter your appointment request details.', variant: 'destructive' });
      return;
    }
    if (!resolvedAttorneyId) {
      toast({ title: 'Error', description: 'No referring attorney linked.', variant: 'destructive' });
      return;
    }
    setSendingEmail(true);
    try {
      // Upload attachments
      const attachmentPaths: string[] = [];
      for (const file of emailFiles) {
        const filePath = `appointment-requests/${resolvedAttorneyId}/email/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage.from('attorney-documents').upload(filePath, file);
        if (!uploadErr) attachmentPaths.push(filePath);
      }

      const ccList = emailCc.split(',').map(e => e.trim()).filter(e => e.length > 0);
      const emailNotes = `[EMAIL REQUEST]\nSubject: ${emailSubject}${ccList.length > 0 ? `\nCC: ${ccList.join(', ')}` : ''}\n\n${emailBody}\n\nAttachments: ${attachmentPaths.length > 0 ? attachmentPaths.map(p => p.split('/').pop()).join(', ') : 'None'}`;
      const isAccessCodeMode = accessCode && !user;

      if (isAccessCodeMode) {
        const { data, error } = await supabase.functions.invoke('submit-appointment-request', {
          body: {
            access_code: accessCode,
            requests: [{
              claimant_first_name: 'Email',
              claimant_last_name: 'Request',
              expert_type_requested: 'To be determined',
              matter_type: 'To be determined',
              province: 'To be determined',
              preferred_date_type: 'any_date',
              additional_notes: emailNotes,
            }],
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } else {
        const { error } = await supabase.from('appointment_requests').insert({
          claimant_first_name: 'Email',
          claimant_last_name: 'Request',
          expert_type_requested: 'To be determined',
          matter_type: 'To be determined',
          province: 'To be determined',
          preferred_date_type: 'any_date',
          additional_notes: emailNotes,
          referring_attorney_id: resolvedAttorneyId,
          referring_attorney_name: resolvedAttorneyName,
          attorney_email: resolvedAttorneyEmail,
          requested_by: user?.id || resolvedAttorneyId,
          status: 'pending',
        });
        if (error) throw error;
      }

      toast({ title: 'Email Request Sent', description: 'Your appointment request with attachments has been submitted to the admin team.' });
      setEmailBody('');
      setEmailSubject('New Appointment Request');
      setEmailCc('');
      setEmailFiles([]);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to send email request.', variant: 'destructive' });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarPlus className="h-5 w-5 text-primary" />
          Request New Appointment
        </CardTitle>
        <CardDescription>
          Send your appointment request by email. Add a CC if you want to copy
          colleagues, and attach any supporting documents you would like the
          coordinator to see.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/30 border border-border/50 flex items-start gap-2">
            <Mail className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Your request is delivered to the admin team by email. They will
              review the details and respond to confirm an appointment.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Appointment Request Subject"
            />
          </div>

          <div className="space-y-2">
            <Label>CC (Optional)</Label>
            <Input
              value={emailCc}
              onChange={(e) => setEmailCc(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple email addresses with commas
            </p>
          </div>

          <div className="space-y-2">
            <Label>Request Details *</Label>
            <Textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Please provide details of your appointment request:&#10;&#10;- Claimant name(s)&#10;- Expert type required&#10;- Matter type (RAF, Med Neg, etc.)&#10;- Preferred dates/month&#10;- Province&#10;- Any special requirements"
              rows={8}
            />
          </div>

          <div className="space-y-2">
            <Label>Attach Supporting Documents</Label>
            <p className="text-xs text-muted-foreground">
              Attach any supporting documents (max 20MB each).
            </p>
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => emailFileRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Click to select files</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, JPG, PNG, XLS (max 20MB each)</p>
              <input
                ref={emailFileRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff,.xls,.xlsx"
                onChange={handleEmailFileSelect}
                className="hidden"
              />
            </div>
            {emailFiles.length > 0 && (
              <div className="space-y-2 mt-2">
                {emailFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({(file.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEmailFiles(prev => prev.filter((_, i) => i !== index))}
                      className="shrink-0 h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleSendEmailRequest}
            disabled={sendingEmail || !emailBody.trim()}
            className="w-full"
          >
            {sendingEmail ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
            ) : (
              <><Mail className="h-4 w-4 mr-2" /> Send Email Request {emailFiles.length > 0 ? `(${emailFiles.length} files)` : ''}</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileRequestAppointment;
