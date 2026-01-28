/**
 * Unit tests for Token Focus State Machine.
 *
 * Tests the state transitions of the token focus reducer
 * that consolidates: isFocused, currentFocusId, entryDirection, pendingFocus
 */
import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  getCurrentFocusId,
  getEntryDirection,
  getPendingFocus,
  isFocused,
  type TokenComponentState,
  type TokenFocusAction,
  tokenFocusReducer,
} from '../../tokens/composition/focus/token-focus-machine';

describe('Token Focus State Machine', () => {
  describe('Initial State', () => {
    it('starts in inactive status', () => {
      const state = createInitialState();
      expect(state.status).toBe('inactive');
    });
  });

  describe('PLUGIN_FOCUS_GAINED', () => {
    it('transitions from inactive to pending-entry with entry-first when entering from left', () => {
      const state = createInitialState();
      const action: TokenFocusAction = {
        type: 'PLUGIN_FOCUS_GAINED',
        entry: { direction: 'from-left', policy: 'entry' },
      };

      const newState = tokenFocusReducer(state, action);

      expect(newState.status).toBe('pending-entry');
      if (newState.status === 'pending-entry') {
        expect(newState.focusType).toBe('entry-first');
        expect(newState.position).toBe('start');
        expect(newState.direction).toBe('from-left');
      }
    });

    it('transitions from inactive to pending-entry with entry-last when entering from right', () => {
      const state = createInitialState();
      const action: TokenFocusAction = {
        type: 'PLUGIN_FOCUS_GAINED',
        entry: { direction: 'from-right', policy: 'entry' },
      };

      const newState = tokenFocusReducer(state, action);

      expect(newState.status).toBe('pending-entry');
      if (newState.status === 'pending-entry') {
        expect(newState.focusType).toBe('entry-last');
        expect(newState.position).toBe('end');
        expect(newState.direction).toBe('from-right');
      }
    });

    it('uses first focusType when policy is all and direction is from-left', () => {
      const state = createInitialState();
      const action: TokenFocusAction = {
        type: 'PLUGIN_FOCUS_GAINED',
        entry: { direction: 'from-left', policy: 'all' },
      };

      const newState = tokenFocusReducer(state, action);

      expect(newState.status).toBe('pending-entry');
      if (newState.status === 'pending-entry') {
        expect(newState.focusType).toBe('first');
        expect(newState.position).toBe('start');
      }
    });

    it('uses last focusType when policy is all and direction is from-right', () => {
      const state = createInitialState();
      const action: TokenFocusAction = {
        type: 'PLUGIN_FOCUS_GAINED',
        entry: { direction: 'from-right', policy: 'all' },
      };

      const newState = tokenFocusReducer(state, action);

      expect(newState.status).toBe('pending-entry');
      if (newState.status === 'pending-entry') {
        expect(newState.focusType).toBe('last');
        expect(newState.position).toBe('end');
      }
    });

    it('uses entry-first focusType with end position for click activation', () => {
      const state = createInitialState();
      const action: TokenFocusAction = {
        type: 'PLUGIN_FOCUS_GAINED',
        entry: { type: 'click' },
      };

      const newState = tokenFocusReducer(state, action);

      expect(newState.status).toBe('pending-entry');
      if (newState.status === 'pending-entry') {
        expect(newState.focusType).toBe('entry-first');
        expect(newState.position).toBe('end');
        expect(newState.direction).toBeNull();
      }
    });

    it('preserves state when already active', () => {
      const state: TokenComponentState = {
        status: 'active',
        focusId: 'value',
        direction: 'from-left',
      };
      const action: TokenFocusAction = {
        type: 'PLUGIN_FOCUS_GAINED',
        entry: { direction: 'from-right', policy: 'entry' },
      };

      const newState = tokenFocusReducer(state, action);

      expect(newState).toEqual(state);
    });
  });

  describe('PENDING_FOCUS_EXECUTED', () => {
    it('transitions from pending-entry to active when child focus completes', () => {
      const state: TokenComponentState = {
        status: 'pending-entry',
        focusType: 'entry-first',
        position: 'start',
        direction: 'from-left',
      };
      const action: TokenFocusAction = {
        type: 'PENDING_FOCUS_EXECUTED',
        focusId: 'value',
      };

      const newState = tokenFocusReducer(state, action);

      expect(newState.status).toBe('active');
      if (newState.status === 'active') {
        expect(newState.focusId).toBe('value');
        expect(newState.direction).toBe('from-left');
      }
    });

    it('ignores action when not in pending-entry state', () => {
      const state: TokenComponentState = { status: 'inactive' };
      const action: TokenFocusAction = {
        type: 'PENDING_FOCUS_EXECUTED',
        focusId: 'value',
      };

      const newState = tokenFocusReducer(state, action);

      expect(newState).toEqual(state);
    });
  });

  describe('CHILD_FOCUSED', () => {
    it('updates focusId when active', () => {
      const state: TokenComponentState = {
        status: 'active',
        focusId: 'value',
        direction: 'from-left',
      };
      const action: TokenFocusAction = {
        type: 'CHILD_FOCUSED',
        id: 'operator',
      };

      const newState = tokenFocusReducer(state, action);

      expect(newState.status).toBe('active');
      if (newState.status === 'active') {
        expect(newState.focusId).toBe('operator');
        expect(newState.direction).toBe('from-left');
      }
    });

    it('transitions to active from pending-entry', () => {
      const state: TokenComponentState = {
        status: 'pending-entry',
        focusType: 'entry-first',
        position: 'start',
        direction: 'from-left',
      };
      const action: TokenFocusAction = {
        type: 'CHILD_FOCUSED',
        id: 'value',
      };

      const newState = tokenFocusReducer(state, action);

      expect(newState.status).toBe('active');
      if (newState.status === 'active') {
        expect(newState.focusId).toBe('value');
        expect(newState.direction).toBe('from-left');
      }
    });

    it('ignores when inactive', () => {
      const state: TokenComponentState = { status: 'inactive' };
      const action: TokenFocusAction = {
        type: 'CHILD_FOCUSED',
        id: 'value',
      };

      const newState = tokenFocusReducer(state, action);

      expect(newState).toEqual(state);
    });
  });

  describe('PLUGIN_FOCUS_LOST', () => {
    it('transitions to inactive from active', () => {
      const state: TokenComponentState = {
        status: 'active',
        focusId: 'value',
        direction: 'from-left',
      };
      const action: TokenFocusAction = { type: 'PLUGIN_FOCUS_LOST' };

      const newState = tokenFocusReducer(state, action);

      expect(newState.status).toBe('inactive');
    });

    it('transitions to inactive from pending-entry', () => {
      const state: TokenComponentState = {
        status: 'pending-entry',
        focusType: 'entry-first',
        position: 'start',
        direction: 'from-left',
      };
      const action: TokenFocusAction = { type: 'PLUGIN_FOCUS_LOST' };

      const newState = tokenFocusReducer(state, action);

      expect(newState.status).toBe('inactive');
    });

    it('stays inactive when already inactive', () => {
      const state: TokenComponentState = { status: 'inactive' };
      const action: TokenFocusAction = { type: 'PLUGIN_FOCUS_LOST' };

      const newState = tokenFocusReducer(state, action);

      expect(newState.status).toBe('inactive');
    });
  });

  describe('EXIT_REQUESTED', () => {
    it('transitions to exiting state with direction', () => {
      const state: TokenComponentState = {
        status: 'active',
        focusId: 'value',
        direction: 'from-left',
      };
      const action: TokenFocusAction = {
        type: 'EXIT_REQUESTED',
        direction: 'right',
      };

      const newState = tokenFocusReducer(state, action);

      expect(newState.status).toBe('exiting');
      if (newState.status === 'exiting') {
        expect(newState.exitDirection).toBe('right');
      }
    });

    it('transitions to exiting with left direction', () => {
      const state: TokenComponentState = {
        status: 'active',
        focusId: 'value',
        direction: 'from-right',
      };
      const action: TokenFocusAction = {
        type: 'EXIT_REQUESTED',
        direction: 'left',
      };

      const newState = tokenFocusReducer(state, action);

      expect(newState.status).toBe('exiting');
      if (newState.status === 'exiting') {
        expect(newState.exitDirection).toBe('left');
      }
    });

    it('ignores when inactive', () => {
      const state: TokenComponentState = { status: 'inactive' };
      const action: TokenFocusAction = {
        type: 'EXIT_REQUESTED',
        direction: 'right',
      };

      const newState = tokenFocusReducer(state, action);

      expect(newState).toEqual(state);
    });
  });

  describe('EXIT_COMPLETED', () => {
    it('transitions from exiting to inactive', () => {
      const state: TokenComponentState = {
        status: 'exiting',
        exitDirection: 'right',
      };
      const action: TokenFocusAction = { type: 'EXIT_COMPLETED' };

      const newState = tokenFocusReducer(state, action);

      expect(newState.status).toBe('inactive');
    });

    it('ignores when not in exiting state', () => {
      const state: TokenComponentState = {
        status: 'active',
        focusId: 'value',
        direction: 'from-left',
      };
      const action: TokenFocusAction = { type: 'EXIT_COMPLETED' };

      const newState = tokenFocusReducer(state, action);

      expect(newState).toEqual(state);
    });
  });

  describe('EDITOR_DISABLED', () => {
    it('transitions to inactive from any state', () => {
      const activeState: TokenComponentState = {
        status: 'active',
        focusId: 'value',
        direction: 'from-left',
      };
      const pendingState: TokenComponentState = {
        status: 'pending-entry',
        focusType: 'entry-first',
        position: 'start',
        direction: 'from-left',
      };

      const action: TokenFocusAction = { type: 'EDITOR_DISABLED' };

      expect(tokenFocusReducer(activeState, action).status).toBe('inactive');
      expect(tokenFocusReducer(pendingState, action).status).toBe('inactive');
    });
  });

  describe('Derived state helpers', () => {
    it('isFocused returns true for active and pending-entry states', () => {
      expect(isFocused({ status: 'inactive' })).toBe(false);
      expect(
        isFocused({
          status: 'pending-entry',
          focusType: 'entry-first',
          position: 'start',
          direction: 'from-left',
        })
      ).toBe(true);
      expect(isFocused({ status: 'active', focusId: 'value', direction: 'from-left' })).toBe(true);
      expect(isFocused({ status: 'exiting', exitDirection: 'right' })).toBe(false);
    });

    it('getCurrentFocusId returns focusId for active state only', () => {
      expect(getCurrentFocusId({ status: 'inactive' })).toBeNull();
      expect(
        getCurrentFocusId({
          status: 'pending-entry',
          focusType: 'entry-first',
          position: 'start',
          direction: 'from-left',
        })
      ).toBeNull();
      expect(
        getCurrentFocusId({ status: 'active', focusId: 'value', direction: 'from-left' })
      ).toBe('value');
    });

    it('getEntryDirection returns direction for active and pending-entry states', () => {
      expect(getEntryDirection({ status: 'inactive' })).toBeNull();
      expect(
        getEntryDirection({
          status: 'pending-entry',
          focusType: 'entry-first',
          position: 'start',
          direction: 'from-left',
        })
      ).toBe('from-left');
      expect(
        getEntryDirection({ status: 'active', focusId: 'value', direction: 'from-right' })
      ).toBe('from-right');
    });

    it('getPendingFocus returns focus info for pending-entry state only', () => {
      expect(getPendingFocus({ status: 'inactive' })).toBeNull();
      expect(
        getPendingFocus({
          status: 'pending-entry',
          focusType: 'entry-first',
          position: 'start',
          direction: 'from-left',
        })
      ).toEqual({ type: 'entry-first', position: 'start' });
      expect(
        getPendingFocus({ status: 'active', focusId: 'value', direction: 'from-left' })
      ).toBeNull();
    });
  });
});
