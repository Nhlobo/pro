import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { useAttorneyLinkStatus } from '@/hooks/useAttorneyLinkStatus';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AttorneyNotLinkedState } from '@/components/portal/AttorneyNotLinkedState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CalendarPlus, Loader2, Send, FileText, X, Receipt } from 'lucide-react';
import {
  PortalPage,
  PortalHeader,
  PortalCard,
  PortalCardHeader,
  PortalCardBody,
  PortalLoadingState,
} from '@/components/attorney-portal/ui/PortalPrimitives';

// Client request #5: "I don't see function where new appointment are
// requested — label the function as New appointment Request on the
// attorney Portal." The form + submit logic already existed
// (ProfileRequestAppointment.tsx / AppointmentRequest.tsx) but was only
// reachable from the admin's internal view of an attorney, never from the
// attorney's own portal — so this is a new, portal-native page, not a copy
// of either of those.
//
// Client request #7: "Submission of new referral must be able to request
// more than one Expert eg orthopaedic, neurosurgeon, nursing expert etc."
// expert_type_requested on appointment_requests is a required single text
// column read as a plain string by ~15 other places (edge functions,
// emails, admin dashboards) — turning it into an array would break every
// one of those. Instead: picking multiple experts here creates one
// appointment_requests row per expert (all identical apart from
// expert_type_requested), tagged with a shared referral_group_id so staff
// see them grouped as one referral. Every existing single-expert reader
// keeps working untouched.

const EXPERT_TYPES = [
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
  'Nursing Expert',
  'Biokineticist',
  'Speech Therapist',
];

const PROVINCES = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
  'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape',
];

const MATTER_TYPES = [
  'Road Accident Fund (RAF)',
  'Medical Negligence',
  'Slip & Fall',
  'Unlawful Arrest',
  'Product Liability',
  'Addendum (Post-Report)',
  'Affidavits',
  'Joint Minutes (Post-Report)',
  'Other',
];

// Client request (email, 12 Sep 2026): attorneys need an option to upload
// supporting documents (medical records, instruction letter, summons — "like"
// signals examples, not an exhaustive list, hence "Other") and proof of
// payment when requesting a new appointment date, so staff can book
// immediately instead of following up first. Files are staged locally and
// only actually uploaded once the appointment_requests row(s) exist (see
// handleSubmit) — appointment_request_documents and payment_pop_attachments
// are both keyed off that row's id.
type SupportingDocType = 'medical_record' | 'instruction_letter' | 'summons' | 'other';

const DOCUMENT_TYPE_LABELS: Record<SupportingDocType, string> = {
  medical_record: 'Medical record',
  instruction_letter: 'Instruction letter',
  summons: 'Summons',
  other: 'Other',
};

interface LinkedClaimant {
  id: string;
  full_name: string;
}

const AttorneyRequestAppointment: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const linkStatus = useAttorneyLinkStatus();

  const [attorneyId, setAttorneyId] = useState<string | null>(null);
  const [attorneyName, setAttorneyName] = useState<string>('');
  const [attorneyEmail, setAttorneyEmail] = useState<string | null>(null);
  const [linkedClaimants, setLinkedClaimants] = useState<LinkedClaimant[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [claimantSource, setClaimantSource] = useState<'linked' | 'new'>('linked');
  const [linkedClaimantId, setLinkedClaimantId] = useState('');
  const [claimantName, setClaimantName] = useState('');
  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState('');
  const [matterType, setMatterType] = useState('');
  const [province, setProvince] = useState('');
  const [expertTypesSelected, setExpertTypesSelected] = useState<string[]>([]);
  const [suggestedDate, setSuggestedDate] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const [stagedDocType, setStagedDocType] = useState<SupportingDocType>('medical_record');
  const [stagedDocuments, setStagedDocuments] = useState<{ file: File; documentType: SupportingDocType }[]>([]);
  const [popFile, setPopFile] = useState<File | null>(null);
  const [popReference, setPopReference] = useState('');

  useEffect(() => {
    if (!user) return;
    const resolve = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('referring_attorney_id')
        .eq('id', user.id)
        .single();
      if (!profile?.referring_attorney_id) return;
      setAttorneyId(profile.referring_attorney_id);
      const { data: attorney } = await supabase
        .from('referring_attorneys')
        .select('name, email')
        .eq('id', profile.referring_attorney_id)
        .single();
      setAttorneyName(attorney?.name || '');
      setAttorneyEmail(attorney?.email || null);
      const { data: claimants } = await supabase
        .from('claimants')
        .select('id, first_name, last_name')
        .eq('referring_attorney_id', profile.referring_attorney_id)
        .order('last_name');
      setLinkedClaimants((claimants || []).map(c => ({ id: c.id, full_name: `${c.first_name} ${c.last_name}` })));
    };
    resolve();
  }, [user]);

  const toggleExpertType = (type: string) => {
    setExpertTypesSelected(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const addStagedDocument = (file: File | null) => {
    if (!file) return;
    setStagedDocuments(prev => [...prev, { file, documentType: stagedDocType }]);
  };

  const removeStagedDocument = (index: number) => {
    setStagedDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const getClaimantName = () => {
    if (claimantSource === 'linked') {
      return linkedClaimants.find(c => c.id === linkedClaimantId)?.full_name?.trim() || '';
    }
    return claimantName.trim();
  };

  const isValid = () => {
    const claimant = getClaimantName();
    return !!claimant && !!matterType && !!province && expertTypesSelected.length > 0;
  };

  const resetForm = () => {
    setClaimantSource('linked');
    setLinkedClaimantId('');
    setClaimantName('');
    setIsMinor(false);
    setGuardianName('');
    setMatterType('');
    setProvince('');
    setExpertTypesSelected([]);
    setSuggestedDate('');
    setAdditionalNotes('');
    setStagedDocType('medical_record');
    setStagedDocuments([]);
    setPopFile(null);
    setPopReference('');
  };

  const handleSubmit = async () => {
    if (!attorneyId || !user || !isValid()) return;
    setSubmitting(true);

    const claimantFullName = getClaimantName();
    const [claimantFirstName, ...rest] = claimantFullName.split(' ');
    const claimantLastName = rest.join(' ') || claimantFirstName;

    // One referral needing several experts still only sets a group id when
    // there's actually more than one — a single-expert request stays
    // ungrouped, same as before this feature existed.
    const referralGroupId = expertTypesSelected.length > 1 ? crypto.randomUUID() : null;

    const baseRow = {
      referring_attorney_id: attorneyId,
      referring_attorney_name: attorneyName,
      attorney_email: attorneyEmail,
      requested_by: user.id,
      claimant_first_name: claimantFirstName,
      claimant_last_name: claimantLastName,
      is_minor: isMinor,
      guardian_name: isMinor ? guardianName.trim() || null : null,
      matter_type: matterType,
      province,
      preferred_date_type: suggestedDate ? 'specific_date' : 'any_date',
      suggested_date: suggestedDate || null,
      additional_notes: additionalNotes.trim() || null,
      status: 'pending',
      referral_group_id: referralGroupId,
    };

    try {
      const rows = expertTypesSelected.map(expertType => ({
        ...baseRow,
        expert_type_requested: expertType,
      }));

      const { data: inserted, error } = await supabase
        .from('appointment_requests')
        .insert(rows)
        .select('id, expert_type_requested');

      if (error) throw error;

      // Best-effort admin notification email per request — mirrors the
      // existing internal AppointmentRequest.tsx flow. A failed email must
      // never undo the request itself, so failures are swallowed here.
      await Promise.allSettled(
        (inserted || []).map(row =>
          supabase.functions.invoke('send-appointment-request', {
            body: {
              requestData: {
                referring_attorney_name: attorneyName,
                claimant_first_name: claimantFirstName,
                claimant_last_name: claimantLastName,
                is_minor: isMinor,
                guardian_name: isMinor ? guardianName.trim() : undefined,
                expert_type_requested: row.expert_type_requested,
                matter_type: matterType,
                special_requests: [],
                province,
                preferred_date_type: suggestedDate ? 'specific_date' : 'any_date',
                suggested_date: suggestedDate || undefined,
                additional_notes: additionalNotes.trim() || undefined,
              },
            },
          })
        )
      );

      // Attach any staged supporting documents + proof of payment to every
      // row just created. A multi-expert referral makes several rows for
      // the same claimant — the attachments aren't specific to any one
      // expert, so the same files get linked to all of them, meaning
      // whichever row staff open, they see everything the attorney sent.
      let attachmentIssue = false;
      if (stagedDocuments.length > 0 || popFile) {
        try {
          for (const row of inserted || []) {
            for (const doc of stagedDocuments) {
              const path = `${user.id}/${row.id}/${Date.now()}_${doc.file.name}`;
              const { error: uploadError } = await supabase.storage
                .from('appointment-request-documents')
                .upload(path, doc.file);
              if (uploadError) throw uploadError;

              const { error: docRowError } = await supabase
                .from('appointment_request_documents')
                .insert({
                  appointment_request_id: row.id,
                  document_type: doc.documentType,
                  file_path: path,
                  file_name: doc.file.name,
                  file_size_bytes: doc.file.size,
                  mime_type: doc.file.type || null,
                  uploaded_by: user.id,
                });
              if (docRowError) throw docRowError;
            }

            if (popFile) {
              const popPath = `appointment_request/${row.id}/${Date.now()}_${popFile.name}`;
              const { error: popUploadError } = await supabase.storage
                .from('payment-pop-documents')
                .upload(popPath, popFile);
              if (popUploadError) throw popUploadError;

              const { error: popRowError } = await supabase
                .from('payment_pop_attachments')
                .insert({
                  record_type: 'appointment_request',
                  record_id: row.id,
                  file_path: popPath,
                  file_name: popFile.name,
                  payment_reference: popReference.trim() || `Submitted with appointment request for ${claimantFullName}`,
                  uploaded_by: user.id,
                });
              if (popRowError) throw popRowError;
            }
          }
        } catch (attachErr) {
          // The request itself is already safely submitted at this point —
          // an attachment failure shouldn't read as the whole request failing.
          console.error('Failed to attach documents/POP to appointment request:', attachErr);
          attachmentIssue = true;
        }
      }

      toast(
        attachmentIssue
          ? {
              title: 'Request submitted, but an attachment failed',
              description: 'Your request went through — please contact our team to resend whatever didn\'t attach.',
              variant: 'destructive',
            }
          : {
              title: expertTypesSelected.length > 1 ? 'Referral submitted' : 'Appointment request submitted',
              description: expertTypesSelected.length > 1
                ? `Requested ${expertTypesSelected.length} experts for ${claimantFullName}. Our team will be in touch to confirm each.`
                : `Your request for ${claimantFullName} has been sent to our team.`,
            }
      );
      resetForm();
      navigate('/attorney-portal/appointments');
    } catch (err) {
      console.error('Failed to submit appointment request:', err);
      toast({
        title: 'Something went wrong',
        description: 'Your request could not be submitted. Please try again or contact support.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (linkStatus === 'checking') {
    return (
      <AttorneyPortalLayout>
        <PortalPage>
          <PortalHeader eyebrow="Attorney Portal" title="New Appointment Request" icon={CalendarPlus} />
          <PortalLoadingState label="Checking your account…" />
        </PortalPage>
      </AttorneyPortalLayout>
    );
  }

  if (linkStatus === 'not_linked') {
    return (
      <AttorneyPortalLayout>
        <PortalPage>
          <PortalHeader eyebrow="Attorney Portal" title="New Appointment Request" icon={CalendarPlus} />
          <AttorneyNotLinkedState description="Your account isn't linked to a firm's referrals yet, so there's nothing to show here. Contact an administrator or get help below." />
        </PortalPage>
      </AttorneyPortalLayout>
    );
  }

  return (
    <AttorneyPortalLayout>
      <PortalPage>
        <PortalHeader
          eyebrow="Attorney Portal"
          title="New Appointment Request"
          description="Submit a new referral — select every expert this claimant needs in one go."
          icon={CalendarPlus}
        />

        <PortalCard>
          <PortalCardHeader icon={CalendarPlus} title="Referral details" description="Fields marked are required to submit" />
          <PortalCardBody className="space-y-6">
            <div className="space-y-3">
              <Label>Claimant</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={claimantSource === 'linked' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setClaimantSource('linked')}
                >
                  Existing claimant
                </Button>
                <Button
                  type="button"
                  variant={claimantSource === 'new' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setClaimantSource('new')}
                >
                  New claimant
                </Button>
              </div>
              {claimantSource === 'linked' ? (
                <Select value={linkedClaimantId} onValueChange={setLinkedClaimantId}>
                  <SelectTrigger><SelectValue placeholder="Select a claimant" /></SelectTrigger>
                  <SelectContent>
                    {linkedClaimants.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={claimantName}
                  onChange={e => setClaimantName(e.target.value)}
                  placeholder="Full name of the new claimant"
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="is-minor" checked={isMinor} onCheckedChange={c => setIsMinor(!!c)} />
              <Label htmlFor="is-minor" className="cursor-pointer font-normal">Claimant is a minor</Label>
            </div>
            {isMinor && (
              <Input
                value={guardianName}
                onChange={e => setGuardianName(e.target.value)}
                placeholder="Guardian's full name"
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Matter type</Label>
                <Select value={matterType} onValueChange={setMatterType}>
                  <SelectTrigger><SelectValue placeholder="Select matter type" /></SelectTrigger>
                  <SelectContent>
                    {MATTER_TYPES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Province</Label>
                <Select value={province} onValueChange={setProvince}>
                  <SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger>
                  <SelectContent>
                    {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Expert(s) required</Label>
              <p className="text-xs text-muted-foreground">
                Select every expert this claimant needs — e.g. Orthopaedic Surgeon, Neurosurgeon and Nursing Expert
                can all be requested together as one referral.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {EXPERT_TYPES.map(type => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`expert-${type}`}
                      checked={expertTypesSelected.includes(type)}
                      onCheckedChange={() => toggleExpertType(type)}
                    />
                    <Label htmlFor={`expert-${type}`} className="cursor-pointer font-normal text-sm">{type}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Suggested date (optional)</Label>
              <Input type="date" value={suggestedDate} onChange={e => setSuggestedDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Additional notes (optional)</Label>
              <Textarea
                value={additionalNotes}
                onChange={e => setAdditionalNotes(e.target.value)}
                placeholder="Anything else our team should know…"
                rows={3}
              />
            </div>

          </PortalCardBody>
        </PortalCard>

        <PortalCard>
          <PortalCardHeader
            icon={FileText}
            title="Supporting documents"
            description="Optional, but attaching these upfront helps our team book immediately instead of following up first"
          />
          <PortalCardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Document type</Label>
                <Select value={stagedDocType} onValueChange={v => setStagedDocType(v as SupportingDocType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DOCUMENT_TYPE_LABELS) as SupportingDocType[]).map(key => (
                      <SelectItem key={key} value={key}>{DOCUMENT_TYPE_LABELS[key]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Add a file</Label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                  onChange={e => {
                    addStagedDocument(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            {stagedDocuments.length > 0 && (
              <ul className="space-y-2">
                {stagedDocuments.map((doc, index) => (
                  <li key={`${doc.file.name}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="truncate pr-2">
                      <span className="font-medium">{DOCUMENT_TYPE_LABELS[doc.documentType]}:</span> {doc.file.name}
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeStagedDocument(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </PortalCardBody>
        </PortalCard>

        <PortalCard>
          <PortalCardHeader
            icon={Receipt}
            title="Proof of payment"
            description="Optional — attach if payment has already been made for this assessment"
          />
          <PortalCardBody className="space-y-4">
            <div className="space-y-2">
              <Label>Payment reference (optional)</Label>
              <Input
                value={popReference}
                onChange={e => setPopReference(e.target.value)}
                placeholder="e.g. EFT reference or transaction number"
              />
            </div>
            <div className="space-y-2">
              <Label>Proof of payment file</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={e => setPopFile(e.target.files?.[0] ?? null)}
              />
              {popFile && (
                <p className="text-xs text-muted-foreground">Selected: {popFile.name}</p>
              )}
            </div>

            <Button onClick={handleSubmit} disabled={!isValid() || submitting} className="w-full sm:w-auto">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {expertTypesSelected.length > 1 ? `Submit referral (${expertTypesSelected.length} experts)` : 'Submit request'}
            </Button>
          </PortalCardBody>
        </PortalCard>
      </PortalPage>
    </AttorneyPortalLayout>
  );
};

export default AttorneyRequestAppointment;
