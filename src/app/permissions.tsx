import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import { Icon, PrimaryButton, RoundButton, Screen, T, type IconName } from '@/components/ui';
import { useSettings } from '@/store/settings';
import { INK, LIME } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Perm = {
  name: string;
  why: string;
  icon: IconName;
  required: boolean;
  granted: boolean;
  canAsk: boolean;
  ask: () => Promise<unknown>;
};

export default function Permissions() {
  const t = useTheme();
  const router = useRouter();
  const checkpointId = useSettings((s) => s.checkpointId);
  const [cam, askCam] = useCameraPermissions();
  const [mic, askMic] = useMicrophonePermissions();
  const [loc, askLoc] = Location.useForegroundPermissions();

  const perms: Perm[] = [
    { name: 'Camera', why: 'Live preview, photos and video', icon: 'camera', required: true, granted: !!cam?.granted, canAsk: cam?.canAskAgain ?? true, ask: askCam },
    { name: 'Microphone', why: 'Audio track on video recordings', icon: 'mic', required: false, granted: !!mic?.granted, canAsk: mic?.canAskAgain ?? true, ask: askMic },
    { name: 'Location', why: 'GPS on the timestamp overlay', icon: 'map-pin', required: false, granted: !!loc?.granted, canAsk: loc?.canAskAgain ?? true, ask: askLoc },
  ];
  const granted = perms.filter((p) => p.granted).length;

  const next = () => {
    if (router.canGoBack() && checkpointId) router.back();
    else router.replace(checkpointId ? '/camera-setup' : '/checkpoint');
  };

  return (
    <Screen style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <RoundButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))} />
        <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: t.card, borderWidth: 1, borderColor: t.line }}>
          <T f="mono" size={12}>
            {granted} of {perms.length} allowed
          </T>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <T f="head" size={32} style={{ letterSpacing: -1, lineHeight: 35 }}>
          A few permissions before you start.
        </T>
        <T size={14} color={t.muted} style={{ lineHeight: 21 }}>
          The camera is required. Microphone and location make videos and timestamps more complete. Photos are stored inside the app, so no gallery access is needed.
        </T>
      </View>

      <ScrollView contentContainerStyle={{ gap: 8 }}>
        {perms.map((p) => {
          const blocked = !p.granted && !p.canAsk;
          return (
            <View key={p.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: t.card, borderWidth: 1, borderColor: t.line }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: p.granted ? LIME : t.card2 }}>
                <Icon name={p.icon} size={22} color={p.granted ? INK : t.text} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <T f="semi">{p.name}</T>
                  <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: p.required ? t.text : t.card2 }}>
                    <T f="bold" size={10} color={p.required ? t.bg : t.muted}>
                      {p.required ? 'Required' : 'Optional'}
                    </T>
                  </View>
                </View>
                <T size={12} color={t.muted}>
                  {blocked ? 'Blocked — allow it in system settings' : p.why}
                </T>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${p.granted ? 'Allowed' : 'Allow'} ${p.name}`}
                disabled={p.granted}
                onPress={() => (blocked ? Linking.openSettings() : p.ask())}
                style={{
                  minWidth: 80,
                  height: 38,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: p.granted ? 'transparent' : t.btn,
                  borderWidth: p.granted ? 1 : 0,
                  borderColor: t.line,
                }}
              >
                <T f="semi" size={13} color={p.granted ? t.muted : t.btnText}>
                  {p.granted ? 'Allowed' : blocked ? 'Settings' : 'Allow'}
                </T>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <PrimaryButton label="Continue" onPress={next} disabled={!cam?.granted} />
    </Screen>
  );
}
