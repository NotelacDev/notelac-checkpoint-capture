import { CameraView, useMicrophonePermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { Redirect, useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import { LiveStamp } from '@/components/StampOverlay';
import { useNow } from '@/hooks/useNow';
import { Icon, Stat, T, type IconName } from '@/components/ui';
import { findCheckpoint } from '@/data/checkpoints';
import { enqueueFrame, saveVideo, stampQueue } from '@/services/media';
import { duration, hms, hmsMs, now, prettyDate, tzLabel } from '@/services/time';
import { netStore } from '@/services/uploader';
import { nextParticipant, useCaptures } from '@/store/captures';
import { useSettings } from '@/store/settings';
import { CAMERA_BG, INK, LIME, REC } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Mode = 'picture' | 'video';
const THRESHOLD = { low: 0.25, medium: 0.15, high: 0.08 } as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Big clock for the bottom sheet; owns its own timer so the camera never re-renders. */
function Clock() {
  const t = useTheme();
  const offset = useCaptures((x) => x.timeOffsetMs);
  const d = new Date(useNow(250, offset));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      <View style={{ gap: 2 }}>
        <T size={13} color={t.muted}>
          {prettyDate(d)}
        </T>
        <T f="monoB" size={34} style={{ letterSpacing: -0.6, lineHeight: 38 }}>
          {hms(d)}
        </T>
      </View>
      <View style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: t.card, borderWidth: 1, borderColor: t.line }}>
        <T f="mono" size={12}>
          {tzLabel(d)}
        </T>
      </View>
    </View>
  );
}

function Elapsed({ since, prefix }: { since: number; prefix: string }) {
  const t = useNow(500);
  return (
    <T f="monoB" size={12} color="#FFFFFF">
      {prefix} {duration(t - since)}
    </T>
  );
}

function Pill({ children, bg = 'rgba(14,15,16,0.6)', style }: { children: ReactNode; bg?: string; style?: object }) {
  return <View style={[{ height: 32, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: bg }, style]}>{children}</View>;
}

function GlassButton({ icon, label, onPress, size = 44 }: { icon: IconName; label: string; onPress: () => void; size?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(14,15,16,0.6)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Icon name={icon} size={20} color="#F4F5F2" />
    </Pressable>
  );
}

export default function CaptureScreen() {
  const t = useTheme();
  const router = useRouter();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  const s = useSettings((x) => x);
  const sessionId = useCaptures((x) => x.activeSessionId);
  const sessions = useCaptures((x) => x.sessions);
  const captures = useCaptures((x) => x.captures);
  const online = netStore.use((x) => x.online);
  const stamping = stampQueue.use((x) => x.jobs.length);
  const [mic] = useMicrophonePermissions();

  const session = sessions.find((x) => x.id === sessionId);
  const cp = findCheckpoint(s.checkpointId);

  const camRef = useRef<CameraView>(null);
  const camLock = useRef<Promise<unknown>>(Promise.resolve());
  const [mode, setMode] = useState<Mode>('picture');
  // The camera is ready only for the configuration that reported ready; changing
  // mode, lens or quality remounts the native camera and waits for onCameraReady again.
  const camKey = `${mode}:${s.facing}:${s.videoQuality}`;
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const ready = readyKey === camKey;
  const [running, setRunning] = useState(s.trigger !== 'manual');
  const [recording, setRecording] = useState<{ since: number } | null>(null);
  const [motionHit, setMotionHit] = useState<number | null>(null);
  /** Runner markers of the current video segment, as absolute (server) times. */
  const [markers, setMarkers] = useState<number[]>([]);
  const gps = useRef<{ lat: number; lng: number } | undefined>(undefined);
  const stopRequested = useRef(false);

  /** Serialises every camera call so probes, bursts and recordings never overlap. */
  const withCam = useCallback(<R,>(fn: () => Promise<R>) => {
    const p = camLock.current.then(fn, fn);
    camLock.current = p.catch(() => undefined);
    return p;
  }, []);

  // Orientation: this is the only screen that may rotate (16:9 landscape recording).
  const keepAwake = s.keepAwake;
  useFocusEffect(
    useCallback(() => {
      void ScreenOrientation.unlockAsync().catch(() => undefined);
      if (keepAwake) void activateKeepAwakeAsync('capture');
      return () => {
        setReadyKey(null); // the camera unmounts while this screen is in the background
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
        void deactivateKeepAwake('capture');
      };
    }, [keepAwake, setReadyKey]),
  );

  // GPS once per session, if allowed.
  useEffect(() => {
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
      if (pos) gps.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    })();
  }, [sessionId]);

  // Hide the "motion" badge 1.5 s after a trigger.
  useEffect(() => {
    if (!motionHit) return;
    const id = setTimeout(() => setMotionHit(null), 1500);
    return () => clearTimeout(id);
  }, [motionHit]);

  const burst = useCallback(async () => {
    if (!sessionId || !s.checkpointId || !s.operator || mode !== 'picture') return;
    await withCam(async () => {
      const cam = camRef.current;
      if (!cam) return;
      const participant = nextParticipant(sessionId);
      if (s.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      for (let i = 1; i <= s.burstFrames; i++) {
        const deviceTime = Date.now();
        const capturedAt = now();
        const pic = await cam.takePictureAsync({ quality: s.photoQuality, shutterSound: s.shutterSound });
        enqueueFrame({
          rawUri: pic.uri,
          width: pic.width,
          height: pic.height,
          capturedAt,
          deviceTime,
          sessionId,
          checkpointId: s.checkpointId!,
          operator: s.operator!,
          participant,
          frame: i,
          frames: s.burstFrames,
          lat: gps.current?.lat,
          lng: gps.current?.lng,
        });
      }
    }).catch((e) => console.warn('burst failed', e));
  }, [sessionId, s.checkpointId, s.operator, s.burstFrames, s.photoQuality, s.shutterSound, s.haptics, mode, withCam]);

  // Automatic triggers (photo mode only).
  const autoOn = focused && ready && running && mode === 'picture' && !!sessionId;
  useEffect(() => {
    if (!autoOn || s.trigger !== 'interval') return;
    const id = setInterval(() => void burst(), Math.max(1, s.intervalSec) * 1000);
    return () => clearInterval(id);
  }, [autoOn, s.trigger, s.intervalSec, burst]);

  useEffect(() => {
    if (!autoOn || s.trigger !== 'motion') return;
    // Expo Go has no camera frame access, so motion is estimated from tiny probe
    // snapshots: a sudden change in JPEG size means the scene changed.
    let alive = true;
    const sizes: number[] = [];
    let lastHit = 0;
    (async () => {
      while (alive) {
        await sleep(450);
        if (!alive) break;
        const size = await withCam(async () => {
          const cam = camRef.current;
          if (!cam) return null;
          const probe = await cam.takePictureAsync({ quality: 0.05, skipProcessing: true, shutterSound: false });
          const f = new File(probe.uri);
          const n = f.size ?? 0;
          try {
            f.delete();
          } catch {
            // ignore
          }
          return n;
        }).catch(() => null);
        if (!alive || !size) continue;
        if (sizes.length >= 3) {
          const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
          const change = Math.abs(size - avg) / avg;
          if (change > THRESHOLD[s.sensitivity] && Date.now() - lastHit > 1500) {
            lastHit = Date.now();
            setMotionHit(lastHit);
            await burst();
            sizes.length = 0; // re-learn the empty scene after a burst
            continue;
          }
        }
        sizes.push(size);
        if (sizes.length > 5) sizes.shift();
      }
    })();
    return () => {
      alive = false;
    };
  }, [autoOn, s.trigger, s.sensitivity, burst, withCam]);

  // Video recording in segments, with participant markers.
  const segmentStart = useRef(0);
  const markersRef = useRef<number[]>([]);
  const startRecording = useCallback(async () => {
    if (!sessionId || !s.checkpointId || !s.operator || !ready) return;
    stopRequested.current = false;
    setRecording({ since: Date.now() });
    while (!stopRequested.current) {
      const cam = camRef.current;
      if (!cam) break;
      const deviceTime = Date.now();
      segmentStart.current = now();
      markersRef.current = [];
      setMarkers([]);
      const res = await cam.recordAsync({ maxDuration: s.videoSegmentMin * 60 }).catch((e) => {
        console.warn('record failed', e);
        stopRequested.current = true;
        return undefined;
      });
      if (res?.uri) {
        await saveVideo({
          rawUri: res.uri,
          startedAt: segmentStart.current,
          deviceTime,
          durationMs: now() - segmentStart.current,
          markers: [...markersRef.current],
          sessionId,
          checkpointId: s.checkpointId,
          operator: s.operator,
          lat: gps.current?.lat,
          lng: gps.current?.lng,
        }).catch((e) => console.warn('save video failed', e));
      }
    }
    setRecording(null);
  }, [sessionId, s.checkpointId, s.operator, s.videoSegmentMin, ready]);

  const stopRecording = useCallback(() => {
    stopRequested.current = true;
    camRef.current?.stopRecording();
  }, []);

  useEffect(() => {
    if (!focused && recording) stopRecording();
  }, [focused, recording, stopRecording]);

  const mark = () => {
    if (!recording || !sessionId) return;
    nextParticipant(sessionId);
    const offset = now() - segmentStart.current;
    markersRef.current.push(offset);
    setMarkers((m) => [...m, segmentStart.current + offset]);
    if (s.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const switchMode = (m: Mode) => {
    if (recording) return;
    setMode(m);
  };

  const mainAction = () => {
    if (mode === 'video') return recording ? stopRecording() : void startRecording();
    if (s.trigger === 'manual') return void burst();
    setRunning((r) => !r);
  };

  const sessionCaptures = useMemo(() => captures.filter((c) => c.sessionId === sessionId), [captures, sessionId]);
  const counts = useMemo(() => {
    let up = 0;
    let pend = 0;
    let photos = 0;
    for (const c of sessionCaptures) {
      if (c.kind === 'photo') photos++;
      if (c.status === 'uploaded') up++;
      else pend++;
    }
    return { photos, up, pend, total: sessionCaptures.length };
  }, [sessionCaptures]);
  const latest = useMemo(() => sessionCaptures.filter((c) => c.kind === 'photo' && c.uri).slice(0, 5), [sessionCaptures]);

  if (!sessionId || !session) return <Redirect href="/camera-setup" />;

  const video = mode === 'video';
  const autoTrigger = s.trigger !== 'manual';
  const status: { label: string; bg: string } = video
    ? recording
      ? { label: 'REC', bg: REC }
      : { label: 'STANDBY', bg: 'rgba(14,15,16,0.6)' }
    : autoTrigger
      ? running
        ? { label: s.trigger === 'motion' ? 'MOTION' : `EVERY ${s.intervalSec}s`, bg: REC }
        : { label: 'PAUSED', bg: 'rgba(14,15,16,0.6)' }
      : { label: 'TAP TO CAPTURE', bg: 'rgba(14,15,16,0.6)' };

  const stampTitle = `${cp?.id ?? ''} · ${(cp?.name ?? '').toUpperCase()}`;
  const stampFooter = video ? `VIDEO · ${s.videoQuality} · ${markers.length} markers` : `P#${session.participants} · ${s.burstFrames}/burst · ${s.operator}`;

  const camera =
    focused ? (
      <CameraView
        ref={camRef}
        style={{ flex: 1 }}
        facing={s.facing}
        mode={mode}
        videoQuality={s.videoQuality}
        ratio="16:9"
        mute={!mic?.granted}
        animateShutter={false}
        onCameraReady={() => setReadyKey(camKey)}
        onMountError={(e) => console.warn('camera mount error', e.message)}
      />
    ) : (
      <View style={{ flex: 1, backgroundColor: CAMERA_BG }} />
    );

  const triggerLine = (
    <Svg width="100%" height="100%" style={{ position: 'absolute' }} pointerEvents="none">
      {landscape ? (
        // Horizontal finish line across the lower part of the 16:9 frame, above the timestamp box.
        <Line x1="4%" y1="62%" x2="96%" y2="62%" stroke={LIME} strokeWidth={2} strokeDasharray="7 7" />
      ) : (
        <Line x1="8%" y1="74%" x2="92%" y2="74%" stroke={LIME} strokeWidth={2} strokeDasharray="7 7" />
      )}
    </Svg>
  );

  const modeSwitch = (vertical: boolean) => (
    <View style={{ flexDirection: vertical ? 'column' : 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: 'rgba(14,15,16,0.6)', width: vertical ? 76 : 170 }}>
      {(['picture', 'video'] as Mode[]).map((m) => (
        <Pressable
          key={m}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === m, disabled: !!recording }}
          onPress={() => switchMode(m)}
          style={{ flex: vertical ? 0 : 1, height: vertical ? 40 : 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: mode === m ? LIME : 'transparent' }}
        >
          <T f="semi" size={13} color={mode === m ? INK : '#F4F5F2'}>
            {m === 'picture' ? 'Photo' : 'Video'}
          </T>
        </Pressable>
      ))}
    </View>
  );

  const statusPill = (
    <Pill bg={status.bg}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status.bg === REC ? '#FFFFFF' : '#9AA0A6' }} />
      {video && recording ? <Elapsed since={recording.since} prefix="REC" /> : <T f="monoB" size={12} color="#FFFFFF">{status.label}</T>}
    </Pill>
  );

  const actionPill =
    video && recording ? (
      <Pressable accessibilityRole="button" accessibilityLabel="Mark a runner crossing" onPress={mark} style={{ height: 40, paddingHorizontal: 14, borderRadius: 14, backgroundColor: LIME, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="flag" size={16} color={INK} />
        <T f="semi" size={13} color={INK}>
          Mark runner
        </T>
      </Pressable>
    ) : !video && autoTrigger ? (
      <Pressable accessibilityRole="button" accessibilityLabel="Capture a burst now" onPress={() => void burst()} style={{ height: 40, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(14,15,16,0.6)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="aperture" size={16} color="#F4F5F2" />
        <T f="semi" size={13} color="#F4F5F2">
          Burst now
        </T>
      </Pressable>
    ) : null;

  const bigButton = (size: number) => {
    const isStop = (video && recording) || (!video && autoTrigger && running);
    const ring = isStop ? (t.isDark ? '#3A1810' : '#F8D3CA') : video ? (t.isDark ? '#3A3E44' : '#E0E0DA') : t.isDark ? '#2E3A06' : '#EEFFB0';
    const fill = isStop ? REC : video ? '#FFFFFF' : LIME;
    const label = video ? (recording ? 'Stop recording' : 'Start recording') : autoTrigger ? (running ? 'Pause auto capture' : 'Resume auto capture') : 'Capture burst';
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={mainAction} disabled={!ready} style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, borderWidth: 6, borderColor: ring, backgroundColor: fill, alignItems: 'center', justifyContent: 'center', opacity: !ready ? 0.5 : pressed ? 0.8 : 1 })}>
        {isStop ? (
          <View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: '#FFFFFF' }} />
        ) : video ? (
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: REC }} />
        ) : autoTrigger ? (
          <Icon name="play" size={28} color={INK} />
        ) : (
          <Icon name="aperture" size={30} color={INK} />
        )}
      </Pressable>
    );
  };

  const motionBadge =
    motionHit ? (
      <View style={{ position: 'absolute', alignSelf: 'center', top: '42%', backgroundColor: LIME, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
        <T f="monoB" size={12} color={INK}>
          MOTION · BURST P#{session.participants}
        </T>
      </View>
    ) : null;

  // ───────────── Landscape (16:9) ─────────────
  if (landscape) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: t.bg }}>
        <View style={{ flex: 1, backgroundColor: CAMERA_BG, overflow: 'hidden' }}>
          {camera}
          {triggerLine}
          {motionBadge}
          <View style={{ position: 'absolute', left: insets.left + 12, top: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <GlassButton icon="chevron-left" label="Back" size={40} onPress={() => (router.canGoBack() ? router.back() : router.replace('/camera-setup'))} />
            {statusPill}
            <Pill>
              <T f="mono" size={11} color="#F4F5F2">
                16:9 · {s.videoQuality}
              </T>
            </Pill>
            <Pill>
              <T f="mono" size={11} color="#F4F5F2">
                {cp?.id}
              </T>
            </Pill>
          </View>
          <View style={{ position: 'absolute', left: insets.left + 12, top: '50%', marginTop: -48 }}>{modeSwitch(true)}</View>
          {video ? (
            <View style={{ position: 'absolute', right: 12, top: 14, width: 190, backgroundColor: 'rgba(14,15,16,0.72)', borderRadius: 14, padding: 10, gap: 4 }}>
              <T f="bold" size={11} color={LIME} style={{ letterSpacing: 1 }}>
                LIVE MARKERS
              </T>
              {markers.length === 0 ? (
                <T f="mono" size={11} color="#C9CCD1">
                  Tap “Mark runner” at each crossing
                </T>
              ) : (
                markers
                  .slice(-4)
                  .reverse()
                  .map((m, i) => (
                    <View key={m} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <T f="mono" size={11} color="#F4F5F2">
                        {hmsMs(new Date(m))}
                      </T>
                      <T f="mono" size={11} color="#C9CCD1">
                        #{markers.length - i}
                      </T>
                    </View>
                  ))
              )}
            </View>
          ) : null}
          <View style={{ position: 'absolute', left: insets.left + 12, bottom: 14, right: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <LiveStamp title={stampTitle} footer={stampFooter} withMs={s.overlayMs} scale={1.15} />
            {actionPill}
          </View>
        </View>
        <View style={{ width: 120 + insets.right, paddingRight: insets.right, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, backgroundColor: t.bg }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Open gallery" onPress={() => router.push('/gallery')} style={{ width: 52, height: 52, borderRadius: 14, overflow: 'hidden', backgroundColor: '#24272B', borderWidth: 2, borderColor: t.line }}>
            {latest[0] ? <Image source={{ uri: latest[0].uri }} style={{ flex: 1 }} /> : null}
          </Pressable>
          <View style={{ alignItems: 'center', gap: 8 }}>
            {bigButton(76)}
            <T f="mono" size={11} color={t.muted}>
              {session.participants} runners
            </T>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rotate to portrait"
            onPress={() => void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)}
            style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="smartphone" size={20} color={t.text} />
          </Pressable>
        </View>
      </View>
    );
  }

  // ───────────── Portrait ─────────────
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ height: Math.round(height * 0.53), backgroundColor: CAMERA_BG, overflow: 'hidden' }}>
        {camera}
        {triggerLine}
        {motionBadge}
        <View style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <GlassButton icon="chevron-left" label="Back to camera setup" onPress={() => (router.canGoBack() ? router.back() : router.replace('/camera-setup'))} />
          {statusPill}
          <GlassButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
        </View>
        <View style={{ position: 'absolute', top: insets.top + 62, alignSelf: 'center' }}>{modeSwitch(false)}</View>
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 40, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <LiveStamp title={stampTitle} footer={stampFooter} withMs={s.overlayMs} />
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            {actionPill}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Rotate to landscape 16:9"
              onPress={() => void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)}
              style={{ height: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(14,15,16,0.6)', flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Icon name="rotate-cw" size={16} color="#F4F5F2" />
              <T f="mono" size={11} color="#F4F5F2">
                16:9
              </T>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={{ flex: 1, marginTop: -28, backgroundColor: t.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 12, gap: 12 }}>
        {!online ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, backgroundColor: t.card2 }}>
            <Icon name="wifi-off" size={16} color={t.text} />
            <T f="semi" size={12} style={{ flex: 1 }}>
              Offline · {counts.pend} saved on phone, will upload when back online
            </T>
          </View>
        ) : null}
        <Clock />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat label="Captured" value={counts.total.toLocaleString('en')} accent onPress={() => router.push('/summary')} />
          <Stat label="Uploaded" value={counts.up.toLocaleString('en')} />
          <Stat label="Pending" value={counts.pend.toLocaleString('en')} onPress={() => router.push('/uploads')} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T f="semi" size={14}>
            Latest burst{stamping ? ` · saving ${stamping}…` : ''}
          </T>
          <Pressable onPress={() => router.push('/gallery')} accessibilityRole="link" hitSlop={8}>
            <T f="semi" size={13} color={t.link}>
              See all
            </T>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flexGrow: 0 }}>
          {latest.length === 0 ? (
            <View style={{ height: 62, justifyContent: 'center' }}>
              <T size={13} color={t.muted}>
                No frames yet — {video ? 'switch to Photo' : autoTrigger ? 'waiting for a runner' : 'tap the shutter'}.
              </T>
            </View>
          ) : (
            latest.map((c) => (
              <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Open frame ${c.frame}`} onPress={() => router.push({ pathname: '/image/[id]', params: { id: c.id } })} style={{ width: 62, height: 62, borderRadius: 12, overflow: 'hidden', backgroundColor: '#24272B' }}>
                <Image source={{ uri: c.uri }} style={{ flex: 1 }} />
                <View style={{ position: 'absolute', left: 4, bottom: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 4 }}>
                  <T f="mono" size={9} color="#FFFFFF">
                    F{c.frame}
                  </T>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Gallery" onPress={() => router.push('/gallery')} style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="image" size={22} color={t.text} />
          </Pressable>
          {bigButton(84)}
          <Pressable accessibilityRole="button" accessibilityLabel="Upload queue" onPress={() => router.push('/uploads')} style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="upload" size={22} color={t.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

