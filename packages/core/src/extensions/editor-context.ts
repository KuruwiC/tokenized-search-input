import { Extension } from '@tiptap/core';
import { getFreeTextStrategy } from '../editor/auto-tokenize/free-text-strategy';
import { getCurrentWord } from '../editor/use-auto-tokenize';
import { createAutoTokenizePlugin } from '../plugins/auto-tokenize-plugin';
import { createDocInvariantPlugin } from '../plugins/doc-invariant-plugin';
import { createFreeTextSanitizerPlugin } from '../plugins/free-text-sanitizer-plugin';
import {
  type ClassNames,
  type CustomSuggestion,
  type DatePickerRenderProps,
  type DateTimePickerRenderProps,
  DEFAULT_OPERATOR_LABELS,
  DEFAULT_TOKEN_DELIMITER,
  type FieldDefinition,
  type FilterTokenAttrs,
  type FreeTextMode,
  type OperatorLabels,
  type PaginationLabels,
  type ParsedToken,
  type UnknownFieldTemplate,
  type ValidationConfig,
} from '../types';

export { type FieldResolutionSource, resolveField } from '../utils/resolve-field';

/**
 * @example
 * // Custom format with fallback to standard
 * deserializeText: (text) => {
 *   const tokens = matchCustomFormat(text);
 *   return tokens.length > 0 ? tokens : null; // null = use default parser
 * }
 */
export type DeserializeTextFn = (text: string) => ParsedToken[] | null;

/** Transaction metadata used to notify node views that context-backed UI changed. */
export const EDITOR_CONTEXT_UPDATED = 'editorContextUpdated';

export interface EditorCallbacks {
  onFieldSelect: (field: FieldDefinition) => void;
  onValueSelect: (value: string) => void;
  onCustomSelect: (suggestion: CustomSuggestion) => void;
  onSubmit: () => void;
}

/**
 * The single owner of editor configuration. Every reader goes through
 * `getEditorContext(editor)`; nothing else keeps a copy.
 */
export interface EditorContextStorage {
  fields: FieldDefinition[];
  freeTextMode: FreeTextMode;
  /** Presence allows unknown field keys; see `resolveField`. */
  unknownFields: UnknownFieldTemplate | undefined;
  operatorLabels: OperatorLabels;
  callbacks: EditorCallbacks;
  fieldSuggestionsDisabled: boolean;
  valueSuggestionsDisabled: boolean;
  validation: ValidationConfig | undefined;
  deserializeText: DeserializeTextFn | undefined;
  serializeToken: ((token: FilterTokenAttrs) => string | null) | undefined;
  /** A single character, fixed when the editor is created. */
  delimiter: string;
  classNames: ClassNames | undefined;
  renderDatePicker: ((props: DatePickerRenderProps) => React.ReactNode) | undefined;
  renderDateTimePicker: ((props: DateTimePickerRenderProps) => React.ReactNode) | undefined;
  paginationLabels: PaginationLabels | undefined;
}

/** The members of the editor context that can change after the editor is created. */
export type EditorConfig = Omit<EditorContextStorage, 'callbacks' | 'delimiter'>;

export type EditorContextUpdate = {
  [K in keyof EditorConfig]?: EditorConfig[K] | undefined;
} & { callbacks?: Partial<EditorCallbacks> };

/** What `createEditorContext` accepts: the updatable members plus the delimiter. */
export type EditorContextOptions = EditorContextUpdate & { delimiter?: string | undefined };

export const DEFAULT_EDITOR_CONTEXT: EditorContextStorage = {
  fields: [],
  freeTextMode: 'plain',
  unknownFields: undefined,
  operatorLabels: DEFAULT_OPERATOR_LABELS,
  callbacks: {
    onFieldSelect: () => {},
    onValueSelect: () => {},
    onCustomSelect: () => {},
    onSubmit: () => {},
  },
  fieldSuggestionsDisabled: false,
  valueSuggestionsDisabled: false,
  validation: undefined,
  deserializeText: undefined,
  serializeToken: undefined,
  delimiter: DEFAULT_TOKEN_DELIMITER,
  classNames: undefined,
  renderDatePicker: undefined,
  renderDateTimePicker: undefined,
  paginationLabels: undefined,
};

declare module '@tiptap/core' {
  interface Storage {
    editorContext?: EditorContextStorage;
  }

  interface Commands<ReturnType> {
    editorContext: {
      /**
       * Updates the members present in `context`. An `undefined` value restores
       * that member's default.
       */
      setEditorContext: (context: EditorContextUpdate) => ReturnType;
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

function applyEditorContext(target: EditorContextStorage, update: EditorContextUpdate): void {
  const { callbacks, ...config } = update;
  const defaults: Record<string, unknown> = { ...DEFAULT_EDITOR_CONTEXT };
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    next[key] = value ?? defaults[key];
  }
  Object.assign(target, next);
  if (callbacks) {
    target.callbacks = { ...target.callbacks, ...callbacks };
  }
}

/** Builds the initial editor context. Absent or `undefined` members take their defaults. */
export function createEditorContext(options: EditorContextOptions = {}): EditorContextStorage {
  const { delimiter, ...update } = options;
  if (delimiter !== undefined && delimiter.length !== 1) {
    throw new Error(
      `[TokenizedSearchInput] initialDelimiter must be a single character, got "${delimiter}"`
    );
  }
  const context: EditorContextStorage = {
    ...DEFAULT_EDITOR_CONTEXT,
    delimiter: delimiter ?? DEFAULT_EDITOR_CONTEXT.delimiter,
  };
  applyEditorContext(context, update);
  return context;
}

/**
 * Tiptap clears an editor's `storage` when it is destroyed, yet React can keep
 * rendering with a destroyed editor until `useEditor` swaps in a new one. The
 * context object is therefore indexed by editor so readers never lose it.
 */
const contextsByEditor = new WeakMap<object, EditorContextStorage>();

/**
 * The single reader of editor configuration. Throws when `EditorContextExtension`
 * is not registered: there is no meaningful configuration to fall back to.
 */
export function getEditorContext(editor: object): EditorContextStorage {
  const context = contextsByEditor.get(editor);
  if (!context) {
    throw new Error(
      '[TokenizedSearchInput] EditorContextExtension is not registered on the editor'
    );
  }
  return context;
}

export const EditorContextExtension = Extension.create<EditorContextOptions, EditorContextStorage>({
  name: 'editorContext',

  addOptions() {
    return {};
  },

  addStorage() {
    return createEditorContext(this.options);
  },

  onBeforeCreate() {
    contextsByEditor.set(this.editor, this.storage);
  },

  addCommands() {
    return {
      setEditorContext:
        (context) =>
        ({ editor }) => {
          applyEditorContext(getEditorContext(editor), context);
          return true;
        },

      setCallbacks:
        (callbacks) =>
        ({ editor }) => {
          applyEditorContext(getEditorContext(editor), { callbacks });
          return true;
        },

      finalizeInput:
        () =>
        ({ editor, chain }) => {
          const storage = getEditorContext(editor);
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
        unknownFields: this.storage.unknownFields,
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
