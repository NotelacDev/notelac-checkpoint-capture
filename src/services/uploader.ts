import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { File, UploadType } from 'expo-file-system';

import { capturesStore, updateCapture, type Capture } from '@/store/captures';
import { createStore } from '@/store/createStore';
import { settingsStore } from '@/store/settings';

const CONCURRENCY = 2;
const MAX_ATTEMPTS = 10;
const RETRY_MS = 30_000;

export const netStore = createStore({ online: true, type: 'unknown' as string, checkedAt: 0 });

const inFlight = new Set<string>();
let started = false;

function canUpload() {
  const { online, type } = netStore.get();
  const { wifiOnly, uploadsPaused } = settingsStore.get();
  if (!online || uploadsPaused) return false;
  if (wifiOnly && type !== 'wifi' && type !== 'ethernet') return false;
  return true;
}

/** Demo mode (no server URL): pretend to upload so the whole flow can be tried in Expo Go. */
async function simulate(c: Capture) {
  for (let p = 0.2; p < 1; p += 0.2) {
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 250));
    updateCapture(c.id, { progress: p });
  }
  if (Math.random() < 0.03) throw new Error('Simulated network timeout');
}

async function send(c: Capture) {
  const { apiUrl, apiToken } = settingsStore.get();
  if (!apiUrl) return simulate(c);
  const meta = new File(c.metaUri);
  const metadata = meta.exists ? await meta.text() : '{}';
  updateCapture(c.id, { progress: 0.3 });
  const res = await new File(c.uri).upload(`${apiUrl.replace(/\/$/, '')}/captures`, {
    uploadType: UploadType.MULTIPART,
    fieldName: 'file',
    mimeType: c.kind === 'photo' ? 'image/jpeg' : 'video/mp4',
    parameters: { metadata, captureId: c.id, checkpointId: c.checkpointId, capturedAt: String(c.capturedAt) },
    headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : undefined,
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`Server returned ${res.status}`);
}

async function uploadOne(c: Capture) {
  inFlight.add(c.id);
  updateCapture(c.id, { status: 'uploading', progress: 0.05, attempts: c.attempts + 1, error: undefined });
  try {
    await send(c);
    updateCapture(c.id, { status: 'uploaded', progress: 1, uploadedAt: Date.now(), nextRetryAt: undefined });
    if (!settingsStore.get().keepLocal && c.kind === 'photo') {
      // The uploaded file can go; the record stays for history and the summary.
      try {
        new File(c.uri).delete();
      } catch {
        // already removed
      }
      updateCapture(c.id, { uri: '' });
    }
  } catch (e) {
    const attempts = c.attempts + 1;
    const retry = settingsStore.get().autoRetry && attempts < MAX_ATTEMPTS;
    updateCapture(c.id, {
      status: 'failed',
      progress: 0,
      error: e instanceof Error ? e.message : String(e),
      nextRetryAt: retry ? Date.now() + RETRY_MS : undefined,
    });
  } finally {
    inFlight.delete(c.id);
  }
}

function tick() {
  const t = Date.now();
  // Failed items whose retry time has come go back to the queue.
  const due = capturesStore.get().captures.filter((c) => c.status === 'failed' && c.nextRetryAt && c.nextRetryAt <= t);
  due.forEach((c) => updateCapture(c.id, { status: 'pending', nextRetryAt: undefined }));

  if (!canUpload()) return;
  const free = CONCURRENCY - inFlight.size;
  if (free <= 0) return;
  // Oldest first so the server receives captures in time order.
  const queue = capturesStore
    .get()
    .captures.filter((c) => c.status === 'pending' && !inFlight.has(c.id) && c.uri)
    .sort((a, b) => a.capturedAt - b.capturedAt)
    .slice(0, free);
  queue.forEach((c) => void uploadOne(c));
}

export function startUploader() {
  if (started) return;
  started = true;
  NetInfo.addEventListener((s: NetInfoState) => {
    netStore.set({ online: !!s.isConnected && s.isInternetReachable !== false, type: s.type, checkedAt: Date.now() });
  });
  setInterval(tick, 1000);
}
