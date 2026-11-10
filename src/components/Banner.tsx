import { View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

import { Button, Icon, T, type IconName } from './ui';

export type Tone = 'neutral' | 'warn' | 'error';

const TONES: Record<Tone, { light: [string, string]; dark: [string, string] }> = {
  neutral: { light: ['#EEEEE9', '#0E0F10'], dark: ['#24272B', '#F4F5F2'] },
  warn: { light: ['#FCEFD2', '#8A5A00'], dark: ['#3A2C08', '#F2C14E'] },
  error: { light: ['#FDE3DC', '#B83A1F'], dark: ['#3A1810', '#FF8A70'] },
};

/** Warning / error card used for offline, storage, battery, clock and upload problems. */
export function Banner({
  tone,
  icon,
  title,
  message,
  kind,
  action,
  onAction,
  onDismiss,
}: {
  tone: Tone;
  icon: IconName;
  title: string;
  message: string;
  kind?: string;
  action?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  const t = useTheme();
  const [bg, fg] = TONES[tone][t.isDark ? 'dark' : 'light'];
  return (
    <View style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: 20, backgroundColor: t.card, borderWidth: 1, borderColor: t.line }}>
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={fg} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <T f="bold" size={15} style={{ flex: 1 }}>
            {title}
          </T>
          {kind ? (
            <T f="mono" size={10} color={t.muted}>
              {kind}
            </T>
          ) : null}
        </View>
        <T size={13} color={t.muted} style={{ lineHeight: 19 }}>
          {message}
        </T>
        {action || onDismiss ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            {action ? <Button kind="primary" label={action} onPress={onAction} style={{ flex: 0, minHeight: 36, borderRadius: 12 }} /> : null}
            {onDismiss ? <Button label="Dismiss" onPress={onDismiss} style={{ flex: 0, minHeight: 36, borderRadius: 12 }} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
