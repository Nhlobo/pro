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
import { useToast } from '@/hooks/use-toast';
import { CalendarPlus, Loader2, Send, Upload, X, FileText, Plus, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
}

const ProfileRequestAppointment: React.FC<ProfileRequestAppointmentProps> = ({ referringAttorneyId: propAttorneyId, attorneyName, attorneyEmail }) => {
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

        // Upload files
        if (req.files.length > 0) {
          const claimantSlug = req.claimant_name.trim().replace(/\s+/g, '_');
          for (const file of req.files) {
            const filePath = `appointment-requests/${resolvedAttorneyId}/${claimantSlug}/${Date.now()}_${file.name}`;
            await supabase.storage.from('attorney-documents').upload(filePath, file);
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

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarPlus className="h-5 w-5 text-kutlwano-blue" />
          Request New Appointment
        </CardTitle>
        <CardDescription>Add one or more requests, then submit all at once</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Queued Requests */}
        {queuedRequests.length > 0 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Queued Requests ({queuedRequests.length})
            </Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {queuedRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{req.claimant_name}</span>
                    <Badge variant="outline" className="shrink-0 text-xs">{req.expert_type}</Badge>
                    <Badge variant="secondary" className="shrink-0 text-xs">{req.matter_type}</Badge>
                    {req.claimant_source === 'new' && (
                      <Badge variant="outline" className="shrink-0 text-xs border-accent text-accent-foreground">New Matter</Badge>
                    )}
                    {req.files.length > 0 && (
                      <span className="text-xs text-muted-foreground shrink-0">({req.files.length} files)</span>
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFromQueue(req.id)} className="shrink-0 h-6 w-6 p-0 text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          {/* Claimant Source Toggle */}
          <div className="space-y-2">
            <Label>Claimant *</Label>
            <div className="flex gap-2 mb-2">
              <Button
                type="button"
                variant={formData.claimant_source === 'linked' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, claimant_source: 'linked', claimant_name: '', linked_claimant_id: '' }))}
              >
                Linked Claimant
              </Button>
              <Button
                type="button"
                variant={formData.claimant_source === 'new' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, claimant_source: 'new', claimant_name: '', linked_claimant_id: '' }))}
              >
                New Matter / Claimant
              </Button>
            </div>

            {formData.claimant_source === 'linked' ? (
              <Select
                value={formData.linked_claimant_id}
                onValueChange={(v) => setFormData(prev => ({ ...prev, linked_claimant_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingClaimants ? 'Loading claimants...' : 'Select linked claimant'} />
                </SelectTrigger>
                <SelectContent>
                  {linkedClaimants.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                  {linkedClaimants.length === 0 && !loadingClaimants && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No linked claimants found</div>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-1">
                <Input
                  value={formData.claimant_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, claimant_name: e.target.value }))}
                  placeholder="Full name (e.g. John Doe)"
                />
                <p className="text-xs text-muted-foreground">This claimant is not yet in the system or requires a new matter</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Expert / Service Type *</Label>
              <Select value={formData.expert_type} onValueChange={(v) => setFormData(prev => ({ ...prev, expert_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Select expert type" /></SelectTrigger>
                <SelectContent>
                  {expertTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Matter Type *</Label>
              <Select value={formData.matter_type} onValueChange={(v) => setFormData(prev => ({ ...prev, matter_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Select matter type" /></SelectTrigger>
                <SelectContent>
                  {matterTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Province *</Label>
              <Select value={formData.province} onValueChange={(v) => setFormData(prev => ({ ...prev, province: v }))}>
                <SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger>
                <SelectContent>
                  {provinces.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Preferred Date</Label>
              <Input
                type="date"
                value={formData.suggested_date}
                onChange={(e) => setFormData(prev => ({ ...prev, suggested_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={formData.is_minor}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_minor: !!checked }))}
            />
            <Label>Claimant is a minor</Label>
          </div>

          {formData.is_minor && (
            <div className="space-y-2">
              <Label>Guardian Name</Label>
              <Input
                value={formData.guardian_name}
                onChange={(e) => setFormData(prev => ({ ...prev, guardian_name: e.target.value }))}
                placeholder="Parent/Guardian name"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Textarea
              value={formData.additional_notes}
              onChange={(e) => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
              placeholder="Any special requests or additional information..."
              rows={3}
            />
          </div>

          {/* Document Upload */}
          <div className="space-y-2">
            <Label>Upload Documents</Label>
            <p className="text-xs text-muted-foreground">Attach instruction letters, medical records, ID copies, or other supporting documents.</p>
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Click to select files</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, JPG, PNG (max 20MB each)</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff,.xls,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            {selectedFiles.length > 0 && (
              <div className="space-y-2 mt-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">({formatFileSize(file.size)})</span>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)} className="shrink-0 h-6 w-6 p-0">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={addToQueue}
              disabled={!canAddToQueue()}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add to Queue & Add Another
            </Button>
            <Button
              type="button"
              onClick={handleSubmitAll}
              disabled={submitting || (!canAddToQueue() && queuedRequests.length === 0)}
              className="flex-1"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Submit {queuedRequests.length > 0 ? `All (${queuedRequests.length + (canAddToQueue() ? 1 : 0)})` : 'Request'}</>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileRequestAppointment;
