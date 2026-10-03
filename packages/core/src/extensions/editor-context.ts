import { type Editor, Extension } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { getFreeTextStrategy } from '../plugins/auto-tokenize/free-text-strategy';
import { createAutoTokenizePlugin } from '../plugins/auto-tokenize/plugin';
import { tokenizeRange } from '../plugins/auto-tokenize/tokenize-range';
import { createFreeTextSanitizerPlugin } from '../plugins/free-text-sanitizer-plugin';
import {
  isCleared,
  isSubmitted,
  markAutoTokenized,
  markCleared,
  markSubmitted,
} from '../plugins/shared/meta';
import { type FocusTransitionContext, leaveFocusedTokenIn } from '../plugins/token-focus-plugin';
import { createQuerySnapshot, type SerializeDocOptions } from '../serializer';
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
  type QuerySnapshot,
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

export interface EditorCallbacks {
  onFieldSelect: (field: FieldDefinition) => void;
  onValueSelect: (value: string) => void;
  onCustomSelect: (suggestion: CustomSuggestion) => void;
  onSubmit: (snapshot: QuerySnapshot) => void;
  onClear: () => void;
}

/** The single owner of editor configuration; readers go through `getEditorContext`. */
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

/** Members that can change after the editor is created; `undefined` means the default. */
export type EditorConfig = {
  [K in keyof Omit<EditorContextStorage, 'callbacks' | 'delimiter'>]?:
    | EditorContextStorage[K]
    | undefined;
};

export type EditorContextUpdate = EditorConfig & { callbacks?: Partial<EditorCallbacks> };

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
    onClear: () => {},
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
       * - 'tokenize': Reads the text left in the paragraph as a query, as a paste is read
       * - 'plain': No action (text remains as-is)
       * - 'none': Removes all text nodes from document
       */
      finalizeInput: () => ReturnType;
      /**
       * Leaves the token being edited, finalizes the input and calls `onSubmit` with the
       * query that leaves. Every way of submitting goes through this command.
       */
      submit: () => ReturnType;
      /**
       * Removes the whole content, like `replaceContent`, and calls `onClear`. Every way
       * of clearing goes through this command.
       */
      clear: () => ReturnType;
    };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isSameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]));
  }
  return false;
}

/**
 * Writes the members present in `update` into `target` and reports whether any of
 * them held a different value before. Members that compare equal keep the stored
 * value, so re-applying an equal configuration changes nothing.
 */
export function applyEditorContext(
  target: EditorContextStorage,
  update: EditorContextUpdate
): boolean {
  const { callbacks, ...config } = update;
  let changed = false;
  for (const key of Object.keys(config) as Array<keyof EditorConfig>) {
    const next = config[key] ?? DEFAULT_EDITOR_CONTEXT[key];
    if (isSameValue(target[key], next)) continue;
    Object.assign(target, { [key]: next });
    changed = true;
  }
  if (callbacks) {
    for (const key of Object.keys(callbacks) as Array<keyof EditorCallbacks>) {
      const next = callbacks[key];
      if (next === undefined || Object.is(target.callbacks[key], next)) continue;
      target.callbacks = { ...target.callbacks, [key]: next };
      changed = true;
    }
  }
  return changed;
}

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

/** What writing the query of `editor` needs from its configuration. */
export function getSerializeOptions(editor: object): SerializeDocOptions {
  const { delimiter, fields, unknownFields } = getEditorContext(editor);
  return { delimiter, fields, unknownFields };
}

/** What a focus transition in a transaction from `state` of `editor` needs to know. */
export function getFocusContext(
  editor: Editor,
  state: EditorState = editor.state
): FocusTransitionContext {
  return { state, source: getEditorContext(editor), editable: editor.isEditable };
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
        ({ editor, tr, dispatch, chain }) => {
          const storage = getEditorContext(editor);
          const strategy = getFreeTextStrategy(storage.freeTextMode);
          const action = strategy.finalizeAction;

          if (action === 'none') {
            return true;
          }

          if (action === 'tokenize') {
            if (
              dispatch &&
              tokenizeRange(tr, 0, tr.doc.content.size, storage, getFocusContext(editor))
            ) {
              markAutoTokenized(tr);
            }
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

      submit:
        () =>
        ({ editor, state, tr, commands, dispatch }) => {
          if (!dispatch) return true;
          leaveFocusedTokenIn(tr, getFocusContext(editor, state));
          commands.finalizeInput();
          markSubmitted(tr);
          return true;
        },

      clear:
        () =>
        ({ tr, commands, dispatch }) => {
          if (!commands.replaceContent('')) return false;
          if (dispatch) markCleared(tr);
          return true;
        },
    };
  },

  onTransaction({ transaction }) {
    const { callbacks } = getEditorContext(this.editor);
    if (isCleared(transaction)) callbacks.onClear();
    if (isSubmitted(transaction)) {
      callbacks.onSubmit(createQuerySnapshot(this.editor.state, getSerializeOptions(this.editor)));
    }
  },

  addProseMirrorPlugins() {
    return [
      // Auto-tokenize runs first: converts text to tokens
      createAutoTokenizePlugin(
        () => ({
          fields: this.storage.fields,
          freeTextMode: this.storage.freeTextMode,
          unknownFields: this.storage.unknownFields,
          deserializeText: this.storage.deserializeText,
          delimiter: this.storage.delimiter,
        }),
        (state) => getFocusContext(this.editor, state)
      ),
      // Sanitizer runs second: removes remaining free text in 'none' mode
      createFreeTextSanitizerPlugin(() => ({
        freeTextMode: this.storage.freeTextMode,
      })),
    ];
  },
});
