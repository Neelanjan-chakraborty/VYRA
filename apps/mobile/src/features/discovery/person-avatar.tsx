import { color, radius, typography } from '@vyra/design-system';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';

/**
 * A small portrait: the person's approved photo, or their initial. The API only
 * ever sends approved photos, so a missing URL always means "no photo to show".
 */
export function PersonAvatar({
  name,
  photoUrl,
  size,
  round = false,
}: {
  readonly name: string;
  readonly photoUrl: string | null;
  readonly size: number;
  readonly round?: boolean;
}) {
  const shape = {
    width: size,
    height: round ? size : size * 1.25,
    borderRadius: round ? size / 2 : radius.m,
  };
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[styles.photo, shape]}
        contentFit="cover"
        transition={150}
        accessibilityLabel={`Photo of ${name}`}
      />
    );
  }
  return (
    <View style={[styles.placeholder, shape]} role="img" aria-label={`No photo of ${name} yet`}>
      <Text style={[typography.title, { color: color.textSecondary }]}>
        {name.trim().charAt(0).toUpperCase() || '·'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { backgroundColor: color.surface },
  placeholder: {
    backgroundColor: color.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
