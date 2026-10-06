import { renderHook } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it } from 'vitest';
import { useEditorConfig } from '../../editor/hooks/use-editor-config';
import { useEditorConfigSync } from '../../editor/hooks/use-editor-config-sync';
import { EditorContextExtension, getEditorContext } from '../../extensions/editor-context';
import type { FieldDefinition } from '../../types';

const fields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'string', operators: ['is'] },
];

const callbacks = {
  onFieldSelect: () => {},
  onValueSelect: () => {},
  onCustomSelect: () => {},
  onSubmit: () => {},
  onClear: () => {},
};

describe('useEditorConfigSync', () => {
  it('keeps writing the storage of a destroyed editor', () => {
    const editor = new Editor({
      extensions: [Document, Paragraph, Text, EditorContextExtension],
      content: '',
    });
    editor.destroy();

    renderHook(() => useEditorConfigSync(editor, { fields, freeTextMode: 'tokenize' }, callbacks));

    expect(getEditorContext(editor).fields).toBe(fields);
    expect(getEditorContext(editor).freeTextMode).toBe('tokenize');
  });
});

describe('useEditorConfig', () => {
  it('leaves unset members undefined so the editor context owns the defaults', () => {
    const { result } = renderHook(() => useEditorConfig({ fields }));

    expect(result.current.freeTextMode).toBeUndefined();
    expect(result.current.fieldSuggestionsDisabled).toBeUndefined();
    expect(result.current.valueSuggestionsDisabled).toBeUndefined();
  });
});
