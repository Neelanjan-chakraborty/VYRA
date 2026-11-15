import { color, radius, space } from '@vyra/design-system';
import { MAX_PHOTOS, type Photo } from '@vyra/validation';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { prepareImageForUpload } from '@/lib/prepare-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from '@/components/text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import {
  type PickedImage,
  useAppealPhoto,
  useMe,
  useRemovePhoto,
  useReorderPhotos,
  useReplacePhoto,
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
  const replace = useReplacePhoto();
  const appeal = useAppealPhoto();
  const [selected, setSelected] = useState<Photo | null>(null);
  const [pickerError, setPickerError] = useState<string>();

  async function pick(): Promise<PickedImage | null> {
    setPickerError(undefined);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return null;
      return await prepareImageForUpload(asset);
    } catch {
      setPickerError('We couldn’t open your photos. Check the permission in Settings.');
      return null;
    }
  }

  async function addPhoto() {
    upload.reset();
    const image = await pick();
    if (image) upload.mutate(image);
  }

  async function replacePhoto(photo: Photo) {
    setSelected(null);
    replace.reset();
    const image = await pick();
    if (image) replace.mutate({ photoId: photo.id, image });
  }

  function makeFirst(photo: Photo) {
    reorder.mutate([photo.id, ...photos.filter((p) => p.id !== photo.id).map((p) => p.id)]);
    setSelected(null);
  }

  const failure = upload.error ?? remove.error ?? reorder.error ?? replace.error ?? appeal.error;
  const slots = Array.from({ length: MAX_PHOTOS }, (_, index) => photos[index]);

  return (
    <FormScreen
      eyebrow={chrome.eyebrow}
      progress={chrome.progress}
      showBack={chrome.showBack}
      title={mode === 'edit' ? 'Your photos.' : 'Show yourself.'}
      intro={`Add up to ${MAX_PHOTOS}. The first is the one people see first. Every photo is checked before anyone else can see it, and location data is removed.`}
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
              aria-label={`Photo ${index + 1}${index === 0 ? ', shown first' : ''}${STATUS_LABEL[photo.status] ? `, ${STATUS_LABEL[photo.status]}` : ''}. Options`}
              onPress={() => setSelected(photo)}
              style={[styles.tile, index === 0 && styles.lead]}
            >
              <Image
                source={{ uri: photo.thumbUrl ?? photo.url }}
                style={styles.image}
                contentFit="cover"
                transition={150}
              />
              {photo.status === 'REJECTED' ? <View style={styles.dim} /> : null}
              <View style={styles.badges}>
                {index === 0 ? (
                  <View style={styles.badge}>
                    <Text variant="eyebrow">First</Text>
                  </View>
                ) : null}
                {STATUS_LABEL[photo.status] ? (
                  <View style={[styles.badge, photo.status === 'REJECTED' && styles.badgeAlert]}>
                    <Text variant="eyebrow">{STATUS_LABEL[photo.status]}</Text>
                  </View>
                ) : null}
              </View>
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
        {selected && STATUS_EXPLANATION[selected.status] ? (
          <Text tone="textSecondary" style={styles.sheetNote}>
            {STATUS_EXPLANATION[selected.status]}
          </Text>
        ) : null}
        <View style={styles.sheetActions}>
          {selected?.canAppeal ? (
            <Button
              label="Ask a person to review it"
              variant="secondary"
              loading={appeal.isPending}
              onPress={() => {
                appeal.mutate(selected.id);
                setSelected(null);
              }}
            />
          ) : null}
          {selected ? (
            <Button
              label="Replace photo"
              variant="secondary"
              onPress={() => void replacePhoto(selected)}
            />
          ) : null}
          {selected && photos[0]?.id !== selected.id && selected.status !== 'REJECTED' ? (
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

/** Short tile labels; approved photos carry none. */
const STATUS_LABEL: Readonly<Record<Photo['status'], string | null>> = {
  PENDING: 'Checking',
  REVIEW_REQUIRED: 'In review',
  REJECTED: 'Declined',
  APPROVED: null,
};

const STATUS_EXPLANATION: Readonly<Record<Photo['status'], string | null>> = {
  PENDING:
    'We’re checking this photo. Nobody else sees it until it’s approved — usually within a minute.',
  REVIEW_REQUIRED: 'A person is reviewing this photo. Until then, only you can see it.',
  REJECTED:
    'This photo doesn’t meet our photo guidelines, so nobody else can see it. Replace it, remove it, or ask a person to review it.',
  APPROVED: null,
};

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
  dim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: color.scrim },
  badges: {
    position: 'absolute',
    left: space.s,
    bottom: space.s,
    right: space.s,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  badgeAlert: { borderWidth: 1, borderColor: color.danger },
  sheetNote: { marginBottom: space.l },
  badge: {
    paddingHorizontal: space.s,
    paddingVertical: space.xs,
    borderRadius: radius.s,
    backgroundColor: color.scrim,
  },
  sheetActions: { gap: space.m },
});
