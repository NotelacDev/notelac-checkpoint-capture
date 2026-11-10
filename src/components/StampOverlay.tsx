import { useEffect, useState } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { now, stampLine } from '@/services/time';
import { F, LIME } from '@/theme/tokens';

export type StampText = { title: string; time: string; footer?: string };

/**
 * The timestamp box. Same look on the live viewfinder, burned into photos,
 * and over video playback. `scale` keeps proportions when rendered for an image.
 */
export function StampOverlay({ title, time, footer, scale = 1, style }: StampText & { scale?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          backgroundColor: 'rgba(0,0,0,0.66)',
          borderRadius: 8 * scale,
          paddingHorizontal: 10 * scale,
          paddingVertical: 6 * scale,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text style={{ fontFamily: F.mono, fontSize: 10.5 * scale, color: LIME }}>{title}</Text>
      <Text style={{ fontFamily: F.monoB, fontSize: 13 * scale, color: '#FFFFFF' }}>{time}</Text>
      {footer ? <Text style={{ fontFamily: F.mono, fontSize: 10 * scale, color: '#C9CCD1' }}>{footer}</Text> : null}
    </View>
  );
}

/** Live overlay for the viewfinder; ticks every 100 ms without re-rendering the camera. */
export function LiveStamp({ title, footer, withMs, scale, style }: { title: string; footer?: string; withMs: boolean; scale?: number; style?: StyleProp<ViewStyle> }) {
  const [t, setT] = useState(now());
  useEffect(() => {
    const id = setInterval(() => setT(now()), withMs ? 100 : 500);
    return () => clearInterval(id);
  }, [withMs]);
  return <StampOverlay title={title} time={stampLine(t, withMs)} footer={footer} scale={scale} style={style} />;
}
