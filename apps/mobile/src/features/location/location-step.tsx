import { color, space } from '@vyra/design-system';
import type { PlaceView } from '@vyra/validation';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { Button } from '@/components/ui/button';
import { FormScreen } from '@/components/ui/form-screen';
import { ErrorNotice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { type StepMode, useStepChrome } from '@/features/onboarding/step-chrome';
import { useMe } from '@/features/profile/profile-api';
import { errorMessage } from '@/lib/api';
import { getApproximateLocation } from './device-location';
import { useClearLocation, usePlaces, useSetLocation } from './location-api';

/** Where you are: approximate device location, a chosen city, or nothing. */
export function LocationStep({ mode }: { readonly mode: StepMode }) {
  const chrome = useStepChrome(mode, 5, { optional: true });
  const location = useMe().data?.location ?? null;
  const setLocation = useSetLocation();
  const clear = useClearLocation();
  const [choosing, setChoosing] = useState(false);
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<PlaceView | null>(null);
  const [area, setArea] = useState('');
  const [deviceMessage, setDeviceMessage] = useState<string>();
  const [locating, setLocating] = useState(false);
  const places = usePlaces(query);

  async function useDevice() {
    setDeviceMessage(undefined);
    setLocating(true);
    const result = await getApproximateLocation();
    setLocating(false);
    if (result.status === 'ok') {
      setLocation.mutate({
        source: 'device',
        latitude: result.latitude,
        longitude: result.longitude,
      });
    } else {
      setDeviceMessage(
        result.status === 'denied'
          ? 'Location permission is off. You can choose a city instead, or turn permission on in your device settings.'
          : 'We couldn’t get your location just now. You can choose a city instead.',
      );
      setChoosing(true);
    }
  }

  function saveChoice() {
    if (!place) return;
    setLocation.mutate(
      {
        source: 'manual',
        countryCode: place.countryCode,
        placeId: place.id,
        ...(area.trim() ? { area: area.trim() } : {}),
      },
      {
        onSuccess: () => {
          setChoosing(false);
          setPlace(null);
          setArea('');
          setQuery('');
        },
      },
    );
  }

  const failure = setLocation.error ?? clear.error;
  const summary = location
    ? [location.area, location.city, location.region].filter(Boolean).join(', ') || 'Location set'
    : null;

  return (
    <FormScreen
      eyebrow={chrome.eyebrow}
      progress={chrome.progress}
      showBack={chrome.showBack}
      headerAction={chrome.skipAction}
      title="Where are you?"
      intro="Optional. VYRA only keeps a rough area — about 2 km — and only ever shows others a distance band like “About 10 km away”, never where you are."
      footer={
        <Button label={mode === 'edit' ? 'Done' : chrome.submitLabel} onPress={chrome.advance} />
      }
    >
      <ErrorNotice message={failure ? errorMessage(failure) : deviceMessage} />

      <View style={styles.current} role="status">
        <Text variant="eyebrow" tone="textSecondary">
          Your location
        </Text>
        <Text variant="title" style={styles.currentValue}>
          {summary ?? 'Not set'}
        </Text>
        <Text variant="caption" tone="textSecondary">
          {!location
            ? 'Without a location, distance isn’t used to find people.'
            : location.source === 'DEVICE_APPROXIMATE'
              ? 'From your device, approximate.'
              : location.distanceAvailable
                ? 'Chosen by you. Distance is measured from the city centre.'
                : 'Chosen by you. This place isn’t in our list, so distance isn’t used.'}
        </Text>
      </View>

      {!choosing ? (
        <View style={styles.actions}>
          <Button
            label="Use my approximate location"
            variant="secondary"
            loading={locating || (setLocation.isPending && !choosing)}
            onPress={() => void useDevice()}
          />
          <Button label="Choose a city" variant="secondary" onPress={() => setChoosing(true)} />
          {location ? (
            <Button
              label="Remove my location"
              variant="quiet"
              loading={clear.isPending}
              onPress={() => clear.mutate()}
            />
          ) : null}
        </View>
      ) : (
        <View>
          <TextField
            label="City"
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setPlace(null);
            }}
            placeholder="Start typing a city"
            autoFocus
          />
          {place ? null : (
            <View role="list" aria-label="Matching places">
              {places.isPending ? <ActivityIndicator color={color.textSecondary} /> : null}
              {places.data?.places.slice(0, 8).map((p) => (
                <Pressable
                  key={p.id}
                  role="button"
                  aria-label={`${p.name}${p.region ? `, ${p.region}` : ''}`}
                  onPress={() => {
                    setPlace(p);
                    setQuery(p.name);
                  }}
                  style={({ pressed }) => [
                    styles.place,
                    pressed && { backgroundColor: color.surface },
                  ]}
                >
                  <Text>{p.name}</Text>
                  {p.region ? (
                    <Text variant="caption" tone="textSecondary">
                      {p.region}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
              {places.data && places.data.places.length === 0 ? (
                <Text variant="caption" tone="textSecondary" style={styles.empty}>
                  No matching city. Try a nearby larger city.
                </Text>
              ) : null}
            </View>
          )}
          {place ? (
            <>
              <TextField
                label="Area or neighbourhood (optional)"
                value={area}
                onChangeText={setArea}
                maxLength={80}
                hint="Shown as a label only. Never used to measure distance."
              />
              <Button
                label={`Use ${place.name}`}
                variant="secondary"
                loading={setLocation.isPending}
                onPress={saveChoice}
              />
            </>
          ) : null}
          <Button
            label="Cancel"
            variant="quiet"
            onPress={() => setChoosing(false)}
            style={styles.cancel}
          />
        </View>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  current: {
    paddingVertical: space.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    marginBottom: space.xl,
    gap: space.xs,
  },
  currentValue: { marginTop: space.xs },
  actions: { gap: space.m },
  place: {
    minHeight: 52,
    justifyContent: 'center',
    paddingVertical: space.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  empty: { marginVertical: space.m },
  cancel: { marginTop: space.s },
});
