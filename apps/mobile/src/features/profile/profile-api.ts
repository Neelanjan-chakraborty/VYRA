import { useMutation, useQuery } from '@tanstack/react-query';
import {
  interestListSchema,
  meSchema,
  photoSchema,
  type DiscoveryPreferences,
  type Me,
  type ProfileUpdate,
  type RelationshipIntentsUpdate,
} from '@vyra/validation';
import { Platform } from 'react-native';
import { z } from 'zod';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { useSession } from '@/lib/session';

const ME_KEY = ['me'] as const;

export function useMe() {
  const signedIn = useSession((state) => state.status === 'signedIn');
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => api('/me', { schema: meSchema }),
    enabled: signedIn,
    // Photo URLs are signed for ten minutes; refresh well inside that.
    staleTime: 4 * 60_000,
    refetchInterval: 8 * 60_000,
  });
}

function setMe(me: Me): void {
  queryClient.setQueryData(ME_KEY, me);
}

function refetchMe(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: ME_KEY });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (update: ProfileUpdate) =>
      api('/me/profile', { method: 'PATCH', body: update, schema: meSchema }),
    onSuccess: setMe,
  });
}

export function useSetIntents() {
  return useMutation({
    mutationFn: (update: RelationshipIntentsUpdate) =>
      api('/me/relationship-intents', { method: 'PUT', body: update, schema: meSchema }),
    onSuccess: setMe,
  });
}

export function useSetPreferences() {
  return useMutation({
    mutationFn: (prefs: DiscoveryPreferences) =>
      api('/me/discovery-preferences', { method: 'PUT', body: prefs, schema: meSchema }),
    onSuccess: setMe,
  });
}

export function useInterestCatalogue() {
  return useQuery({
    queryKey: ['interests'],
    queryFn: () => api('/interests', { schema: interestListSchema }),
    staleTime: 60 * 60_000,
  });
}

export function useSetInterests() {
  return useMutation({
    mutationFn: (interestIds: string[]) =>
      api('/me/interests', { method: 'PUT', body: { interestIds }, schema: meSchema }),
    onSuccess: setMe,
  });
}

export function useCompleteOnboarding() {
  return useMutation({
    mutationFn: () => api('/me/onboarding/complete', { method: 'POST', schema: meSchema }),
    onSuccess: setMe,
  });
}

export interface PickedImage {
  readonly uri: string;
  readonly mimeType?: string;
  /** Present on web, where the picker returns a real File. */
  readonly file?: File;
}

export function useUploadPhoto() {
  return useMutation({
    mutationFn: (image: PickedImage) => {
      const form = new FormData();
      if (Platform.OS === 'web' && image.file) {
        form.append('file', image.file);
      } else {
        // React Native's FormData accepts this file descriptor in place of a Blob.
        form.append('file', {
          uri: image.uri,
          name: 'photo.jpg',
          type: image.mimeType ?? 'image/jpeg',
        } as unknown as Blob);
      }
      return api('/me/photos', { method: 'POST', body: form, schema: photoSchema });
    },
    onSuccess: refetchMe,
  });
}

export function useRemovePhoto() {
  return useMutation({
    mutationFn: (photoId: string) => api(`/me/photos/${photoId}`, { method: 'DELETE' }),
    onSuccess: refetchMe,
  });
}

export function useReorderPhotos() {
  return useMutation({
    mutationFn: (photoIds: string[]) =>
      api('/me/photos/order', {
        method: 'PUT',
        body: { photoIds },
        schema: z.object({ photos: z.array(photoSchema) }),
      }),
    onSuccess: refetchMe,
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => api('/me', { method: 'DELETE', body: { confirm: 'DELETE' } }),
    onSuccess: async () => {
      await useSession.getState().clear();
      queryClient.clear();
    },
  });
}
