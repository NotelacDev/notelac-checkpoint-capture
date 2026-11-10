import { useEventListener } from 'expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StampOverlay } from '@/components/StampOverlay';
import { Badge, Button, Card, Icon, Screen, T } from '@/components/ui';
import { findCheckpoint } from '@/data/checkpoints';
import { stampTextFor } from '@/services/media';
import { duration, formatBytes, hmsMs, stampLine, utcOffset, ymd } from '@/services/time';
import { updateCapture, useCaptures, type Capture } from '@/store/captures';
import { useSettings } from '@/store/settings';
import { CAMERA_BG, F, LIME } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

function MetaRow({ k, v, last }: { k: string; v: string; last?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 42, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line }}>
      <T size={13} color={t.muted}>
        {k}
      </T>
      <T f="mono" size={12.5} style={{ flexShrink: 1, textAlign: 'right' }}>
        {v}
      </T>
    </View>
  );
}

function statusBadge(c: Capture) {
  if (c.status === 'uploaded') return <Badge label={`Uploaded · ${c.uploadedAt ? hmsMs(new Date(c.uploadedAt)).slice(0, 8) : ''}`} tone="lime" />;
  if (c.status === 'failed') return <Badge label={`Failed · ${c.error ?? ''}`.slice(0, 40)} tone="red" />;
  if (c.status === 'uploading') return <Badge label={`Uploading ${Math.round(c.progress * 100)}%`} tone="neutral" />;
  return <Badge label="Waiting to upload" tone="neutral" />;
}

function VideoBlock({ c }: { c: Capture }) {
  const withMs = useSettings((s) => s.overlayMs);
  const [pos, setPos] = useState(0);
  const player = useVideoPlayer(c.uri, (p) => {
    p.timeUpdateEventInterval = 0.1;
  });
  useEventListener(player, 'timeUpdate', (e) => setPos(e.currentTime));
  const cp = findCheckpoint(c.checkpointId);
  const at = c.capturedAt + pos * 1000;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ aspectRatio: 16 / 9, backgroundColor: CAMERA_BG, borderRadius: 18, overflow: 'hidden' }}>
        <VideoView player={player} style={{ flex: 1 }} nativeControls contentFit="contain" />
        {/* The timestamp follows playback: start time + current position. */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 10, top: 10 }}>
          <StampOverlay title={`${c.checkpointId} · ${(cp?.name ?? '').toUpperCase()}`} time={stampLine(at, withMs)} footer={`VIDEO · ${duration(pos * 1000)}`} scale={0.9} />
        </View>
      </View>
      {(c.markers ?? []).length ? (
        <Card style={{ padding: 12, gap: 6 }}>
          <T f="bold" size={12} style={{ letterSpacing: 1 }}>
            RUNNER MARKERS
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(c.markers ?? []).map((m, i) => (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityLabel={`Jump to marker ${i + 1}`}
                onPress={() => {
                  player.currentTime = Math.max(0, m / 1000 - 1);
                  player.play();
                }}
                style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: LIME }}
              >
                <T f="mono" size={11} color="#0E0F10">
                  #{i + 1} · {hmsMs(new Date(c.capturedAt + m))}
                </T>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}
    </View>
  );
}

export default function CaptureDetail() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const captures = useCaptures((s) => s.captures);
  const offset = useCaptures((s) => s.timeOffsetMs);
  const synced = useCaptures((s) => s.timeSyncedAt);
  const c = captures.find((x) => x.id === id);
  const burst = useMemo(
    () => (c && c.kind === 'photo' ? captures.filter((x) => x.sessionId === c.sessionId && x.participant === c.participant && x.kind === 'photo').sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0)) : []),
    [captures, c],
  );
  const [bib, setBib] = useState(c?.bib ?? '');
  const [editingBib, setEditingBib] = useState(false);

  if (!c) {
    return (
      <Screen>
        <T>This capture no longer exists.</T>
        <Button label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/gallery'))} style={{ flex: 0 }} />
      </Screen>
    );
  }

  const d = new Date(c.capturedAt);
  const cp = findCheckpoint(c.checkpointId);
  const meta: [string, string][] = [
    ['Captured (server time)', `${ymd(d)} ${hmsMs(d)}`],
    ['Device clock', hmsMs(new Date(c.deviceTime))],
    ['Server time offset', synced ? `${offset >= 0 ? '+' : ''}${offset} ms · synced` : 'Not synced'],
    ['Time zone', `${c.tz} · ${utcOffset(d)}`],
    ['Checkpoint', `${c.checkpointId} · ${cp?.name ?? ''}`],
    ['Participant', `P#${c.participant ?? '—'}${c.bib ? ` · BIB ${c.bib}` : ''}`],
    ['GPS', c.lat != null && c.lng != null ? `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}` : 'Not recorded'],
    [c.kind === 'photo' ? 'Size' : 'Duration', c.kind === 'photo' ? `${c.width ?? '?'}×${c.height ?? '?'} · ${formatBytes(c.size)}` : `${duration(c.durationMs ?? 0)} · ${formatBytes(c.size)}`],
    ['File', c.uri ? (c.uri.split('/').pop() ?? '') : 'Removed from phone after upload'],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {c.kind === 'photo' ? (
        <View style={{ height: 400, backgroundColor: CAMERA_BG }}>
          {c.uri ? (
            <Image source={{ uri: c.uri }} style={{ flex: 1 }} resizeMode="contain" accessibilityLabel="Captured frame with burned-in timestamp" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="cloud" size={32} color="#9AA0A6" />
              <T color="#C9CCD1">Stored on the server</T>
              <StampOverlay {...stampTextFor(c)} />
            </View>
          )}
          <View style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/gallery'))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(14,15,16,0.6)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="chevron-left" size={20} color="#F4F5F2" />
            </Pressable>
            <View style={{ height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(14,15,16,0.6)', justifyContent: 'center' }}>
              <T f="monoB" size={12} color="#F4F5F2">
                Frame {c.frame ?? 1} / {c.frames ?? 1}
              </T>
            </View>
            <View style={{ width: 44 }} />
          </View>
        </View>
      ) : (
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/gallery'))} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chevron-left" size={20} color={t.text} />
          </Pressable>
          {c.uri ? <VideoBlock c={c} /> : <T color={t.muted}>Video removed from the phone after upload.</T>}
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 14, gap: 12, paddingBottom: insets.bottom + 24 }}>
        {burst.length > 1 ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {burst.map((f) => (
              <Pressable
                key={f.id}
                accessibilityRole="button"
                accessibilityLabel={`Frame ${f.frame}`}
                accessibilityState={{ selected: f.id === c.id }}
                onPress={() => router.setParams({ id: f.id })}
                style={{ flex: 1, height: 60, borderRadius: 12, overflow: 'hidden', backgroundColor: '#24272B', borderWidth: f.id === c.id ? 3 : 1, borderColor: f.id === c.id ? t.sel : t.line }}
              >
                {f.uri ? <Image source={{ uri: f.uri }} style={{ flex: 1 }} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        <Card style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          {meta.map(([k, v]) => (
            <MetaRow key={k} k={k} v={v} />
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 46 }}>
            <T size={13} color={t.muted}>
              Upload
            </T>
            {statusBadge(c)}
          </View>
        </Card>

        {editingBib ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              accessibilityLabel="BIB number"
              value={bib}
              onChangeText={setBib}
              keyboardType="number-pad"
              placeholder="BIB number"
              placeholderTextColor={t.muted}
              autoFocus
              style={{ flex: 1, height: 54, borderRadius: 18, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, color: t.text, fontFamily: F.semi, fontSize: 16, paddingHorizontal: 16 }}
            />
            <Button
              kind="primary"
              label="Save"
              style={{ flex: 0, paddingHorizontal: 24 }}
              onPress={() => {
                // Tag every frame of the burst with the same BIB.
                const ids = burst.length ? burst.map((f) => f.id) : [c.id];
                ids.forEach((fid) => updateCapture(fid, { bib: bib.trim() || undefined }));
                setEditingBib(false);
              }}
            />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label={c.bib ? `BIB ${c.bib}` : 'Tag BIB no.'} onPress={() => setEditingBib(true)} />
            <Button
              kind="primary"
              label={c.status === 'uploaded' ? 'Upload again' : 'Upload now'}
              disabled={!c.uri || c.status === 'uploading'}
              onPress={() => updateCapture(c.id, { status: 'pending', nextRetryAt: undefined, error: undefined })}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
