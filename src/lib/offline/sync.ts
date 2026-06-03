import { supabase } from "@/integrations/supabase/client";
import {
  deleteQueued,
  listQueue,
  updateQueued,
  type QueuedMutation,
} from "./db";

/**
 * Registered mutation handlers. Each safe-module handler registers itself here
 * so the sync engine can replay queued offline mutations when back online.
 *
 * Handlers MUST be idempotent (last-write-wins) since the same mutation may
 * be retried after partial failures.
 */
export type MutationHandler = (payload: unknown) => Promise<void>;

const handlers = new Map<string, MutationHandler>();

export function registerMutationHandler(type: string, handler: MutationHandler) {
  handlers.set(type, handler);
}

export function hasHandler(type: string) {
  return handlers.has(type);
}

// Default handler for generic Supabase inserts queued from offline.
// Payload shape: { table: string, values: Record<string, unknown> }
registerMutationHandler("supabase.insert", async (payload) => {
  const p = payload as { table: string; values: Record<string, unknown> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)(p.table).insert(p.values);
  if (error) throw error;
});

// Generic Supabase update: { table, match: {col: val}, values }
registerMutationHandler("supabase.update", async (payload) => {
  const p = payload as {
    table: string;
    match: Record<string, unknown>;
    values: Record<string, unknown>;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from as any)(p.table)
    .update(p.values)
    .match(p.match);
  if (error) throw error;
});

const MAX_ATTEMPTS = 8;
let syncing = false;

export interface SyncResult {
  processed: number;
  failed: number;
  remaining: number;
}

/**
 * Drain the queue. Safe to call repeatedly; one drain runs at a time.
 * Returns summary so the UI can toast success/failure.
 */
export async function syncQueue(): Promise<SyncResult> {
  if (syncing) return { processed: 0, failed: 0, remaining: 0 };
  syncing = true;
  let processed = 0;
  let failed = 0;
  try {
    if (!navigator.onLine) {
      const q = await listQueue();
      return { processed: 0, failed: 0, remaining: q.length };
    }
    const queue = (await listQueue()).sort((a, b) => a.createdAt - b.createdAt);
    for (const item of queue) {
      const handler = handlers.get(item.type);
      if (!handler) {
        // Unknown handler — leave in queue, will retry once handler registers
        failed++;
        continue;
      }
      try {
        await handler(item.payload);
        if (item.id != null) await deleteQueued(item.id);
        processed++;
      } catch (err) {
        const updated: QueuedMutation = {
          ...item,
          attempts: item.attempts + 1,
          lastError: err instanceof Error ? err.message : String(err),
        };
        if (updated.attempts >= MAX_ATTEMPTS) {
          // Give up after MAX_ATTEMPTS so the queue doesn't grow forever.
          // Keep it in queue but flagged — UI shows lastError to user.
          await updateQueued(updated);
        } else {
          await updateQueued(updated);
        }
        failed++;
      }
    }
    const remaining = (await listQueue()).length;
    return { processed, failed, remaining };
  } finally {
    syncing = false;
  }
}

let retryTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Install global online/visibility listeners that auto-drain the queue.
 * Idempotent — safe to call multiple times.
 */
let installed = false;
export function installSyncListeners() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const trigger = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => void syncQueue(), 500);
  };

  window.addEventListener("online", trigger);
  window.addEventListener("focus", trigger);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") trigger();
  });

  // Periodic retry every 60s while there's a queue
  setInterval(() => {
    if (navigator.onLine) void syncQueue();
  }, 60_000);

  // Initial drain on load
  trigger();
}
