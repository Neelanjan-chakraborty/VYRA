import { color, radius, space } from '@vyra/design-system';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { QrCode } from '@/components/qr-code';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { useMe } from '@/features/profile/profile-api';
import { API_BASE_URL } from '@/lib/api';

/** Your QR code and link. Whoever opens it still only sees what VYRA lets them see. */
export default function ShareProfileScreen() {
  const router = useRouter();
  const username = useMe().data?.profile?.username ?? null;
  const [copied, setCopied] = useState(false);

  if (!username) {
    return (
      <FormScreen
        eyebrow="Profile"
        title="Share your profile"
        intro="Choose a username first. Your QR code and link are made from it."
        footer={
          <Button label="Choose a username" onPress={() => router.push('/settings/username')} />
        }
      />
    );
  }

  const link = `${API_BASE_URL}/u/${username}`;
  return (
    <FormScreen
      eyebrow="Profile"
      title="Share your profile"
      intro="Anyone with VYRA can scan this to open your profile. They’ll only see you if your settings and theirs allow it."
      footer={
        <View style={styles.actions}>
          <Button
            label="Share link"
            onPress={() => void Share.share({ message: `Find me on VYRA: ${link}`, url: link })}
          />
          <Button
            label={copied ? 'Copied' : 'Copy link'}
            variant="secondary"
            onPress={() => {
              void Clipboard.setStringAsync(link).then(() => setCopied(true));
              setTimeout(() => setCopied(false), 2500);
            }}
          />
        </View>
      }
    >
      <View style={styles.card}>
        <QrCode value={link} size={248} label={`QR code for @${username}`} />
        <Text variant="title" style={styles.handle}>
          @{username}
        </Text>
        <Text variant="caption" tone="textSecondary" selectable>
          {link}
        </Text>
      </View>
      <Button
        label="Change username"
        variant="quiet"
        onPress={() => router.push('/settings/username')}
        style={styles.change}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: space.m,
    paddingVertical: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    borderRadius: radius.m,
  },
  handle: { marginTop: space.s },
  actions: { gap: space.s },
  change: { alignSelf: 'flex-start', marginTop: space.m },
});
