import { Image } from 'react-native';
import Svg, { Polygon, Rect } from 'react-native-svg';

import { CHARCOAL, LIME } from '@/theme/tokens';

/** Notelac mark — vector, geometry measured from the brand logo (40×40 box). */
export function LogoMark({ size = 38 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityLabel="Notelac logo">
      <Rect width={40} height={40} fill={CHARCOAL} />
      <Polygon points="6.9,5.9 23.9,5.9 23.9,24.5" fill={LIME} />
      <Polygon points="3.9,11.1 3.9,34.9 25.4,34.9" fill={LIME} />
      <Rect x={26.5} y={5.9} width={8.7} height={25.4} fill={LIME} />
      <Rect x={26.5} y={34.3} width={8.7} height={0.6} fill={LIME} />
    </Svg>
  );
}

const LOGO_DARK = require('../../assets/brand/notelac-logo-dark.png');
const LOGO_LIGHT = require('../../assets/brand/notelac-logo-light.png');
const RATIO = 671 / 142;

/** Full Notelac logo (mark + wordmark + ™). `ink` is the wordmark colour: dark on light backgrounds. */
export function Logo({ height = 40, ink = 'dark' }: { height?: number; ink?: 'dark' | 'light' }) {
  return (
    <Image
      source={ink === 'dark' ? LOGO_DARK : LOGO_LIGHT}
      style={{ height, width: height * RATIO }}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Notelac"
    />
  );
}
