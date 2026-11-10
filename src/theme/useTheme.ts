import { useColorScheme } from 'react-native';

import { useSettings } from '@/store/settings';

import { dark, light, type Palette } from './tokens';

export function useTheme(): Palette {
  const mode = useSettings((s) => s.themeMode);
  const system = useColorScheme();
  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  return isDark ? dark : light;
}
