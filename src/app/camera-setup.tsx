import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused, useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { Card, PrimaryButton, Row, Screen, Segmented, T, Toggle, Header } from '@/components/ui';
import { findCheckpoint } from '@/data/checkpoints';
import { startSession } from '@/store/captures';
import { setSettings, useSettings, type Sensitivity, type Trigger, type VideoQuality } from '@/store/settings';
import { CAMERA_BG, F, INK, LIME } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string }) {
  const t = useTheme();
  const btn = (d: number, primary: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${d < 0 ? 'Decrease' : 'Increase'} ${label}`}
      onPress={() => onChange(Math.min(max, Math.max(min, value + d)))}
      style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: primary ? t.btn : t.card2, borderWidth: primary ? 0 : 1, borderColor: t.line }}
    >
      <T f="bold" size={18} color={primary ? t.btnText : t.text}>
        {d < 0 ? '−' : '+'}
      </T>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {btn(-1, false)}
      <T f="mono" size={16} style={{ width: 34, textAlign: 'center' }}>
        {value}
      </T>
      {btn(1, true)}
    </View>
  );
}

export default function CameraSetup() {
  const t = useTheme();
  const router = useRouter();
  const focused = useIsFocused();
  const [cam] = useCameraPermissions();
  const s = useSettings((x) => x);
  const cp = findCheckpoint(s.checkpointId);

  const start = () => {
    if (!s.checkpointId || !s.operator) return router.replace('/');
    startSession(s.checkpointId, s.operator);
    router.push('/capture');
  };

  return (
    <Screen>
      <Header
        title="Camera setup"
        subtitle={cp ? `${cp.id} · ${cp.name}` : 'No checkpoint'}
        right={
          <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: t.card, borderWidth: 1, borderColor: t.line }}>
            <T f="mono" size={12}>
              Step 2/2
            </T>
          </View>
        }
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
        <View style={{ height: 190, borderRadius: 24, backgroundColor: CAMERA_BG, overflow: 'hidden' }}>
          {focused && cam?.granted ? (
            <CameraView style={{ flex: 1 }} facing={s.facing} animateShutter={false} />
          ) : (
            <Pressable onPress={() => router.push('/permissions')} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <T f="semi" color="#F4F5F2">
                {cam?.granted ? 'Preview paused' : 'Allow camera access →'}
              </T>
            </Pressable>
          )}
          <Svg width="100%" height="100%" style={{ position: 'absolute' }} pointerEvents="none">
            <Line x1="33.3%" y1="0" x2="33.3%" y2="100%" stroke="#FFFFFF" strokeOpacity={0.15} />
            <Line x1="66.6%" y1="0" x2="66.6%" y2="100%" stroke="#FFFFFF" strokeOpacity={0.15} />
            <Line x1="0" y1="33.3%" x2="100%" y2="33.3%" stroke="#FFFFFF" strokeOpacity={0.15} />
            <Line x1="0" y1="66.6%" x2="100%" y2="66.6%" stroke="#FFFFFF" strokeOpacity={0.15} />
            <Path d="M30 150 H1000" stroke={LIME} strokeWidth={2} strokeDasharray="7 7" />
          </Svg>
          <View style={{ position: 'absolute', left: 14, top: 14, backgroundColor: LIME, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 }}>
            <T f="monoB" size={11} color={INK}>
              PREVIEW
            </T>
          </View>
          <View style={{ position: 'absolute', right: 14, top: 14, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 }}>
            <T f="mono" size={11} color="#F4F5F2">
              {s.videoQuality} · {s.burstFrames}/burst
            </T>
          </View>
        </View>

        <Card style={{ paddingHorizontal: 16 }}>
          <Row label="Camera" right={<Segmented compact value={s.facing} onChange={(v) => setSettings({ facing: v })} options={[{ label: 'Back', value: 'back' as const }, { label: 'Front', value: 'front' as const }]} />} />
          <Row
            label="Video quality"
            hint="Photos use the camera's best size"
            right={
              <Segmented<VideoQuality>
                compact
                value={s.videoQuality}
                onChange={(v) => setSettings({ videoQuality: v })}
                options={[
                  { label: '720p', value: '720p' },
                  { label: '1080p', value: '1080p' },
                  { label: '4K', value: '2160p' },
                ]}
              />
            }
          />
          <Row label="Frames per participant" hint="Burst size on each trigger" right={<Stepper label="frames" value={s.burstFrames} min={1} max={10} onChange={(n) => setSettings({ burstFrames: n })} />} />
          <Row
            label="Capture trigger"
            hint={s.trigger === 'motion' ? 'Fires when the scene changes (beta)' : s.trigger === 'interval' ? 'Fires a burst on a timer' : 'Tap the shutter for each runner'}
            right={
              <Segmented<Trigger>
                compact
                value={s.trigger}
                onChange={(v) => setSettings({ trigger: v })}
                options={[
                  { label: 'Motion', value: 'motion' },
                  { label: 'Timer', value: 'interval' },
                  { label: 'Tap', value: 'manual' },
                ]}
              />
            }
          />
          {s.trigger === 'motion' ? (
            <Row
              label="Motion sensitivity"
              right={
                <Segmented<Sensitivity>
                  compact
                  value={s.sensitivity}
                  onChange={(v) => setSettings({ sensitivity: v })}
                  options={[
                    { label: 'Low', value: 'low' },
                    { label: 'Med', value: 'medium' },
                    { label: 'High', value: 'high' },
                  ]}
                />
              }
            />
          ) : null}
          {s.trigger === 'interval' ? (
            <Row label="Burst every (seconds)" right={<Stepper label="interval" value={s.intervalSec} min={1} max={60} onChange={(n) => setSettings({ intervalSec: n })} />} />
          ) : null}
          <Row label="Burn timestamp into photos" hint="Checkpoint · date · time · zone" last right={<Toggle label="Burn timestamp into photos" value={s.overlay} onChange={(v) => setSettings({ overlay: v })} />} />
        </Card>

        {!cam?.granted ? (
          <T size={13} color="#D23F22" style={{ fontFamily: F.semi }}>
            Camera permission is needed before you can start.
          </T>
        ) : null}
      </ScrollView>

      <PrimaryButton label="Start capture session" icon="play" onPress={start} disabled={!cam?.granted} />
    </Screen>
  );
}
