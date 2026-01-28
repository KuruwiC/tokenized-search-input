import type { SuggestionType } from '../plugins/suggestion-plugin';

/**
 * Reasons why a suggestion overlay might be dismissed.
 */
export type DismissReason = 'blur' | 'pointer-outside' | 'escape' | 'confirm' | 'focus-outside';

/**
 * Defines how the "inside" boundary is determined for dismiss detection.
 * - container: editor container + suggestion overlay (for field suggestions)
 * - token: token element + suggestion overlay (for date/datetime pickers)
 * - value-input: value input element + suggestion overlay (for value suggestions)
 */
export type BoundaryType = 'container' | 'token' | 'value-input';

/**
 * Policy defining how a suggestion type should be dismissed.
 * Each suggestion type can have different dismiss behaviors.
 */
export type DismissPolicy = {
  readonly dismissOnBlur: boolean;
  readonly dismissOnOutsideClick: boolean;
  readonly dismissOnEscape: boolean;
  readonly dismissOnFocusOutside: boolean;
  readonly requireExplicitConfirm: boolean;
  readonly boundaryType: BoundaryType;
};

type SuggestionTypeKey = NonNullable<SuggestionType> | 'null';

/**
 * Dismiss policies for each suggestion type.
 *
 * - field/value: Traditional behavior - dismiss on blur, outside click, or escape
 * - date/datetime: Don't dismiss on blur (allows clicking calendar controls),
 *                  dismiss on outside click or escape, require explicit confirm button click
 */
export const DISMISS_POLICIES: Record<SuggestionTypeKey, DismissPolicy> = {
  null: {
    dismissOnBlur: false,
    dismissOnOutsideClick: false,
    dismissOnEscape: false,
    dismissOnFocusOutside: false,
    requireExplicitConfirm: false,
    boundaryType: 'container',
  },
  field: {
    dismissOnBlur: true,
    dismissOnOutsideClick: true,
    dismissOnEscape: true,
    dismissOnFocusOutside: false,
    requireExplicitConfirm: false,
    boundaryType: 'container',
  },
  value: {
    dismissOnBlur: false,
    dismissOnOutsideClick: true,
    dismissOnEscape: true,
    dismissOnFocusOutside: true,
    requireExplicitConfirm: false,
    boundaryType: 'value-input',
  },
  date: {
    dismissOnBlur: false,
    dismissOnOutsideClick: true,
    dismissOnEscape: true,
    dismissOnFocusOutside: true,
    requireExplicitConfirm: true,
    boundaryType: 'value-input',
  },
  datetime: {
    dismissOnBlur: false,
    dismissOnOutsideClick: true,
    dismissOnEscape: true,
    dismissOnFocusOutside: true,
    requireExplicitConfirm: true,
    boundaryType: 'value-input',
  },
  custom: {
    dismissOnBlur: true,
    dismissOnOutsideClick: true,
    dismissOnEscape: true,
    dismissOnFocusOutside: false,
    requireExplicitConfirm: false,
    boundaryType: 'container',
  },
  fieldWithCustom: {
    dismissOnBlur: true,
    dismissOnOutsideClick: true,
    dismissOnEscape: true,
    dismissOnFocusOutside: false,
    requireExplicitConfirm: false,
    boundaryType: 'container',
  },
};

/**
 * Get the dismiss policy for a given suggestion type.
 */
export const getDismissPolicy = (type: SuggestionType): DismissPolicy =>
  DISMISS_POLICIES[type ?? 'null'];

/**
 * Check if a dismiss reason should trigger dismissal based on the policy.
 */
export const shouldDismiss = (policy: DismissPolicy, reason: DismissReason): boolean => {
  switch (reason) {
    case 'blur':
      return policy.dismissOnBlur;
    case 'pointer-outside':
      return policy.dismissOnOutsideClick;
    case 'escape':
      return policy.dismissOnEscape;
    case 'focus-outside':
      return policy.dismissOnFocusOutside;
    case 'confirm':
      return true;
  }
};
