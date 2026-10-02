/**
 * Unit tests for the shared dropdown of the operator and label blocks: the keys of a
 * closed trigger and the state, keys and focus rules of an open list.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleClosedKey, useTokenDropdown } from '../../tokens/composition/blocks/token-dropdown';

describe('handleClosedKey', () => {
  const navigation = () => ({
    left: vi.fn(),
    right: vi.fn(),
    leftEntry: vi.fn(),
    rightEntry: vi.fn(),
  });

  it.each([
    ['Enter', 'Enter'],
    ['Space', ' '],
    ['ArrowDown', 'ArrowDown'],
  ] as const)('opens the list on %s', (_name, key) => {
    const open = vi.fn();
    const handled = handleClosedKey({ key, shiftKey: false }, open, navigation());

    expect(handled).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['ArrowLeft', 'left'],
    ['ArrowRight', 'right'],
    ['Tab', 'right'],
    ['Backspace', 'leftEntry'],
    ['Delete', 'rightEntry'],
  ] as const)('moves focus on %s', (key, move) => {
    const open = vi.fn();
    const nav = navigation();

    const handled = handleClosedKey({ key, shiftKey: false }, open, nav);

    expect(handled).toBe(true);
    expect(nav[move]).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it('moves focus left on Shift+Tab', () => {
    const open = vi.fn();
    const nav = navigation();

    const handled = handleClosedKey({ key: 'Tab', shiftKey: true }, open, nav);

    expect(handled).toBe(true);
    expect(nav.left).toHaveBeenCalledTimes(1);
    expect(nav.right).not.toHaveBeenCalled();
  });

  it('leaves other keys alone', () => {
    const open = vi.fn();
    const nav = navigation();

    expect(handleClosedKey({ key: 'a', shiftKey: false }, open, nav)).toBe(false);
    expect(handleClosedKey({ key: 'Escape', shiftKey: false }, open, nav)).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(nav.left).not.toHaveBeenCalled();
    expect(nav.right).not.toHaveBeenCalled();
  });
});

describe('useTokenDropdown', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  function setup(onOpen?: () => void) {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    const anchorRef = { current: anchor };
    const rendered = renderHook(() => useTokenDropdown(anchorRef, onOpen));
    return { anchor, ...rendered };
  }

  it('starts closed with no active option', () => {
    const { result } = setup();

    expect(result.current.isOpen).toBe(false);
    expect(result.current.activeIndex).toBe(-1);
  });

  it('opens with the option it is given active, and tells the owner', () => {
    const onOpen = vi.fn();
    const { result } = setup(onOpen);

    act(() => result.current.open(2));

    expect(result.current.isOpen).toBe(true);
    expect(result.current.activeIndex).toBe(2);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('opens with no active option when none is given', () => {
    const { result } = setup();
    act(() => result.current.open(3));
    act(() => result.current.close());

    act(() => result.current.open());

    expect(result.current.activeIndex).toBe(-1);
  });

  it('moves the active option within the bounds with the Arrow keys', () => {
    const { result } = setup();
    const bounds = { min: 0, max: 2 };
    act(() => result.current.open(1));

    let handled = false;
    act(() => {
      handled = result.current.handleListKey('ArrowDown', bounds);
    });
    expect(handled).toBe(true);
    expect(result.current.activeIndex).toBe(2);

    act(() => {
      result.current.handleListKey('ArrowDown', bounds);
    });
    expect(result.current.activeIndex).toBe(2);

    act(() => {
      result.current.handleListKey('ArrowUp', bounds);
      result.current.handleListKey('ArrowUp', bounds);
      result.current.handleListKey('ArrowUp', bounds);
    });
    expect(result.current.activeIndex).toBe(0);
  });

  it('may let the active option go back to none when the bounds allow it', () => {
    const { result } = setup();
    act(() => result.current.open(0));

    act(() => {
      result.current.handleListKey('ArrowUp', { min: -1, max: 2 });
    });

    expect(result.current.activeIndex).toBe(-1);
  });

  it('leaves the Arrow keys alone when there is no list', () => {
    const { result } = setup();
    act(() => result.current.open(1));

    expect(result.current.handleListKey('ArrowDown')).toBe(false);
    expect(result.current.handleListKey('ArrowUp')).toBe(false);
    expect(result.current.activeIndex).toBe(1);
  });

  it('closes only the list on Escape and returns focus to the trigger', () => {
    const { result, anchor } = setup();
    act(() => result.current.open(0));
    const elsewhere = document.createElement('input');
    document.body.appendChild(elsewhere);
    elsewhere.focus();

    let handled = false;
    act(() => {
      handled = result.current.handleListKey('Escape');
    });

    expect(handled).toBe(true);
    expect(result.current.isOpen).toBe(false);
    expect(document.activeElement).toBe(anchor);
  });

  it('leaves other keys alone', () => {
    const { result } = setup();
    act(() => result.current.open(0));

    expect(result.current.handleListKey('a', { min: 0, max: 1 })).toBe(false);
    expect(result.current.handleListKey('Tab', { min: 0, max: 1 })).toBe(false);
    expect(result.current.isOpen).toBe(true);
  });

  it('holds focus on the trigger, what is inside it and the list, and on nothing else', () => {
    const { result, anchor } = setup();
    const inside = document.createElement('input');
    anchor.appendChild(inside);
    const list = document.createElement('div');
    const inList = document.createElement('button');
    list.appendChild(inList);
    document.body.appendChild(list);
    (result.current.listRef as { current: HTMLDivElement | null }).current = list;
    const outside = document.createElement('input');
    document.body.appendChild(outside);

    expect(result.current.holdsFocus(anchor)).toBe(true);
    expect(result.current.holdsFocus(inside)).toBe(true);
    expect(result.current.holdsFocus(inList)).toBe(true);
    expect(result.current.holdsFocus(outside)).toBe(false);
    expect(result.current.holdsFocus(null)).toBe(false);
  });
});
