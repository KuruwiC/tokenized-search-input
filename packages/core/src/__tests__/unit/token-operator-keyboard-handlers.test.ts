/**
 * Unit tests for token-operator-keyboard-handlers.ts
 *
 * Tests for the extracted keyboard handler functions.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  handleClosedKeyDown,
  handleOpenKeyDown,
  type OperatorState,
} from '../../tokens/composition/blocks/token-operator-keyboard-handlers';

describe('handleClosedKeyDown', () => {
  const createActions = () => ({
    openDropdown: vi.fn(),
    navigateLeft: vi.fn(),
    navigateRight: vi.fn(),
    navigateLeftEntry: vi.fn(),
    navigateRightEntry: vi.fn(),
  });

  it.each([
    ['Enter', 'Enter'],
    ['Space', ' '],
    ['ArrowDown', 'ArrowDown'],
  ] as const)('opens dropdown on %s', (_name, key) => {
    const actions = createActions();
    const handled = handleClosedKeyDown(key, actions);
    expect(handled).toBe(true);
    expect(actions.openDropdown).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['ArrowLeft', 'ArrowLeft', 'navigateLeft'],
    ['ArrowRight', 'ArrowRight', 'navigateRight'],
    ['Tab', 'Tab', 'navigateRight'],
  ] as const)('navigates on %s', (_name, key, actionName) => {
    const actions = createActions();
    const handled = handleClosedKeyDown(key, actions);
    expect(handled).toBe(true);
    expect(actions[actionName]).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Backspace', 'Backspace', 'navigateLeftEntry'],
    ['Delete', 'Delete', 'navigateRightEntry'],
  ] as const)('navigates to entry on %s', (_name, key, actionName) => {
    const actions = createActions();
    const handled = handleClosedKeyDown(key, actions);
    expect(handled).toBe(true);
    expect(actions[actionName]).toHaveBeenCalledTimes(1);
  });

  it('returns false for unhandled keys', () => {
    const actions = createActions();
    const handled = handleClosedKeyDown('a', actions);
    expect(handled).toBe(false);
    expect(actions.openDropdown).not.toHaveBeenCalled();
    expect(actions.navigateLeft).not.toHaveBeenCalled();
    expect(actions.navigateRight).not.toHaveBeenCalled();
  });
});

describe('handleOpenKeyDown', () => {
  const createActions = () => ({
    closeDropdown: vi.fn(),
    navigateRight: vi.fn(),
    selectOperator: vi.fn(),
    moveActiveUp: vi.fn(),
    moveActiveDown: vi.fn(),
  });

  const createState = (activeIndex = 0): OperatorState => ({
    isOpen: true,
    activeIndex,
    operators: ['is', 'is_not', 'contains'],
  });

  it.each([
    ['ArrowDown', 'moveActiveDown'],
    ['ArrowUp', 'moveActiveUp'],
  ] as const)('moves selection on %s', (key, actionName) => {
    const actions = createActions();
    const state = createState(1);
    const handled = handleOpenKeyDown(key, state, actions);
    expect(handled).toBe(true);
    expect(actions[actionName]).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Enter', 'Enter', 1, 'is_not'],
    ['Space', ' ', 2, 'contains'],
  ] as const)('selects current item and closes dropdown on %s', (_name, key, activeIndex, expectedOperator) => {
    const actions = createActions();
    const state = createState(activeIndex);
    const handled = handleOpenKeyDown(key, state, actions);
    expect(handled).toBe(true);
    expect(actions.selectOperator).toHaveBeenCalledWith(expectedOperator);
    expect(actions.closeDropdown).toHaveBeenCalledTimes(1);
  });

  it('closes dropdown on Escape without selecting', () => {
    const actions = createActions();
    const state = createState(1);
    const handled = handleOpenKeyDown('Escape', state, actions);
    expect(handled).toBe(true);
    expect(actions.closeDropdown).toHaveBeenCalledTimes(1);
    expect(actions.selectOperator).not.toHaveBeenCalled();
  });

  it('closes dropdown and navigates right on Tab', () => {
    const actions = createActions();
    const state = createState(0);
    const handled = handleOpenKeyDown('Tab', state, actions);
    expect(handled).toBe(true);
    expect(actions.closeDropdown).toHaveBeenCalledTimes(1);
    expect(actions.navigateRight).toHaveBeenCalledTimes(1);
  });

  it('returns false for unhandled keys', () => {
    const actions = createActions();
    const state = createState(0);
    const handled = handleOpenKeyDown('a', state, actions);
    expect(handled).toBe(false);
    expect(actions.closeDropdown).not.toHaveBeenCalled();
    expect(actions.selectOperator).not.toHaveBeenCalled();
  });

  it.each([
    ['negative', -1],
    ['too large', 5],
  ] as const)('does not select or close when activeIndex is out of bounds (%s)', (_name, activeIndex) => {
    const actions = createActions();
    const state: OperatorState = {
      isOpen: true,
      activeIndex,
      operators: ['is', 'is_not'],
    };
    const handled = handleOpenKeyDown('Enter', state, actions);
    expect(handled).toBe(true);
    expect(actions.selectOperator).not.toHaveBeenCalled();
    expect(actions.closeDropdown).not.toHaveBeenCalled();
  });
});
