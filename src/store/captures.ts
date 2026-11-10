import { Directory, File, Paths } from 'expo-file-system';

import { createStore, jsonFile } from './createStore';

export type UploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export type Capture = {
  id: string;
  kind: 'photo' | 'video';
  /** Local file (stamped JPG for photos, MP4/MOV for videos). */
  uri: string;
  /** Sidecar JSON with the full metadata (always uploaded alongside). */
  metaUri: string;
  /** Capture time in ms since epoch, already corrected by the server time offset. */
  capturedAt: number;
  /** Raw device clock at capture, for audit. */
  deviceTime: number;
  tz: string;
  tzOffsetMin: number;
  checkpointId: string;
  sessionId: string;
  operator: string;
  /** Participant counter within the session (one per burst / video marker). */
  participant?: number;
  frame?: number;
  frames?: number;
  durationMs?: number;
  /** Video: participant markers as ms offsets from capturedAt. */
  markers?: number[];
  width?: number;
  height?: number;
  size: number;
  lat?: number;
  lng?: number;
  bib?: string;
  status: UploadStatus;
  progress: number;
  attempts: number;
  nextRetryAt?: number;
  error?: string;
  uploadedAt?: number;
};

export type Session = {
  id: string;
  checkpointId: string;
  operator: string;
  startedAt: number;
  endedAt?: number;
  participants: number;
};

type State = {
  captures: Capture[];
  sessions: Session[];
  activeSessionId: string | null;
  /** serverTime - deviceTime in ms. 0 until synced. */
  timeOffsetMs: number;
  timeSyncedAt: number | null;
};

export const capturesStore = createStore<State>(
  { captures: [], sessions: [], activeSessionId: null, timeOffsetMs: 0, timeSyncedAt: null },
  jsonFile('notelac/index.json'),
  // An upload that was in flight when the app closed goes back to the queue.
  (s) => ({ ...s, captures: s.captures.map((c) => (c.status === 'uploading' ? { ...c, status: 'pending', progress: 0 } : c)) }),
);

export const useCaptures = <S>(sel: (s: State) => S) => capturesStore.use(sel);

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Folder for one session's media: <documents>/notelac/<sessionId>/ */
export function sessionDir(sessionId: string) {
  const d = new Directory(Paths.document, 'notelac', sessionId);
  d.create({ idempotent: true, intermediates: true });
  return d;
}

export function startSession(checkpointId: string, operator: string) {
  const s = capturesStore.get();
  const open = s.sessions.find((x) => x.id === s.activeSessionId && !x.endedAt && x.checkpointId === checkpointId);
  if (open) return open.id;
  const session: Session = { id: newId(), checkpointId, operator, startedAt: Date.now(), participants: 0 };
  capturesStore.set({ sessions: [session, ...s.sessions], activeSessionId: session.id });
  return session.id;
}

export function endSession(id: string) {
  capturesStore.set((s) => ({
    sessions: s.sessions.map((x) => (x.id === id ? { ...x, endedAt: Date.now() } : x)),
    activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
  }));
}

/** Next participant number for a session (one per burst or video marker). */
export function nextParticipant(sessionId: string) {
  let n = 0;
  capturesStore.set((s) => ({
    sessions: s.sessions.map((x) => {
      if (x.id !== sessionId) return x;
      n = x.participants + 1;
      return { ...x, participants: n };
    }),
  }));
  return n;
}

export function addCapture(c: Capture) {
  capturesStore.set((s) => ({ captures: [c, ...s.captures] }));
}

export function updateCapture(id: string, patch: Partial<Capture>) {
  capturesStore.set((s) => ({ captures: s.captures.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
}

export function deleteLocalFiles(c: Capture) {
  for (const uri of [c.uri, c.metaUri]) {
    try {
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch {
      // already gone
    }
  }
}

export function retryFailed() {
  capturesStore.set((s) => ({
    captures: s.captures.map((c) => (c.status === 'failed' ? { ...c, status: 'pending', nextRetryAt: undefined, error: undefined } : c)),
  }));
}
