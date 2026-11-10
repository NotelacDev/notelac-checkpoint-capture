import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { Badge, Button, Card, Header, NotchCard, Screen, Stat, T } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { findCheckpoint } from '@/data/checkpoints';
import { duration, formatBytes, hms, tzLabel, utcOffset } from '@/services/time';
import { endSession, useCaptures } from '@/store/captures';
import { useSettings } from '@/store/settings';
import { INK } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const BUCKET_MS = 15 * 60_000;

export default function Summary() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const activeId = useCaptures((s) => s.activeSessionId);
  const sessions = useCaptures((s) => s.sessions);
  const captures = useCaptures((s) => s.captures);
  const facing = useSettings((s) => s.facing);
  const quality = useSettings((s) => s.videoQuality);
  const nowMs = useNow(1000);

  const id = params.id ?? activeId ?? sessions[0]?.id;
  const session = sessions.find((s) => s.id === id);
  const endMs = session?.endedAt ?? nowMs;
  const items = useMemo(() => captures.filter((c) => c.sessionId === id), [captures, id]);

  const stats = useMemo(() => {
    let photos = 0,
      videos = 0,
      up = 0,
      pend = 0,
      failed = 0,
      bytes = 0;
    for (const c of items) {
      if (c.kind === 'photo') photos++;
      else videos++;
      bytes += c.size;
      if (c.status === 'uploaded') up++;
      else if (c.status === 'failed') failed++;
      else pend++;
    }
    return { photos, videos, up, pend, failed, bytes };
  }, [items]);

  const bars = useMemo(() => {
    if (!session || !items.length) return [];
    const start = session.startedAt;
    const n = Math.min(16, Math.max(1, Math.ceil((endMs - start) / BUCKET_MS)));
    const counts = new Array(n).fill(0);
    for (const c of items) {
      const i = Math.min(n - 1, Math.max(0, Math.floor((c.capturedAt - start) / BUCKET_MS)));
      counts[i]++;
    }
    const max = Math.max(...counts, 1);
    return counts.map((v) => v / max);
  }, [items, session, endMs]);

  if (!session) {
    return (
      <Screen>
        <Header title="Session summary" />
        <T color={t.muted}>No session yet. Start one from Camera setup.</T>
      </Screen>
    );
  }

  const cp = findCheckpoint(session.checkpointId);
  const live = !session.endedAt;
  const end = () =>
    Alert.alert('End this session?', `${items.length} captures. ${stats.pend} are still uploading — they keep uploading after you end.`, [
      { text: 'Keep capturing', style: 'cancel' },
      {
        text: 'End session',
        style: 'destructive',
        onPress: () => {
          endSession(session.id);
          router.replace('/history');
        },
      },
    ]);

  return (
    <Screen>
      <Header title="Session summary" right={live ? <Badge label="● LIVE" tone="red" /> : <Badge label="Ended" tone="neutral" />} />
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
        <Card style={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
          {(
            [
              ['Checkpoint', `${session.checkpointId} · ${cp?.name ?? ''}`, false],
              ['Operator', session.operator, false],
              ['Started', hms(new Date(session.startedAt)), true],
              ['Duration', duration(endMs - session.startedAt), true],
            ] as const
          ).map(([k, v, mono]) => (
            <View key={k} style={{ width: '50%', gap: 2 }}>
              <T size={12} color={t.muted}>
                {k}
              </T>
              <T f={mono ? 'mono' : 'semi'} size={15} numberOfLines={1}>
                {v}
              </T>
            </View>
          ))}
        </Card>

        <NotchCard style={{ gap: 14 }}>
          <View>
            <T f="headX" size={48} color={INK} style={{ letterSpacing: -2, lineHeight: 52 }}>
              {items.length.toLocaleString('en')}
            </T>
            <T f="semi" size={14} color={INK}>
              captures · {session.participants} runners · {stats.videos} videos
            </T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 64 }}>
            {bars.length ? (
              bars.map((v, i) => <View key={i} style={{ flex: 1, height: `${Math.max(6, v * 100)}%`, borderRadius: 4, backgroundColor: i === bars.length - 1 && live ? 'rgba(14,15,16,0.35)' : INK }} />)
            ) : (
              <T size={13} color={INK}>
                The chart fills in as frames come in.
              </T>
            )}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T f="mono" size={11} color={INK}>
              {hms(new Date(session.startedAt)).slice(0, 5)}
            </T>
            <T f="mono" size={11} color={INK}>
              Captures per 15 min
            </T>
            <T f="mono" size={11} color={INK}>
              {hms(new Date(endMs)).slice(0, 5)}
            </T>
          </View>
        </NotchCard>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat label="Uploaded" value={stats.up.toLocaleString('en')} />
          <Stat label="Pending" value={stats.pend.toLocaleString('en')} onPress={() => router.push('/uploads')} />
          <Stat label="Failed" value={String(stats.failed)} valueColor={stats.failed ? '#D23F22' : undefined} />
        </View>

        <Card style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          {[
            ['Camera', `${facing === 'back' ? 'Back' : 'Front'} · ${quality}`],
            ['Storage used', formatBytes(stats.bytes)],
            ['Time zone', `${tzLabel()} · ${utcOffset()}`],
          ].map(([k, v], i, a) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 46, borderBottomWidth: i === a.length - 1 ? 0 : 1, borderBottomColor: t.line }}>
              <T size={14} color={t.muted}>
                {k}
              </T>
              <T f="mono" size={13}>
                {v}
              </T>
            </View>
          ))}
        </Card>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label={live ? 'Back to capture' : 'Gallery'} onPress={() => (live ? (router.canGoBack() ? router.back() : router.replace('/capture')) : router.push('/gallery'))} />
        {live ? <Button kind="danger" label="End session" onPress={end} /> : null}
      </View>
    </Screen>
  );
}
