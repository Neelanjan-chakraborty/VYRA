import { color, radius, space, typography } from '@vyra/design-system';
import { OTP_LENGTH } from '@vyra/validation';
import { type ComponentRef, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { noBrowserFocusRing } from '@/lib/web-style';
import { Text } from '../text';

interface OtpInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onComplete?: (value: string) => void;
  readonly hasError?: boolean;
  readonly disabled?: boolean;
}

/**
 * One real text input (so paste, SMS autofill and screen readers work) drawn
 * as six cells.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  hasError = false,
  disabled = false,
}: OtpInputProps) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);

  function handleChange(text: string) {
    const digits = text.replaceAll(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(digits);
    if (digits.length === OTP_LENGTH) onComplete?.(digits);
  }

  return (
    <Pressable onPress={() => input.current?.focus()} style={styles.root} accessible={false}>
      <View style={styles.cells} aria-hidden>
        {Array.from({ length: OTP_LENGTH }, (_, index) => {
          const active = focused && index === Math.min(value.length, OTP_LENGTH - 1);
          return (
            <View
              key={index}
              style={[
                styles.cell,
                active && { borderColor: color.textPrimary },
                hasError && { borderColor: color.danger },
              ]}
            >
              <Text style={styles.digit}>{value[index] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={handleChange}
        editable={!disabled}
        autoFocus
        aria-label="Verification code"
        inputMode="numeric"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch' },
  cells: { flexDirection: 'row', gap: space.s },
  cell: {
    flex: 1,
    maxWidth: 56,
    aspectRatio: 0.82,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.m,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { ...typography.displayM, color: color.textPrimary },
  // Covers the cells so taps and autofill land on a real input, but draws nothing.
  hiddenInput: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.01,
    color: 'transparent',
    ...noBrowserFocusRing,
  },
});
