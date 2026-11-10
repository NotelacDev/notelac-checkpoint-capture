import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';

import { Banner, type Tone } from '@/components/Banner';
import { Button, Header, Icon, Screen, T, type IconName } from '@/components/ui';
import { retryFailed } from '@/store/captures';
import { INK, LIME } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Item = { id: string; tone: Tone; icon: IconName; kind: string; title: string; message: string; action: string; onAction: () => void };

/** Reference screen: every warning the app can raise, with working actions. */
export default function Alerts() {
  const t = useTheme();
  const router = useRouter();
  const [hidden, setHidden] = useState<string[]>([]);

  const items: Item[] = [
    { id: 'offline', tone: 'neutral', icon: 'wifi-off', kind: 'BANNER', title: 'You’re offline', message: 'Capture keeps running. Frames are saved on the phone and upload when the network is back.', action: 'Upload queue', onAction: () => router.push('/uploads') },
    { id: 'clock', tone: 'warn', icon: 'clock', kind: 'WARNING', title: 'Clock drift over 1 s', message: 'This phone’s time is out of sync with the race server. Timestamps may not match other checkpoints.', action: 'Sync time', onAction: () => router.push('/health') },
    { id: 'storage', tone: 'warn', icon: 'hard-drive', kind: 'WARNING', title: 'Storage almost full', message: 'Under 2 GB left. Uploaded photos can be removed from the phone safely.', action: 'Free up space', onAction: () => router.push('/settings') },
    { id: 'battery', tone: 'error', icon: 'battery', kind: 'CRITICAL', title: 'Battery low', message: 'Connect a power bank. The session is saved if the phone shuts down.', action: 'Device health', onAction: () => router.push('/health') },
    { id: 'camera', tone: 'error', icon: 'camera-off', kind: 'ERROR', title: 'Camera access blocked', message: 'Allow camera access in system settings to keep capturing.', action: 'Open settings', onAction: () => void Linking.openSettings() },
    { id: 'upload', tone: 'error', icon: 'upload-cloud', kind: 'ERROR', title: 'Uploads failed', message: 'The server did not answer. Failed items retry every 30 seconds.', action: 'Retry now', onAction: retryFailed },
  ];

  return (
    <Screen edges={['top']}>
      <Header title="Alerts & states" subtitle="Banners, toasts and dialogs" />
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: INK }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={16} color={INK} />
          </View>
          <T f="semi" size={13} color="#FFFFFF" style={{ flex: 1 }}>
            Burst saved · 5 frames
          </T>
          <T f="mono" size={10} color="#A3A7AD">
            TOAST
          </T>
        </View>

        {items
          .filter((i) => !hidden.includes(i.id))
          .map((i) => (
            <Banner key={i.id} {...i} onDismiss={() => setHidden((h) => [...h, i.id])} />
          ))}
        {hidden.length ? <Button label="Show all again" onPress={() => setHidden([])} style={{ flex: 0 }} /> : null}

        <Button
          label="Preview the “End session?” dialog"
          onPress={() =>
            Alert.alert('End this session?', '1,248 captures. 36 are still uploading — they keep uploading after you end.', [
              { text: 'Keep capturing', style: 'cancel' },
              { text: 'End session', style: 'destructive' },
            ])
          }
          style={{ flex: 0 }}
        />
        <T size={12} color={t.muted}>
          Offline status also shows live on the capture screen and in Upload & sync.
        </T>
      </ScrollView>
    </Screen>
  );
}
