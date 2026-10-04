import type { Editor, JSONContent } from '@tiptap/core';
import { EditorState, type Transaction } from '@tiptap/pm/state';
import {
  type ForwardedRef,
  type MutableRefObject,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { getEditorContext, getSerializeOptions } from '../../extensions/editor-context';
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
import { scheduleDocumentChange } from './schedule-document-change';

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

/**
 * The handle calls held to run on the live editor. Whenever calls are held and a live
 * editor has committed, a drain that runs them on it is scheduled, so no call stays held.
 */
interface HeldHandleCalls {
  /** The document the calls were made against. */
  base: JSONContent | null;
  /** In call order. */
  calls: PendingCall[];
  /** The editor the calls run on: the last one whose commit happened. */
  live: Editor | null;
}

function liveEditor(held: HeldHandleCalls): Editor | null {
  return held.live && !held.live.isDestroyed ? held.live : null;
}

/** Runs the held calls on `editor`, in call order. */
function drain(held: HeldHandleCalls, editor: Editor): void {
  const { base, calls } = held;
  held.base = null;
  held.calls = [];
  if (calls.length === 0) return;
  // The calls were made against `base`, which may be a destroyed editor's document.
  if (base && !editor.state.doc.eq(editor.schema.nodeFromJSON(base))) {
    setContentAndValidate(editor, base);
  }
  for (const call of calls) runPendingCall(editor, call);
}

/** Schedules a drain of `held` on the live editor, if there is one yet. */
function scheduleDrain(held: HeldHandleCalls): void {
  const live = liveEditor(held);
  if (live) scheduleDocumentChange(live, () => drain(held, live));
}

/**
 * Builds the imperative handle.
 *
 * An ancestor's effect in the same commit can call the handle while `editor` is
 * still a destroyed instance, and a handle kept from before can be called after its
 * editor was replaced. Calls made through a destroyed editor are held in call order and
 * run on the live editor after its commit (see `useApplyPendingHandleWrites`), through
 * the same commands as on a live editor, starting from the document they were made
 * against. Calls made while held calls wait are held behind them, so they run in call
 * order. `getValue` and
 * `getSnapshot` read the document the held calls produce; validation runs once they
 * are applied, so snapshots read in the meantime carry no validation.
 */
export function useTokenizedSearchInputRef(
  ref: ForwardedRef<TokenizedSearchInputRef>,
  editor: Editor | null
): MutableRefObject<HeldHandleCalls> {
  const pendingHandleRef = useRef<HeldHandleCalls>({ base: null, calls: [], live: null });

  useImperativeHandle(ref, () => {
    const parseValue = (ed: Editor, value: string) => {
      const context = getEditorContext(ed);
      return parseQueryToDoc(value, context.fields, {
        freeTextMode: context.freeTextMode,
        unknownFields: context.unknownFields,
        delimiter: context.delimiter,
      }).doc;
    };
    /** The document calls are made against: the live editor's, else `ed`'s. */
    const currentDoc = (ed: Editor): JSONContent =>
      (liveEditor(pendingHandleRef.current) ?? ed).getJSON();
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
      }, base ?? currentDoc(ed));
    };
    const readState = (ed: Editor) =>
      pendingHandleRef.current.calls.length > 0 ? stateFromDoc(ed, readDoc(ed)) : ed.state;
    const hold = (ed: Editor, call: PendingCall) => {
      const held = pendingHandleRef.current;
      held.base ??= currentDoc(ed);
      held.calls.push(call);
      scheduleDrain(held);
    };
    /** Whether a call has to wait: the editor is destroyed, or held calls wait before it. */
    const mustHold = (ed: Editor) => ed.isDestroyed || pendingHandleRef.current.calls.length > 0;

    return {
      setValue: (value: string) => {
        if (!editor) return;
        const doc = parseValue(editor, value);
        if (mustHold(editor)) {
          hold(editor, { type: 'setValue', doc });
          return;
        }
        setContentAndValidate(editor, doc);
      },
      getValue: () => {
        if (!editor) return '';
        return serializeDocToQuery(readDoc(editor), getSerializeOptions(editor));
      },
      getSnapshot: () => {
        if (!editor) return { segments: [], text: '' };
        return createQuerySnapshot(readState(editor), getSerializeOptions(editor));
      },
      focus: () => {
        if (!editor) return;
        if (mustHold(editor)) {
          hold(editor, { type: 'focus' });
          return;
        }
        editor.commands.focus();
      },
      clear: () => {
        if (!editor) return;
        if (mustHold(editor)) {
          hold(editor, { type: 'clear' });
          return;
        }
        editor.commands.clear();
      },
      submit: () => {
        if (!editor) return;
        if (mustHold(editor)) {
          hold(editor, { type: 'submit' });
          return;
        }
        editor.commands.submit();
      },
      updateToken: (id: string, patch: TokenPatch) => {
        if (!editor) return;
        if (mustHold(editor)) {
          hold(editor, { type: 'updateToken', id, patch });
          return;
        }
        editor.commands.updateToken(id, patch);
      },
      deleteToken: (id: string) => {
        if (!editor) return;
        if (mustHold(editor)) {
          hold(editor, { type: 'deleteToken', id });
          return;
        }
        editor.commands.deleteToken(id);
      },
      setTokenDisplay: (id: string, display: TokenDisplay) => {
        if (!editor) return;
        if (mustHold(editor)) {
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
 * Makes `editor` the one held handle calls run on once its commit has happened, and runs
 * the calls held so far, in call order, right after that commit. Call it after every
 * other hook that attaches to the editor: the calls set content, validate, set token
 * display, focus and submit, so they have to see the configuration synced from the
 * current props, the focus listeners and the suggestion scheduling already in place.
 * The calls stay held until they run.
 */
export function useApplyPendingHandleWrites(
  editor: Editor | null,
  pending: MutableRefObject<HeldHandleCalls>
): void {
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    pending.current.live = editor;
    scheduleDrain(pending.current);
  }, [editor, pending]);
}
