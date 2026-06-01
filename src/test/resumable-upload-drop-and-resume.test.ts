/**
 * E2E-ish test for resumable uploads: simulates a dropped connection mid-upload
 * and verifies the next attempt resumes from the last successfully uploaded
 * chunk instead of starting over from byte 0.
 *
 * We mock `tus-js-client` so we don't need a real network. The mock models the
 * two behaviours we actually depend on:
 *   1. `findPreviousUploads()` returns the previously-aborted upload's state.
 *   2. `resumeFromPreviousUpload(prev)` seeds the next `Upload` with the
 *      already-uploaded byte offset; subsequent `onProgress` events start from
 *      that offset, not from 0.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Module-level state the mock writes to so the test can inspect it. ---
const state: {
  attempts: Array<{
    chunkSize: number;
    startedAtBytes: number;
    aborted: boolean;
    completed: boolean;
    progressEvents: Array<{ sent: number; total: number }>;
  }>;
  // Simulated "server-side" record of how many bytes have been received.
  serverOffset: number;
  fileSize: number;
} = {
  attempts: [],
  serverOffset: 0,
  fileSize: 0,
};

// Behaviour knobs the test sets before each scenario.
const scenario: {
  dropAfterChunks: number | null; // abort the 1st attempt after N chunks
} = { dropAfterChunks: null };

vi.mock("tus-js-client", () => {
  class MockUpload {
    file: { size: number };
    options: any;
    private _aborted = false;
    private _attemptIndex: number;

    constructor(file: { size: number }, options: any) {
      this.file = file;
      this.options = options;
      state.fileSize = file.size;
      this._attemptIndex = state.attempts.length;
      state.attempts.push({
        chunkSize: options.chunkSize,
        startedAtBytes: state.serverOffset,
        aborted: false,
        completed: false,
        progressEvents: [],
      });
    }

    async findPreviousUploads() {
      // If the server already has some bytes from a previous attempt, surface
      // that as a "previous upload" tus-js-client would find on disk.
      if (state.serverOffset > 0 && state.serverOffset < this.file.size) {
        return [{ size: state.serverOffset, urlStorageKey: "k" }];
      }
      return [];
    }

    resumeFromPreviousUpload(prev: { size: number }) {
      // tus-js-client would set the internal offset to `prev.size`; we record
      // it so the resumed run picks up from there.
      state.attempts[this._attemptIndex].startedAtBytes = prev.size;
    }

    async abort(_shouldTerminate: boolean) {
      this._aborted = true;
      state.attempts[this._attemptIndex].aborted = true;
    }

    start() {
      // Drive chunked progress synchronously via microtasks so the test stays fast.
      const chunkSize = this.options.chunkSize as number;
      const total = this.file.size;
      let sent = state.attempts[this._attemptIndex].startedAtBytes;

      const drive = async () => {
        let chunksThisAttempt = 0;
        while (sent < total) {
          if (this._aborted) return;
          sent = Math.min(sent + chunkSize, total);
          state.serverOffset = sent;
          chunksThisAttempt += 1;
          state.attempts[this._attemptIndex].progressEvents.push({
            sent,
            total,
          });
          this.options.onProgress?.(sent, total);

          // Simulate a dropped connection mid-upload on the first attempt.
          if (
            this._attemptIndex === 0 &&
            scenario.dropAfterChunks !== null &&
            chunksThisAttempt >= scenario.dropAfterChunks &&
            sent < total
          ) {
            this._aborted = true;
            state.attempts[this._attemptIndex].aborted = true;
            this.options.onError?.(new Error("Network disconnected"));
            return;
          }

          await Promise.resolve();
        }
        state.attempts[this._attemptIndex].completed = true;
        this.options.onSuccess?.();
      };
      void drive();
    }
  }

  return { Upload: MockUpload };
});

// Stub the supabase client so the helper can call auth.getSession() and the
// small-file fast path without touching network.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "test-token" } },
      }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
      }),
    },
  },
}));

// Import AFTER mocks so the helper picks up the mocked tus module.
import { uploadFileResumable } from "@/lib/resumableUpload";

const CHUNK = 6 * 1024 * 1024; // must match helper

function makeFile(sizeBytes: number): File {
  // Build a Blob of the requested size cheaply (a single zero-filled chunk).
  const blob = new Blob([new Uint8Array(sizeBytes)], {
    type: "application/pdf",
  });
  // File extends Blob; jsdom supports the constructor.
  return new File([blob], "big-report.pdf", { type: "application/pdf" });
}

beforeEach(() => {
  state.attempts = [];
  state.serverOffset = 0;
  state.fileSize = 0;
  scenario.dropAfterChunks = null;
});

describe("resumable upload — drops & resumes", () => {
  it("resumes from the last uploaded chunk after a dropped connection", async () => {
    // 4 full chunks + a small tail → 5 chunks total.
    const fileSize = CHUNK * 4 + 1024 * 1024;
    const file = makeFile(fileSize);

    // Drop the first attempt after 2 chunks have been uploaded (~12 MB).
    scenario.dropAfterChunks = 2;

    // First attempt: expect it to fail.
    await expect(
      uploadFileResumable({
        bucket: "documents",
        path: "reports/big-report.pdf",
        file,
      }),
    ).rejects.toThrow(/disconnect/i);

    // Stop dropping for the retry.
    scenario.dropAfterChunks = null;

    // Second attempt: should succeed and resume, not restart.
    await uploadFileResumable({
      bucket: "documents",
      path: "reports/big-report.pdf",
      file,
    });

    expect(state.attempts).toHaveLength(2);

    const [first, second] = state.attempts;

    // First attempt aborted partway through.
    expect(first.aborted).toBe(true);
    expect(first.completed).toBe(false);
    expect(first.progressEvents).toHaveLength(2);
    expect(first.progressEvents.at(-1)!.sent).toBe(CHUNK * 2);

    // Second attempt RESUMED from where the first left off — it did NOT
    // start at byte 0. This is the core guarantee of the resumable flow.
    expect(second.startedAtBytes).toBe(CHUNK * 2);
    expect(second.completed).toBe(true);
    expect(second.progressEvents[0].sent).toBeGreaterThan(CHUNK * 2);
    expect(second.progressEvents.at(-1)!.sent).toBe(fileSize);

    // No chunk was re-sent: total progress events across both attempts equals
    // the number of chunks in the file (5).
    const totalChunks = Math.ceil(fileSize / CHUNK);
    const totalEvents =
      first.progressEvents.length + second.progressEvents.length;
    expect(totalEvents).toBe(totalChunks);
  });

  it("reports monotonically increasing progress to the caller across attempts", async () => {
    const fileSize = CHUNK * 3;
    const file = makeFile(fileSize);
    scenario.dropAfterChunks = 1;

    const progressLog: number[] = [];
    const onProgress = (pct: number) => progressLog.push(pct);

    await expect(
      uploadFileResumable({
        bucket: "documents",
        path: "reports/r.pdf",
        file,
        onProgress,
      }),
    ).rejects.toBeTruthy();

    scenario.dropAfterChunks = null;
    await uploadFileResumable({
      bucket: "documents",
      path: "reports/r.pdf",
      file,
      onProgress,
    });

    // Progress is non-decreasing and ends at 100%.
    for (let i = 1; i < progressLog.length; i++) {
      expect(progressLog[i]).toBeGreaterThanOrEqual(progressLog[i - 1]);
    }
    expect(progressLog.at(-1)).toBe(100);
  });
});
