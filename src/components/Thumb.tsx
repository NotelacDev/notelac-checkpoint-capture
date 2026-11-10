import { Image, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Capture } from '@/store/captures';
import { OK, REC } from '@/theme/tokens';

import { Icon, T } from './ui';

const dotColor = (c: Capture) => (c.status === 'uploaded' ? OK : c.status === 'failed' ? REC : '#9AA0A6');

export function Thumb({ c, onPress, style, label }: { c: Capture; onPress?: () => void; style?: StyleProp<ViewStyle>; label?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? `Open capture ${c.id}`} onPress={onPress} style={[{ borderRadius: 14, overflow: 'hidden', backgroundColor: '#24272B' }, style]}>
      {c.uri && c.kind === 'photo' ? (
        <Image source={{ uri: c.uri }} style={{ flex: 1 }} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={c.kind === 'video' ? 'film' : 'cloud'} size={22} color="#9AA0A6" />
        </View>
      )}
      {c.frame ? (
        <View style={{ position: 'absolute', left: 6, top: 6, backgroundColor: '#CFFE0F', borderRadius: 4, paddingHorizontal: 5 }}>
          <T f="monoB" size={9} color="#0E0F10">
            F{c.frame}
          </T>
        </View>
      ) : null}
      <View style={{ position: 'absolute', right: 6, top: 6, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: dotColor(c) }} />
    </Pressable>
  );
}
