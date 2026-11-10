import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { Thumb } from '@/components/Thumb';
import { Button, Header, Icon, Screen, Segmented, T } from '@/components/ui';
import { formatBytes, hm, hmsMs } from '@/services/time';
import { netStore } from '@/services/uploader';
import { retryFailed, updateCapture, useCaptures, type Capture } from '@/store/captures';
import { setSettings, useSettings } from '@/store/settings';
import { LIME, OK, REC } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Tab = 'pending' | 'failed' | 'uploaded';

export default function Uploads() {
  const t = useTheme();
  const router = useRouter();
  const captures = useCaptures((s) => s.captures);
  const net = netStore.use((s) => s);
  const paused = useSettings((s) => s.uploadsPaused);
  const apiUrl = useSettings((s) => s.apiUrl);
  const wifiOnly = useSettings((s) => s.wifiOnly);
  const [tab, setTab] = useState<Tab>('pending');

  const by = useMemo(() => {
    const pending: Capture[] = [];
    const failed: Capture[] = [];
    const uploaded: Capture[] = [];
    let lastUpload = 0;
    let pendingBytes = 0;
    for (const c of captures) {
      if (c.status === 'uploaded') {
        uploaded.push(c);
        lastUpload = Math.max(lastUpload, c.uploadedAt ?? 0);
      } else if (c.status === 'failed') failed.push(c);
      else {
        pending.push(c);
        pendingBytes += c.size;
      }
    }
    pending.sort((a, b) => (a.status === 'uploading' ? -1 : b.status === 'uploading' ? 1 : a.capturedAt - b.capturedAt));
    return { pending, failed, uploaded, lastUpload, pendingBytes };
  }, [captures]);

  const total = captures.length;
  const pct = total ? Math.floor((by.uploaded.length / total) * 100) : 100;
  const blockedByWifi = wifiOnly && net.type !== 'wifi' && net.type !== 'ethernet';
  const title = !net.online ? 'Offline — saving on phone' : paused ? 'Uploads paused' : blockedByWifi ? 'Waiting for Wi-Fi' : by.pending.length ? 'Syncing to race server' : 'All caught up';
  const rows = tab === 'pending' ? by.pending : tab === 'failed' ? by.failed : by.uploaded;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title="Upload & sync"
        right={
          <View style={{ height: 36, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 18, backgroundColor: t.card, borderWidth: 1, borderColor: t.line }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: net.online ? OK : REC }} />
            <T f="semi" size={13}>
              {net.online ? (net.type === 'wifi' ? 'Wi-Fi' : net.type === 'cellular' ? 'Mobile' : 'Online') : 'Offline'}
            </T>
          </View>
        }
      />

      <View style={{ backgroundColor: t.hero, borderRadius: 26, padding: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: 4 }}>
            <T f="semi" size={13} color={t.heroText} style={{ opacity: 0.8 }}>
              {title}
            </T>
            <T f="headX" size={40} color={t.heroText} style={{ letterSpacing: -1, lineHeight: 42 }}>
              {pct}%
            </T>
          </View>
          <View style={{ backgroundColor: LIME, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
            <T f="mono" size={12} color="#0E0F10">
              {by.uploaded.length.toLocaleString('en')} / {total.toLocaleString('en')}
            </T>
          </View>
        </View>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: '#2F3338', overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: 10, borderRadius: 5, backgroundColor: LIME }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T size={12} color={t.heroText} style={{ opacity: 0.8 }}>
            Last upload {by.lastUpload ? hm(new Date(by.lastUpload)) : '—'}
          </T>
          <T size={12} color={t.heroText} style={{ opacity: 0.8 }}>
            {by.pending.length ? `${formatBytes(by.pendingBytes)} to send` : 'Nothing waiting'}
          </T>
        </View>
        {!apiUrl ? (
          <Pressable onPress={() => router.push('/settings')} accessibilityRole="link">
            <T f="semi" size={12} color={LIME}>
              Demo mode — uploads are simulated. Add the server URL in Settings →
            </T>
          </Pressable>
        ) : null}
      </View>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { label: `Pending · ${by.pending.length}`, value: 'pending' },
          { label: `Failed · ${by.failed.length}`, value: 'failed' },
          { label: `Done · ${by.uploaded.length}`, value: 'uploaded' },
        ]}
      />

      <FlatList
        data={rows}
        keyExtractor={(c) => c.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
        initialNumToRender={12}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 40, gap: 8 }}>
            <Icon name="check-circle" size={28} color={t.muted} />
            <T color={t.muted}>Nothing here.</T>
          </View>
        }
        renderItem={({ item: c }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, backgroundColor: t.card, borderWidth: 1, borderColor: t.line }}>
            <Thumb c={c} style={{ width: 48, height: 48, borderRadius: 12 }} onPress={() => router.push({ pathname: '/image/[id]', params: { id: c.id } })} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <T f="mono" size={12} numberOfLines={1}>
                {c.uri ? c.uri.split('/').pop() : c.id}
              </T>
              <T size={12} color={t.muted} numberOfLines={1}>
                {hmsMs(new Date(c.capturedAt))} · {formatBytes(c.size)}
                {c.error ? ` · ${c.error}` : ''}
                {c.status === 'failed' && c.nextRetryAt ? ` · retry ${hm(new Date(c.nextRetryAt))}` : ''}
              </T>
              {c.status === 'uploading' ? (
                <View style={{ height: 6, borderRadius: 3, backgroundColor: t.track, overflow: 'hidden' }}>
                  <View style={{ height: 6, width: `${Math.round(c.progress * 100)}%`, backgroundColor: t.isDark ? LIME : '#0E0F10' }} />
                </View>
              ) : null}
            </View>
            {c.status === 'failed' ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Retry upload" onPress={() => updateCapture(c.id, { status: 'pending', nextRetryAt: undefined, error: undefined })} style={{ height: 36, paddingHorizontal: 12, borderRadius: 12, backgroundColor: REC, justifyContent: 'center' }}>
                <T f="semi" size={13} color="#FFFFFF">
                  Retry
                </T>
              </Pressable>
            ) : c.status === 'uploaded' ? (
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={16} color="#0E0F10" />
              </View>
            ) : c.status === 'pending' ? (
              <T f="mono" size={11} color={t.muted}>
                QUEUED
              </T>
            ) : null}
          </View>
        )}
      />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label={paused ? 'Resume uploads' : 'Pause uploads'} onPress={() => setSettings({ uploadsPaused: !paused })} />
        <Button kind="primary" label={`Retry failed (${by.failed.length})`} disabled={!by.failed.length} onPress={retryFailed} />
      </View>
    </Screen>
  );
}
