/**
 * Actions available in the operator dropdown.
 */
export interface OperatorActions {
  openDropdown: () => void;
  closeDropdown: () => void;
  navigateLeft: () => void;
  navigateRight: () => void;
  navigateLeftEntry: () => void;
  navigateRightEntry: () => void;
  selectOperator: (op: string) => void;
  moveActiveUp: () => void;
  moveActiveDown: () => void;
}

/**
 * State for the operator dropdown.
 */
export interface OperatorState {
  isOpen: boolean;
  activeIndex: number;
  operators: readonly string[];
}

/**
 * Handler for keyboard events when dropdown is closed.
 * @returns true if the event was handled
 */
export function handleClosedKeyDown(
  key: string,
  actions: Pick<
    OperatorActions,
    'openDropdown' | 'navigateLeft' | 'navigateRight' | 'navigateLeftEntry' | 'navigateRightEntry'
  >
): boolean {
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

/**
 * Handler for keyboard events when dropdown is open.
 * @returns true if the event was handled
 */
export function handleOpenKeyDown(
  key: string,
  state: OperatorState,
  actions: Pick<
    OperatorActions,
    'closeDropdown' | 'navigateRight' | 'selectOperator' | 'moveActiveUp' | 'moveActiveDown'
  >
): boolean {
  const { activeIndex, operators } = state;

  switch (key) {
    case 'ArrowDown':
      actions.moveActiveDown();
      return true;
    case 'ArrowUp':
      actions.moveActiveUp();
      return true;
    case 'Enter':
    case ' ':
      if (activeIndex >= 0 && activeIndex < operators.length) {
        const op = operators[activeIndex];
        if (op !== undefined) {
          actions.selectOperator(op);
        }
        actions.closeDropdown();
      }
      return true;
    case 'Escape':
      actions.closeDropdown();
      return true;
    case 'Tab':
      actions.closeDropdown();
      actions.navigateRight();
      return true;
    default:
      return false;
  }
}
