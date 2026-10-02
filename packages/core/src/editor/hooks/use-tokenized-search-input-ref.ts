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

/**
 * Replaces the whole content and validates it, in one transaction. Token meta of the
 * previous content is discarded.
 */
function setContentAndValidate(editor: Editor, doc: JSONContent): void {
  editor
    .chain()
    .replaceContent(doc)
    .command(({ tr }) => {
      requestValidationCheck(tr);
      return true;
    })
    .run();
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

/** A handle call made while the editor was destroyed, held to run on the live editor. */
type PendingCall =
  | { type: 'setValue'; doc: JSONContent }
  | { type: 'clear' }
  | { type: 'updateToken'; id: string; patch: TokenPatch }
  | { type: 'deleteToken'; id: string }
  /** Bound to the key and value its token had when the call was made. */
  | { type: 'setTokenDisplay'; id: string; display: TokenDisplay; binding: DisplayBinding }
  | { type: 'focus' }
  | { type: 'submit' };

interface PendingHandleCalls {
  /** The destroyed editor's document, which the calls were made against. */
  base: JSONContent | null;
  /** In call order. */
  calls: PendingCall[];
}

const NO_PENDING_CALLS: PendingHandleCalls = { base: null, calls: [] };

/**
 * Builds the imperative handle.
 *
 * An ancestor's effect in the same commit can call the handle while `editor` is
 * still a destroyed instance. Calls made then are held in call order and run by
 * `useApplyPendingHandleWrites` on the live editor, through the same commands as on a
 * live editor, starting from the document the destroyed editor had. `getValue` and
 * `getSnapshot` read the document the held calls produce; validation runs once they
 * are applied, so snapshots read in the meantime carry no validation.
 */
export function useTokenizedSearchInputRef(
  ref: ForwardedRef<TokenizedSearchInputRef>,
  editor: Editor | null
): MutableRefObject<PendingHandleCalls> {
  const pendingHandleRef = useRef<PendingHandleCalls>(NO_PENDING_CALLS);

  useImperativeHandle(ref, () => {
    const parseValue = (ed: Editor, value: string) => {
      const context = getEditorContext(ed);
      return parseQueryToDoc(value, context.fields, {
        freeTextMode: context.freeTextMode,
        unknownFields: context.unknownFields,
        delimiter: context.delimiter,
      });
    };
    /** The document after the held calls. */
    const readDoc = (ed: Editor): JSONContent => {
      const { base, calls } = pendingHandleRef.current;
      return calls.reduce<JSONContent>((doc, call) => {
        switch (call.type) {
          case 'setValue':
            return call.doc;
          case 'clear':
            return parseValue(ed, '');
          case 'updateToken':
            return transformDoc(ed, doc, (tr) =>
              applyTokenPatch(tr, call.id, call.patch, getEditorContext(ed))
            );
          case 'deleteToken':
            return transformDoc(ed, doc, (tr) => deleteTokenById(tr, call.id));
          default:
            return doc;
        }
      }, base ?? ed.getJSON());
    };
    const readState = (ed: Editor) =>
      pendingHandleRef.current.calls.length > 0 ? stateFromDoc(ed, readDoc(ed)) : ed.state;
    const hold = (ed: Editor, call: PendingCall) => {
      const { base, calls } = pendingHandleRef.current;
      pendingHandleRef.current = { base: base ?? ed.getJSON(), calls: [...calls, call] };
    };

    return {
      setValue: (value: string) => {
        if (!editor) return;
        const doc = parseValue(editor, value);
        if (editor.isDestroyed) {
          hold(editor, { type: 'setValue', doc });
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
          hold(editor, { type: 'focus' });
          return;
        }
        editor.commands.focus();
      },
      clear: () => {
        if (!editor) return;
        if (editor.isDestroyed) {
          hold(editor, { type: 'clear' });
          return;
        }
        editor.commands.clear();
      },
      submit: () => {
        if (!editor) return;
        if (editor.isDestroyed) {
          hold(editor, { type: 'submit' });
          return;
        }
        editor.commands.submit();
      },
      updateToken: (id: string, patch: TokenPatch) => {
        if (!editor) return;
        if (editor.isDestroyed) {
          hold(editor, { type: 'updateToken', id, patch });
          return;
        }
        editor.commands.updateToken(id, patch);
      },
      deleteToken: (id: string) => {
        if (!editor) return;
        if (editor.isDestroyed) {
          hold(editor, { type: 'deleteToken', id });
          return;
        }
        editor.commands.deleteToken(id);
      },
      setTokenDisplay: (id: string, display: TokenDisplay) => {
        if (!editor) return;
        if (editor.isDestroyed) {
          const found = findTokenById(stateFromDoc(editor, readDoc(editor)).doc, id);
          if (!found || !isFilterToken(found.node)) return;
          const binding = { key: found.node.attrs.key, value: found.node.attrs.value };
          hold(editor, { type: 'setTokenDisplay', id, display, binding });
          return;
        }
        editor.commands.setTokenDisplay(id, display);
      },
      getEditor: () => editor,
    };
  }, [editor]);

  return pendingHandleRef;
}

function runPendingCall(editor: Editor, call: PendingCall): void {
  switch (call.type) {
    case 'setValue':
      setContentAndValidate(editor, call.doc);
      return;
    case 'clear':
      editor.commands.clear();
      return;
    case 'updateToken':
      editor.commands.updateToken(call.id, call.patch);
      return;
    case 'deleteToken':
      editor.commands.deleteToken(call.id);
      return;
    case 'setTokenDisplay': {
      const { tr } = editor.state;
      if (setTokenDisplayById(editor.state, tr, call.id, call.display, call.binding)) {
        editor.view.dispatch(tr);
      }
      return;
    }
    case 'focus':
      editor.commands.focus();
      return;
    case 'submit':
      editor.commands.submit();
      return;
    default: {
      const unhandled: never = call;
      throw new Error(`Unhandled pending handle call: ${JSON.stringify(unhandled)}`);
    }
  }
}

/**
 * Runs the handle calls held while the editor was destroyed, in call order. Call it
 * after every other hook that attaches to the editor: the calls set content, validate,
 * set token display, focus and submit, so they have to see the configuration synced
 * from the current props, the focus listeners and the suggestion scheduling already in
 * place.
 */
export function useApplyPendingHandleWrites(
  editor: Editor | null,
  pending: MutableRefObject<PendingHandleCalls>
): void {
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const { base, calls } = pending.current;
    pending.current = NO_PENDING_CALLS;
    // The calls were made against the destroyed editor's document.
    if (base && !editor.state.doc.eq(editor.schema.nodeFromJSON(base))) {
      setContentAndValidate(editor, base);
    }
    for (const call of calls) runPendingCall(editor, call);
  }, [editor, pending]);
}
