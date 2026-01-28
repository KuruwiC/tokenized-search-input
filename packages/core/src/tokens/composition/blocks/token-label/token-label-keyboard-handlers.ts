import type { FieldDefinition } from '../../../../types';
import type { CursorPosition } from '../../contexts';

interface OpenState {
  isOpen: boolean;
  activeIndex: number;
  filteredFields: readonly FieldDefinition[];
}

interface OpenActions {
  closeDropdown: () => void;
  navigateLeft: () => void;
  navigateRight: (position?: CursorPosition) => void;
  selectField: (key: string) => void;
  selectFieldAndNavigate: (key: string) => void;
  moveActiveUp: () => void;
  moveActiveDown: () => void;
}

interface ClosedActions {
  openDropdown: () => void;
  navigateLeft: () => void;
  navigateRight: (position?: CursorPosition) => void;
  navigateLeftEntry: () => void;
  navigateRightEntry: () => void;
}

/**
 * Handle keyboard events when combobox is open.
 * Returns true if the event was handled.
 */
export function handleOpenKeyDown(key: string, state: OpenState, actions: OpenActions): boolean {
  const { activeIndex, filteredFields } = state;

  switch (key) {
    case 'ArrowUp':
      actions.moveActiveUp();
      return true;

    case 'ArrowDown':
      actions.moveActiveDown();
      return true;

    case 'Tab':
      if (activeIndex >= 0 && activeIndex < filteredFields.length) {
        actions.selectFieldAndNavigate(filteredFields[activeIndex].key);
      } else {
        actions.closeDropdown();
        actions.navigateRight('end');
      }
      return true;

    case 'Enter':
      if (activeIndex >= 0 && activeIndex < filteredFields.length) {
        actions.selectFieldAndNavigate(filteredFields[activeIndex].key);
        return true;
      }
      return false;

    case 'ArrowRight':
      if (activeIndex >= 0 && activeIndex < filteredFields.length) {
        actions.selectFieldAndNavigate(filteredFields[activeIndex].key);
      } else {
        actions.closeDropdown();
        actions.navigateRight('end');
      }
      return true;

    case 'ArrowLeft':
      actions.closeDropdown();
      actions.navigateLeft();
      return true;

    default:
      return false;
  }
}

/**
 * Handle keyboard events when combobox is closed.
 * Returns true if the event was handled.
 */
export function handleClosedKeyDown(key: string, actions: ClosedActions): boolean {
  switch (key) {
    case 'Enter':
    case ' ':
    case 'ArrowDown':
      actions.openDropdown();
      return true;

    case 'ArrowLeft':
      actions.navigateLeft();
      return true;

    case 'ArrowRight':
    case 'Tab':
      actions.navigateRight();
      return true;

    case 'Backspace':
      actions.navigateLeftEntry();
      return true;

    case 'Delete':
      actions.navigateRightEntry();
      return true;

    default:
      return false;
  }
}

export interface InputOnlyOpenState {
  inputValue: string;
  selectionStart: number | null;
  selectionEnd: number | null;
}

export interface InputOnlyOpenActions {
  selectFieldAndClose: (value: string) => void;
  closeAndNavigateLeft: () => void;
  closeAndNavigateRight: (position?: CursorPosition) => void;
}

/**
 * Handle keyboard events for input-only mode when open (editing).
 * Arrow keys navigate only when cursor is at text boundaries.
 * Returns true if the event was handled.
 */
export function handleInputOnlyOpenKeyDown(
  key: string,
  state: InputOnlyOpenState,
  actions: InputOnlyOpenActions
): boolean {
  const { inputValue, selectionStart, selectionEnd } = state;
  const hasSelection = selectionStart !== selectionEnd;
  const atStart = selectionStart === 0 && !hasSelection;
  const atEnd = selectionStart === inputValue.length && !hasSelection;

  switch (key) {
    case 'Enter':
    case 'Tab':
      if (inputValue.trim()) {
        actions.selectFieldAndClose(inputValue.trim());
      }
      actions.closeAndNavigateRight('end');
      return true;

    case 'ArrowRight':
      if (atEnd) {
        if (inputValue.trim()) {
          actions.selectFieldAndClose(inputValue.trim());
        }
        actions.closeAndNavigateRight('end');
        return true;
      }
      return false;

    case 'ArrowLeft':
      if (atStart) {
        if (inputValue.trim()) {
          actions.selectFieldAndClose(inputValue.trim());
        }
        actions.closeAndNavigateLeft();
        return true;
      }
      return false;

    default:
      return false;
  }
}
