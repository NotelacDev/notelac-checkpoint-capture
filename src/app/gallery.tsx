import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';

import { Thumb } from '@/components/Thumb';
import { Badge, Header, Icon, Screen, Segmented, T } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { duration, formatBytes, hms, hmsMs, prettyDate } from '@/services/time';
import { useCaptures, type Capture } from '@/store/captures';
import { useTheme } from '@/theme/useTheme';

type Tab = 'photos' | 'videos';
type Chip = 'All' | 'Last 15 min' | 'Pending' | 'Failed';

type Group = { key: string; participant?: number; at: number; frames: Capture[] };

function groupStatus(g: Group): { label: string; tone: 'lime' | 'red' | 'neutral' } {
  if (g.frames.some((f) => f.status === 'failed')) return { label: 'Failed', tone: 'red' };
  if (g.frames.every((f) => f.status === 'uploaded')) return { label: 'Uploaded', tone: 'lime' };
  return { label: 'Uploading', tone: 'neutral' };
}

export default function Gallery() {
  const t = useTheme();
  const router = useRouter();
  const captures = useCaptures((s) => s.captures);
  const [tab, setTab] = useState<Tab>('photos');
  const [chip, setChip] = useState<Chip>('All');
  const nowMs = useNow(30_000);

  const filtered = useMemo(() => {
    const since = nowMs - 15 * 60_000;
    return captures.filter((c) => {
      if (chip === 'Last 15 min' && c.capturedAt < since) return false;
      if (chip === 'Pending' && c.status !== 'pending' && c.status !== 'uploading') return false;
      if (chip === 'Failed' && c.status !== 'failed') return false;
      return true;
    });
  }, [captures, chip, nowMs]);

  const photos = useMemo(() => filtered.filter((c) => c.kind === 'photo'), [filtered]);
  const videos = useMemo(() => filtered.filter((c) => c.kind === 'video'), [filtered]);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const c of photos) {
      const key = `${c.sessionId}:${c.participant ?? c.id}`;
      const g = map.get(key) ?? { key, participant: c.participant, at: c.capturedAt, frames: [] };
      g.frames.push(c);
      g.at = Math.min(g.at, c.capturedAt);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => b.at - a.at).map((g) => ({ ...g, frames: g.frames.sort((a, b) => (a.frame ?? 0) - (b.frame ?? 0)) }));
  }, [photos]);

  const open = (c: Capture) => router.push({ pathname: '/image/[id]', params: { id: c.id } });

  return (
    <Screen edges={['top']}>
      <Header title="Captures" subtitle={`${photos.length.toLocaleString('en')} photos · ${videos.length} videos`} />
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { label: `Photos · ${photos.length}`, value: 'photos' },
          { label: `Videos · ${videos.length}`, value: 'videos' },
        ]}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        {(['All', 'Last 15 min', 'Pending', 'Failed'] as Chip[]).map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityState={{ selected: chip === c }}
            onPress={() => setChip(c)}
            style={{ height: 36, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', backgroundColor: chip === c ? t.btn : t.card, borderWidth: chip === c ? 0 : 1, borderColor: t.line }}
          >
            <T f="semi" size={13} color={chip === c ? t.btnText : t.text}>
              {c}
            </T>
          </Pressable>
        ))}
      </ScrollView>

      {tab === 'photos' ? (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.key}
          contentContainerStyle={{ gap: 18, paddingBottom: 40 }}
          initialNumToRender={6}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
              <Icon name="image" size={32} color={t.muted} />
              <T color={t.muted}>No photos here yet.</T>
            </View>
          }
          renderItem={({ item: g }) => {
            const st = groupStatus(g);
            return (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <T f="monoB" size={13}>
                      {hms(new Date(g.at))}
                    </T>
                    <T size={12} color={t.muted}>
                      P#{g.participant ?? '—'} · {g.frames.length} frames · {prettyDate(new Date(g.at))}
                    </T>
                  </View>
                  <Badge label={st.label} tone={st.tone} />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {g.frames.map((f) => (
                    <View key={f.id} style={{ width: '32%', aspectRatio: 1 }}>
                      <Thumb c={f} onPress={() => open(f)} style={{ flex: 1 }} label={`Frame ${f.frame} at ${hmsMs(new Date(f.capturedAt))}`} />
                      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.62)', borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingHorizontal: 6, paddingVertical: 3 }} pointerEvents="none">
                        <T f="mono" size={9.5} color="#FFFFFF">
                          {hmsMs(new Date(f.capturedAt))}
                        </T>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ gap: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
              <Icon name="film" size={32} color={t.muted} />
              <T color={t.muted}>No videos yet. Switch the capture screen to Video.</T>
            </View>
          }
          renderItem={({ item: v }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={`Open video from ${hms(new Date(v.capturedAt))}`} onPress={() => open(v)} style={{ gap: 8 }}>
              <View style={{ height: 190, borderRadius: 18, backgroundColor: '#24272B', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="play" size={20} color="#0E0F10" />
                </View>
                <View style={{ position: 'absolute', left: 10, right: 10, top: 10, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' }} />
                {(v.markers ?? []).map((m) => (
                  <View key={m} style={{ position: 'absolute', top: 8, width: 3, height: 8, borderRadius: 2, backgroundColor: '#CFFE0F', left: `${3 + (94 * m) / Math.max(1, v.durationMs ?? 1)}%` }} />
                ))}
                <View style={{ position: 'absolute', left: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.66)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 }}>
                  <T f="mono" size={10} color="#FFFFFF">
                    {v.checkpointId} · {hmsMs(new Date(v.capturedAt))}
                  </T>
                </View>
                <View style={{ position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.66)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 }}>
                  <T f="monoB" size={11} color="#FFFFFF">
                    {duration(v.durationMs ?? 0)}
                  </T>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T f="semi" size={13}>
                  {prettyDate(new Date(v.capturedAt))} · {hms(new Date(v.capturedAt))}
                </T>
                <T size={13} color={t.muted}>
                  {(v.markers ?? []).length} markers · {formatBytes(v.size)}
                </T>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
