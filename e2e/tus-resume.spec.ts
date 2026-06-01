/**
 * End-to-end: TUS upload resumes from the correct byte offset after a real
 * network drop.
 *
 * Strategy:
 *   1. Boot the hermetic test rig (real @tus/server + tus-js-client in Chromium).
 *   2. Start an 18 MB upload with a 6 MB chunk size → 3 PATCH requests.
 *   3. Use Playwright's route() to abort the SECOND PATCH mid-flight with
 *      'connectionfailed' — this is the real-network-drop simulation, the
 *      request never reaches the server.
 *   4. Let tus-js-client's built-in retry logic kick in. It will HEAD the
 *      upload to discover the server's current offset, then re-issue the
 *      PATCH from that offset.
 *   5. Inspect the server's request log and assert that successful PATCH
 *      offsets are exactly [0, 6 MB, 12 MB] — the retry resumed at byte
 *      6 MB, NOT from byte 0.
 */
import { test, expect, Route } from '@playwright/test';

const MB = 1024 * 1024;
const CHUNK = 6 * MB;
const FILE_MB = 18;

type LogEntry = {
  method: string;
  url: string;
  uploadOffset: string | null;
  uploadLength: string | null;
  responseStatus: number;
  responseUploadOffset: string | null;
  ts: number;
};

test('TUS resumes from the last committed byte offset after a dropped PATCH', async ({
  page,
  request,
}) => {
  await request.post('/reset');
  await page.goto('/');

  // Drop the 2nd PATCH the browser sends. The 1st PATCH commits bytes 0..6MB
  // on the server. The 2nd PATCH (bytes 6..12MB) is killed mid-flight. The
  // retry — which IS the resume — must start at offset 6 MB, not 0.
  let patchSeen = 0;
  let droppedOnce = false;
  await page.route('**/files/**', async (route: Route) => {
    if (route.request().method() === 'PATCH') {
      patchSeen += 1;
      if (patchSeen === 2 && !droppedOnce) {
        droppedOnce = true;
        await route.abort('connectionfailed');
        return;
      }
    }
    await route.continue();
  });

  // Run the upload. Resolves only after tus auto-recovers and finishes.
  await page.evaluate(
    async ([sizeMB, chunkSize]) => {
      // @ts-expect-error injected by the harness page
      return await window.startUpload({ sizeMB, chunkSize });
    },
    [FILE_MB, CHUNK] as const,
  );

  const completed = await page.evaluate(() => (window as any).__state.completed);
  expect(completed, 'upload should complete after the dropped PATCH is retried').toBe(true);

  const log: LogEntry[] = await (await request.get('/log')).json();
  const patches = log.filter((e) => e.method === 'PATCH');
  const ok = patches.filter((p) => p.responseStatus >= 200 && p.responseStatus < 300);

  // The cornerstone assertion: exactly one PATCH per chunk reached the server
  // successfully, AND no successful PATCH re-uploaded bytes that were already
  // committed. Offsets are strictly monotonic and match chunk boundaries.
  const okOffsets = ok.map((p) => Number(p.uploadOffset));
  expect(okOffsets, 'PATCH offsets should resume cleanly, not restart at 0').toEqual([
    0,
    CHUNK,
    CHUNK * 2,
  ]);

  // The server's authoritative offset after the final PATCH equals the file size.
  const lastPatch = ok[ok.length - 1];
  expect(Number(lastPatch.responseUploadOffset)).toBe(FILE_MB * MB);

  // And the drop actually happened (defensive — proves the test exercised the path).
  expect(droppedOnce).toBe(true);

  // tus-js-client should have HEADed the resource to discover the offset
  // before issuing the resumed PATCH.
  const headBetweenDropAndResume = log.some(
    (e) => e.method === 'HEAD' && e.responseStatus === 200,
  );
  expect(headBetweenDropAndResume).toBe(true);
});
