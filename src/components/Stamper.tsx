import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Image, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { enqueueFrame, saveFrame, stampQueue, stampTextFor, type FrameJob } from '@/services/media';
import { settingsStore } from '@/store/settings';

import { StampOverlay } from './StampOverlay';

const VIEW_W = 360; // logical width of the off-screen render
const MAX_OUT_W = 1920;

/**
 * Burns the timestamp into photos. Renders one queued photo at a time behind the
 * app's screens, snapshots it with view-shot and saves the result. Works in Expo Go.
 */
export function Stamper() {
  const job = stampQueue.use((s) => s.jobs[0]);
  const ref = useRef<ComponentRef<typeof View>>(null);
  // Which queued photo has finished loading into the off-screen view.
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const loaded = !!job && loadedUri === job.rawUri;

  useEffect(() => {
    if (!job || !loaded) return;
    let cancelled = false;
    const run = async () => {
      // Let the image and overlay finish layout before the snapshot.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelled) return;
      try {
        const outW = Math.min(job.width, MAX_OUT_W);
        const uri = await captureRef(ref, {
          format: 'jpg',
          quality: settingsStore.get().photoQuality,
          width: outW,
          height: Math.round((outW * job.height) / job.width),
          result: 'tmpfile',
        });
        await saveFrame(job, uri);
      } catch (e) {
        console.warn('stamp failed, saving original', e);
        await saveFrame(job, job.rawUri).catch(() => undefined);
      }
      stampQueue.set((s) => ({ jobs: s.jobs.slice(1) }));
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [job, loaded]);

  if (!job) return null;
  const h = Math.round((VIEW_W * job.height) / job.width);
  const scale = Math.min(VIEW_W, h) / 330;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, zIndex: -1 }}>
      <View ref={ref} collapsable={false} style={{ width: VIEW_W, height: h, backgroundColor: '#000' }}>
        <Image source={{ uri: job.rawUri }} style={{ width: VIEW_W, height: h }} resizeMode="cover" onLoad={() => setLoadedUri(job.rawUri)} onError={() => setLoadedUri(job.rawUri)} />
        <StampOverlay {...stampTextFor(job)} scale={scale} style={{ position: 'absolute', left: 8 * scale, bottom: 8 * scale }} />
      </View>
    </View>
  );
}

export type { FrameJob };
export { enqueueFrame };
