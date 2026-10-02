import type { JSONContent } from '@tiptap/core';
import { EditorState, type Transaction } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import {
  type ForwardedRef,
  type MutableRefObject,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { getEditorContext } from '../../extensions/editor-context';
import {
  applyTokenPatch,
  type DisplayBinding,
  deleteTokenById,
  setTokenDisplayById,
} from '../../extensions/token-commands';
import { requestValidationCheck } from '../../plugins/shared/meta';
import { createQuerySnapshot, parseQueryToDoc, serializeDocToQuery } from '../../serializer';
import { findTokenById } from '../../utils/find-token';
import { isFilterToken } from '../../utils/node-predicates';
import type {
  TokenDisplay,
  TokenizedSearchInputRef,
  TokenPatch,
} from '../tokenized-search-input.types';

/** Replaces the whole content. Token meta of the previous content is discarded. */
function setContentAndValidate(editor: Editor, doc: JSONContent): void {
  editor.commands.replaceContent(doc);
  editor.view.dispatch(requestValidationCheck(editor.state.tr));
}

/**
 * A state holding only the document, for reads and writes while no live editor
 * exists. A destroyed editor keeps its last state, whose schema still applies.
 */
function stateFromDoc(editor: Editor, doc: JSONContent): EditorState {
  return EditorState.create({ doc: editor.state.schema.nodeFromJSON(doc) });
}

function transformDoc(
  editor: Editor,
  doc: JSONContent,
  write: (tr: Transaction) => void
): JSONContent {
  const { tr } = stateFromDoc(editor, doc);
  write(tr);
  return tr.doc.toJSON() as JSONContent;
}

interface PendingHandleWrites {
  doc: JSONContent | null;
  /**
   * `setTokenDisplay` calls for tokens of `doc`, applied in order after it, each
   * bound to the key and value its token had when the call was made.
   */
  displays: { id: string; display: TokenDisplay; binding: DisplayBinding }[];
  focus: boolean;
  /** `submit` was called; it submits the query once the writes before it are applied. */
  submit: boolean;
}

const NO_PENDING_WRITES: PendingHandleWrites = {
  doc: null,
  displays: [],
  focus: false,
  submit: false,
};

/**
 * Builds the imperative handle.
 *
 * An ancestor's effect in the same commit can call the handle while `editor` is
 * still a destroyed instance. Writes made then are held as a pending document, read
 * back by `getValue` and `getSnapshot`, and applied by `useApplyPendingHandleWrites`
 * once the live editor renders, which then runs a held `submit` as well. Display data has no
 * place in the document, so `setTokenDisplay` calls are held next to it and applied
 * after it; replacing the content with `setValue` or `clear` discards them, as it
 * discards token meta in a live editor. Validation runs once the document is
 * applied, so snapshots read in the meantime carry no validation.
 */
export function useTokenizedSearchInputRef(
  ref: ForwardedRef<TokenizedSearchInputRef>,
  editor: Editor | null
): MutableRefObject<PendingHandleWrites> {
  const pendingHandleRef = useRef<PendingHandleWrites>(NO_PENDING_WRITES);

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
    const readState = (ed: Editor) => {
      const { doc } = pendingHandleRef.current;
      return doc ? stateFromDoc(ed, doc) : ed.state;
    };
    const replacePending = (doc: JSONContent) => {
      pendingHandleRef.current = { ...pendingHandleRef.current, doc, displays: [] };
    };
    const writePending = (ed: Editor, write: (tr: Transaction) => void) => {
      pendingHandleRef.current = {
        ...pendingHandleRef.current,
        doc: transformDoc(ed, readDoc(ed), write),
      };
    };

    return {
      setValue: (value: string) => {
        if (!editor) return;
        const doc = parseValue(editor, value);
        if (editor.isDestroyed) {
          replacePending(doc);
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
        return createQuerySnapshot(readState(editor), {
          delimiter: getEditorContext(editor).delimiter,
        });
      },
      focus: () => {
        if (!editor) return;
        if (editor.isDestroyed) {
          pendingHandleRef.current = { ...pendingHandleRef.current, focus: true };
          return;
        }
        editor.commands.focus();
      },
      clear: () => {
        if (!editor) return;
        if (editor.isDestroyed) {
          replacePending(parseValue(editor, ''));
          return;
        }
        editor.commands.replaceContent('');
      },
      submit: () => {
        if (!editor) return;
        if (editor.isDestroyed) {
          pendingHandleRef.current = { ...pendingHandleRef.current, submit: true };
          return;
        }
        editor.commands.submit();
      },
      updateToken: (id: string, patch: TokenPatch) => {
        if (!editor) return;
        if (editor.isDestroyed) {
          writePending(editor, (tr) => applyTokenPatch(tr, id, patch, getEditorContext(editor)));
          return;
        }
        editor.commands.updateToken(id, patch);
      },
      deleteToken: (id: string) => {
        if (!editor) return;
        if (editor.isDestroyed) {
          writePending(editor, (tr) => deleteTokenById(tr, id));
          return;
        }
        editor.commands.deleteToken(id);
      },
      setTokenDisplay: (id: string, display: TokenDisplay) => {
        if (!editor) return;
        if (editor.isDestroyed) {
          // The display belongs to the tokens of the destroyed editor's document, so
          // that document is what the live editor has to start from.
          const doc = readDoc(editor);
          const found = findTokenById(stateFromDoc(editor, doc).doc, id);
          if (!found || !isFilterToken(found.node)) return;
          const binding = { key: found.node.attrs.key, value: found.node.attrs.value };
          const { displays } = pendingHandleRef.current;
          pendingHandleRef.current = {
            ...pendingHandleRef.current,
            doc,
            displays: [...displays, { id, display, binding }],
          };
          return;
        }
        editor.commands.setTokenDisplay(id, display);
      },
      getEditor: () => editor,
    };
  }, [editor]);

  return pendingHandleRef;
}

/**
 * Applies the writes held while the editor was destroyed. Call it after every other
 * hook that attaches to the editor: the write sets content, validates, sets token
 * display, focuses and submits, so it has to see the configuration synced from the current props, the focus
 * listeners and the suggestion scheduling already in place.
 */
export function useApplyPendingHandleWrites(
  editor: Editor | null,
  pending: MutableRefObject<PendingHandleWrites>
): void {
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const { doc, displays, focus, submit } = pending.current;
    pending.current = NO_PENDING_WRITES;
    if (doc) setContentAndValidate(editor, doc);
    for (const { id, display, binding } of displays) {
      const { tr } = editor.state;
      if (setTokenDisplayById(editor.state, tr, id, display, binding)) editor.view.dispatch(tr);
    }
    if (focus) editor.commands.focus();
    if (submit) editor.commands.submit();
  }, [editor, pending]);
}
