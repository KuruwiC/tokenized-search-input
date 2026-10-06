import { Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { markTokenValueTyped } from '../../plugins/shared/meta';
import {
  appendCustomSuggestions,
  closeSuggestion,
  createSuggestionPlugin,
  dismissSuggestion,
  getSuggestionState,
  initialSuggestionState,
  isPickerType,
  isSuggestionOpen,
  navigateSuggestion,
  openCustomSuggestion,
  openDateSuggestion,
  openDateTimeSuggestion,
  openFieldSuggestion,
  openFieldWithCustomSuggestion,
  openValueSuggestion,
  type SuggestionState,
  type SuggestionType,
  setCustomLoadingMore,
  setSuggestion,
  updateSuggestionActiveIndex,
  updateSuggestionDateValue,
  updateSuggestionTimeControls,
} from '../../plugins/suggestion';
import { suggestionEntries } from '../../plugins/suggestion/entries';
import { programEntry } from '../../plugins/token-focus';
import { setTokenFocus } from '../../plugins/token-focus/state';
import type { CustomSuggestion, FieldDefinition } from '../../types';
import { basicFields, basicBlockSchema as schema } from '../fixtures';

const testFields = basicFields;

function createEditorState() {
  return EditorState.create({
    schema,
    plugins: [createSuggestionPlugin()],
  });
}

describe('SuggestionPlugin', () => {
  describe('initial state', () => {
    it('initializes with closed suggestions', () => {
      const state = createEditorState();
      const suggestionState = getSuggestionState(state);

      expect(suggestionState).toEqual({
        type: null,
        fieldKey: null,
        query: '',
        items: [],
        customItems: [],
        custom: { hasMore: false, offset: 0, isLoadingMore: false },
        activeIndex: -1,
        anchor: null,
        dateValue: null,
        isUTC: false,
        includeTime: false,
        dismissed: false,
        customDisplayMode: null,
      });
    });
  });

  describe('openFieldSuggestion', () => {
    it('opens field suggestions with fields', () => {
      const state = createEditorState();
      const tr = openFieldSuggestion(state.tr, testFields, '', 10);
      const newState = state.apply(tr);
      const suggestionState = getSuggestionState(newState);

      expect(suggestionState?.type).toBe('field');
      expect(suggestionState?.items).toEqual(testFields);
      expect(suggestionState?.anchor).toEqual({ pos: 10 });
    });

    it('opens field suggestions with query', () => {
      const state = createEditorState();
      const tr = openFieldSuggestion(state.tr, testFields, 'sta');
      const newState = state.apply(tr);
      const suggestionState = getSuggestionState(newState);

      expect(suggestionState?.query).toBe('sta');
      expect(suggestionState?.activeIndex).toBe(-1);
    });
  });

  describe('openValueSuggestion', () => {
    it('opens value suggestions with field key', () => {
      const state = createEditorState();
      const values = ['active', 'inactive', 'pending'];
      const tr = openValueSuggestion(state.tr, 'status', values, '', 'token-1');
      const newState = state.apply(tr);
      const suggestionState = getSuggestionState(newState);

      expect(suggestionState?.type).toBe('value');
      expect(suggestionState?.fieldKey).toBe('status');
      expect(suggestionState?.items).toEqual(values);
      expect(suggestionState?.anchor).toEqual({ tokenId: 'token-1' });
    });
  });

  describe('closeSuggestion', () => {
    it('resets to initial state', () => {
      const state = createEditorState();

      // Open suggestions
      const tr1 = openFieldSuggestion(state.tr, testFields, 'sta', 10);
      const state1 = state.apply(tr1);

      // Close suggestions
      const tr2 = closeSuggestion(state1.tr);
      const state2 = state1.apply(tr2);
      const suggestionState = getSuggestionState(state2);

      expect(suggestionState?.type).toBe(null);
      expect(suggestionState?.items).toEqual([]);
      expect(suggestionState?.anchor).toBe(null);
    });
  });

  describe('value suggestions of a token', () => {
    const tokenSchema = new Schema({
      nodes: {
        doc: { content: 'paragraph' },
        paragraph: { content: 'inline*' },
        text: { group: 'inline' },
        filterToken: {
          group: 'inline',
          inline: true,
          atom: true,
          attrs: { id: {}, key: {}, operator: { default: 'is' }, value: { default: '' } },
        },
      },
    });
    const statusField: FieldDefinition = {
      key: 'status',
      label: 'Status',
      type: 'enum',
      operators: ['is'],
      enumValues: ['active', 'inactive', 'pending'],
    };

    function createTokenState(value: string) {
      const token = tokenSchema.nodes.filterToken.create({ id: 'token-1', key: 'status', value });
      return EditorState.create({
        doc: tokenSchema.node('doc', null, [tokenSchema.node('paragraph', null, [token])]),
        plugins: [
          createSuggestionPlugin({
            resolveField: (key) => (key === statusField.key ? statusField : undefined),
          }),
        ],
      });
    }

    function setTokenValue(state: EditorState, value: string) {
      return state.tr.setNodeMarkup(1, undefined, { ...state.doc.nodeAt(1)?.attrs, value });
    }

    it('takes the query and items from the token value whatever changed it', () => {
      const state = createTokenState('');
      const state1 = state.apply(
        openValueSuggestion(state.tr, 'status', ['active', 'inactive', 'pending'], '', 'token-1')
      );

      const suggestionState = getSuggestionState(state1.apply(setTokenValue(state1, 'ina')));

      expect(suggestionState?.type).toBe('value');
      expect(suggestionState?.query).toBe('ina');
      expect(suggestionState?.items).toEqual(['inactive']);
      expect(suggestionState?.activeIndex).toBe(-1);
      expect(suggestionState?.anchor).toEqual({ tokenId: 'token-1' });
    });

    it('shows dismissed value suggestions again when the user types', () => {
      const state = createTokenState('');
      const state1 = state.apply(
        openValueSuggestion(state.tr, 'status', ['active', 'inactive', 'pending'], '', 'token-1')
      );
      const state2 = state1.apply(dismissSuggestion(state1.tr));

      const untyped = getSuggestionState(state2.apply(setTokenValue(state2, 'p')));
      const typed = getSuggestionState(
        state2.apply(markTokenValueTyped(setTokenValue(state2, 'p'), 'token-1'))
      );

      expect(isSuggestionOpen(untyped)).toBe(false);
      expect(typed).toMatchObject({
        type: 'value',
        query: 'p',
        items: ['pending'],
        dismissed: false,
      });
    });
  });

  describe('pagination of custom suggestions', () => {
    const suggestion = (label: string): CustomSuggestion => ({
      label,
      tokens: [{ key: 'status', operator: 'is', value: label }],
    });

    function suggestionOf(state: EditorState) {
      const current = getSuggestionState(state);
      if (!current) throw new Error('the plugin has no state');
      return current;
    }

    function openWithPage() {
      let state = createEditorState();
      const tr = state.tr;
      openCustomSuggestion(tr, [suggestion('a'), suggestion('b')], 'q', 1, true);
      state = state.apply(tr);
      return state;
    }

    it('starts from the first page when custom suggestions open', () => {
      const current = getSuggestionState(openWithPage());

      expect(current?.custom).toEqual({ hasMore: true, offset: 2, isLoadingMore: false });
    });

    it('starts from the first page when custom suggestions open with fields', () => {
      const state = createEditorState();
      const tr = state.tr;
      openFieldWithCustomSuggestion(tr, testFields, [suggestion('a')], 'prepend', '', 1, true);

      expect(getSuggestionState(state.apply(tr))?.custom).toEqual({
        hasMore: true,
        offset: 1,
        isLoadingMore: false,
      });
    });

    it('marks a page as awaited and appends it, keeping the active option and the anchor', () => {
      let state = openWithPage();
      let tr = state.tr;
      updateSuggestionActiveIndex(tr, 1);
      state = state.apply(tr);

      tr = state.tr;
      setCustomLoadingMore(tr, suggestionOf(state), true);
      state = state.apply(tr);
      expect(getSuggestionState(state)?.custom.isLoadingMore).toBe(true);

      tr = state.tr;
      appendCustomSuggestions(tr, suggestionOf(state), [suggestion('c')], false);
      state = state.apply(tr);

      const current = getSuggestionState(state);
      expect(current?.customItems.map((item) => item.label)).toEqual(['a', 'b', 'c']);
      expect(current?.custom).toEqual({ hasMore: false, offset: 3, isLoadingMore: false });
      expect(current?.activeIndex).toBe(1);
      expect(current?.anchor).toEqual({ pos: 1 });
    });

    it('goes back to the start when the suggestion closes', () => {
      let state = openWithPage();
      let tr = state.tr;
      setCustomLoadingMore(tr, suggestionOf(state), true);
      state = state.apply(tr);

      tr = state.tr;
      closeSuggestion(tr);
      state = state.apply(tr);

      expect(getSuggestionState(state)?.custom).toEqual({
        hasMore: false,
        offset: 0,
        isLoadingMore: false,
      });
    });
  });

  describe('entries of the list', () => {
    const suggestion = (label: string): CustomSuggestion => ({
      label,
      tokens: [{ key: 'status', operator: 'is', value: label }],
    });

    function suggestionOf(state: EditorState) {
      const current = getSuggestionState(state);
      if (!current) throw new Error('the plugin has no state');
      return current;
    }

    it('drops custom suggestions when the suggestion becomes a field list', () => {
      let state = createEditorState();
      let tr = state.tr;
      openFieldWithCustomSuggestion(tr, testFields, [suggestion('a')], 'prepend', 'q', 1, true);
      state = state.apply(tr);

      tr = state.tr;
      openFieldSuggestion(tr, testFields, 'q', 1);
      state = state.apply(tr);

      expect(suggestionOf(state)).toMatchObject({
        type: 'field',
        customItems: [],
        custom: { hasMore: false, offset: 0, isLoadingMore: false },
        customDisplayMode: null,
      });
    });

    it('drops custom suggestions when the suggestion is dismissed', () => {
      let state = createEditorState();
      let tr = state.tr;
      openCustomSuggestion(tr, [suggestion('a')], 'q', 1, true);
      state = state.apply(tr);

      tr = state.tr;
      dismissSuggestion(tr);
      state = state.apply(tr);

      expect(suggestionOf(state)).toMatchObject({
        dismissed: true,
        customItems: [],
        custom: { hasMore: false, offset: 0, isLoadingMore: false },
      });
    });

    it('wraps the active index around the entries of a mixed list', () => {
      let state = createEditorState();
      let tr = state.tr;
      openFieldWithCustomSuggestion(tr, testFields, [suggestion('a')], 'append', '', 1);
      state = state.apply(tr);
      const total = testFields.length + 1;

      tr = state.tr;
      updateSuggestionActiveIndex(tr, total - 1);
      state = state.apply(tr);
      tr = state.tr;
      navigateSuggestion(tr, suggestionOf(state), 'down');
      state = state.apply(tr);

      expect(suggestionOf(state).activeIndex).toBe(0);
    });

    it('keeps the same entry active when a page arrives before it', () => {
      let state = createEditorState();
      let tr = state.tr;
      openFieldWithCustomSuggestion(tr, testFields, [suggestion('a')], 'prepend', '', 1, true);
      state = state.apply(tr);
      tr = state.tr;
      updateSuggestionActiveIndex(tr, 2);
      state = state.apply(tr);
      const before = suggestionEntries(suggestionOf(state))[2];

      tr = state.tr;
      appendCustomSuggestions(tr, suggestionOf(state), [suggestion('b'), suggestion('c')], false);
      state = state.apply(tr);

      const current = suggestionOf(state);
      expect(current.activeIndex).toBe(4);
      expect(suggestionEntries(current)[4]).toEqual(before);
    });
  });

  describe('updateSuggestionActiveIndex', () => {
    it('updates active index', () => {
      const state = createEditorState();

      // Open suggestions
      const tr1 = openFieldSuggestion(state.tr, testFields, '');
      const state1 = state.apply(tr1);

      // Update active index
      const tr2 = updateSuggestionActiveIndex(state1.tr, 1);
      const state2 = state1.apply(tr2);
      const suggestionState = getSuggestionState(state2);

      expect(suggestionState?.activeIndex).toBe(1);
    });
  });

  describe('state preservation', () => {
    it('preserves state for transactions without meta', () => {
      const state = createEditorState();

      // Set initial state
      const tr1 = openFieldSuggestion(state.tr, testFields, 'test', 5);
      const state1 = state.apply(tr1);

      // Apply transaction without meta
      const tr2 = state1.tr;
      const state2 = state1.apply(tr2);
      const suggestionState = getSuggestionState(state2);

      expect(suggestionState?.type).toBe('field');
      expect(suggestionState?.query).toBe('test');
      expect(suggestionState?.anchor).toEqual({ pos: 5 });
    });
  });

  describe('setSuggestion merge behavior', () => {
    it('merges multiple setSuggestion calls in the same transaction', () => {
      const state = createEditorState();

      // Call setSuggestion twice on the same transaction with different properties
      const tr = state.tr;
      setSuggestion(tr, { query: 'test', items: testFields });
      setSuggestion(tr, { isUTC: true });

      const newState = state.apply(tr);
      const suggestionState = getSuggestionState(newState);

      // Both properties should be merged
      expect(suggestionState?.query).toBe('test');
      expect(suggestionState?.items).toEqual(testFields);
      expect(suggestionState?.isUTC).toBe(true);
    });

    it('closeSuggestion after merged write takes precedence', () => {
      const state = createEditorState();

      // First set some state, then close in the same transaction
      const tr = state.tr;
      setSuggestion(tr, { query: 'test', items: testFields, type: 'field' });
      closeSuggestion(tr);

      const newState = state.apply(tr);
      const suggestionState = getSuggestionState(newState);

      // Close should win
      expect(suggestionState?.type).toBe(null);
      expect(suggestionState?.query).toBe('');
      expect(suggestionState?.items).toEqual([]);
    });

    it('ignores setSuggestion calls after closeSuggestion', () => {
      const state = createEditorState();

      // Close first, then try to set state in the same transaction
      const tr = state.tr;
      closeSuggestion(tr);
      setSuggestion(tr, { query: 'test', items: testFields, type: 'field' });

      const newState = state.apply(tr);
      const suggestionState = getSuggestionState(newState);

      // Close should be preserved (close is terminal)
      expect(suggestionState?.type).toBe(null);
      expect(suggestionState?.query).toBe('');
      expect(suggestionState?.items).toEqual([]);
    });

    it('merges a query update and an active index update on the same transaction', () => {
      const state = createEditorState();

      // Open suggestions first
      const tr1 = openFieldSuggestion(state.tr, testFields, '');
      const state1 = state.apply(tr1);

      // Update query and active index on the same transaction
      const tr2 = state1.tr;
      setSuggestion(tr2, { query: 'sta', items: [testFields[0]], activeIndex: -1 });
      updateSuggestionActiveIndex(tr2, 0);

      const newState = state1.apply(tr2);
      const suggestionState = getSuggestionState(newState);

      // Both should be applied
      expect(suggestionState?.query).toBe('sta');
      expect(suggestionState?.items).toEqual([testFields[0]]);
      expect(suggestionState?.activeIndex).toBe(0);
    });
  });

  describe('a dismissal by the user', () => {
    function createTextState() {
      return EditorState.create({
        schema,
        doc: schema.node('doc', null, [schema.node('paragraph', null, [schema.text('abc')])]),
        plugins: [createSuggestionPlugin()],
      });
    }

    function dismissedFieldState() {
      const state = createTextState();
      const opened = state.apply(openFieldSuggestion(state.tr, testFields, '', 1));
      return opened.apply(dismissSuggestion(opened.tr));
    }

    it('closes the suggestion', () => {
      const suggestionState = getSuggestionState(dismissedFieldState());

      expect(suggestionState).toEqual({ ...initialSuggestionState, dismissed: true });
      expect(isSuggestionOpen(suggestionState)).toBe(false);
    });

    it('holds through a close that the user did not ask for', () => {
      const state = dismissedFieldState();

      const closed = state.apply(closeSuggestion(state.tr));

      expect(getSuggestionState(closed)?.dismissed).toBe(true);
    });

    it('holds through a close made with it in one transaction', () => {
      const state = createTextState();
      const opened = state.apply(openFieldSuggestion(state.tr, testFields, '', 1));

      const tr = closeSuggestion(opened.tr);
      dismissSuggestion(tr);
      closeSuggestion(tr);

      expect(getSuggestionState(opened.apply(tr))?.dismissed).toBe(true);
    });

    it('holds through a transaction that changes neither the document nor the selection', () => {
      const state = dismissedFieldState();

      const next = state.apply(updateSuggestionActiveIndex(state.tr, 0));

      expect(getSuggestionState(next)?.dismissed).toBe(true);
    });

    it.each([
      ['the document changes', (state: EditorState) => state.tr.insertText('d', 4)],
      [
        'the selection changes',
        (state: EditorState) => state.tr.setSelection(TextSelection.create(state.doc, 2)),
      ],
      [
        'the token focus changes',
        (state: EditorState) => {
          const tr = state.tr;
          setTokenFocus(tr, null);
          return tr;
        },
      ],
    ])('ends when %s', (_, change) => {
      const state = dismissedFieldState();

      expect(getSuggestionState(state.apply(change(state)))?.dismissed).toBe(false);
    });

    it('ends when a suggestion is opened', () => {
      const state = dismissedFieldState();

      const reopened = state.apply(openFieldSuggestion(state.tr, testFields, '', 1));

      expect(getSuggestionState(reopened)).toMatchObject({ type: 'field', dismissed: false });
    });
  });

  describe('date and datetime suggestions', () => {
    it('holds the typed value of the token the datetime picker opened for', () => {
      const state = createEditorState();
      const value = { date: '2024-03-05', time: '14:30:00', offset: '+09:00' } as const;
      const next = state.apply(openDateTimeSuggestion(state.tr, 'updated', value, 'token-1'));
      const suggestion = getSuggestionState(next);

      expect(suggestion?.type).toBe('datetime');
      expect(suggestion?.dateValue).toEqual(value);
      expect(suggestion?.anchor).toEqual({ tokenId: 'token-1' });
    });

    it('opens in UTC for a value that is in UTC, and with the time for a value that has one', () => {
      const state = createEditorState();
      const utc = { date: '2024-03-05', time: '14:30:00', offset: 'Z' } as const;
      const suggestion = getSuggestionState(
        state.apply(openDateTimeSuggestion(state.tr, 'updated', utc, 'token-1'))
      );

      expect(suggestion?.isUTC).toBe(true);
      expect(suggestion?.includeTime).toBe(true);
    });

    it('opens outside UTC for a value in another offset', () => {
      const state = createEditorState();
      const tokyo = { date: '2024-03-05', time: '14:30:00', offset: '+09:00' } as const;
      const suggestion = getSuggestionState(
        state.apply(openDateTimeSuggestion(state.tr, 'updated', tokyo, 'token-1'))
      );

      expect(suggestion?.isUTC).toBe(false);
      expect(suggestion?.includeTime).toBe(true);
    });

    it('opens without a time for a date, and for no value', () => {
      const state = createEditorState();
      const dateOnly = getSuggestionState(
        state.apply(openDateTimeSuggestion(state.tr, 'updated', { date: '2024-03-05' }, 't'))
      );
      const empty = getSuggestionState(
        state.apply(openDateTimeSuggestion(state.tr, 'updated', null, 't'))
      );

      expect(dateOnly?.includeTime).toBe(false);
      expect(empty?.includeTime).toBe(false);
      expect(empty?.isUTC).toBe(false);
    });

    it('opens a date suggestion without the time controls', () => {
      const state = createEditorState();
      const withUtc = state.apply(
        openDateTimeSuggestion(
          state.tr,
          'updated',
          { date: '2024-03-05', time: '10:00', offset: 'Z' },
          't'
        )
      );
      const suggestion = getSuggestionState(
        withUtc.apply(openDateSuggestion(withUtc.tr, 'created', { date: '2024-03-05' }, 't'))
      );

      expect(suggestion?.type).toBe('date');
      expect(suggestion?.isUTC).toBe(false);
      expect(suggestion?.includeTime).toBe(false);
    });

    it('updates the committed value without touching the time controls', () => {
      const state = createEditorState();
      const opened = state.apply(openDateTimeSuggestion(state.tr, 'updated', null, 't'));
      const controls = opened.apply(
        updateSuggestionTimeControls(opened.tr, { isUTC: true, includeTime: true })
      );
      const updated = controls.apply(
        updateSuggestionDateValue(controls.tr, { date: '2024-03-05', time: '10:00', offset: 'Z' })
      );
      const suggestion = getSuggestionState(updated);

      expect(suggestion?.dateValue).toEqual({ date: '2024-03-05', time: '10:00', offset: 'Z' });
      expect(suggestion?.isUTC).toBe(true);
      expect(suggestion?.includeTime).toBe(true);
    });

    it('changes one time control and keeps the other', () => {
      const state = createEditorState();
      const opened = state.apply(openDateTimeSuggestion(state.tr, 'updated', null, 't'));
      const utc = opened.apply(updateSuggestionTimeControls(opened.tr, { isUTC: true }));
      const suggestion = getSuggestionState(
        utc.apply(updateSuggestionTimeControls(utc.tr, { includeTime: true }))
      );

      expect(suggestion?.isUTC).toBe(true);
      expect(suggestion?.includeTime).toBe(true);
    });

    it('forgets the time controls when the suggestion closes', () => {
      const state = createEditorState();
      const opened = state.apply(
        openDateTimeSuggestion(
          state.tr,
          'updated',
          { date: '2024-03-05', time: '10:00', offset: 'Z' },
          't'
        )
      );
      const closed = getSuggestionState(opened.apply(closeSuggestion(opened.tr)));

      expect(closed?.dateValue).toBeNull();
      expect(closed?.isUTC).toBe(false);
      expect(closed?.includeTime).toBe(false);
    });
  });
});

describe('isPickerType', () => {
  it.each<[SuggestionType, boolean]>([
    ['date', true],
    ['datetime', true],
    ['field', false],
    ['value', false],
    ['custom', false],
    ['fieldWithCustom', false],
    [null, false],
  ])('%s -> %s', (type, expected) => {
    expect(isPickerType(type)).toBe(expected);
  });
});

describe('how long a suggestion lives', () => {
  const tokenSchema = new Schema({
    nodes: {
      doc: { content: 'paragraph' },
      paragraph: { content: 'inline*' },
      text: { group: 'inline' },
      filterToken: {
        group: 'inline',
        inline: true,
        atom: true,
        attrs: { id: {}, key: {}, operator: { default: 'is' }, value: { default: '' } },
      },
    },
  });
  const suggestion: CustomSuggestion = {
    label: 'a',
    tokens: [{ key: 'status', operator: 'is', value: 'a' }],
  };

  /** A document of `ab`, then the status token `token-1` at position 3. */
  function createTokenState() {
    const token = tokenSchema.nodes.filterToken.create({ id: 'token-1', key: 'status' });
    return EditorState.create({
      doc: tokenSchema.node('doc', null, [
        tokenSchema.node('paragraph', null, [tokenSchema.text('ab'), token]),
      ]),
      plugins: [createSuggestionPlugin()],
    });
  }
  const TOKEN_POS = 3;

  function open(state: EditorState, write: (tr: EditorState['tr']) => void) {
    const tr = state.tr;
    write(tr);
    return state.apply(tr);
  }

  function focusToken(state: EditorState, id: string | null) {
    const tr = state.tr;
    setTokenFocus(tr, id === null ? null : { id, entry: programEntry() });
    return state.apply(tr);
  }

  const plainTextSuggestions: Array<[string, (tr: EditorState['tr']) => void]> = [
    ['field', (tr) => openFieldSuggestion(tr, testFields, '', TOKEN_POS)],
    ['custom', (tr) => openCustomSuggestion(tr, [suggestion], '', TOKEN_POS)],
    [
      'fieldWithCustom',
      (tr) => openFieldWithCustomSuggestion(tr, testFields, [suggestion], 'append', '', TOKEN_POS),
    ],
  ];
  const tokenSuggestions: Array<[string, (tr: EditorState['tr']) => void]> = [
    ['value', (tr) => openValueSuggestion(tr, 'status', ['a'], '', 'token-1')],
    ['date', (tr) => openDateSuggestion(tr, 'status', null, 'token-1')],
    ['datetime', (tr) => openDateTimeSuggestion(tr, 'status', null, 'token-1')],
  ];

  describe('when a token gains or loses focus', () => {
    it.each(plainTextSuggestions)('closes %s suggestions when a token gains focus', (_, write) => {
      const state = focusToken(open(createTokenState(), write), 'token-1');

      expect(getSuggestionState(state)).toEqual(initialSuggestionState);
    });

    it.each(
      plainTextSuggestions
    )('keeps %s suggestions open when token focus clears', (type, write) => {
      const state = focusToken(open(createTokenState(), write), null);

      expect(getSuggestionState(state)?.type).toBe(type);
    });

    it.each(tokenSuggestions)('closes %s suggestions when token focus clears', (_, write) => {
      const state = focusToken(open(createTokenState(), write), null);

      expect(getSuggestionState(state)).toEqual(initialSuggestionState);
    });

    it.each(
      tokenSuggestions
    )('keeps %s suggestions open when a token gains focus', (type, write) => {
      const state = focusToken(open(createTokenState(), write), 'token-1');

      expect(getSuggestionState(state)?.type).toBe(type);
    });
  });

  describe('when the document changes', () => {
    const openField = (state: EditorState) =>
      open(state, (tr) => openFieldSuggestion(tr, testFields, '', TOKEN_POS));

    it('moves a position anchor along with the token it points at', () => {
      const state = openField(createTokenState());

      const moved = state.apply(state.tr.insertText('xy', 1));

      expect(getSuggestionState(moved)).toMatchObject({
        type: 'field',
        anchor: { pos: TOKEN_POS + 2 },
      });
    });

    it('keeps a position anchor as it is when the change comes after its token', () => {
      const state = openField(createTokenState());
      const before = getSuggestionState(state)?.anchor;

      const kept = state.apply(state.tr.insertText('xy', TOKEN_POS + 1));

      expect(getSuggestionState(kept)?.anchor).toBe(before);
    });

    it('closes a suggestion whose position anchor token is deleted', () => {
      const state = openField(createTokenState());

      const deleted = state.apply(state.tr.delete(TOKEN_POS, TOKEN_POS + 1));

      expect(getSuggestionState(deleted)).toEqual(initialSuggestionState);
    });

    it('closes a suggestion whose token anchor token is deleted', () => {
      const state = open(createTokenState(), (tr) =>
        openValueSuggestion(tr, 'status', ['a'], '', 'token-1')
      );

      const deleted = state.apply(state.tr.delete(TOKEN_POS, TOKEN_POS + 1));

      expect(getSuggestionState(deleted)).toEqual(initialSuggestionState);
    });

    it('closes a token-anchored suggestion when the key of its token changes', () => {
      const state = open(createTokenState(), (tr) =>
        openDateSuggestion(tr, 'status', null, 'token-1')
      );
      const attrs = state.doc.nodeAt(TOKEN_POS)?.attrs;

      const sameKey = state.apply(
        state.tr.setNodeMarkup(TOKEN_POS, undefined, { ...attrs, value: 'x' })
      );
      const otherKey = state.apply(
        state.tr.setNodeMarkup(TOKEN_POS, undefined, { ...attrs, key: 'priority' })
      );

      expect(getSuggestionState(sameKey)).toMatchObject({
        type: 'date',
        anchor: { tokenId: 'token-1' },
      });
      expect(getSuggestionState(otherKey)).toEqual(initialSuggestionState);
    });
  });

  describe('the active index', () => {
    const field = (key: string): FieldDefinition => ({
      key,
      label: key,
      type: 'string',
      operators: ['is'],
    });
    const threeFields = [field('a'), field('b'), field('c')];

    function activeIndexAfter(fields: FieldDefinition[], index: number) {
      const state = open(createEditorState(), (tr) => {
        openFieldSuggestion(tr, fields, '');
        updateSuggestionActiveIndex(tr, index);
      });
      return getSuggestionState(state)?.activeIndex;
    }

    it('keeps an index inside the entries', () => {
      expect(activeIndexAfter(threeFields, 2)).toBe(2);
    });

    it('moves an index past the entries to the last entry', () => {
      expect(activeIndexAfter(threeFields, 3)).toBe(2);
      expect(activeIndexAfter(threeFields, 99)).toBe(2);
    });

    it('moves an index below -1 to -1', () => {
      expect(activeIndexAfter(threeFields, -5)).toBe(-1);
    });

    it('is -1 when there are no entries', () => {
      expect(activeIndexAfter([], 1)).toBe(-1);
    });

    it('counts the custom suggestions of a mixed list as entries', () => {
      const state = open(createEditorState(), (tr) => {
        openFieldWithCustomSuggestion(tr, threeFields, [suggestion], 'append', '');
        updateSuggestionActiveIndex(tr, 10);
      });

      expect(getSuggestionState(state)?.activeIndex).toBe(3);
    });
  });
});

describe('isSuggestionOpen', () => {
  const field: FieldDefinition = { key: 'a', label: 'A', type: 'string', operators: ['is'] };
  const custom: CustomSuggestion = {
    label: 'c',
    tokens: [{ key: 'a', operator: 'is', value: 'c' }],
  };
  const stateOf = (overrides: Partial<SuggestionState>): SuggestionState => ({
    ...initialSuggestionState,
    ...overrides,
  });

  it.each<[string, SuggestionState | null | undefined, boolean]>([
    ['is closed for no state', undefined, false],
    ['is closed for a null state', null, false],
    ['is closed without a type', stateOf({ items: [field] }), false],
    [
      'is closed for a dismissed list with fields',
      stateOf({ type: 'field', items: [field], dismissed: true }),
      false,
    ],
    ['is closed for a dismissed date picker', stateOf({ type: 'date', dismissed: true }), false],
    ['is open for a date picker without entries', stateOf({ type: 'date' }), true],
    ['is open for a datetime picker without entries', stateOf({ type: 'datetime' }), true],
    ['is open for field suggestions with fields', stateOf({ type: 'field', items: [field] }), true],
    ['is closed for field suggestions without fields', stateOf({ type: 'field' }), false],
    ['is open for value suggestions with values', stateOf({ type: 'value', items: ['x'] }), true],
    ['is closed for value suggestions without values', stateOf({ type: 'value' }), false],
    [
      'is open for custom suggestions with suggestions',
      stateOf({ type: 'custom', customItems: [custom] }),
      true,
    ],
    [
      'is closed for custom suggestions with only items',
      stateOf({ type: 'custom', items: [field] }),
      false,
    ],
    [
      'is open for a mixed list with only fields',
      stateOf({ type: 'fieldWithCustom', items: [field] }),
      true,
    ],
    [
      'is open for a mixed list with only custom suggestions',
      stateOf({ type: 'fieldWithCustom', customItems: [custom] }),
      true,
    ],
    ['is closed for an empty mixed list', stateOf({ type: 'fieldWithCustom' }), false],
  ])('%s', (_, state, expected) => {
    expect(isSuggestionOpen(state)).toBe(expected);
  });
});
