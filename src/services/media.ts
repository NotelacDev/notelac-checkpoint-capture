import { File } from 'expo-file-system';

import { findCheckpoint } from '@/data/checkpoints';
import { addCapture, newId, sessionDir, type Capture, type UploadStatus } from '@/store/captures';
import { createStore } from '@/store/createStore';
import { settingsStore } from '@/store/settings';

import { fileStamp, stampLine, tzLabel, utcOffset } from './time';

export type FrameJob = {
  rawUri: string;
  width: number;
  height: number;
  capturedAt: number;
  deviceTime: number;
  sessionId: string;
  checkpointId: string;
  operator: string;
  participant: number;
  frame: number;
  frames: number;
  lat?: number;
  lng?: number;
  /** Sample data only: start the record in this upload state instead of "pending". */
  seed?: { status: UploadStatus; uploadedAt?: number; error?: string; bib?: string };
};

/** Photos waiting to get the burned-in timestamp (rendered by <Stamper/>). */
export const stampQueue = createStore<{ jobs: FrameJob[] }>({ jobs: [] });

export function enqueueFrame(job: FrameJob) {
  if (!settingsStore.get().overlay) {
    // No overlay wanted: store the camera file as it is.
    void saveFrame(job, job.rawUri);
    return;
  }
  stampQueue.set((s) => ({ jobs: [...s.jobs, job] }));
}

export function stampTextFor(j: { checkpointId: string; capturedAt: number; participant?: number; frame?: number; frames?: number; lat?: number; lng?: number; operator: string }) {
  const s = settingsStore.get();
  const cp = findCheckpoint(j.checkpointId);
  const gps = s.overlayGps && j.lat != null && j.lng != null ? ` · ${j.lat.toFixed(4)}, ${j.lng.toFixed(4)}` : '';
  return {
    title: `${j.checkpointId}${cp ? ` · ${cp.name.toUpperCase()}` : ''}${gps}`,
    time: stampLine(j.capturedAt, s.overlayMs),
    footer: j.participant != null ? `P#${j.participant} · F${j.frame}/${j.frames} · ${j.operator}` : j.operator,
  };
}

function metadataFor(c: Omit<Capture, 'metaUri' | 'size' | 'status' | 'progress' | 'attempts'>) {
  const cp = findCheckpoint(c.checkpointId);
  return {
    id: c.id,
    kind: c.kind,
    capturedAt: new Date(c.capturedAt).toISOString(),
    capturedAtMs: c.capturedAt,
    deviceTimeMs: c.deviceTime,
    timeZone: c.tz,
    utcOffset: utcOffset(new Date(c.capturedAt)),
    checkpoint: { id: c.checkpointId, name: cp?.name, lat: cp?.lat, lng: cp?.lng },
    gps: c.lat != null ? { lat: c.lat, lng: c.lng } : null,
    sessionId: c.sessionId,
    operator: c.operator,
    participant: c.participant ?? null,
    frame: c.frame ?? null,
    frames: c.frames ?? null,
    durationMs: c.durationMs ?? null,
    markersMs: c.markers ?? null,
    width: c.width ?? null,
    height: c.height ?? null,
  };
}

/** Move a finished file into the session folder, write its JSON sidecar, add the record. */
export async function saveFrame(job: FrameJob, sourceUri: string) {
  const dir = sessionDir(job.sessionId);
  const base = `${job.checkpointId.replace('-', '')}_${fileStamp(job.capturedAt)}_p${job.participant}_f${job.frame}`;
  const src = new File(sourceUri);
  const dest = new File(dir, `${base}.jpg`);
  src.move(dest);
  if (sourceUri !== job.rawUri) {
    try {
      const raw = new File(job.rawUri);
      if (raw.exists) raw.delete();
    } catch {
      // camera temp file already cleaned
    }
  }
  const id = newId();
  const partial = {
    id,
    kind: 'photo' as const,
    uri: dest.uri,
    capturedAt: job.capturedAt,
    deviceTime: job.deviceTime,
    tz: tzLabel(new Date(job.capturedAt)),
    tzOffsetMin: -new Date(job.capturedAt).getTimezoneOffset(),
    checkpointId: job.checkpointId,
    sessionId: job.sessionId,
    operator: job.operator,
    participant: job.participant,
    frame: job.frame,
    frames: job.frames,
    width: job.width,
    height: job.height,
    lat: job.lat,
    lng: job.lng,
  };
  const meta = new File(dir, `${base}.json`);
  meta.create({ overwrite: true });
  await meta.write(JSON.stringify(metadataFor(partial), null, 2));
  const seed = job.seed;
  addCapture({
    ...partial,
    metaUri: meta.uri,
    size: dest.size ?? 0,
    status: seed?.status ?? 'pending',
    progress: seed?.status === 'uploaded' ? 1 : 0,
    attempts: seed?.status === 'failed' ? 1 : 0,
    uploadedAt: seed?.uploadedAt,
    error: seed?.error,
    bib: seed?.bib,
  });
}

export async function saveVideo(v: {
  rawUri: string;
  startedAt: number;
  deviceTime: number;
  durationMs: number;
  markers: number[];
  sessionId: string;
  checkpointId: string;
  operator: string;
  lat?: number;
  lng?: number;
}) {
  const dir = sessionDir(v.sessionId);
  const ext = v.rawUri.split('.').pop() || 'mp4';
  const base = `${v.checkpointId.replace('-', '')}_${fileStamp(v.startedAt)}_video`;
  const dest = new File(dir, `${base}.${ext}`);
  new File(v.rawUri).move(dest);
  const id = newId();
  const partial = {
    id,
    kind: 'video' as const,
    uri: dest.uri,
    capturedAt: v.startedAt,
    deviceTime: v.deviceTime,
    tz: tzLabel(new Date(v.startedAt)),
    tzOffsetMin: -new Date(v.startedAt).getTimezoneOffset(),
    checkpointId: v.checkpointId,
    sessionId: v.sessionId,
    operator: v.operator,
    durationMs: v.durationMs,
    markers: v.markers,
    lat: v.lat,
    lng: v.lng,
  };
  const meta = new File(dir, `${base}.json`);
  meta.create({ overwrite: true });
  await meta.write(JSON.stringify(metadataFor(partial), null, 2));
  addCapture({ ...partial, metaUri: meta.uri, size: dest.size ?? 0, status: 'pending', progress: 0, attempts: 0 });
}
