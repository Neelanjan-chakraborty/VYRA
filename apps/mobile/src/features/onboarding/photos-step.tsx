import { color, radius, space } from '@vyra/design-system';
import { MAX_PHOTOS, type Photo } from '@vyra/validation';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '@/components/text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import {
  useMe,
  useRemovePhoto,
  useReorderPhotos,
  useUploadPhoto,
} from '@/features/profile/profile-api';
import { errorMessage } from '@/lib/api';
import { type StepMode, useStepChrome } from './step-chrome';

export function PhotosStep({ mode }: { readonly mode: StepMode }) {
  const chrome = useStepChrome(mode, 1);
  const photos = useMe().data?.photos ?? [];
  const upload = useUploadPhoto();
  const remove = useRemovePhoto();
  const reorder = useReorderPhotos();
  const [selected, setSelected] = useState<Photo | null>(null);
  const [pickerError, setPickerError] = useState<string>();

  async function addPhoto() {
    setPickerError(undefined);
    upload.reset();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;
      upload.mutate({
        uri: asset.uri,
        ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
        ...(asset.file ? { file: asset.file } : {}),
      });
    } catch {
      setPickerError('We couldn’t open your photos. Check the permission in Settings.');
    }
  }

  function makeFirst(photo: Photo) {
    reorder.mutate([photo.id, ...photos.filter((p) => p.id !== photo.id).map((p) => p.id)]);
    setSelected(null);
  }

  const failure = upload.error ?? remove.error ?? reorder.error;
  const slots = Array.from({ length: MAX_PHOTOS }, (_, index) => photos[index]);

  return (
    <FormScreen
      eyebrow={chrome.eyebrow}
      progress={chrome.progress}
      showBack={chrome.showBack}
      title={mode === 'edit' ? 'Your photos.' : 'Show yourself.'}
      intro={`Add up to ${MAX_PHOTOS}. The first is the one people see first. Location data is removed from every photo.`}
      footer={
        mode === 'edit' ? (
          <Button label="Done" onPress={chrome.advance} />
        ) : (
          <Button
            label={chrome.submitLabel}
            disabled={photos.length === 0}
            onPress={chrome.advance}
          />
        )
      }
    >
      <ErrorNotice message={pickerError ?? (failure ? errorMessage(failure) : undefined)} />
      <View style={styles.grid}>
        {slots.map((photo, index) =>
          photo ? (
            <Pressable
              key={photo.id}
              role="button"
              aria-label={`Photo ${index + 1}${index === 0 ? ', shown first' : ''}. Options`}
              onPress={() => setSelected(photo)}
              style={[styles.tile, index === 0 && styles.lead]}
            >
              <Image
                source={{ uri: photo.url }}
                style={styles.image}
                contentFit="cover"
                transition={150}
              />
              {index === 0 ? (
                <View style={styles.badge}>
                  <Text variant="eyebrow">First</Text>
                </View>
              ) : null}
            </Pressable>
          ) : (
            <Pressable
              key={`empty-${index}`}
              role="button"
              aria-label="Add a photo"
              disabled={upload.isPending || index !== photos.length}
              onPress={() => void addPhoto()}
              style={[
                styles.tile,
                styles.empty,
                index === 0 && styles.lead,
                index !== photos.length && styles.later,
              ]}
            >
              {upload.isPending && index === photos.length ? (
                <ActivityIndicator color={color.textSecondary} />
              ) : index === photos.length ? (
                <Svg width={24} height={24} viewBox="0 0 24 24">
                  <Path
                    d="M12 5v14M5 12h14"
                    stroke={color.textSecondary}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                  />
                </Svg>
              ) : null}
            </Pressable>
          ),
        )}
      </View>

      <BottomSheet visible={selected !== null} title="This photo" onClose={() => setSelected(null)}>
        <View style={styles.sheetActions}>
          {selected && photos[0]?.id !== selected.id ? (
            <Button
              label="Show this one first"
              variant="secondary"
              onPress={() => makeFirst(selected)}
            />
          ) : null}
          <Button
            label="Remove photo"
            variant="danger"
            onPress={() => {
              if (selected) remove.mutate(selected.id);
              setSelected(null);
            }}
          />
          <Button label="Cancel" variant="quiet" onPress={() => setSelected(null)} />
        </View>
      </BottomSheet>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  // Editorial grid: one tall lead image beside a column of two, then a row of three.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  tile: {
    width: '31.6%',
    aspectRatio: 0.8,
    borderRadius: radius.m,
    overflow: 'hidden',
    backgroundColor: color.surface,
  },
  lead: { width: '65.6%' },
  image: { width: '100%', height: '100%' },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.border,
    borderStyle: 'dashed',
  },
  later: { opacity: 0.4 },
  badge: {
    position: 'absolute',
    left: space.s,
    bottom: space.s,
    paddingHorizontal: space.s,
    paddingVertical: space.xs,
    borderRadius: radius.s,
    backgroundColor: color.scrim,
  },
  sheetActions: { gap: space.m },
});
