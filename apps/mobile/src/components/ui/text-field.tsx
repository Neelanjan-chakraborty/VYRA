import { color, radius, space, typography } from '@vyra/design-system';
import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { noBrowserFocusRing } from '@/lib/web-style';
import { Text } from '../text';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string;
  /** Shown inside the field before the value, e.g. a currency or dial prefix. */
  readonly prefix?: string;
}

export function TextField({ label, error, hint, prefix, multiline, ...input }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? color.danger : focused ? color.textPrimary : color.border;
  return (
    <View style={styles.root}>
      <Text variant="caption" tone="textSecondary" style={styles.label}>
        {label}
      </Text>
      <View style={[styles.field, { borderColor }, multiline && styles.multiline]}>
        {prefix ? (
          <Text tone="textSecondary" style={styles.prefix}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          {...input}
          multiline={multiline}
          aria-label={label}
          aria-invalid={error !== undefined}
          placeholderTextColor={color.textDisabled}
          selectionColor={color.accent}
          onFocus={(event) => {
            setFocused(true);
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            input.onBlur?.(event);
          }}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
      </View>
      {error ? (
        <Text variant="caption" tone="danger" style={styles.message} role="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="textSecondary" style={styles.message}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: space.l },
  label: { marginBottom: space.s },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.m,
    backgroundColor: color.surface,
    paddingHorizontal: space.l,
  },
  multiline: { alignItems: 'flex-start', paddingVertical: space.m },
  prefix: { marginRight: space.s },
  input: {
    flex: 1,
    ...typography.body,
    color: color.textPrimary,
    paddingVertical: space.m,
    ...noBrowserFocusRing,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top', paddingVertical: 0 },
  message: { marginTop: space.s },
});
