/**
 * useFormDraft – Universal form draft persistence hook.
 *
 * Saves form data to localStorage on every change (debounced 400ms).
 * Restores the draft when the component mounts OR when the browser tab
 * becomes visible again (user switches back). Drafts expire after 24 h.
 *
 * Also locks the AppointmentSyncContext while the form has unsaved data so
 * no background realtime refresh can clobber the user's in-progress work.
 *
 * Exposes `saveStatus` ('idle' | 'saving' | 'saved') and `lastSavedAt`
 * (Date | null) for UI indicators.
 *
 * Usage:
 *   const { draft, setDraft, clearDraft, hasDraft, saveStatus, lastSavedAt } =
 *     useFormDraft<MyFormType>('new-appointment', defaultValues);
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';

const DRAFT_PREFIX = 'form_draft_v2_';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEBOUNCE_MS = 400;

interface DraftMeta<T> {
  data: T;
  savedAt: number; // epoch ms
  version: number;
}

export type DraftSaveStatus = 'idle' | 'saving' | 'saved';

function readDraftMeta<T>(key: string): DraftMeta<T> | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    if (!raw) return null;
    const meta: DraftMeta<T> = JSON.parse(raw);
    if (Date.now() - meta.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(DRAFT_PREFIX + key);
      return null;
    }
    return meta;
  } catch {
    return null;
  }
}

function readDraft<T>(key: string): T | null {
  return readDraftMeta<T>(key)?.data ?? null;
}

function writeDraft<T>(key: string, data: T): number {
  const savedAt = Date.now();
  try {
    const meta: DraftMeta<T> = { data, savedAt, version: 1 };
    localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(meta));
  } catch {
    // storage quota exceeded – silently ignore
  }
  return savedAt;
}

function removeDraft(key: string) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch { /* empty */ }
}

export function useFormDraft<T extends Record<string, any>>(
  formKey: string,
  defaultValues: T
) {
  const { lockPage } = useAppointmentSync();

  // Initialise from localStorage draft immediately (synchronous read)
  const initialMeta = readDraftMeta<T>(formKey);
  const [draft, setDraftState] = useState<T>(initialMeta?.data ?? defaultValues);
  const [hasDraft, setHasDraft] = useState<boolean>(initialMeta !== null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(
    initialMeta ? new Date(initialMeta.savedAt) : null
  );
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>(
    initialMeta ? 'saved' : 'idle'
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraft = useRef<T>(draft);

  // Persist on change (debounced)
  const setDraft = useCallback((data: T | ((prev: T) => T)) => {
    setDraftState(prev => {
      const next = typeof data === 'function' ? data(prev) : data;
      latestDraft.current = next;

      // Lock the sync context so realtime events don't refresh the page
      lockPage();
      setSaveStatus('saving');

      // Debounced write to localStorage
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const savedAt = writeDraft(formKey, next);
        setHasDraft(true);
        setLastSavedAt(new Date(savedAt));
        setSaveStatus('saved');
      }, DEBOUNCE_MS);

      return next;
    });
  }, [formKey, lockPage]);

  // Wipe the draft (call after successful submit)
  const clearDraft = useCallback(() => {
    removeDraft(formKey);
    setHasDraft(false);
    setDraftState(defaultValues);
    latestDraft.current = defaultValues;
    setLastSavedAt(null);
    setSaveStatus('idle');
  }, [formKey, defaultValues]);

  // Restore draft when tab regains focus (user switches back)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) {
        const meta = readDraftMeta<T>(formKey);
        if (meta) {
          setDraftState(meta.data);
          latestDraft.current = meta.data;
          setHasDraft(true);
          setLastSavedAt(new Date(meta.savedAt));
          setSaveStatus('saved');
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [formKey]);

  // Flush pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        // Write immediately on unmount if there's pending data
        writeDraft(formKey, latestDraft.current);
      }
    };
  }, [formKey]);

  return { draft, setDraft, clearDraft, hasDraft, lastSavedAt, saveStatus };
}
