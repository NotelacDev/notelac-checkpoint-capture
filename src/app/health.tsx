import { useBatteryLevel, useBatteryState, BatteryState } from 'expo-battery';
import * as Device from 'expo-device';
import { Paths } from 'expo-file-system';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Header, Icon, Screen, T, statusColor, type IconName } from '@/components/ui';
import { useNow } from '@/hooks/useNow';
import { formatBytes, hm, hmsMs, now, syncTime } from '@/services/time';
import { netStore } from '@/services/uploader';
import { useCaptures } from '@/store/captures';
import { useSettings } from '@/store/settings';
import { LIME } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const AVG_FRAME_BYTES = 1.8 * 1024 * 1024;

type Level = 'ok' | 'warn' | 'bad' | 'off';
type Tile = { k: string; v: string; hint: string; pct: number; level: Level; icon: IconName };

async function readGps(): Promise<{ acc: number | null; ok: boolean }> {
  const p = await Location.getForegroundPermissionsAsync();
  if (!p.granted) return { acc: null, ok: false };
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
  return { acc: pos?.coords.accuracy ?? null, ok: !!pos };
}

function LiveClocks() {
  const t = useTheme();
  const offset = useCaptures((s) => s.timeOffsetMs);
  const d = useNow(100);
  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={11} color={t.heroText} style={{ opacity: 0.75 }}>
          Device clock
        </T>
        <T f="monoB" size={15} color={t.heroText}>
          {hmsMs(new Date(d))}
        </T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={11} color={t.heroText} style={{ opacity: 0.75 }}>
          Server clock
        </T>
        <T f="monoB" size={15} color={LIME}>
          {hmsMs(new Date(d + offset))}
        </T>
      </View>
    </View>
  );
}

export default function Health() {
  const t = useTheme();
  const battery = useBatteryLevel();
  const batteryState = useBatteryState();
  const net = netStore.use((s) => s);
  const apiUrl = useSettings((s) => s.apiUrl);
  const synced = useCaptures((s) => s.timeSyncedAt);
  const offset = useCaptures((s) => s.timeOffsetMs);
  const queue = useCaptures((s) => s.captures.filter((c) => c.status !== 'uploaded').length);
  const [gps, setGps] = useState<{ acc: number | null; ok: boolean } | null>(null);
  const [checkedAt, setCheckedAt] = useState(now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void readGps().then((g) => {
      if (alive) setGps(g);
    });
    return () => {
      alive = false;
    };
  }, []);

  const runDiagnostics = async () => {
    setBusy(true);
    await Promise.all([readGps().then(setGps), syncTime()]);
    setCheckedAt(now());
    setBusy(false);
  };

  const free = Paths.availableDiskSpace;
  const total = Paths.totalDiskSpace || 1;
  const charging = batteryState === BatteryState.CHARGING || batteryState === BatteryState.FULL;
  const pctBattery = battery >= 0 ? Math.round(battery * 100) : -1;

  const tiles: Tile[] = [
    {
      k: 'Battery',
      v: pctBattery >= 0 ? `${pctBattery}%` : 'n/a',
      hint: charging ? 'Charging' : pctBattery >= 0 && pctBattery < 20 ? 'Connect a power bank' : 'On battery',
      pct: Math.max(0, pctBattery),
      level: pctBattery < 0 ? 'off' : pctBattery < 15 ? 'bad' : pctBattery < 30 ? 'warn' : 'ok',
      icon: 'battery',
    },
    {
      k: 'Storage free',
      v: formatBytes(free),
      hint: `≈ ${Math.floor(free / AVG_FRAME_BYTES).toLocaleString('en')} frames left`,
      pct: Math.round((free / total) * 100),
      level: free < 2 * 1024 ** 3 ? 'bad' : free < 5 * 1024 ** 3 ? 'warn' : 'ok',
      icon: 'hard-drive',
    },
    {
      k: 'Network',
      v: net.online ? (net.type === 'wifi' ? 'Wi-Fi' : net.type === 'cellular' ? 'Mobile' : 'Online') : 'Offline',
      hint: net.online ? 'Uploads can run' : 'Saving on phone',
      pct: net.online ? 100 : 0,
      level: net.online ? 'ok' : 'bad',
      icon: net.online ? 'wifi' : 'wifi-off',
    },
    {
      k: 'Clock sync',
      v: synced ? `${offset >= 0 ? '+' : ''}${offset} ms` : 'Not synced',
      hint: synced ? `Synced ${hm(new Date(synced))}` : apiUrl ? 'Tap Run diagnostics' : 'Needs server URL',
      pct: synced ? Math.max(5, 100 - Math.min(100, Math.abs(offset) / 10)) : 0,
      level: !synced ? 'warn' : Math.abs(offset) > 1000 ? 'bad' : Math.abs(offset) > 200 ? 'warn' : 'ok',
      icon: 'clock',
    },
    {
      k: 'GPS',
      v: gps == null ? '…' : !gps.ok ? 'Off' : gps.acc != null ? `±${Math.round(gps.acc)} m` : 'Fix',
      hint: gps?.ok ? 'Used on overlay' : 'Optional',
      pct: gps?.ok ? 90 : 0,
      level: gps?.ok ? 'ok' : 'off',
      icon: 'navigation',
    },
    {
      k: 'Upload queue',
      v: String(queue),
      hint: queue ? 'Waiting to send' : 'All uploaded',
      pct: Math.max(4, 100 - Math.min(100, queue)),
      level: queue > 500 ? 'warn' : 'ok',
      icon: 'upload-cloud',
    },
  ];
  const worst = tiles.some((x) => x.level === 'bad') ? 'bad' : tiles.some((x) => x.level === 'warn') ? 'warn' : 'ok';

  return (
    <Screen>
      <Header title="Device health" subtitle={`${Device.manufacturer ?? ''} ${Device.modelName ?? ''}`.trim() || undefined} />
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
        <View style={{ backgroundColor: t.hero, borderRadius: 24, padding: 18, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: worst === 'ok' ? LIME : statusColor(worst), alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={worst === 'ok' ? 'check' : 'alert-triangle'} size={18} color="#0E0F10" />
            </View>
            <T f="head" size={20} color={t.heroText} style={{ flex: 1 }}>
              {worst === 'ok' ? 'Ready to capture' : worst === 'warn' ? 'Ready, with warnings' : 'Needs attention'}
            </T>
            <T f="mono" size={11} color={t.heroText} style={{ opacity: 0.75 }}>
              checked {hm(new Date(checkedAt))}
            </T>
          </View>
          <LiveClocks />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tiles.map((x) => (
            <View key={x.k} style={{ width: '48.7%', backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 18, padding: 12, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name={x.icon} size={14} color={t.muted} />
                  <T f="semi" size={12} color={t.muted}>
                    {x.k}
                  </T>
                </View>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor(x.level) }} />
              </View>
              <T f="headX" size={20} numberOfLines={1} adjustsFontSizeToFit>
                {x.v}
              </T>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: t.track, overflow: 'hidden' }}>
                <View style={{ height: 6, width: `${x.pct}%`, backgroundColor: x.level === 'warn' ? statusColor('warn') : x.level === 'bad' ? statusColor('bad') : t.sel }} />
              </View>
              <T size={11} color={t.muted} numberOfLines={1}>
                {x.hint}
              </T>
            </View>
          ))}
        </View>
        <T size={12} color={t.muted}>
          Phone temperature is not readable from Expo Go; it can be added in a development build.
        </T>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button kind="primary" label={busy ? 'Checking…' : 'Run diagnostics'} disabled={busy} onPress={runDiagnostics} />
      </View>
    </Screen>
  );
}
