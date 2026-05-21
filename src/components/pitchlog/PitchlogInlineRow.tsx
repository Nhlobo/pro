import React, { useState, useEffect, useRef } from 'react';
import { generateLawFirmCode } from '@/utils/idGenerators';
import { TableCell, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Edit, Trash2, Save, X, CalendarDays, Mail, Phone, CalendarIcon, UserPlus, AlertCircle, RotateCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'
];
const ATTORNEY_TYPES = ['Plaintiff', 'Defendant', 'State Attorney'];
const PRACTICE_AREAS = ['RAF', 'Medical Negligence', 'Both RAF & Med Neg', 'Not Applicable', 'Other Service'];
const PITCH_STATUSES = ['Pitched', 'Re-pitched', 'Followed Up', 'No Answers'];
const COMMENT_OPTIONS = [
  'Interested', 'Potential', 'Not Interested', 'Not dealing with RAF',
  'Not dealing Med Neg', 'Not Sure', 'Others'
];
const MEETING_STATUSES = ['Meeting Proposed', 'No Meeting Proposed', 'Meeting Held', 'Meeting Cancelled'];

export interface PitchEntry {
  id: string;
  month_year: string;
  province: string;
  law_firm_name: string;
  attorney_type: string;
  practice_area: string;
  contact_person: string;
  email: string | null;
  telephone: string | null;
  sales_person: string;
  pitch_status: string;
  follow_up_date: string | null;
  comment: string | null;
  comment_2: string | null;
  identified_challenge: string | null;
  meeting_function: string | null;
  deal_closed: boolean | null;
  deal_closed_date: string | null;
  matched_referring_attorney_id: string | null;
  created_at: string;
}

interface Props {
  entry: PitchEntry;
  onSave: (id: string, data: Partial<PitchEntry>) => void | Promise<unknown>;
  onDelete?: (id: string) => void;
  statusColor: (status: string) => string;
  followUpCount?: number;
}

const PitchlogInlineRow: React.FC<Props> = ({ entry, onSave, onDelete, statusColor, followUpCount = 0 }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry);

  // Inline auto-save state for comment fields (always editable, no need to enter edit mode)
  const [inlineChallenge, setInlineChallenge] = useState(entry.identified_challenge || '');
  const [inlineComment2, setInlineComment2] = useState(entry.comment_2 || '');
  const [savingInline, setSavingInline] = useState<null | 'challenge' | 'comment_2'>(null);
  const [savedFlash, setSavedFlash] = useState<null | 'challenge' | 'comment_2'>(null);
  const [errorField, setErrorField] = useState<null | 'challenge' | 'comment_2'>(null);
  const [retryCount, setRetryCount] = useState<{ challenge: number; comment_2: number }>({ challenge: 0, comment_2: 0 });
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPayloadRef = useRef<{ field: 'identified_challenge' | 'comment_2'; value: string | null } | null>(null);

  // Sync when entry refreshes from server
  useEffect(() => {
    setInlineChallenge(entry.identified_challenge || '');
    setInlineComment2(entry.comment_2 || '');
  }, [entry.identified_challenge, entry.comment_2]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const performSave = async (field: 'identified_challenge' | 'comment_2', value: string | null, attempt: number) => {
    const key = field === 'identified_challenge' ? 'challenge' : 'comment_2';
    setSavingInline(key);
    setErrorField(null);
    lastPayloadRef.current = { field, value };
    try {
      await Promise.resolve(onSave(entry.id, { [field]: value } as any));
      setSavingInline(null);
      setSavedFlash(key);
      setRetryCount((r) => ({ ...r, [key]: 0 }));
      setTimeout(() => setSavedFlash((cur) => (cur === key ? null : cur)), 1200);
    } catch (err: any) {
      setSavingInline(null);
      setErrorField(key);
      const next = attempt + 1;
      setRetryCount((r) => ({ ...r, [key]: next }));
      // Auto-retry up to 2 times with backoff (1.5s, 4s)
      if (next <= 2) {
        const delay = next === 1 ? 1500 : 4000;
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => performSave(field, value, next), delay);
      } else {
        toast({
          title: 'Could not save comment',
          description: err?.message || 'Network error. Click ↻ to retry.',
          variant: 'destructive',
        });
      }
    }
  };

  const autoSaveField = (field: 'identified_challenge' | 'comment_2', value: string | null, immediate = false) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    const run = () => performSave(field, value, 0);
    if (immediate) run();
    else debounceRef.current = setTimeout(run, 800);
  };

  const manualRetry = (key: 'challenge' | 'comment_2') => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    const field = key === 'challenge' ? 'identified_challenge' : 'comment_2';
    const value = key === 'challenge' ? (inlineChallenge || null) : (inlineComment2 || null);
    setRetryCount((r) => ({ ...r, [key]: 0 }));
    performSave(field, value, 0);
  };

  const { toast } = useToast();
  const [addingToDirectory, setAddingToDirectory] = useState(false);

  const startEdit = () => {
    setDraft(entry);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(entry);
    setEditing(false);
  };

  const save = () => {
    onSave(entry.id, {
      province: draft.province,
      law_firm_name: draft.law_firm_name,
      attorney_type: draft.attorney_type,
      practice_area: draft.practice_area,
      contact_person: draft.contact_person,
      email: draft.email,
      telephone: draft.telephone,
      sales_person: draft.sales_person,
      pitch_status: draft.pitch_status,
      follow_up_date: draft.follow_up_date,
      identified_challenge: draft.identified_challenge,
      comment_2: draft.comment_2,
      meeting_function: draft.meeting_function,
    });
    setEditing(false);
  };

  const addToDirectory = async () => {
    if (!entry.law_firm_name) return;
    setAddingToDirectory(true);
    try {
      // Check if already exists
      const { data: existing } = await supabase
        .from('referring_attorneys')
        .select('id, name')
        .ilike('name', entry.law_firm_name.trim())
        .limit(1);

      if (existing && existing.length > 0) {
        toast({
          title: "Already in Directory",
          description: `"${entry.law_firm_name}" is already registered as a referring attorney.`,
        });
        // Link pitchlog entry to existing attorney
        await supabase
          .from('attorney_pitchlog')
          .update({ matched_referring_attorney_id: existing[0].id })
          .eq('id', entry.id);
        setAddingToDirectory(false);
        return;
      }

      // Generate a unique code
      const { count } = await supabase
        .from('referring_attorneys')
        .select('*', { count: 'exact', head: true });
      const seq = (count || 0) + 1;
      const code = generateLawFirmCode(entry.contact_person || entry.law_firm_name, entry.law_firm_name, seq);

      // Add to referring_attorneys
      const { data: newAttorney, error } = await supabase
        .from('referring_attorneys')
        .insert({
          name: entry.law_firm_name.trim(),
          code,
          contact_person: entry.contact_person || '',
          email: entry.email || '',
          phone: entry.telephone || '',
          province: entry.province || '',
          attorney_role: entry.attorney_type || 'Plaintiff',
        })
        .select('id')
        .single();

      if (error) throw error;

      // Link pitchlog entry
      if (newAttorney) {
        await supabase
          .from('attorney_pitchlog')
          .update({ matched_referring_attorney_id: newAttorney.id })
          .eq('id', entry.id);
      }

      toast({
        title: "Added to Directory",
        description: `"${entry.law_firm_name}" has been added to the Referring Attorney Directory.`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to add attorney to directory.",
        variant: "destructive",
      });
    } finally {
      setAddingToDirectory(false);
    }
  };

  if (editing) {
    return (
      <TableRow className="bg-muted/30">
        <TableCell className="text-sm">{format(new Date(entry.created_at), 'dd MMM yyyy')}</TableCell>
        <TableCell>
          <Select value={draft.province} onValueChange={v => setDraft(d => ({ ...d, province: v }))}>
            <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </TableCell>
        <TableCell><Input className="h-8 text-xs w-[130px]" value={draft.law_firm_name} onChange={e => setDraft(d => ({ ...d, law_firm_name: e.target.value }))} /></TableCell>
        <TableCell>
          <Select value={draft.attorney_type} onValueChange={v => setDraft(d => ({ ...d, attorney_type: v }))}>
            <SelectTrigger className="h-8 text-xs w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>{ATTORNEY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Select value={draft.practice_area} onValueChange={v => setDraft(d => ({ ...d, practice_area: v }))}>
            <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>{PRACTICE_AREAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </TableCell>
        <TableCell><Input className="h-8 text-xs w-[120px]" value={draft.contact_person} onChange={e => setDraft(d => ({ ...d, contact_person: e.target.value }))} placeholder="Name" /></TableCell>
        <TableCell><Input className="h-8 text-xs w-[140px]" value={draft.email || ''} onChange={e => setDraft(d => ({ ...d, email: e.target.value || null }))} placeholder="Email" /></TableCell>
        <TableCell><Input className="h-8 text-xs w-[110px]" value={draft.telephone || ''} onChange={e => setDraft(d => ({ ...d, telephone: e.target.value || null }))} placeholder="Phone" /></TableCell>
        <TableCell><Input className="h-8 text-xs w-[100px]" value={draft.sales_person} onChange={e => setDraft(d => ({ ...d, sales_person: e.target.value }))} /></TableCell>
        <TableCell>
          <Select value={draft.pitch_status} onValueChange={v => setDraft(d => ({ ...d, pitch_status: v }))}>
            <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>{PITCH_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-8 text-xs w-[130px] justify-start text-left font-normal", !draft.follow_up_date && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-3 w-3" />
                {draft.follow_up_date ? format(new Date(draft.follow_up_date), 'dd MMM yyyy') : <span>Pick date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={draft.follow_up_date ? new Date(draft.follow_up_date) : undefined}
                onSelect={(date) => setDraft(d => ({ ...d, follow_up_date: date ? format(date, 'yyyy-MM-dd') : null }))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </TableCell>
        <TableCell>
       <Select value={draft.identified_challenge || ''} onValueChange={v => setDraft(d => ({ ...d, identified_challenge: v || null }))}>
            <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{COMMENT_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Input className="h-8 text-xs w-[150px]" value={draft.comment_2 || ''} onChange={e => setDraft(d => ({ ...d, comment_2: e.target.value || null }))} placeholder="Additional notes..." />
        </TableCell>
        <TableCell>
          <Select value={draft.meeting_function || ''} onValueChange={v => setDraft(d => ({ ...d, meeting_function: v || null }))}>
            <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{MEETING_STATUSES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={save} className="text-emerald-600"><Save className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="sm" onClick={cancel}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  const isRePitched = entry.pitch_status === 'Re-pitched';
  const isFollowedUp = entry.pitch_status === 'Followed Up';
  const hasMultipleFollowUps = followUpCount >= 3;

  const rowHighlightClass = cn(
    isRePitched && 'bg-purple-50 dark:bg-purple-950/30 border-l-[3px] border-l-purple-400',
    isFollowedUp && !hasMultipleFollowUps && 'bg-blue-50 dark:bg-blue-950/30 border-l-[3px] border-l-blue-400',
    hasMultipleFollowUps && isFollowedUp && 'bg-amber-50 dark:bg-amber-950/30',
  );

  // Generate thin colored indicator lines for 3+ follow-ups
  const followUpIndicator = hasMultipleFollowUps && isFollowedUp ? (
    <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-center gap-[2px]">
      {Array.from({ length: Math.min(followUpCount, 6) }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-[3px] rounded-full',
            i % 3 === 0 && 'bg-amber-500',
            i % 3 === 1 && 'bg-orange-500',
            i % 3 === 2 && 'bg-red-500',
          )}
          style={{ height: `${Math.floor(80 / Math.min(followUpCount, 6))}%` }}
        />
      ))}
    </div>
  ) : null;

  return (
    <TableRow key={entry.id} className={cn('relative', rowHighlightClass)}>
      {followUpIndicator}
      <TableCell className="text-sm">{format(new Date(entry.created_at), 'dd MMM yyyy')}</TableCell>
      <TableCell className="text-sm">{entry.province}</TableCell>
      <TableCell className="text-sm font-medium">{entry.law_firm_name}</TableCell>
      <TableCell><Badge variant="outline" className="text-xs">{entry.attorney_type}</Badge></TableCell>
      <TableCell><Badge variant="secondary" className="text-xs">{entry.practice_area}</Badge></TableCell>
      <TableCell className="text-sm">{entry.contact_person}</TableCell>
      <TableCell className="text-sm">
        {entry.email ? <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" />{entry.email}</span> : '—'}
      </TableCell>
      <TableCell className="text-sm">
        {entry.telephone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" />{entry.telephone}</span> : '—'}
      </TableCell>
      <TableCell className="text-sm">{entry.sales_person}</TableCell>
      <TableCell><Badge className={statusColor(entry.pitch_status)}>{entry.pitch_status}</Badge></TableCell>
      <TableCell className="text-sm">
        {entry.follow_up_date ? (
          <span className={`flex items-center gap-1 ${new Date(entry.follow_up_date) <= new Date() ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            <CalendarDays className="h-3 w-3" />
            {format(new Date(entry.follow_up_date), 'dd MMM')}
          </span>
        ) : '—'}
      </TableCell>
      <TableCell className="max-w-[140px]">
        <div className="flex items-center gap-1">
          <Select
            value={inlineChallenge || '__none__'}
            disabled={savingInline === 'challenge'}
            onValueChange={(v) => {
              const val = v === '__none__' ? null : v;
              setInlineChallenge(val || '');
              autoSaveField('identified_challenge', val, true);
            }}
          >
            <SelectTrigger
              className={cn(
                'h-7 text-xs w-[130px] transition-colors',
                errorField === 'challenge' && 'border-destructive ring-1 ring-destructive/40 bg-destructive/5',
                savingInline === 'challenge' && 'opacity-60 cursor-not-allowed'
              )}
              aria-invalid={errorField === 'challenge'}
            >
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {COMMENT_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {savingInline === 'challenge' && <span className="text-[10px] text-muted-foreground">…</span>}
          {savedFlash === 'challenge' && errorField !== 'challenge' && <span className="text-[10px] text-emerald-600">✓</span>}
          {errorField === 'challenge' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => manualRetry('challenge')}
                    className="flex items-center gap-0.5 text-[10px] text-destructive hover:underline"
                    aria-label="Retry saving comment"
                  >
                    <AlertCircle className="h-3 w-3" />
                    <RotateCw className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {retryCount.challenge >= 3 ? 'Save failed — click to retry' : `Retrying… (attempt ${retryCount.challenge})`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </TableCell>
      <TableCell className="max-w-[260px]">
        <Comment2TimestampedEditor
          value={entry.comment_2 || ''}
          saving={savingInline === 'comment_2'}
          error={errorField === 'comment_2'}
          flash={savedFlash === 'comment_2'}
          retryCount={retryCount.comment_2}
          onAppend={(line) => {
            const next = entry.comment_2 ? `${entry.comment_2}\n${line}` : line;
            setInlineComment2(next);
            autoSaveField('comment_2', next, true);
          }}
          onRetry={() => manualRetry('comment_2')}
        />
      </TableCell>

      <TableCell className="text-xs max-w-[130px] truncate">{entry.meeting_function || '—'}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addToDirectory}
                  disabled={addingToDirectory || !!entry.matched_referring_attorney_id}
                  className={entry.matched_referring_attorney_id ? 'text-success' : 'text-primary hover:text-primary'}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {entry.matched_referring_attorney_id ? 'Already in directory' : 'Add to Referring Attorney Directory'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="ghost" size="sm" onClick={startEdit}><Edit className="h-3.5 w-3.5" /></Button>
          {onDelete && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(entry.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

export default PitchlogInlineRow;
export { PROVINCES, ATTORNEY_TYPES, PRACTICE_AREAS, PITCH_STATUSES, COMMENT_OPTIONS, MEETING_STATUSES };
