import { Extension } from '@tiptap/core';
import { getFreeTextStrategy } from '../editor/auto-tokenize/free-text-strategy';
import { getCurrentWord } from '../editor/use-auto-tokenize';
import { createAutoTokenizePlugin } from '../plugins/auto-tokenize-plugin';
import { createDocInvariantPlugin } from '../plugins/doc-invariant-plugin';
import { createFreeTextSanitizerPlugin } from '../plugins/free-text-sanitizer-plugin';
import {
  type ClassNames,
  type CustomSuggestion,
  DEFAULT_OPERATOR_LABELS,
  DEFAULT_TOKEN_DELIMITER,
  type FieldDefinition,
  type FreeTextMode,
  type OperatorLabels,
  type ParsedToken,
  type ValidationConfig,
} from '../types';

/**
 * @example
 * // Custom format with fallback to standard
 * deserializeText: (text) => {
 *   const tokens = matchCustomFormat(text);
 *   return tokens.length > 0 ? tokens : null; // null = use default parser
 * }
 */
export type DeserializeTextFn = (text: string) => ParsedToken[] | null;

export interface EditorCallbacks {
  onFieldSelect: (field: FieldDefinition) => void;
  onValueSelect: (value: string) => void;
  onCustomSelect: (suggestion: CustomSuggestion) => void;
  onSubmit: () => void;
}

export interface EditorContextStorage {
  fields: FieldDefinition[];
  freeTextMode: FreeTextMode;
  allowUnknownFields: boolean;
  unknownFieldOperators: readonly string[] | undefined;
  hideUnknownFieldSingleOperator: boolean;
  operatorLabels: OperatorLabels;
  callbacks: EditorCallbacks;
  fieldSuggestionsDisabled: boolean;
  valueSuggestionsDisabled: boolean;
  validation: ValidationConfig | undefined;
  deserializeText: DeserializeTextFn | undefined;
  delimiter: string;
  classNames: ClassNames | undefined;
}

const defaultCallbacks: EditorCallbacks = {
  onFieldSelect: () => {},
  onValueSelect: () => {},
  onCustomSelect: () => {},
  onSubmit: () => {},
};

export interface EditorContextUpdate {
  fields?: FieldDefinition[];
  freeTextMode?: FreeTextMode;
  allowUnknownFields?: boolean;
  unknownFieldOperators?: readonly string[];
  hideUnknownFieldSingleOperator?: boolean;
  operatorLabels?: OperatorLabels;
  callbacks?: Partial<EditorCallbacks>;
  fieldSuggestionsDisabled?: boolean;
  valueSuggestionsDisabled?: boolean;
  validation?: ValidationConfig;
}

declare module '@tiptap/core' {
  interface Storage {
    editorContext?: EditorContextStorage;
  }

  interface Commands<ReturnType> {
    editorContext: {
      setEditorContext: (context: EditorContextUpdate) => ReturnType;
      setFields: (fields: FieldDefinition[]) => ReturnType;
      setFreeTextMode: (mode: FreeTextMode) => ReturnType;
      setCallbacks: (callbacks: Partial<EditorCallbacks>) => ReturnType;
      /**
       * Applies mode-specific processing based on freeTextMode:
       * - 'tokenize': Converts pending text to freeTextToken
       * - 'plain': No action (text remains as-is)
       * - 'none': Removes all text nodes from document
       */
      finalizeInput: () => ReturnType;
    };
  }
}

export interface EditorContextOptions {
  fields?: FieldDefinition[];
  freeTextMode?: FreeTextMode;
  allowUnknownFields?: boolean;
  unknownFieldOperators?: readonly string[];
  hideUnknownFieldSingleOperator?: boolean;
  operatorLabels?: OperatorLabels;
  callbacks?: Partial<EditorCallbacks>;
  fieldSuggestionsDisabled?: boolean;
  valueSuggestionsDisabled?: boolean;
  validation?: ValidationConfig;
  deserializeText?: DeserializeTextFn;
  /** Must be a single character. Cannot be changed after editor initialization. */
  delimiter?: string;
  /** Custom class names for styling component parts. */
  classNames?: ClassNames;
}

export const EditorContextExtension = Extension.create<EditorContextOptions, EditorContextStorage>({
  name: 'editorContext',

  addOptions() {
    return {
      fields: [],
      freeTextMode: 'plain' as FreeTextMode,
      allowUnknownFields: false,
      unknownFieldOperators: undefined,
      hideUnknownFieldSingleOperator: false,
      operatorLabels: undefined,
      callbacks: defaultCallbacks,
      fieldSuggestionsDisabled: false,
      valueSuggestionsDisabled: false,
      validation: undefined,
      deserializeText: undefined,
      delimiter: DEFAULT_TOKEN_DELIMITER,
      classNames: undefined,
    };
  },

  addStorage() {
    return {
      fields: this.options.fields || [],
      freeTextMode: this.options.freeTextMode || 'plain',
      allowUnknownFields: this.options.allowUnknownFields || false,
      unknownFieldOperators: this.options.unknownFieldOperators,
      hideUnknownFieldSingleOperator: this.options.hideUnknownFieldSingleOperator ?? false,
      operatorLabels: this.options.operatorLabels ?? DEFAULT_OPERATOR_LABELS,
      callbacks: { ...defaultCallbacks, ...this.options.callbacks },
      fieldSuggestionsDisabled: this.options.fieldSuggestionsDisabled ?? false,
      valueSuggestionsDisabled: this.options.valueSuggestionsDisabled ?? false,
      validation: this.options.validation,
      deserializeText: this.options.deserializeText,
      delimiter: this.options.delimiter ?? DEFAULT_TOKEN_DELIMITER,
      classNames: this.options.classNames,
    };
  },

  addCommands() {
    const getStorage = (editor: { storage: unknown }) =>
      (editor.storage as Record<string, EditorContextStorage>).editorContext;

    return {
      setEditorContext:
        (context) =>
        ({ editor }) => {
          const storage = getStorage(editor);
          if (context.fields !== undefined) {
            storage.fields = context.fields;
          }
          if (context.freeTextMode !== undefined) {
            storage.freeTextMode = context.freeTextMode;
          }
          if (context.allowUnknownFields !== undefined) {
            storage.allowUnknownFields = context.allowUnknownFields;
          }
          if (context.unknownFieldOperators !== undefined) {
            storage.unknownFieldOperators = context.unknownFieldOperators;
          }
          if (context.hideUnknownFieldSingleOperator !== undefined) {
            storage.hideUnknownFieldSingleOperator = context.hideUnknownFieldSingleOperator;
          }
          if (context.operatorLabels !== undefined) {
            storage.operatorLabels = context.operatorLabels;
          }
          if (context.callbacks !== undefined) {
            storage.callbacks = { ...storage.callbacks, ...context.callbacks };
          }
          if (context.fieldSuggestionsDisabled !== undefined) {
            storage.fieldSuggestionsDisabled = context.fieldSuggestionsDisabled;
          }
          if (context.valueSuggestionsDisabled !== undefined) {
            storage.valueSuggestionsDisabled = context.valueSuggestionsDisabled;
          }
          if ('validation' in context) {
            storage.validation = context.validation;
          }
          return true;
        },

      setFields:
        (fields) =>
        ({ editor }) => {
          getStorage(editor).fields = fields;
          return true;
        },

      setFreeTextMode:
        (mode) =>
        ({ editor }) => {
          getStorage(editor).freeTextMode = mode;
          return true;
        },

      setCallbacks:
        (callbacks) =>
        ({ editor }) => {
          const storage = getStorage(editor);
          storage.callbacks = { ...storage.callbacks, ...callbacks };
          return true;
        },

      finalizeInput:
        () =>
        ({ editor, chain }) => {
          const storage = getStorage(editor);
          const strategy = getFreeTextStrategy(storage.freeTextMode);
          const action = strategy.finalizeAction;

          if (action === 'none') {
            return true;
          }

          if (action === 'tokenize') {
            // Convert pending text to freeTextToken using proper word boundary detection
            const { word, from, to } = getCurrentWord(editor);
            const trimmedWord = word.trim();

            if (!trimmedWord || from >= to) return true;

            chain()
              .deleteRange({ from, to })
              .insertFreeTextToken({ value: trimmedWord, quoted: false })
              .run();

            return true;
          }

          if (action === 'remove') {
            // Remove all text nodes from document (including whitespace-only)
            const { doc } = editor.state;
            const textNodes: Array<{ from: number; to: number }> = [];

            doc.descendants((node, pos) => {
              if (node.isText) {
                textNodes.push({ from: pos, to: pos + node.nodeSize });
              }
              return true;
            });

            if (textNodes.length === 0) return true;

            const chainCmd = chain();
            for (let i = textNodes.length - 1; i >= 0; i--) {
              chainCmd.deleteRange(textNodes[i]);
            }
            chainCmd.run();

            return true;
          }

          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      // Doc invariant runs first: removes empty leading paragraphs (TipTap #2560 fix)
      createDocInvariantPlugin(),
      // Auto-tokenize runs second: converts text to tokens
      createAutoTokenizePlugin(() => ({
        fields: this.storage.fields,
        freeTextMode: this.storage.freeTextMode,
        allowUnknownFields: this.storage.allowUnknownFields,
        unknownFieldOperators: this.storage.unknownFieldOperators,
        deserializeText: this.storage.deserializeText,
        delimiter: this.storage.delimiter,
      })),
      // Sanitizer runs third: removes remaining free text in 'none' mode
      createFreeTextSanitizerPlugin(() => ({
        freeTextMode: this.storage.freeTextMode,
      })),
    ];
  },
});

export function getEditorContext(editor: {
  storage: { editorContext?: EditorContextStorage };
}): EditorContextStorage {
  return (
    editor.storage.editorContext || {
      fields: [],
      freeTextMode: 'plain',
      allowUnknownFields: false,
      unknownFieldOperators: undefined,
      hideUnknownFieldSingleOperator: false,
      operatorLabels: DEFAULT_OPERATOR_LABELS,
      callbacks: defaultCallbacks,
      fieldSuggestionsDisabled: false,
      valueSuggestionsDisabled: false,
      validation: undefined,
      deserializeText: undefined,
      delimiter: DEFAULT_TOKEN_DELIMITER,
      classNames: undefined,
    }
  );
}

// Accepts any object with storage property (works with @tiptap/core and @tiptap/react)
export function getEditorContextFromEditor(editor: { storage: unknown }): EditorContextStorage {
  const storage = editor.storage as { editorContext?: EditorContextStorage } | undefined;
  if (!storage) {
    return {
      fields: [],
      freeTextMode: 'plain',
      allowUnknownFields: false,
      unknownFieldOperators: undefined,
      hideUnknownFieldSingleOperator: false,
      operatorLabels: DEFAULT_OPERATOR_LABELS,
      callbacks: defaultCallbacks,
      fieldSuggestionsDisabled: false,
      valueSuggestionsDisabled: false,
      validation: undefined,
      deserializeText: undefined,
      delimiter: DEFAULT_TOKEN_DELIMITER,
      classNames: undefined,
    };
  }
  return getEditorContext({ storage });
}
