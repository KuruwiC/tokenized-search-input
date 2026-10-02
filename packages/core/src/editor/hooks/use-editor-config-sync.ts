import type { Editor } from '@tiptap/react';
import { useEffect, useRef } from 'react';
import {
  EDITOR_CONTEXT_UPDATED,
  type EditorCallbacks,
  type EditorConfig,
  getEditorContext,
} from '../../extensions/editor-context';
import { FORCE_VALIDATION_CHECK } from '../../plugins/validation-plugin';
import { parseQueryToDoc, serializeDocToQuery } from '../../serializer';

/**
 * The only place that writes configuration into the editor context storage after
 * the editor exists. It updates the storage and dispatches one
 * `EDITOR_CONTEXT_UPDATED` transaction so node views and the suggestion overlay
 * re-read it. Effects skip a destroyed editor.
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
    if (!editor || editor.isDestroyed) return;
    editor.commands.setEditorContext({
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

  // Re-validate when validation config changes
  const prevValidationRef = useRef(validation);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const prevValidation = prevValidationRef.current;
    prevValidationRef.current = validation;

    // Skip if validation hasn't changed (referential equality check is sufficient)
    if (prevValidation === validation) return;

    // Trigger re-validation
    const tr = editor.state.tr;
    tr.setMeta(FORCE_VALIDATION_CHECK, true);
    editor.view.dispatch(tr);
  }, [editor, validation]);

  // Re-parse content when freeTextMode changes
  const prevFreeTextModeRef = useRef(freeTextMode);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const prevMode = prevFreeTextModeRef.current;
    prevFreeTextModeRef.current = freeTextMode;

    if (prevMode === freeTextMode) return;

    const context = getEditorContext(editor);
    const currentQuery = serializeDocToQuery(editor.getJSON(), { delimiter: context.delimiter });
    if (!currentQuery) return;

    const newDoc = parseQueryToDoc(currentQuery, context.fields, {
      freeTextMode: context.freeTextMode,
      unknownFields: context.unknownFields,
      delimiter: context.delimiter,
    });
    editor.commands.setContent(newDoc);
  }, [editor, freeTextMode]);

  // Callbacks change with the handlers' identities, so they update the storage
  // without notifying node views.
  const { onFieldSelect, onValueSelect, onCustomSelect, onSubmit } = callbacks;
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setCallbacks({ onFieldSelect, onValueSelect, onCustomSelect, onSubmit });
  }, [editor, onFieldSelect, onValueSelect, onCustomSelect, onSubmit]);
}
