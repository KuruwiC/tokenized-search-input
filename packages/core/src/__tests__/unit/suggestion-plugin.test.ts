import { EditorState } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import {
  clearDismissed,
  closeSuggestion,
  createSuggestionPlugin,
  dismissSuggestion,
  getSuggestionState,
  openFieldSuggestion,
  openValueSuggestion,
  setSuggestion,
  setSuggestionLoading,
  updateSuggestionActiveIndex,
  updateSuggestionQuery,
} from '../../plugins/suggestion-plugin';
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
        activeIndex: -1,
        isLoading: false,
        anchorPos: null,
        dateValue: null,
        fieldSuggestionsDisabled: false,
        valueSuggestionsDisabled: false,
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
      expect(suggestionState?.anchorPos).toBe(10);
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
      const tr = openValueSuggestion(state.tr, 'status', values, '', 15);
      const newState = state.apply(tr);
      const suggestionState = getSuggestionState(newState);

      expect(suggestionState?.type).toBe('value');
      expect(suggestionState?.fieldKey).toBe('status');
      expect(suggestionState?.items).toEqual(values);
      expect(suggestionState?.anchorPos).toBe(15);
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
      expect(suggestionState?.anchorPos).toBe(null);
    });
  });

  describe('updateSuggestionQuery', () => {
    it('updates query and items', () => {
      const state = createEditorState();

      // Open suggestions
      const tr1 = openFieldSuggestion(state.tr, testFields, '');
      const state1 = state.apply(tr1);

      // Update query with filtered items
      const filteredFields = [testFields[0]];
      const tr2 = updateSuggestionQuery(state1.tr, 'sta', filteredFields);
      const state2 = state1.apply(tr2);
      const suggestionState = getSuggestionState(state2);

      expect(suggestionState?.query).toBe('sta');
      expect(suggestionState?.items).toEqual(filteredFields);
      expect(suggestionState?.activeIndex).toBe(-1);
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
      expect(suggestionState?.anchorPos).toBe(5);
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

    it('merges updateSuggestionQuery and setSuggestionLoading on same transaction', () => {
      const state = createEditorState();

      // Open suggestions first
      const tr1 = openFieldSuggestion(state.tr, testFields, '');
      const state1 = state.apply(tr1);

      // Update query and loading on the same transaction
      const tr2 = state1.tr;
      updateSuggestionQuery(tr2, 'sta', [testFields[0]]);
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
});
