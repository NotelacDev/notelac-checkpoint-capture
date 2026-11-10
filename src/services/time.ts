import { capturesStore } from '@/store/captures';
import { settingsStore } from '@/store/settings';

const pad = (n: number, w = 2) => String(Math.trunc(n)).padStart(w, '0');

/** Device clock corrected by the last server time sync. */
export const now = () => Date.now() + capturesStore.get().timeOffsetMs;

export function tzLabel(d = new Date()) {
  try {
    const part = new Intl.DateTimeFormat('en', { timeZoneName: 'short' }).formatToParts(d).find((p) => p.type === 'timeZoneName');
    // Android/Hermes often returns a bare "GMT" (or "GMT+5:30") instead of a name like "IST".
    // A bare GMT is only correct when the device really is at UTC+0, so fall back to the exact offset.
    if (part && !/^(GMT|UTC)/.test(part.value)) return part.value;
    if (part && d.getTimezoneOffset() === 0) return 'GMT';
  } catch {
    // Intl without timeZoneName support
  }
  return utcOffset(d);
}

export function utcOffset(d = new Date()) {
  const m = -d.getTimezoneOffset();
  const sign = m >= 0 ? '+' : '-';
  return `UTC${sign}${pad(Math.abs(m) / 60)}:${pad(Math.abs(m) % 60)}`;
}

export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hms = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
export const hmsMs = (d: Date) => `${hms(d)}.${pad(d.getMilliseconds(), 3)}`;
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function duration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(s / 3600)}:${pad((s / 60) % 60)}:${pad(s % 60)}`;
}

export const prettyDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** Overlay line burned into images: 2026-11-10 09:32:14.218 IST */
export function stampLine(t: number, withMs: boolean) {
  const d = new Date(t);
  return `${ymd(d)} ${withMs ? hmsMs(d) : hms(d)} ${tzLabel(d)}`;
}

/** File-name friendly time: 20261110_093214_218 */
export function fileStamp(t: number) {
  const d = new Date(t);
  return `${ymd(d).replace(/-/g, '')}_${hms(d).replace(/:/g, '')}_${pad(d.getMilliseconds(), 3)}`;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

/**
 * Sync with the race server clock. Expects GET {apiUrl}/time → { "epochMs": number }.
 * Uses half the round trip as the network delay estimate (NTP style).
 * Returns the offset, or null when no server is configured or the request fails.
 */
export async function syncTime(): Promise<number | null> {
  const { apiUrl, apiToken } = settingsStore.get();
  if (!apiUrl) return null;
  try {
    const t0 = Date.now();
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/time`, {
      headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : undefined,
    });
    const t1 = Date.now();
    if (!res.ok) return null;
    const body = (await res.json()) as { epochMs?: number };
    if (typeof body.epochMs !== 'number') return null;
    const offset = Math.round(body.epochMs + (t1 - t0) / 2 - t1);
    capturesStore.set({ timeOffsetMs: offset, timeSyncedAt: Date.now() });
    return offset;
  } catch {
    return null;
  }
}
