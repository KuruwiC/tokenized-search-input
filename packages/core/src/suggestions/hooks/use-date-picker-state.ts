import type { Editor } from '@tiptap/react';
import { useCallback } from 'react';
import { getEditorContext } from '../../extensions/editor-context';
import { useDebouncedPickerSync } from '../../hooks/use-debounced-picker-sync';
import { useEditorSelector } from '../../hooks/use-editor-store';
import { parseDateFieldValue } from '../../pickers/date-format';
import {
  type DateTimeValue,
  fromInstant,
  localMidnight,
  localOffsetAt,
  toInstant,
} from '../../pickers/date-time-value';
import {
  resolveAnchorPos,
  type SuggestionState,
  suggestionKey,
  updateSuggestionTimeControls,
} from '../../plugins/suggestion-plugin';
import { useDeferredDateChange } from './use-deferred-date-change';

export interface DatePickerState {
  /** What the input says the picker should show, ahead of the value it last committed */
  syncedValue: DateTimeValue | null | undefined;
  isUTC: boolean;
  includeTime: boolean;
  onDateChange: (value: DateTimeValue | null) => void;
  onUTCChange: (isUTC: boolean) => void;
  onIncludeTimeChange: (includeTime: boolean) => void;
}

/**
 * What a date or date-time picker shows and how it changes the value: the value the token
 * holds as typed, the picker mode read from it, and the handlers that write a change.
 */
export function useDatePickerState(
  editor: Editor,
  suggestionState: SuggestionState | undefined,
  onTokenDateChange: ((value: DateTimeValue | null, fieldKey: string) => void) | undefined
): DatePickerState {
  const { fields } = getEditorContext(editor);
  const onDateChange = useDeferredDateChange(editor, suggestionState, onTokenDateChange);

  const tokenInputValue = useEditorSelector(editor, (state) => {
    const current = suggestionKey.getState(state);
    if (current?.type !== 'date' && current?.type !== 'datetime') return '';
    const pos = resolveAnchorPos(state.doc, current.anchor);
    return pos === null ? '' : String(state.doc.nodeAt(pos)?.attrs.value ?? '');
  });

  const pickerType =
    suggestionState?.type === 'date' || suggestionState?.type === 'datetime'
      ? suggestionState.type
      : null;
  const pickerField = suggestionState?.fieldKey
    ? fields.find((field) => field.key === suggestionState.fieldKey)
    : undefined;
  const parseTyped = useCallback(
    (input: string): DateTimeValue | null => {
      if (pickerField?.type !== 'date' && pickerField?.type !== 'datetime') return null;
      const parsed = parseDateFieldValue(input, pickerField);
      return parsed.ok ? parsed.value : null;
    },
    [pickerField]
  );

  const { value: syncedValue, complete } = useDebouncedPickerSync({
    inputValue: tokenInputValue,
    selectedValue: suggestionState?.dateValue ?? null,
    type: pickerType,
    parse: parseTyped,
    delay: 200,
  });

  // The picker mode comes from the value the token holds in full, or else the one the
  // picker last committed: partial input only moves the calendar. While there is no
  // value, the state is all there is to go by.
  const settled = complete ?? suggestionState?.dateValue ?? null;
  const timeRequired = pickerField?.type === 'datetime' && pickerField.timeRequired === true;
  const isUTC =
    settled?.time !== undefined ? settled.offset === 'Z' : (suggestionState?.isUTC ?? false);
  const includeTime =
    timeRequired ||
    (settled ? settled.time !== undefined : (suggestionState?.includeTime ?? false));

  const setTimeControls = useCallback(
    (controls: { isUTC?: boolean; includeTime?: boolean }) => {
      const tr = editor.state.tr;
      updateSuggestionTimeControls(tr, controls);
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    },
    [editor]
  );

  const onUTCChange = useCallback(
    (nextIsUTC: boolean) => {
      // Remembered for the time a value has none, such as after its time was removed
      setTimeControls({ isUTC: nextIsUTC });
      if (settled?.time === undefined) return;
      const instant = toInstant(settled);
      const converted = fromInstant(instant, nextIsUTC ? 'Z' : localOffsetAt(instant));
      if (converted) onDateChange(converted);
    },
    [settled, setTimeControls, onDateChange]
  );

  const onIncludeTimeChange = useCallback(
    (nextIncludeTime: boolean) => {
      if (!settled) {
        setTimeControls({ includeTime: nextIncludeTime });
        return;
      }
      if (!nextIncludeTime) {
        onDateChange({ date: settled.date });
        return;
      }
      if (settled.time !== undefined) return;
      onDateChange(
        isUTC ? { date: settled.date, time: '00:00:00', offset: 'Z' } : localMidnight(settled.date)
      );
    },
    [settled, isUTC, setTimeControls, onDateChange]
  );

  return { syncedValue, isUTC, includeTime, onDateChange, onUTCChange, onIncludeTimeChange };
}
