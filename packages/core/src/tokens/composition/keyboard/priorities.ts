/**
 * Handler priority constants.
 * Higher values execute first.
 */
export const HandlerPriority = {
  /** View-specific handlers (suggestions, special behaviors) */
  VIEW: 20,
  /** Block-specific handlers */
  BLOCK: 10,
  /** Default priority for generic handlers */
  DEFAULT: 0,
} as const;

export type HandlerPriorityValue = (typeof HandlerPriority)[keyof typeof HandlerPriority];
