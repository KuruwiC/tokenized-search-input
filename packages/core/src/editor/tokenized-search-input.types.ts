import type { FieldDefinition, FreeTextMode, QuerySnapshot } from '../types';
import type {
  ClassNames,
  LabelsConfig,
  PickersConfig,
  SerializationConfig,
  SuggestionsConfig,
  UnknownFieldsConfig,
  ValidationConfig,
} from '../types/config';

export interface TokenizedSearchInputProps {
  /** Field definitions for tokenization */
  fields: FieldDefinition[];
  /** Initial query value */
  defaultValue?: string;
  /**
   * Called when the query content changes.
   * Provides a snapshot with parsed tokens and serialized text.
   */
  onChange?: (snapshot: QuerySnapshot) => void;
  /**
   * Called when the user submits the query (e.g., pressing Enter).
   * Provides a snapshot with parsed tokens and serialized text.
   */
  onSubmit?: (snapshot: QuerySnapshot) => void;
  /**
   * Called when non-focused tokens change.
   * Fires when tokens are created, updated, or deleted, excluding the currently focused token.
   * Provides a full snapshot for easy state synchronization.
   */
  onTokensChange?: (snapshot: QuerySnapshot) => void;
  /**
   * Called when the editor loses focus.
   * Provides a snapshot with parsed tokens and serialized text.
   */
  onBlur?: (snapshot: QuerySnapshot) => void;
  /**
   * Called when the editor gains focus.
   * Provides a snapshot with parsed tokens and serialized text.
   */
  onFocus?: (snapshot: QuerySnapshot) => void;
  /**
   * Called when the clear button is clicked.
   */
  onClear?: () => void;
  /** Placeholder text when input is empty */
  placeholder?: string;
  /** Disable the input */
  disabled?: boolean;
  /** How free text (non-tokenized) input is handled */
  freeTextMode?: FreeTextMode;
  /**
   * Show clear button to remove all content.
   * @default false
   */
  clearable?: boolean;
  /**
   * Custom class name for the root container element.
   * Merged with classNames.root if both are provided.
   */
  className?: string;
  /** Custom class names for styling component parts */
  classNames?: ClassNames;
  /**
   * Display mode for the input layout.
   * - false (default): Tokens wrap to multiple lines
   * - true: Single line with horizontal scroll, no wrapping
   * @default false
   */
  singleLine?: boolean;
  /**
   * When true, the input collapses to single-line horizontal scroll when unfocused,
   * and expands to multi-line (max 4 lines) overlay when focused.
   * The expanded state overlays content below without pushing layout.
   * When both singleLine and expandOnFocus are true, expandOnFocus takes priority.
   * @default false
   */
  expandOnFocus?: boolean;

  // Configuration props (grouped)

  /** Suggestions configuration */
  suggestions?: SuggestionsConfig;
  /** Validation configuration */
  validation?: ValidationConfig;
  /** Unknown fields configuration */
  unknownFields?: UnknownFieldsConfig;
  /** Serialization configuration (clipboard) */
  serialization?: SerializationConfig;
  /**
   * Initial delimiter character used to separate field, operator, and value in tokens.
   * Format: `field{delimiter}operator{delimiter}value` (e.g., with ':': `status:is:active`)
   *
   * **Frozen after mount** - this value cannot be changed after initialization.
   *
   * @default ':'
   */
  initialDelimiter?: string;
  /** Labels configuration (i18n) */
  labels?: LabelsConfig;
  /** Custom pickers configuration */
  pickers?: PickersConfig;
  /**
   * Whether to render the editor immediately on mount.
   * Set to `false` for SSR environments (e.g., Next.js App Router) to prevent hydration mismatches.
   * @default true
   */
  immediatelyRender?: boolean;

  /**
   * Element to render at the start of the input.
   * Commonly used for a search icon.
   * For interactive elements, wrap in a button with proper aria-label.
   * Mark purely decorative content with `aria-hidden="true"` on that content.
   */
  startAdornment?: React.ReactNode;

  /**
   * Element to render at the end of the input (before clear button if enabled).
   * Can be used for action buttons like submit or voice search.
   * For interactive elements, wrap in a button with proper aria-label.
   * Mark purely decorative content with `aria-hidden="true"` on that content.
   */
  endAdornment?: React.ReactNode;
}

export interface TokenizedSearchInputRef {
  /** Set the input value programmatically */
  setValue: (value: string) => void;
  /** Get the current serialized query string */
  getValue: () => string;
  /**
   * Get a versioned snapshot of the current query state.
   * Includes parsed tokens with stable IDs and serialized text.
   */
  getSnapshot: () => QuerySnapshot;
  /** Focus the input */
  focus: () => void;
  /** Clear all content */
  clear: () => void;
  /** Trigger submit programmatically */
  submit: () => void;
}
