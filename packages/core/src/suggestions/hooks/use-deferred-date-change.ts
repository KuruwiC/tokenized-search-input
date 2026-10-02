import type { Editor } from '@tiptap/react';
import { useCallback, useEffect, useRef } from 'react';
import type { DateTimeValue } from '../../pickers/date-time-value';
import {
  type SuggestionState,
  suggestionKey,
  updateSuggestionDateValue,
} from '../../plugins/suggestion-plugin';

/**
 * Passes the date a picker reports on to the suggestion state and the token once per
 * animation frame, the latest one if there are several. A value still waiting when the
 * picker closes or the overlay unmounts is passed on then.
 */
export function useDeferredDateChange(
  editor: Editor,
  suggestionState: SuggestionState | undefined,
  onDateChange: ((value: DateTimeValue | null, fieldKey: string) => void) | undefined
): (value: DateTimeValue | null) => void {
  const pendingValue = useRef<DateTimeValue | null>(null);
  const frameId = useRef<number | null>(null);

  // The field of the picker, for the flush that follows the picker closing
  const type = suggestionState?.type;
  const fieldKey = suggestionState?.fieldKey ?? null;
  const lastFieldKey = useRef(fieldKey);
  useEffect(() => {
    if (type) lastFieldKey.current = fieldKey;
  }, [type, fieldKey]);

  const flush = useCallback(() => {
    if (frameId.current !== null) {
      cancelAnimationFrame(frameId.current);
      frameId.current = null;
    }

    const value = pendingValue.current;
    if (value === null) return;
    pendingValue.current = null;

    // The state as it is now; the one a render saw may be older
    const current = suggestionKey.getState(editor.state);
    if (!current) return;

    const tr = editor.state.tr;
    updateSuggestionDateValue(tr, value);
    tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);

    // The picker's field is gone from the state once it has closed
    const field = current.fieldKey ?? lastFieldKey.current;
    if (field) onDateChange?.(value, field);
  }, [editor, onDateChange]);

  const change = useCallback(
    (value: DateTimeValue | null) => {
      pendingValue.current = value;
      if (frameId.current === null) {
        frameId.current = requestAnimationFrame(() => {
          frameId.current = null;
          flush();
        });
      }
    },
    [flush]
  );

  // Flush when the type changes, such as when the picker closes or another one opens
  const previousType = useRef(type);
  useEffect(() => {
    if (previousType.current !== type && previousType.current != null) flush();
    previousType.current = type;
  }, [type, flush]);

  useEffect(() => flush, [flush]);

  return change;
}
