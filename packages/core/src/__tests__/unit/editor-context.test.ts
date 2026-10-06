import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it, vi } from 'vitest';
import {
  applyEditorContext,
  DEFAULT_EDITOR_CONTEXT,
  EditorContextExtension,
  type EditorContextStorage,
  getEditorContext,
} from '../../extensions/editor-context';
import type { FieldDefinition } from '../../types';

// Type-safe helper using the exported function
function getStorage(editor: Editor): EditorContextStorage {
  return getEditorContext(editor);
}

describe('EditorContextExtension', () => {
  function createEditor(options?: Parameters<typeof EditorContextExtension.configure>[0]) {
    return new Editor({
      extensions: [Document, Paragraph, Text, EditorContextExtension.configure(options)],
      content: '',
    });
  }

  describe('storage initialization', () => {
    it('initializes with default values', () => {
      const editor = createEditor();
      const storage = getStorage(editor);

      expect(storage.fields).toEqual([]);
      expect(storage.freeTextMode).toBe('plain');
      expect(storage.callbacks.onFieldSelect).toBeDefined();
      expect(storage.callbacks.onValueSelect).toBeDefined();
      expect(storage.callbacks.onSubmit).toBeDefined();

      editor.destroy();
    });

    it('keeps the delimiter from the options', () => {
      const editor = createEditor({ delimiter: '=' });

      expect(getStorage(editor).delimiter).toBe('=');

      editor.destroy();
    });

    it('rejects a delimiter that is not a single character', () => {
      expect(() => createEditor({ delimiter: '::' })).toThrow('single character');
    });

    it('initializes with provided options', () => {
      const fields: FieldDefinition[] = [
        {
          key: 'status',
          label: 'Status',
          type: 'enum',
          operators: ['is', 'is_not'],
          enumValues: ['open', 'closed'],
        },
      ];
      const onSubmit = vi.fn();

      const editor = createEditor({
        fields,
        freeTextMode: 'tokenize',
        callbacks: { onSubmit },
      });

      const storage = getStorage(editor);

      expect(storage.fields).toEqual(fields);
      expect(storage.freeTextMode).toBe('tokenize');
      expect(storage.callbacks.onSubmit).toBe(onSubmit);

      editor.destroy();
    });
  });

  describe('applyEditorContext', () => {
    it('updates fields', () => {
      const editor = createEditor();
      const newFields: FieldDefinition[] = [
        {
          key: 'priority',
          label: 'Priority',
          type: 'enum',
          operators: ['is'],
          enumValues: ['high', 'low'],
        },
      ];

      applyEditorContext(getStorage(editor), { fields: newFields });

      const storage = getStorage(editor);
      expect(storage.fields).toEqual(newFields);

      editor.destroy();
    });

    it('updates freeTextMode', () => {
      const editor = createEditor();

      applyEditorContext(getStorage(editor), { freeTextMode: 'none' });

      const storage = getStorage(editor);
      expect(storage.freeTextMode).toBe('none');

      editor.destroy();
    });

    it('leaves members that are absent from the update untouched', () => {
      const fields: FieldDefinition[] = [
        { key: 'status', label: 'Status', type: 'string', operators: ['is'] },
      ];
      const editor = createEditor({ fields, freeTextMode: 'tokenize' });

      applyEditorContext(getStorage(editor), { freeTextMode: 'none' });

      const storage = getStorage(editor);
      expect(storage.fields).toEqual(fields);
      expect(storage.freeTextMode).toBe('none');

      editor.destroy();
    });

    it('restores the default of a member updated to undefined', () => {
      const editor = createEditor({ freeTextMode: 'tokenize', fieldSuggestionsDisabled: true });

      applyEditorContext(getStorage(editor), {
        freeTextMode: undefined,
        fieldSuggestionsDisabled: undefined,
      });

      const storage = getStorage(editor);
      expect(storage.freeTextMode).toBe(DEFAULT_EDITOR_CONTEXT.freeTextMode);
      expect(storage.fieldSuggestionsDisabled).toBe(false);

      editor.destroy();
    });

    it('updates callbacks partially', () => {
      const originalOnSearch = vi.fn();
      const newOnFieldSelect = vi.fn();

      const editor = createEditor({
        callbacks: { onSubmit: originalOnSearch },
      });

      applyEditorContext(getStorage(editor), {
        callbacks: { onFieldSelect: newOnFieldSelect },
      });

      const storage = getStorage(editor);
      expect(storage.callbacks.onFieldSelect).toBe(newOnFieldSelect);
      expect(storage.callbacks.onSubmit).toBe(originalOnSearch);

      editor.destroy();
    });

    it('updates multiple values at once', () => {
      const editor = createEditor();
      const newFields: FieldDefinition[] = [
        { key: 'status', label: 'Status', type: 'string', operators: ['is'] },
      ];
      const newOnSearch = vi.fn();

      applyEditorContext(getStorage(editor), {
        fields: newFields,
        freeTextMode: 'tokenize',
        callbacks: { onSubmit: newOnSearch },
      });

      const storage = getStorage(editor);
      expect(storage.fields).toEqual(newFields);
      expect(storage.freeTextMode).toBe('tokenize');
      expect(storage.callbacks.onSubmit).toBe(newOnSearch);

      editor.destroy();
    });
  });

  describe('getEditorContext helper', () => {
    it('keeps the context readable after the editor is destroyed', () => {
      const fields: FieldDefinition[] = [
        { key: 'status', label: 'Status', type: 'string', operators: ['is'] },
      ];
      const editor = createEditor({ fields });

      editor.destroy();

      expect(getEditorContext(editor).fields).toEqual(fields);
    });

    it('throws if the extension is not registered', () => {
      const editorWithoutExtension = new Editor({
        extensions: [Document, Paragraph, Text],
        content: '',
      });

      expect(() => getEditorContext(editorWithoutExtension)).toThrow(
        'EditorContextExtension is not registered'
      );

      editorWithoutExtension.destroy();
    });
  });
});
