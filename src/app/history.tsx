import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { Badge, Header, Icon, Screen, Stat, T } from '@/components/ui';
import { findCheckpoint } from '@/data/checkpoints';
import { duration, hm } from '@/services/time';
import { useCaptures } from '@/store/captures';
import { INK, LIME } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const dayKey = (t: number) => new Date(t).toDateString();

export default function History() {
  const t = useTheme();
  const router = useRouter();
  const sessions = useCaptures((s) => s.sessions);
  const captures = useCaptures((s) => s.captures);
  const activeId = useCaptures((s) => s.activeSessionId);

  // Last 7 days, today on the right.
  const days = useMemo(() => {
    const out: { key: string; w: string; n: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push({ key: d.toDateString(), w: d.toLocaleDateString('en-GB', { weekday: 'short' }), n: d.getDate() });
    }
    return out;
  }, []);
  const [day, setDay] = useState<string | null>(null);

  const perSession = useMemo(() => {
    const m = new Map<string, { n: number; up: number; videos: number; videoMs: number }>();
    for (const c of captures) {
      const x = m.get(c.sessionId) ?? { n: 0, up: 0, videos: 0, videoMs: 0 };
      x.n++;
      if (c.status === 'uploaded') x.up++;
      if (c.kind === 'video') {
        x.videos++;
        x.videoMs += c.durationMs ?? 0;
      }
      m.set(c.sessionId, x);
    }
    return m;
  }, [captures]);

  const withData = new Set(sessions.map((s) => dayKey(s.startedAt)));
  const list = day ? sessions.filter((s) => dayKey(s.startedAt) === day) : sessions;
  const totals = list.reduce(
    (a, s) => {
      const x = perSession.get(s.id);
      return { n: a.n + (x?.n ?? 0), vid: a.vid + (x?.videoMs ?? 0) };
    },
    { n: 0, vid: 0 },
  );

  return (
    <Screen edges={['top']}>
      <Header title="Session history" />
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {days.map((d) => {
          const on = d.key === day;
          return (
            <Pressable
              key={d.key}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Show ${d.w} ${d.n}`}
              onPress={() => setDay(on ? null : d.key)}
              style={{ flex: 1, height: 70, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: on ? t.btn : t.card, borderWidth: on ? 0 : 1, borderColor: t.line }}
            >
              <T f="semi" size={11} color={on ? t.btnText : t.text}>
                {d.w}
              </T>
              <T f="monoB" size={15} color={on ? t.btnText : t.text}>
                {d.n}
              </T>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: withData.has(d.key) ? (on ? t.chip : '#3BA55C') : 'transparent' }} />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat label="Sessions" value={String(list.length)} />
        <Stat label="Captures" value={totals.n.toLocaleString('en')} />
        <Stat label="Video" value={duration(totals.vid).slice(0, 5)} />
      </View>
      <FlatList
        data={list}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 40, gap: 8 }}>
            <Icon name="calendar" size={28} color={t.muted} />
            <T color={t.muted}>{day ? 'No sessions on this day.' : 'No sessions yet.'}</T>
          </View>
        }
        renderItem={({ item: s }) => {
          const x = perSession.get(s.id) ?? { n: 0, up: 0, videos: 0, videoMs: 0 };
          const live = s.id === activeId && !s.endedAt;
          const needsUpload = x.n > x.up;
          const cp = findCheckpoint(s.checkpointId);
          const fg = live ? INK : t.text;
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/summary', params: { id: s.id } })}
              style={{ padding: 14, gap: 10, borderRadius: 20, backgroundColor: live ? LIME : t.card, borderWidth: 1, borderColor: live ? LIME : t.line }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T f="monoB" size={12} color={fg}>
                  {new Date(s.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {hm(new Date(s.startedAt))} – {s.endedAt ? hm(new Date(s.endedAt)) : 'now'}
                </T>
                <Badge label={live ? 'Live' : needsUpload ? 'Needs upload' : 'Done'} tone={live ? 'ink' : needsUpload ? 'red' : 'neutral'} />
              </View>
              <T f="head" size={18} color={fg}>
                {s.checkpointId} · {cp?.name ?? ''}
              </T>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <T f="semi" size={12} color={fg} style={{ opacity: 0.85 }}>
                  {x.n.toLocaleString('en')} captures
                </T>
                <T f="semi" size={12} color={fg} style={{ opacity: 0.85 }}>
                  {s.participants} runners
                </T>
                <T f="semi" size={12} color={fg} style={{ opacity: 0.85 }}>
                  {x.n ? Math.floor((x.up / x.n) * 100) : 100}% uploaded
                </T>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
