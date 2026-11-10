// Design tokens shared by every screen. Values match the Notelac design canvas.

/** Brand colours, sampled from the Notelac logo. */
export const LIME = '#CFFE0F';
export const CHARCOAL = '#272A31';
export const INK = '#0E0F10';
export const REC = '#E5482B';
export const OK = '#3BA55C';
export const WARN = '#E8A317';
export const CAMERA_BG = '#15171A';

export type Palette = {
  isDark: boolean;
  bg: string;
  card: string;
  card2: string;
  line: string;
  text: string;
  muted: string;
  /** Primary button background / text. */
  btn: string;
  btnText: string;
  /** Small square chip inside the primary button. */
  chip: string;
  chipText: string;
  link: string;
  track: string;
  /** Selected border, radio and switch-on color. */
  sel: string;
  knob: string;
  /** Dark hero card (sync progress, health). */
  hero: string;
  heroText: string;
  switchOff: string;
};

export const light: Palette = {
  isDark: false,
  bg: '#F3F3EF',
  card: '#FFFFFF',
  card2: '#EEEEE9',
  line: '#E0E0DA',
  text: INK,
  muted: '#5B6067',
  btn: INK,
  btnText: '#FFFFFF',
  chip: LIME,
  chipText: INK,
  link: '#3F4D00',
  track: '#EEEEE9',
  sel: INK,
  knob: LIME,
  hero: INK,
  heroText: '#FFFFFF',
  switchOff: '#C9CCC4',
};

export const dark: Palette = {
  isDark: true,
  bg: INK,
  card: '#1A1C1F',
  card2: '#24272B',
  line: '#2A2D31',
  text: '#F4F5F2',
  muted: '#A3A7AD',
  btn: LIME,
  btnText: INK,
  chip: INK,
  chipText: LIME,
  link: LIME,
  track: '#2F3338',
  sel: LIME,
  knob: INK,
  hero: '#1A1C1F',
  heroText: '#F4F5F2',
  switchOff: '#3A3E44',
};

/** Font family names, as registered by useFonts in the root layout. */
export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  head: 'InterTight_700Bold',
  headX: 'InterTight_800ExtraBold',
  mono: 'JetBrainsMono_600SemiBold',
  monoM: 'JetBrainsMono_500Medium',
  monoB: 'JetBrainsMono_700Bold',
} as const;
