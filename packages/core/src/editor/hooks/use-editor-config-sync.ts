import type { Editor } from '@tiptap/react';
import { useEffect, useRef } from 'react';
import {
  applyEditorContext,
  DEFAULT_EDITOR_CONTEXT,
  EDITOR_CONTEXT_UPDATED,
  type EditorCallbacks,
  type EditorConfig,
  getEditorContext,
  getFocusContext,
} from '../../extensions/editor-context';
import { requestValidationCheck } from '../../plugins/shared/meta';
import { applyFreeTextMode } from '../free-text-mode';

/**
 * The only place that writes configuration into the editor context storage after
 * the editor exists. It updates the storage and, only when a member actually
 * changed, dispatches one `EDITOR_CONTEXT_UPDATED` transaction so node views and the
 * suggestion overlay re-read it.
 *
 * The storage of a destroyed editor is still written, so the imperative handle
 * parses with current configuration until the replacement editor renders; only the
 * dispatch is skipped for it.
 */
export function useEditorConfigSync(
  editor: Editor | null,
  config: EditorConfig,
  callbacks: EditorCallbacks
): void {
  const {
    fields,
    freeTextMode,
    unknownFields,
    operatorLabels,
    fieldSuggestionsDisabled,
    valueSuggestionsDisabled,
    validation,
    deserializeText,
    serializeToken,
    classNames,
    renderDatePicker,
    renderDateTimePicker,
    paginationLabels,
  } = config;

  useEffect(() => {
    if (!editor) return;
    const changed = applyEditorContext(getEditorContext(editor), {
      fields,
      freeTextMode,
      unknownFields,
      operatorLabels,
      fieldSuggestionsDisabled,
      valueSuggestionsDisabled,
      validation,
      deserializeText,
      serializeToken,
      classNames,
      renderDatePicker,
      renderDateTimePicker,
      paginationLabels,
    });
    if (!changed || editor.isDestroyed) return;
    editor.view.dispatch(
      editor.state.tr.setMeta('addToHistory', false).setMeta(EDITOR_CONTEXT_UPDATED, true)
    );
  }, [
    editor,
    fields,
    freeTextMode,
    unknownFields,
    operatorLabels,
    fieldSuggestionsDisabled,
    valueSuggestionsDisabled,
    validation,
    deserializeText,
    serializeToken,
    classNames,
    renderDatePicker,
    renderDateTimePicker,
    paginationLabels,
  ]);

  const prevValidationRef = useRef(validation);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const prevValidation = prevValidationRef.current;
    prevValidationRef.current = validation;

    if (prevValidation === validation) return;

    const tr = editor.state.tr;
    requestValidationCheck(tr);
    editor.view.dispatch(tr);
  }, [editor, validation]);

  // Read the content again when freeTextMode changes. An unset mode means the default.
  const mode = freeTextMode ?? DEFAULT_EDITOR_CONTEXT.freeTextMode;
  const prevFreeTextModeRef = useRef(mode);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const prevMode = prevFreeTextModeRef.current;
    prevFreeTextModeRef.current = mode;

    if (prevMode === mode) return;

    const { tr } = editor.state;
    applyFreeTextMode(tr, getEditorContext(editor), getFocusContext(editor));
    if (tr.docChanged) editor.view.dispatch(tr);
  }, [editor, mode]);

  // Callbacks change with the handlers' identities, so they update the storage
  // without notifying node views.
  const { onFieldSelect, onValueSelect, onCustomSelect, onSubmit, onClear } = callbacks;
  useEffect(() => {
    if (!editor) return;
    applyEditorContext(getEditorContext(editor), {
      callbacks: { onFieldSelect, onValueSelect, onCustomSelect, onSubmit, onClear },
    });
  }, [editor, onFieldSelect, onValueSelect, onCustomSelect, onSubmit, onClear]);
}
