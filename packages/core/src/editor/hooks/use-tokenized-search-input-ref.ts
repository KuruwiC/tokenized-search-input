import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import {
  type ForwardedRef,
  type MutableRefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { getEditorContext } from '../../extensions/editor-context';
import { FORCE_VALIDATION_CHECK } from '../../plugins/validation-plugin';
import { createQuerySnapshot, parseQueryToDoc, serializeDocToQuery } from '../../serializer';
import type { QuerySnapshot } from '../../types';
import {
  deleteTokenInDoc,
  deleteTokenInEditor,
  setTokenDisplayInDoc,
  setTokenDisplayInEditor,
  updateTokenInDoc,
  updateTokenInEditor,
} from '../token-commands';
import type {
  TokenDisplay,
  TokenizedSearchInputRef,
  TokenPatch,
} from '../tokenized-search-input.types';

function setContentAndValidate(editor: Editor, doc: JSONContent): void {
  editor.commands.setContent(doc);
  const tr = editor.state.tr;
  tr.setMeta(FORCE_VALIDATION_CHECK, true);
  editor.view.dispatch(tr);
}

export interface UseTokenizedSearchInputRefOptions {
  editor: Editor | null;
  onSubmit: ((snapshot: QuerySnapshot) => void) | undefined;
}

interface PendingHandleWrites {
  doc: JSONContent | null;
  focus: boolean;
}

export interface TokenizedSearchInputHandle {
  submit: () => void;
  pending: MutableRefObject<PendingHandleWrites>;
}

/**
 * Builds the imperative handle.
 *
 * An ancestor's effect in the same commit can call the handle while `editor` is
 * still a destroyed instance. Writes made then are held as a pending document, read
 * back by `getValue`, `getSnapshot` and `submit`, and applied by
 * `useApplyPendingHandleWrites` once the live editor renders.
 */
export function useTokenizedSearchInputRef(
  ref: ForwardedRef<TokenizedSearchInputRef>,
  { editor, onSubmit }: UseTokenizedSearchInputRefOptions
): TokenizedSearchInputHandle {
  const pendingHandleRef = useRef<PendingHandleWrites>({ doc: null, focus: false });

  const submit = useCallback(() => {
    if (!editor) return;
    const doc = pendingHandleRef.current.doc ?? editor.getJSON();
    const snapshot = createQuerySnapshot(doc, { delimiter: getEditorContext(editor).delimiter });
    onSubmit?.(snapshot);
  }, [editor, onSubmit]);

  useImperativeHandle(ref, () => {
    const parseValue = (ed: Editor, value: string) => {
      const context = getEditorContext(ed);
      return parseQueryToDoc(value, context.fields, {
        freeTextMode: context.freeTextMode,
        unknownFields: context.unknownFields,
        delimiter: context.delimiter,
      });
    };
    const readDoc = (ed: Editor) => pendingHandleRef.current.doc ?? ed.getJSON();

    return {
      setValue: (value: string) => {
        if (!editor) return;
        const doc = parseValue(editor, value);
        if (editor.isDestroyed) {
          pendingHandleRef.current.doc = doc;
          return;
        }
        setContentAndValidate(editor, doc);
      },
      getValue: () => {
        if (!editor) return '';
        return serializeDocToQuery(readDoc(editor), {
          delimiter: getEditorContext(editor).delimiter,
        });
      },
      getSnapshot: () => {
        if (!editor) return { segments: [], text: '' };
        return createQuerySnapshot(readDoc(editor), {
          delimiter: getEditorContext(editor).delimiter,
        });
      },
      focus: () => {
        if (!editor) return;
        if (editor.isDestroyed) {
          pendingHandleRef.current.focus = true;
          return;
        }
        editor.commands.focus();
      },
      clear: () => {
        if (!editor) return;
        if (editor.isDestroyed) {
          pendingHandleRef.current.doc = parseValue(editor, '');
          return;
        }
        editor.commands.clearContent();
      },
      submit,
      updateToken: (id: string, patch: TokenPatch) => {
        if (!editor) return;
        if (editor.isDestroyed) {
          pendingHandleRef.current.doc = updateTokenInDoc(readDoc(editor), id, patch);
          return;
        }
        updateTokenInEditor(editor, id, patch);
      },
      deleteToken: (id: string) => {
        if (!editor) return;
        if (editor.isDestroyed) {
          pendingHandleRef.current.doc = deleteTokenInDoc(readDoc(editor), id);
          return;
        }
        deleteTokenInEditor(editor, id);
      },
      setTokenDisplay: (id: string, display: TokenDisplay) => {
        if (!editor) return;
        if (editor.isDestroyed) {
          pendingHandleRef.current.doc = setTokenDisplayInDoc(readDoc(editor), id, display);
          return;
        }
        setTokenDisplayInEditor(editor, id, display);
      },
      getEditor: () => editor,
    };
  }, [editor, submit]);

  return { submit, pending: pendingHandleRef };
}

/**
 * Applies the writes held while the editor was destroyed. Call it after every other
 * hook that attaches to the editor: the write sets content, validates and focuses,
 * so it has to see the configuration synced from the current props, the focus
 * listeners and the suggestion scheduling already in place.
 */
export function useApplyPendingHandleWrites(
  editor: Editor | null,
  pending: MutableRefObject<PendingHandleWrites>
): void {
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const { doc, focus } = pending.current;
    pending.current = { doc: null, focus: false };
    if (doc) setContentAndValidate(editor, doc);
    if (focus) editor.commands.focus();
  }, [editor, pending]);
}
