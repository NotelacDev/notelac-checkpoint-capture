import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Icon, NotchCard, PrimaryButton, RoundButton, Screen, Segmented, T } from '@/components/ui';
import { CHECKPOINTS } from '@/data/checkpoints';
import { useCaptures } from '@/store/captures';
import { setSettings, useSettings } from '@/store/settings';
import { F, INK } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Filter = 'All' | 'Assigned';

export default function CheckpointScreen() {
  const t = useTheme();
  const router = useRouter();
  const operator = useSettings((s) => s.operator);
  const current = useSettings((s) => s.checkpointId);
  const sessions = useCaptures((s) => s.sessions);
  const [picked, setPicked] = useState(current ?? 'CP-03');
  const [filter, setFilter] = useState<Filter>('All');
  const [q, setQ] = useState('');

  const list = useMemo(
    () =>
      CHECKPOINTS.filter((c) => (filter === 'Assigned' ? c.id === current : true)).filter(
        (c) => !q || `${c.id} ${c.name} ${c.place}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [filter, q, current],
  );
  const sel = CHECKPOINTS.find((c) => c.id === picked) ?? CHECKPOINTS[0];
  const sessionsHere = sessions.filter((s) => s.checkpointId === sel.id).length;

  const confirm = () => {
    setSettings({ checkpointId: sel.id });
    router.push('/camera-setup');
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <RoundButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))} />
        <View style={{ flex: 1 }}>
          <T size={13} color={t.muted}>
            Signed in as
          </T>
          <T f="semi">{operator ?? '—'}</T>
        </View>
        <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: t.card, borderWidth: 1, borderColor: t.line }}>
          <T f="mono" size={12}>
            Step 1/2
          </T>
        </View>
      </View>

      <T f="head" size={32} style={{ letterSpacing: -1, lineHeight: 35 }}>
        Pick your checkpoint.
      </T>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, borderRadius: 25, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, paddingHorizontal: 18 }}>
        <Icon name="search" size={18} color={t.muted} />
        <TextInput
          accessibilityLabel="Search checkpoints"
          value={q}
          onChangeText={setQ}
          placeholder="Search name or ID"
          placeholderTextColor={t.muted}
          style={{ flex: 1, fontFamily: F.medium, fontSize: 15, color: t.text }}
        />
      </View>

      <Segmented
        options={[
          { label: 'All', value: 'All' as Filter },
          { label: 'Assigned', value: 'Assigned' as Filter },
        ]}
        value={filter}
        onChange={setFilter}
      />

      <NotchCard style={{ gap: 12, paddingTop: 18 }}>
        <T f="mono" size={11} color={INK} style={{ letterSpacing: 1.2 }}>
          SELECTED · {sel.id}
        </T>
        <T f="head" size={26} color={INK} style={{ letterSpacing: -0.5 }}>
          {sel.name}
        </T>
        <View style={{ flexDirection: 'row', gap: 18, borderTopWidth: 1, borderTopColor: 'rgba(14,15,16,0.25)', paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="map-pin" size={15} color={INK} />
            <T f="semi" size={13} color={INK}>
              {sel.place}
            </T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="layers" size={15} color={INK} />
            <T f="semi" size={13} color={INK}>
              {sessionsHere} session{sessionsHere === 1 ? '' : 's'} on this phone
            </T>
          </View>
        </View>
      </NotchCard>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }}>
        {list.map((c) => {
          const on = c.id === picked;
          return (
            <Pressable
              key={c.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setPicked(c.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 12,
                minHeight: 70,
                borderRadius: 18,
                backgroundColor: t.card,
                borderWidth: on ? 2 : 1,
                borderColor: on ? t.sel : t.line,
              }}
            >
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: t.card2, alignItems: 'center', justifyContent: 'center' }}>
                <T f="mono" size={13}>
                  {c.short}
                </T>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T f="semi">{c.name}</T>
                <T size={12} color={t.muted}>
                  {c.id} · {c.place}
                  {c.id === current ? ' · Assigned to you' : ''}
                </T>
              </View>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: on ? 7 : 2,
                  borderColor: on ? t.sel : t.switchOff,
                  backgroundColor: t.card,
                }}
              />
            </Pressable>
          );
        })}
        {list.length === 0 ? (
          <T color={t.muted} style={{ textAlign: 'center', paddingVertical: 24 }}>
            No checkpoint matches “{q}”.
          </T>
        ) : null}
      </ScrollView>

      <PrimaryButton label="Confirm checkpoint" onPress={confirm} />
    </Screen>
  );
}
