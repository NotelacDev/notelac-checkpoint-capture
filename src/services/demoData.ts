import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

import { findCheckpoint } from '@/data/checkpoints';
import { DEMO_PHOTO_SIZE, DEMO_RUNNERS } from '@/data/demo';
import { capturesStore, newId, type Session, type UploadStatus } from '@/store/captures';
import { settingsStore } from '@/store/settings';

import { enqueueFrame, stampQueue } from './media';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

type Plan = {
  checkpointId: string;
  startedAt: number;
  endedAt?: number;
  bursts: { at: number; status: UploadStatus }[];
};

/**
 * Adds three sample sessions (3 days ago, yesterday, and a live one today) built from the
 * bundled runner photos. Every frame goes through the normal stamper, so the photos get the
 * same burned-in timestamp as real captures. Returns the number of frames queued.
 */
export async function loadDemoData() {
  const operator = settingsStore.get().operator ?? 'demo';
  const checkpointId = settingsStore.get().checkpointId ?? 'CP-03';
  const now = Date.now();

  const plans: Plan[] = [
    {
      checkpointId: 'CP-01',
      startedAt: now - 3 * DAY - 2 * 60 * MIN,
      endedAt: now - 3 * DAY + 70 * MIN,
      bursts: [0, 1, 2].map((i) => ({ at: now - 3 * DAY - 100 * MIN + i * 25 * MIN, status: 'uploaded' })),
    },
    {
      checkpointId: 'CP-03',
      startedAt: now - DAY - 3 * 60 * MIN,
      endedAt: now - DAY,
      bursts: [0, 1, 2, 3, 4, 5].map((i) => ({ at: now - DAY - 160 * MIN + i * 24 * MIN, status: i === 4 ? 'failed' : 'uploaded' })),
    },
    {
      checkpointId,
      startedAt: now - 42 * MIN,
      bursts: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
        at: now - 40 * MIN + i * 4.6 * MIN,
        status: i === 6 ? 'failed' : i >= 7 ? 'pending' : 'uploaded',
      })),
    },
  ];

  // Resolve the bundled photos to local files once.
  const assets = await Promise.all(DEMO_RUNNERS.map((r) => Asset.loadAsync(r.frames)));

  const sessions: Session[] = plans.map((p) => ({
    id: newId(),
    checkpointId: p.checkpointId,
    operator,
    startedAt: p.startedAt,
    endedAt: p.endedAt,
    participants: p.bursts.length,
  }));

  capturesStore.set((s) => ({
    sessions: [sessions[2], ...s.sessions, sessions[1], sessions[0]].sort((a, b) => b.startedAt - a.startedAt),
    // Make today's sample session the live one unless a real session is already running.
    activeSessionId: s.activeSessionId ?? sessions[2].id,
  }));

  let queued = 0;
  plans.forEach((p, si) => {
    const cp = findCheckpoint(p.checkpointId);
    p.bursts.forEach((b, bi) => {
      const runner = bi % DEMO_RUNNERS.length;
      const frames = assets[runner];
      frames.forEach((asset, fi) => {
        if (!asset.localUri) return;
        // The stamper consumes (moves/deletes) its input, so give it a copy.
        const copy = new File(Paths.cache, `demo_${newId()}.jpg`);
        new File(asset.localUri).copy(copy);
        const capturedAt = b.at + fi * 118;
        enqueueFrame({
          rawUri: copy.uri,
          width: DEMO_PHOTO_SIZE.width,
          height: DEMO_PHOTO_SIZE.height,
          capturedAt,
          deviceTime: capturedAt - 12,
          sessionId: sessions[si].id,
          checkpointId: p.checkpointId,
          operator,
          participant: bi + 1,
          frame: fi + 1,
          frames: frames.length,
          lat: cp ? cp.lat + (Math.random() - 0.5) * 0.0002 : undefined,
          lng: cp ? cp.lng + (Math.random() - 0.5) * 0.0002 : undefined,
          seed: {
            status: b.status,
            uploadedAt: b.status === 'uploaded' ? capturedAt + 2400 : undefined,
            error: b.status === 'failed' ? 'Server timed out (sample data)' : undefined,
            bib: b.status === 'uploaded' ? DEMO_RUNNERS[runner].bib : undefined,
          },
        });
        queued++;
      });
    });
  });
  return queued;
}

/** Deletes every session, capture and local file on this phone. */
export function clearAllData() {
  stampQueue.set({ jobs: [] });
  try {
    const dir = new Directory(Paths.document, 'notelac');
    if (dir.exists) dir.delete();
  } catch (e) {
    console.warn('clear failed', e);
  }
  capturesStore.set({ captures: [], sessions: [], activeSessionId: null });
}
