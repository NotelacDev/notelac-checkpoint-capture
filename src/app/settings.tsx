import { Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Card, Header, Row, Screen, SectionLabel, Segmented, T, Toggle } from '@/components/ui';
import { findCheckpoint } from '@/data/checkpoints';
import { clearAllData, loadDemoData } from '@/services/demoData';
import { stampQueue } from '@/services/media';
import { formatBytes, syncTime } from '@/services/time';
import { capturesStore, deleteLocalFiles, useCaptures } from '@/store/captures';
import { setSettings, useSettings, type ThemeMode } from '@/store/settings';
import { F, INK, LIME } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function SettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const s = useSettings((x) => x);
  const captures = useCaptures((x) => x.captures);
  const offset = useCaptures((x) => x.timeOffsetMs);
  const synced = useCaptures((x) => x.timeSyncedAt);
  const cp = findCheckpoint(s.checkpointId);
  const [apiUrl, setApiUrl] = useState(s.apiUrl);
  const [token, setToken] = useState(s.apiToken);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const stamping = stampQueue.use((x) => x.jobs.length);

  const usage = useMemo(() => {
    let local = 0;
    let removable = 0;
    for (const c of captures) {
      if (!c.uri) continue;
      local += c.size;
      if (c.status === 'uploaded') removable += c.size;
    }
    return { local, removable };
  }, [captures]);

  const tog = (key: 'overlay' | 'overlayMs' | 'overlayGps' | 'wifiOnly' | 'autoRetry' | 'keepLocal' | 'haptics' | 'shutterSound' | 'keepAwake', label: string) => (
    <Toggle label={label} value={s[key]} onChange={(v) => setSettings({ [key]: v })} />
  );

  const saveServer = async () => {
    const url = apiUrl.trim().replace(/\/$/, '');
    setSettings({ apiUrl: url, apiToken: token.trim() });
    if (!url) return setSyncMsg('Demo mode on — uploads are simulated.');
    setSyncMsg('Checking server time…');
    const off = await syncTime();
    setSyncMsg(off == null ? 'Saved. Could not reach GET /time on the server.' : `Saved. Clock offset ${off >= 0 ? '+' : ''}${off} ms.`);
  };

  const freeSpace = () =>
    Alert.alert('Remove uploaded files?', `Frees ${formatBytes(usage.removable)}. The server keeps its copy; records stay in history.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const all = capturesStore.get().captures;
          all.filter((c) => c.status === 'uploaded' && c.uri).forEach(deleteLocalFiles);
          capturesStore.set({ captures: all.map((c) => (c.status === 'uploaded' ? { ...c, uri: '' } : c)) });
        },
      },
    ]);

  const signOut = () =>
    Alert.alert('Sign out?', 'Captures that have not uploaded yet stay on this phone and upload after the next sign-in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setSettings({ operator: null, checkpointId: null });
          capturesStore.set({ activeSessionId: null });
          router.replace('/login');
        },
      },
    ]);

  const input = { flex: 1, height: 46, borderRadius: 12, backgroundColor: t.card2, color: t.text, fontFamily: F.monoM, fontSize: 13, paddingHorizontal: 12 } as const;

  return (
    <Screen edges={['top']}>
      <Header title="Settings" />
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: LIME, borderRadius: 22, padding: 16 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' }}>
            <T f="bold" color={LIME}>
              {(s.operator ?? 'OP').slice(0, 2).toUpperCase()}
            </T>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T f="bold" size={16} color={INK}>
              {s.operator ?? 'Not signed in'}
            </T>
            <T f="mono" size={11} color={INK}>
              {cp ? `${cp.id} · ${cp.name}` : 'No checkpoint'}
            </T>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/checkpoint')} style={{ height: 36, paddingHorizontal: 12, borderRadius: 12, backgroundColor: INK, justifyContent: 'center' }}>
            <T f="semi" size={13} color={LIME}>
              Switch
            </T>
          </Pressable>
        </View>

        <SectionLabel>APPEARANCE</SectionLabel>
        <Segmented<ThemeMode>
          value={s.themeMode}
          onChange={(v) => setSettings({ themeMode: v })}
          options={[
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
            { label: 'System', value: 'system' },
          ]}
        />

        <SectionLabel>CAPTURE</SectionLabel>
        <Card style={{ paddingHorizontal: 16 }}>
          <Row label="Camera & burst" hint={`${s.facing === 'back' ? 'Back' : 'Front'} · ${s.videoQuality} · ${s.burstFrames} frames · ${s.trigger}`} onPress={() => router.push('/camera-setup')} />
          <Row
            label="Video segment length"
            hint="Long recordings are split into files"
            right={
              <Segmented<number>
                compact
                value={s.videoSegmentMin}
                onChange={(v) => setSettings({ videoSegmentMin: v })}
                options={[
                  { label: '5m', value: 5 },
                  { label: '10m', value: 10 },
                  { label: '15m', value: 15 },
                ]}
              />
            }
          />
          <Row label="Keep screen awake" hint="During a capture session" right={tog('keepAwake', 'Keep screen awake')} />
          <Row label="Vibrate on capture" hint="Short pulse per burst / marker" right={tog('haptics', 'Vibrate on capture')} />
          <Row label="Shutter sound" hint="Off for quiet checkpoints (some regions force it on)" last right={tog('shutterSound', 'Shutter sound')} />
        </Card>

        <SectionLabel>TIMESTAMP OVERLAY</SectionLabel>
        <Card style={{ paddingHorizontal: 16 }}>
          <Row label="Burn timestamp into photos" hint="Also saved in the JSON sidecar" right={tog('overlay', 'Burn timestamp into photos')} />
          <Row label="Show milliseconds" hint="09:32:14.218" right={tog('overlayMs', 'Show milliseconds')} />
          <Row label="Show GPS on overlay" hint="Needs location permission" last right={tog('overlayGps', 'Show GPS on overlay')} />
        </Card>

        <SectionLabel>SERVER</SectionLabel>
        <Card style={{ padding: 16, gap: 10 }}>
          <T size={12} color={t.muted}>
            Leave empty for demo mode. The app calls GET /time and POST /captures on this URL.
          </T>
          <View style={{ flexDirection: 'row' }}>
            <TextInput accessibilityLabel="Server URL" value={apiUrl} onChangeText={setApiUrl} placeholder="https://api.example.com" placeholderTextColor={t.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={input} />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <TextInput accessibilityLabel="API token" value={token} onChangeText={setToken} placeholder="API token (optional)" placeholderTextColor={t.muted} autoCapitalize="none" autoCorrect={false} secureTextEntry style={input} />
          </View>
          <Button kind="primary" label="Save & sync time" onPress={saveServer} style={{ flex: 0 }} />
          <T size={12} color={t.muted}>
            {syncMsg ?? (synced ? `Clock offset ${offset >= 0 ? '+' : ''}${offset} ms` : 'Clock not synced yet')}
          </T>
        </Card>

        <SectionLabel>UPLOAD & STORAGE</SectionLabel>
        <Card style={{ paddingHorizontal: 16 }}>
          <Row label="Upload on Wi-Fi only" hint="Off = Wi-Fi and mobile data" right={tog('wifiOnly', 'Upload on Wi-Fi only')} />
          <Row label="Auto-retry failed uploads" hint="Every 30 s, up to 10 tries" right={tog('autoRetry', 'Auto-retry failed uploads')} />
          <Row label="Keep photo after upload" hint="Off = delete from phone once uploaded" right={tog('keepLocal', 'Keep photo after upload')} />
          <Row label="Storage used" hint={`${formatBytes(Paths.availableDiskSpace)} free on phone`} last right={<T f="mono" size={13} color={t.muted}>{formatBytes(usage.local)}</T>} />
        </Card>
        <Button label={`Remove uploaded files (${formatBytes(usage.removable)})`} onPress={freeSpace} disabled={!usage.removable} style={{ flex: 0 }} />

        <SectionLabel>DEVICE</SectionLabel>
        <Card style={{ paddingHorizontal: 16 }}>
          <Row label="Device health" hint="Battery, storage, network, clock" onPress={() => router.push('/health')} />
          <Row label="Permissions" hint="Camera, microphone, location" onPress={() => router.push('/permissions')} />
          <Row label="Session history" hint="Past capture sessions" onPress={() => router.push('/history')} />
          <Row label="Alerts & states" hint="Preview every warning the app can show" last onPress={() => router.push('/alerts')} />
        </Card>

        <SectionLabel>TEST DATA</SectionLabel>
        <Card style={{ padding: 16, gap: 10 }}>
          <T size={12} color={t.muted}>
            Adds 3 sample sessions (3 days ago, yesterday, live today) with 18 runner bursts — uploaded, pending and failed — using bundled photos.
          </T>
          <Button
            kind="primary"
            label={stamping ? `Stamping sample photos… ${stamping} left` : 'Load sample data'}
            disabled={stamping > 0}
            onPress={() => void loadDemoData().catch((e) => Alert.alert('Could not load sample data', String(e)))}
            style={{ flex: 0 }}
          />
          <Button
            kind="dangerOutline"
            label="Clear all captures & sessions"
            onPress={() =>
              Alert.alert('Delete everything on this phone?', 'All sessions, photos, videos and the upload queue are removed. This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete all', style: 'destructive', onPress: clearAllData },
              ])
            }
            style={{ flex: 0 }}
          />
        </Card>

        <Button kind="dangerOutline" label="Sign out" onPress={signOut} style={{ flex: 0 }} />
        <T f="monoM" size={11} color={t.muted} style={{ textAlign: 'center' }}>
          Notelac Checkpoint Capture · v0.1.0
        </T>
      </ScrollView>
    </Screen>
  );
}
