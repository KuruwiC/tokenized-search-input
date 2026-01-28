import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it, vi } from 'vitest';
import {
  EditorContextExtension,
  type EditorContextStorage,
  getEditorContext,
  getEditorContextFromEditor,
} from '../../extensions/editor-context';
import type { FieldDefinition } from '../../types';

// Type-safe helper using the exported function
function getStorage(editor: Editor): EditorContextStorage {
  return getEditorContextFromEditor(editor);
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

  describe('setEditorContext command', () => {
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

      editor.commands.setEditorContext({ fields: newFields });

      const storage = getStorage(editor);
      expect(storage.fields).toEqual(newFields);

      editor.destroy();
    });

    it('updates freeTextMode', () => {
      const editor = createEditor();

      editor.commands.setEditorContext({ freeTextMode: 'none' });

      const storage = getStorage(editor);
      expect(storage.freeTextMode).toBe('none');

      editor.destroy();
    });

    it('updates callbacks partially', () => {
      const originalOnSearch = vi.fn();
      const newOnFieldSelect = vi.fn();

      const editor = createEditor({
        callbacks: { onSubmit: originalOnSearch },
      });

      editor.commands.setEditorContext({
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

      editor.commands.setEditorContext({
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

  describe('individual setters', () => {
    it('setFields updates only fields', () => {
      const editor = createEditor({ freeTextMode: 'tokenize' });
      const newFields: FieldDefinition[] = [
        { key: 'assignee', label: 'Assignee', type: 'string', operators: ['is', 'is_not'] },
      ];

      editor.commands.setFields(newFields);

      const storage = getStorage(editor);
      expect(storage.fields).toEqual(newFields);
      expect(storage.freeTextMode).toBe('tokenize');

      editor.destroy();
    });

    it('setFreeTextMode updates only mode', () => {
      const fields: FieldDefinition[] = [
        { key: 'status', label: 'Status', type: 'string', operators: ['is'] },
      ];
      const editor = createEditor({ fields });

      editor.commands.setFreeTextMode('none');

      const storage = getStorage(editor);
      expect(storage.fields).toEqual(fields);
      expect(storage.freeTextMode).toBe('none');

      editor.destroy();
    });

    it('setCallbacks merges with existing callbacks', () => {
      const onSubmit = vi.fn();
      const onFieldSelect = vi.fn();
      const editor = createEditor({ callbacks: { onSubmit } });

      editor.commands.setCallbacks({ onFieldSelect });

      const storage = getStorage(editor);
      expect(storage.callbacks.onSubmit).toBe(onSubmit);
      expect(storage.callbacks.onFieldSelect).toBe(onFieldSelect);

      editor.destroy();
    });
  });

  describe('getEditorContext helper', () => {
    it('returns storage from editor', () => {
      const fields: FieldDefinition[] = [
        { key: 'status', label: 'Status', type: 'enum', operators: ['is'], enumValues: ['open'] },
      ];
      const editor = createEditor({ fields, freeTextMode: 'tokenize' });

      const context = getEditorContext({ storage: { editorContext: getStorage(editor) } });

      expect(context.fields).toEqual(fields);
      expect(context.freeTextMode).toBe('tokenize');

      editor.destroy();
    });

    it('returns defaults if extension not configured', () => {
      const editorWithoutExtension = {
        storage: {},
      };

      const context = getEditorContext(editorWithoutExtension);

      expect(context.fields).toEqual([]);
      expect(context.freeTextMode).toBe('plain');
      expect(context.callbacks.onFieldSelect).toBeDefined();
    });
  });

  describe('callbacks execution', () => {
    it('stored callbacks can be invoked', () => {
      const onFieldSelect = vi.fn();
      const onValueSelect = vi.fn();
      const onSubmit = vi.fn();

      const editor = createEditor({
        callbacks: { onFieldSelect, onValueSelect, onSubmit },
      });

      const storage = getStorage(editor);
      const testField: FieldDefinition = {
        key: 'test',
        label: 'Test',
        type: 'string',
        operators: ['is'],
      };

      storage.callbacks.onFieldSelect(testField);
      storage.callbacks.onValueSelect('value');
      storage.callbacks.onSubmit();

      expect(onFieldSelect).toHaveBeenCalledWith(testField);
      expect(onValueSelect).toHaveBeenCalledWith('value');
      expect(onSubmit).toHaveBeenCalled();

      editor.destroy();
    });
  });
});
