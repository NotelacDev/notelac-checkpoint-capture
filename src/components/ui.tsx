import Feather from '@expo/vector-icons/Feather';
import { useRouter, type Href } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';

import { F, INK, LIME, OK, REC, WARN, type Palette } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type IconName = ComponentProps<typeof Feather>['name'];
export const Icon = Feather;

type FontKey = keyof typeof F;

/** Text with the design's font families. */
export function T({
  f = 'regular',
  size = 15,
  color,
  style,
  children,
  ...rest
}: { f?: FontKey; size?: number; color?: string; style?: StyleProp<TextStyle>; children?: ReactNode } & Omit<ComponentProps<typeof Text>, 'style'>) {
  const t = useTheme();
  return (
    <Text {...rest} style={[{ fontFamily: F[f], fontSize: size, color: color ?? t.text }, style]}>
      {children}
    </Text>
  );
}

export function Screen({ children, edges = ['top', 'bottom'], style }: { children: ReactNode; edges?: Edge[]; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[{ flex: 1, paddingHorizontal: 20, paddingTop: 12, gap: 14 }, style]}>{children}</View>
    </SafeAreaView>
  );
}

export function RoundButton({
  icon,
  label,
  onPress,
  size = 44,
  style,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: t.card,
          borderWidth: 1,
          borderColor: t.line,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} size={20} color={t.text} />
    </Pressable>
  );
}

/** Back button + title (+ optional subtitle and right element). */
export function Header({ title, subtitle, right, back = true }: { title: string; subtitle?: string; right?: ReactNode; back?: boolean }) {
  const router = useRouter();
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {back && <RoundButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/capture'))} />}
      <View style={{ flex: 1 }}>
        {subtitle ? <T size={13} color={t.muted}>{subtitle}</T> : null}
        <T f="head" size={22} style={{ letterSpacing: -0.4 }} numberOfLines={1}>
          {title}
        </T>
      </View>
      {right}
    </View>
  );
}

/** Black (light) / lime (dark) button with the arrow chip, as on the canvas. */
export function PrimaryButton({
  label,
  onPress,
  icon = 'arrow-right',
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: 60,
          borderRadius: 20,
          backgroundColor: t.btn,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 22,
          paddingRight: 8,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <T f="head" size={17} color={t.btnText}>
        {label}
      </T>
      <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={t.chipText} />
      </View>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  kind = 'secondary',
  style,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  kind?: 'primary' | 'secondary' | 'danger' | 'dangerOutline';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.btn : kind === 'danger' ? REC : kind === 'dangerOutline' ? 'transparent' : t.card;
  const fg = kind === 'primary' ? t.btnText : kind === 'danger' ? '#FFFFFF' : kind === 'dangerOutline' ? '#D23F22' : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          minHeight: 54,
          borderRadius: 18,
          backgroundColor: bg,
          borderWidth: kind === 'secondary' ? 1 : kind === 'dangerOutline' ? 1.5 : 0,
          borderColor: kind === 'dangerOutline' ? REC : t.line,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 12,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <T f="head" size={15} color={fg}>
        {label}
      </T>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 20 }, style]}>{children}</View>;
}

/** Lime card with the cut top-right corner (the canvas' "folder" shape). */
export function NotchCard({ children, notch = 48, style }: { children: ReactNode; notch?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: LIME, borderRadius: 24, padding: 20, overflow: 'hidden' }, style]}>
      {children}
      <Svg width={notch} height={notch} style={{ position: 'absolute', top: 0, right: 0 }} pointerEvents="none">
        <Polygon points={`0,0 ${notch},0 ${notch},${notch}`} fill={t.bg} />
      </Svg>
    </View>
  );
}

export function Segmented<V extends string | number>({
  options,
  value,
  onChange,
  compact,
}: {
  options: { label: string; value: V }[];
  value: V;
  onChange: (v: V) => void;
  compact?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 4,
        padding: 4,
        borderRadius: compact ? 12 : 16,
        backgroundColor: compact ? t.card2 : t.card,
        borderWidth: compact ? 0 : 1,
        borderColor: t.line,
        flex: compact ? 0 : undefined,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{
              flex: compact ? 0 : 1,
              minHeight: compact ? 34 : 40,
              paddingHorizontal: 12,
              borderRadius: compact ? 9 : 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? t.btn : 'transparent',
            }}
          >
            <T f="semi" size={13} color={on ? t.btnText : t.muted}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={8}
      style={{
        width: 52,
        height: 32,
        borderRadius: 16,
        padding: 3,
        flexDirection: 'row',
        justifyContent: value ? 'flex-end' : 'flex-start',
        backgroundColor: value ? t.sel : t.switchOff,
      }}
    >
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: value ? t.knob : '#FFFFFF' }} />
    </Pressable>
  );
}

/** One row inside a settings-style card. */
export function Row({ label, hint, right, last, onPress }: { label: string; hint?: string; right?: ReactNode; last?: boolean; onPress?: () => void }) {
  const t = useTheme();
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 60,
        paddingVertical: 8,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.line,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T f="semi" size={15}>
          {label}
        </T>
        {hint ? (
          <T size={12} color={t.muted}>
            {hint}
          </T>
        ) : null}
      </View>
      {right}
      {onPress ? <Icon name="chevron-right" size={18} color={t.muted} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function SectionLabel({ children }: { children: string }) {
  const t = useTheme();
  return (
    <T f="bold" size={12} color={t.muted} style={{ letterSpacing: 1, paddingLeft: 4 }}>
      {children}
    </T>
  );
}

export function Stat({ label, value, accent, onPress, valueColor }: { label: string; value: string; accent?: boolean; onPress?: () => void; valueColor?: string }) {
  const t = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={{
        flex: 1,
        borderRadius: 18,
        padding: 12,
        gap: 2,
        backgroundColor: accent ? LIME : t.card,
        borderWidth: accent ? 0 : 1,
        borderColor: t.line,
      }}
    >
      <T f="semi" size={12} color={accent ? INK : t.muted}>
        {label}
        {onPress ? ' ›' : ''}
      </T>
      <T f="headX" size={22} color={valueColor ?? (accent ? INK : t.text)} style={{ letterSpacing: -0.4 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
    </Pressable>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export const statusColor = (s: 'ok' | 'warn' | 'bad' | 'off') => (s === 'ok' ? OK : s === 'warn' ? WARN : s === 'bad' ? REC : '#9AA0A6');

export function Badge({ label, tone }: { label: string; tone: 'lime' | 'red' | 'neutral' | 'ink' }) {
  const t = useTheme();
  const map: Record<string, [string, string]> = {
    lime: [LIME, INK],
    red: [REC, '#FFFFFF'],
    ink: [INK, LIME],
    neutral: [t.card2, t.text],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
      <T f="bold" size={11} color={fg}>
        {label}
      </T>
    </View>
  );
}

export function useNav() {
  const router = useRouter();
  return (href: Href) => router.push(href);
}

export type { Palette };
