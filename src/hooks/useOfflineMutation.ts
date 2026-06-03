import { useCallback } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { enqueueMutation } from "@/lib/offline/db";
import { syncQueue } from "@/lib/offline/sync";

/**
 * useOfflineMutation
 *
 * Wraps a mutation so it works online AND offline.
 *  - Online  → executes immediately via `online()`.
 *  - Offline → enqueues a `{ type, payload }` job in IndexedDB; replayed
 *               automatically when connectivity returns.
 *
 * Register a matching handler via `registerMutationHandler(type, ...)` in
 * `src/lib/offline/sync.ts` so the queue knows how to replay the job.
 *
 * Returns `{ run, isOnline }`. `run` resolves with:
 *   { queued: true }  when stored offline
 *   { queued: false } when executed online
 */
export function useOfflineMutation<TPayload>(opts: {
  type: string;
  online: (payload: TPayload) => Promise<void>;
  describe?: (payload: TPayload) => string;
}) {
  const isOnline = useOnlineStatus();

  const run = useCallback(
    async (
      payload: TPayload,
    ): Promise<{ queued: boolean; error?: string }> => {
      if (navigator.onLine) {
        try {
          await opts.online(payload);
          // Also drain the queue opportunistically
          void syncQueue();
          return { queued: false };
        } catch (err) {
          // If the online call fails, fall through to queue so the user
          // doesn't lose the change.
          await enqueueMutation({
            type: opts.type,
            payload: payload as unknown,
            description: opts.describe?.(payload),
          });
          return {
            queued: true,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }
      await enqueueMutation({
        type: opts.type,
        payload: payload as unknown,
        description: opts.describe?.(payload),
      });
      return { queued: true };
    },
    [opts],
  );

  return { run, isOnline };
}
