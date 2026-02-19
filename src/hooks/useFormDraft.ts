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
 * Usage:
 *   const { draft, setDraft, clearDraft, hasDraft } = useFormDraft<MyFormType>('new-appointment', defaultValues);
 *
 *   // Whenever form state changes:
 *   setDraft(currentFormData);
 *
 *   // On successful submit:
 *   clearDraft();
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

function readDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    if (!raw) return null;
    const meta: DraftMeta<T> = JSON.parse(raw);
    if (Date.now() - meta.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(DRAFT_PREFIX + key);
      return null;
    }
    return meta.data;
  } catch {
    return null;
  }
}

function writeDraft<T>(key: string, data: T) {
  try {
    const meta: DraftMeta<T> = { data, savedAt: Date.now(), version: 1 };
    localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(meta));
  } catch {
    // storage quota exceeded – silently ignore
  }
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
  const [draft, setDraftState] = useState<T>(() => {
    const saved = readDraft<T>(formKey);
    return saved ?? defaultValues;
  });

  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    return readDraft<T>(formKey) !== null;
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraft = useRef<T>(draft);

  // Persist on change (debounced)
  const setDraft = useCallback((data: T | ((prev: T) => T)) => {
    setDraftState(prev => {
      const next = typeof data === 'function' ? data(prev) : data;
      latestDraft.current = next;

      // Lock the sync context so realtime events don't refresh the page
      lockPage();

      // Debounced write to localStorage
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        writeDraft(formKey, next);
        setHasDraft(true);
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
  }, [formKey, defaultValues]);

  // Restore draft when tab regains focus (user switches back)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) {
        const saved = readDraft<T>(formKey);
        if (saved) {
          setDraftState(saved);
          latestDraft.current = saved;
          setHasDraft(true);
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

  // Warn before unload when draft exists
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasDraft) {
        e.preventDefault();
        e.returnValue = 'You have unsaved form data. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDraft]);

  return { draft, setDraft, clearDraft, hasDraft };
}
