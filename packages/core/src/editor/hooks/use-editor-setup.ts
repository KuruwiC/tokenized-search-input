import type { Editor } from '@tiptap/core';
import { History } from '@tiptap/extension-history';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { useEditor } from '@tiptap/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardSerializer } from '../../extensions/clipboard-serializer';
import { CorePluginsExtension } from '../../extensions/core-plugins';
import {
  createEditorContext,
  type EditorConfig,
  EditorContextExtension,
  getFocusContext,
  getSerializeOptions,
} from '../../extensions/editor-context';
import { KeyboardShortcutsExtension } from '../../extensions/keyboard-shortcuts';
import { SingleParagraphDocument } from '../../extensions/single-paragraph-document';
import { TokenCommandsExtension } from '../../extensions/token-commands';
import { TokenMetaExtension } from '../../extensions/token-meta';
import { TokenNavigation } from '../../extensions/token-navigation';
import { useIsomorphicLayoutEffect } from '../../hooks/use-isomorphic-layout-effect';
import { DocumentRepairExtension } from '../../plugins/document-repair';
import { SelectionInvariantExtension } from '../../plugins/selection-invariant-plugin';
import { markContentEntered } from '../../plugins/shared/meta';
import {
  getFocusedToken,
  getTokenFocusMeta,
  leaveFocusedTokenIn,
} from '../../plugins/token-focus-plugin';
import { TokenGapExtension } from '../../plugins/token-gap-decorations';
import { ValidationExtension } from '../../plugins/validation-plugin';
import { createQuerySnapshot, parseQueryToDoc } from '../../serializer';
import { FilterTokenNode } from '../../tokens/filter-token/filter-token-node';
import { FreeTextTokenNode } from '../../tokens/free-text-token/free-text-token-node';
import type { QuerySnapshot } from '../../types';
import { getAllTokens } from '../../utils/query-snapshot';
import { areTokenListsEqual, type ComparableToken, confirmTokens } from '../../utils/token-events';
import { isEditorEmpty } from '../editor-state';

function readSnapshot(editor: Editor): QuerySnapshot {
  return createQuerySnapshot(editor.state, getSerializeOptions(editor));
}

export interface UseEditorSetupOptions {
  /** Read once: the configuration the editor starts with. Later changes go through `useEditorConfigSync`. */
  config: EditorConfig;
  /** Read once; must be a single character. */
  initialDelimiter: string | undefined;
  /** Read once. */
  defaultValue: string | undefined;
  disabled: boolean;
  immediatelyRender: boolean;
  onChange: ((snapshot: QuerySnapshot) => void) | undefined;
  onTokensChange: ((snapshot: QuerySnapshot) => void) | undefined;
}

export interface UseEditorSetupResult {
  editor: Editor | null;
  isEmpty: boolean;
}

/** Creates the editor with extensions and options that stay fixed for the component's lifetime. */
export function useEditorSetup({
  config,
  initialDelimiter,
  defaultValue,
  disabled,
  immediatelyRender,
  onChange,
  onTokensChange,
}: UseEditorSetupOptions): UseEditorSetupResult {
  const [isEmpty, setIsEmpty] = useState(true);

  // The document last reported through onChange; before the first report, an empty input.
  const reportedDocRef = useRef<ProseMirrorNode | null>(null);
  // The tokens last reported through onTokensChange, in their confirmed form.
  const confirmedTokensRef = useRef<readonly ComparableToken[]>([]);
  const reportConfirmedTokens = (ed: Editor, snapshot: QuerySnapshot) => {
    if (!onTokensChange) return;
    const focusedId = getFocusedToken(ed.state)?.id ?? null;
    const tokens = confirmTokens(confirmedTokensRef.current, getAllTokens(snapshot), focusedId);
    if (areTokenListsEqual(confirmedTokensRef.current, tokens)) return;
    confirmedTokensRef.current = tokens;
    onTokensChange(snapshot);
  };

  // Changing the extensions recreates the TipTap editor, which would discard the
  // content and the history. They are built once from the mount-time configuration;
  // the editor context storage seeded here is then kept current by useEditorConfigSync.
  const [initialContext] = useState(() =>
    createEditorContext({ ...config, delimiter: initialDelimiter })
  );
  const [extensions] = useState(() => [
    SingleParagraphDocument,
    Paragraph,
    Text,
    History,
    FilterTokenNode,
    FreeTextTokenNode,
    TokenNavigation,
    ClipboardSerializer,
    TokenGapExtension,
    ValidationExtension,
    DocumentRepairExtension,
    SelectionInvariantExtension,
    EditorContextExtension.configure(initialContext),
    KeyboardShortcutsExtension,
    CorePluginsExtension,
    TokenMetaExtension,
    TokenCommandsExtension,
  ]);
  const [initialContent] = useState(() =>
    defaultValue
      ? parseQueryToDoc(defaultValue, initialContext.fields, {
          freeTextMode: initialContext.freeTextMode,
          unknownFields: initialContext.unknownFields,
          delimiter: initialContext.delimiter,
        }).doc
      : ''
  );

  // useEditor compares these with the editor's options on every render and calls
  // setOptions when they differ, so both keep their identity: the content is read
  // once, and the attributes change only with `disabled`. The combobox
  // relationships that follow the suggestion state are written by SuggestionAria.
  const editorProps = useMemo(
    () => ({
      attributes: {
        'aria-label': 'Search query input',
        role: 'combobox',
        ...(disabled ? { 'aria-disabled': 'true' } : {}),
      },
    }),
    [disabled]
  );

  const editor = useEditor({
    immediatelyRender,
    extensions,
    content: initialContent,
    editable: !disabled,
    editorProps,
    // The initial content counts as entered at once when the editor is created. The
    // transaction that enters it is the first one reported, as a change from an empty
    // input.
    onCreate: ({ editor: ed }) => {
      ed.view.dispatch(markContentEntered(ed.state.tr));
    },
    // Callbacks follow how the state changed, whatever dispatched the change: onChange
    // when the document differs from the one last reported, after the plugins' appended
    // transactions as well; onTokensChange when the confirmed tokens differ from the ones
    // last reported.
    onTransaction: ({ editor: ed, transaction, appendedTransactions }) => {
      const { doc } = ed.state;
      // The placeholder follows the document itself; the layout effect below covers the
      // content the editor is created with.
      if (!transaction.before.eq(doc)) setIsEmpty(isEditorEmpty(ed));

      const reported = reportedDocRef.current ?? ed.schema.topNodeType.createAndFill();
      const docChanged = !reported?.eq(doc);
      const focusChanged = [transaction, ...appendedTransactions].some(
        (tr) => getTokenFocusMeta(tr) !== undefined
      );
      if (!docChanged && !focusChanged) return;

      const snapshot = readSnapshot(ed);
      reportConfirmedTokens(ed, snapshot);
      if (docChanged) {
        reportedDocRef.current = doc;
        onChange?.(snapshot);
      }
    },
  });

  // Effects skip a destroyed editor. useEditor destroys an instance whose render is
  // not committed within a tick, which happens when React 19 commits a
  // Suspense-prerendered tree late. The commit then still sees that instance, and
  // useEditor re-renders with a fresh one right after.

  // Before paint, so the placeholder does not flash.
  useIsomorphicLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return;
    setIsEmpty(isEditorEmpty(editor));
  }, [editor]);

  // aria-disabled follows from editorProps; this toggles editability, which leaves the
  // document as it is. A disabled editor edits no token, so the one focused is left.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!disabled, false);
    if (!disabled) return;
    const tr = editor.state.tr;
    if (leaveFocusedTokenIn(tr, getFocusContext(editor))) editor.view.dispatch(tr);
  }, [editor, disabled]);

  return { editor, isEmpty };
}
