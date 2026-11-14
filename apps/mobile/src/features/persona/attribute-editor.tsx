import { space } from '@vyra/design-system';
import {
  PERSONA_ATTRIBUTES,
  type PersonaAttributeKey,
  type PersonaAttributeValue,
} from '@vyra/validation';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { SegmentedScale } from '@/components/ui/segmented-scale';
import { SelectRow } from '@/components/ui/select-row';
import { Tag } from '@/components/ui/tag';
import { TextField } from '@/components/ui/text-field';

interface AttributeEditorProps {
  readonly attribute: PersonaAttributeKey | null;
  readonly initial: PersonaAttributeValue | undefined;
  readonly saving: boolean;
  readonly onSave: (key: PersonaAttributeKey, value: PersonaAttributeValue) => void;
  readonly onClose: () => void;
}

/** Sheet for setting one attribute yourself. Keyed by attribute so state resets per open. */
export function AttributeEditor(props: AttributeEditorProps) {
  return (
    <BottomSheet
      visible={props.attribute !== null}
      title={props.attribute ? PERSONA_ATTRIBUTES[props.attribute].label : ''}
      onClose={props.onClose}
    >
      {props.attribute ? (
        <EditorBody key={props.attribute} {...props} attribute={props.attribute} />
      ) : null}
    </BottomSheet>
  );
}

function EditorBody({
  attribute,
  initial,
  saving,
  onSave,
  onClose,
}: AttributeEditorProps & { attribute: PersonaAttributeKey }) {
  const definition = PERSONA_ATTRIBUTES[attribute];
  const [value, setValue] = useState<PersonaAttributeValue | undefined>(initial);
  const [draftText, setDraftText] = useState('');
  const list = Array.isArray(value) ? value : [];

  let editor = null;
  if (definition.kind === 'scale') {
    editor = (
      <SegmentedScale
        label={definition.label}
        low={definition.low}
        high={definition.high}
        value={typeof value === 'number' ? value : null}
        onChange={setValue}
      />
    );
  } else if (definition.kind === 'enum') {
    editor = (
      <View role="radiogroup" aria-label={definition.label}>
        {definition.options.map((option) => (
          <SelectRow
            key={option.value}
            kind="radio"
            label={option.label}
            selected={value === option.value}
            onPress={() => setValue(option.value)}
          />
        ))}
      </View>
    );
  } else if (definition.vocabulary) {
    const toggle = (item: string) =>
      setValue(
        list.includes(item)
          ? list.filter((v) => v !== item)
          : list.length < definition.max
            ? [...list, item]
            : list,
      );
    editor = (
      <View style={styles.tags}>
        {definition.vocabulary.map((option) => (
          <Tag
            key={option.value}
            label={option.label}
            selected={list.includes(option.value)}
            onPress={() => toggle(option.value)}
          />
        ))}
      </View>
    );
  } else {
    const add = () => {
      const text = draftText.trim();
      if (text && list.length < definition.max && !list.includes(text)) setValue([...list, text]);
      setDraftText('');
    };
    editor = (
      <View>
        <View style={styles.tags}>
          {list.map((item) => (
            <Tag
              key={item}
              label={`${item}  ×`}
              selected
              onPress={() => setValue(list.filter((v) => v !== item))}
            />
          ))}
        </View>
        <TextField
          label="Add a boundary"
          value={draftText}
          onChangeText={setDraftText}
          maxLength={80}
          onSubmitEditing={add}
          hint={`Up to ${definition.max}. Only you can set these.`}
        />
        <Button label="Add" variant="secondary" onPress={add} disabled={draftText.trim() === ''} />
      </View>
    );
  }

  const ready = value !== undefined && (!Array.isArray(value) || value.length > 0);
  return (
    <View style={styles.body}>
      {editor}
      <View style={styles.actions}>
        <Button
          label="Save"
          loading={saving}
          disabled={!ready}
          onPress={() => ready && onSave(attribute, value)}
        />
        <Button label="Cancel" variant="quiet" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.l },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginBottom: space.l },
  actions: { gap: space.s },
});
