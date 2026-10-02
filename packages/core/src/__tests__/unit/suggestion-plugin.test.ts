import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { updateSuggestionQuery } from '../../plugins/shared/meta';
import { suggestionEntries } from '../../plugins/suggestion/entries';
import {
  appendCustomSuggestions,
  clearDismissed,
  closeSuggestion,
  createSuggestionPlugin,
  dismissSuggestion,
  getSuggestionState,
  navigateSuggestion,
  openCustomSuggestion,
  openDateSuggestion,
  openDateTimeSuggestion,
  openFieldSuggestion,
  openFieldWithCustomSuggestion,
  openValueSuggestion,
  setCustomLoadingMore,
  setSuggestion,
  setSuggestionLoading,
  updateSuggestionActiveIndex,
  updateSuggestionDateValue,
  updateSuggestionTimeControls,
} from '../../plugins/suggestion-plugin';
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
        isLoading: false,
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
        state2.apply(updateSuggestionQuery(setTokenValue(state2, 'p'), 'token-1'))
      );

      expect(untyped?.dismissed).toBe(true);
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

  describe('setSuggestionLoading', () => {
    it('sets loading state', () => {
      const state = createEditorState();

      // Open suggestions
      const tr1 = openValueSuggestion(state.tr, 'status', []);
      const state1 = state.apply(tr1);

      // Set loading
      const tr2 = setSuggestionLoading(state1.tr, true);
      const state2 = state1.apply(tr2);
      const suggestionState = getSuggestionState(state2);

      expect(suggestionState?.isLoading).toBe(true);
    });

    it('clears loading state', () => {
      const state = createEditorState();

      // Open with loading
      const tr1 = openValueSuggestion(state.tr, 'status', []);
      let newState = state.apply(tr1);
      const tr2 = setSuggestionLoading(newState.tr, true);
      newState = newState.apply(tr2);

      // Clear loading
      const tr3 = setSuggestionLoading(newState.tr, false);
      newState = newState.apply(tr3);
      const suggestionState = getSuggestionState(newState);

      expect(suggestionState?.isLoading).toBe(false);
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
      setSuggestion(tr, { isLoading: true });

      const newState = state.apply(tr);
      const suggestionState = getSuggestionState(newState);

      // Both properties should be merged
      expect(suggestionState?.query).toBe('test');
      expect(suggestionState?.items).toEqual(testFields);
      expect(suggestionState?.isLoading).toBe(true);
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

    it('merges a query update and setSuggestionLoading on same transaction', () => {
      const state = createEditorState();

      // Open suggestions first
      const tr1 = openFieldSuggestion(state.tr, testFields, '');
      const state1 = state.apply(tr1);

      // Update query and loading on the same transaction
      const tr2 = state1.tr;
      setSuggestion(tr2, { query: 'sta', items: [testFields[0]], activeIndex: -1 });
      setSuggestionLoading(tr2, true);

      const newState = state1.apply(tr2);
      const suggestionState = getSuggestionState(newState);

      // Both should be applied
      expect(suggestionState?.query).toBe('sta');
      expect(suggestionState?.items).toEqual([testFields[0]]);
      expect(suggestionState?.isLoading).toBe(true);
    });

    it('ignores clearDismissed after closeSuggestion in same transaction', () => {
      const state = createEditorState();

      // Close first, then try to clear dismissed in the same transaction
      const tr = state.tr;
      closeSuggestion(tr);
      clearDismissed(tr);

      const newState = state.apply(tr);
      const suggestionState = getSuggestionState(newState);

      // Close should be preserved (close is terminal, clearDismissed is suppressed)
      expect(suggestionState?.type).toBe(null);
      expect(suggestionState?.dismissed).toBe(false); // closeSuggestion resets via createResetState
    });
  });

  describe('dismissed flag behavior', () => {
    it('closeSuggestion resets dismissed to false (system auto-close)', () => {
      const state = createEditorState();

      // Open suggestions and set dismissed to true via dismissSuggestion
      const tr1 = openFieldSuggestion(state.tr, testFields, '');
      const state1 = state.apply(tr1);
      const tr2 = dismissSuggestion(state1.tr);
      const state2 = state1.apply(tr2);

      // Verify dismissed is true
      expect(getSuggestionState(state2)?.dismissed).toBe(true);

      // Now close via closeSuggestion - should reset dismissed to false
      const tr3 = closeSuggestion(state2.tr);
      const state3 = state2.apply(tr3);
      const suggestionState = getSuggestionState(state3);

      expect(suggestionState?.dismissed).toBe(false);
      expect(suggestionState?.type).toBe(null);
    });

    it('dismissSuggestion sets dismissed to true (user explicit dismiss)', () => {
      const state = createEditorState();

      // Open suggestions
      const tr1 = openFieldSuggestion(state.tr, testFields, '');
      const state1 = state.apply(tr1);

      // Dismiss via dismissSuggestion (e.g., Escape key)
      const tr2 = dismissSuggestion(state1.tr);
      const state2 = state1.apply(tr2);
      const suggestionState = getSuggestionState(state2);

      expect(suggestionState?.dismissed).toBe(true);
      // Note: dismissSuggestion sets type to null, but the existing state's type
      // is preserved through the merge behavior. The dismissed flag is what matters.
    });

    it('allows reopening suggestions after closeSuggestion (dismissed is reset)', () => {
      const state = createEditorState();

      // Open -> Close -> Reopen sequence (simulates arrow navigation)
      const tr1 = openValueSuggestion(state.tr, 'status', ['active', 'inactive'], '');
      const state1 = state.apply(tr1);

      const tr2 = closeSuggestion(state1.tr);
      const state2 = state1.apply(tr2);

      // After closeSuggestion, dismissed should be false
      expect(getSuggestionState(state2)?.dismissed).toBe(false);

      // Should be able to reopen
      const tr3 = openFieldSuggestion(state2.tr, testFields, '');
      const state3 = state2.apply(tr3);
      const suggestionState = getSuggestionState(state3);

      expect(suggestionState?.type).toBe('field');
      expect(suggestionState?.dismissed).toBe(false);
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
