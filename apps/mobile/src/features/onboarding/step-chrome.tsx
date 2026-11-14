import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { Text } from '@/components/text';

export type StepMode = 'onboarding' | 'edit';

/** Order of the onboarding flow. Routes live under `src/app/(onboarding)`. */
const STEPS = ['/', '/photos', '/interests', '/intention', '/preferences'] as const;
export type StepIndex = 0 | 1 | 2 | 3 | 4;

interface StepChrome {
  readonly eyebrow: string;
  readonly progress: number | undefined;
  readonly showBack: boolean;
  readonly submitLabel: string;
  /** Call after a successful save. */
  readonly advance: () => void;
  readonly skipAction: ReactNode;
}

/**
 * The same step component serves onboarding and Settings; this supplies what
 * differs between the two: header, button label and where to go afterwards.
 */
export function useStepChrome(
  mode: StepMode,
  index: StepIndex,
  options: { optional?: boolean } = {},
): StepChrome {
  const router = useRouter();
  if (mode === 'edit') {
    return {
      eyebrow: 'Settings',
      progress: undefined,
      showBack: true,
      submitLabel: 'Save',
      advance: () => router.back(),
      skipAction: null,
    };
  }
  const next = STEPS[index + 1];
  const advance = () => {
    if (next) router.push(next);
  };
  return {
    eyebrow: `Step ${index + 1} of ${STEPS.length}`,
    progress: (index + 1) / STEPS.length,
    showBack: index > 0,
    submitLabel: 'Continue',
    advance,
    skipAction: options.optional ? (
      <Pressable role="button" aria-label="Skip this step" onPress={advance} hitSlop={12}>
        <Text variant="bodyStrong" tone="textSecondary">
          Skip
        </Text>
      </Pressable>
    ) : null,
  };
}
