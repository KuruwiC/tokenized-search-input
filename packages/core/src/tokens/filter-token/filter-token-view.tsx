import type { NodeViewProps } from '@tiptap/react';
import { useRef } from 'react';
import { getEditorContext, resolveField } from '../../extensions/editor-context';
import { useEditorContextUpdate } from '../../hooks/use-editor-context-update';
import { useTokenMeta } from '../../hooks/use-editor-store';
import {
  getDateDisplayValue,
  getDateTimeDisplayValue,
  normalizeDateTimeValue,
  normalizeDateValue,
} from '../../pickers/date-format';
import { getApplicableDisplay } from '../../plugins/shared/meta';
import {
  closeSuggestion,
  getSuggestionState,
  navigateSuggestion,
} from '../../plugins/suggestion-plugin';
import { getDecorationValidation } from '../../plugins/token-meta-plugin';
import { type EnumValue, type FieldDefinition, getOperatorSelectLabel } from '../../types';
import { isRangeSelected } from '../../utils/decoration-helpers';
import { getEnumLabel, getEnumValue, resolveEnumValue } from '../../utils/enum-value';
import { isInsideQuotes } from '../../utils/quoted-string';
import {
  HandlerPriority,
  Token,
  TokenIconSlot,
  useBlockKeyboardContribution,
  useTokenConfig,
  useTokenFocusContext,
} from '../composition';
import { resolveDisplayValue } from './resolve-display-value';
import { applyTokenAction, commitFilterToken, type FilterTokenAction } from './token-actions';
import { useValueSuggestions } from './use-value-suggestions';

/** The text the user edits: a static enum value's label, otherwise the value itself. */
function getEditableText(fieldDef: FieldDefinition | undefined, rawValue: string): string {
  if (fieldDef?.type !== 'enum' || !fieldDef.enumValues) return rawValue;
  const matched = fieldDef.enumValues.find((ev: EnumValue) => getEnumValue(ev) === rawValue);
  return matched ? getEnumLabel(matched) : rawValue;
}

export const FilterTokenView: React.FC<NodeViewProps> = ({
  node,
  deleteNode,
  editor,
  getPos,
  decorations,
}) => {
  useEditorContextUpdate(editor);
  const { id, key, operator, value } = node.attrs;
  const inputRef = useRef<HTMLInputElement>(null);

  const editorContext = getEditorContext(editor);
  const { fields } = editorContext;
  const globalOperatorLabels = editorContext.operatorLabels;
  const valueSuggestionsDisabled = editorContext.valueSuggestionsDisabled;
  const classNames = editorContext.classNames;
  const fieldSource = { fields, unknownFields: editorContext.unknownFields };
  const fieldDef = resolveField(fieldSource, key) ?? undefined;
  const isEnumField = fieldDef?.type === 'enum';
  const isDateField = fieldDef?.type === 'date';
  const isDateTimeField = fieldDef?.type === 'datetime';
  const operatorLabels = fieldDef?.operatorLabels
    ? { ...globalOperatorLabels, ...fieldDef.operatorLabels }
    : globalOperatorLabels;
  const operatorSelectLabel = (op: string) => getOperatorSelectLabel(operatorLabels, op);
  // A token whose field was removed from `fields` has no definition left; its own
  // operator is the only one it can still offer.
  const operators: readonly string[] = fieldDef?.operators ?? [operator];
  const rawValue = value || '';

  const validation = getDecorationValidation(decorations);
  const display = getApplicableDisplay(useTokenMeta(editor, id)?.display, key, rawValue);

  // Display control options
  const tokenLabelDisplay = fieldDef?.tokenLabelDisplay ?? 'auto';
  const showLabel = tokenLabelDisplay !== 'hidden';
  const hasMultipleOperators = operators.length > 1;
  // Operator visibility: multiple operators always show (user needs to switch between them)
  // hideSingleOperator only applies when exactly one operator exists
  const showOperator = hasMultipleOperators || !fieldDef?.hideSingleOperator;
  const isImmutable = node.attrs.immutable ?? false;

  const rangeSelected = isRangeSelected(decorations);

  // Resolve display value using pure function (extracted for testability)
  const { valueDisplayString, startContent, endContent } = resolveDisplayValue({
    rawValue,
    fieldDef,
    display,
    getDateDisplayValue,
    getDateTimeDisplayValue,
  });

  const dispatchAction = (action: FilterTokenAction) => {
    const tr = editor.state.tr;
    if (applyTokenAction(tr, id, action)) editor.view.dispatch(tr);
  };

  const handleOperatorChange = (op: string) => {
    dispatchAction({ type: 'setOperator', operator: op });
  };

  /** The value that the text typed into the input stands for. */
  const toValue = (inputText: string): string =>
    isEnumField && fieldDef?.enumValues
      ? resolveEnumValue(fieldDef.enumValues, inputText, { resolver: fieldDef.valueResolver })
      : inputText;

  return (
    <Token
      editor={editor}
      getPos={getPos}
      node={node}
      deleteNode={deleteNode}
      validation={validation}
      ariaLabel={`Filter: ${key} ${operator} ${valueDisplayString}`}
      className={classNames?.token}
      dataAttrs={{ 'data-filter-token': '' }}
      onBlur={() => {
        const tr = editor.state.tr;
        if (commitFilterToken(tr, id, fieldDef)) editor.view.dispatch(tr);
      }}
      immutable={isImmutable}
      rangeSelected={rangeSelected}
    >
      {showLabel && (
        <Token.LabelCombobox
          field={fieldDef}
          fallback={key}
          selectableFields={fields}
          allowUnknownFields={editorContext.unknownFields !== undefined}
          onFieldChange={(newKey) => {
            const newOperator = resolveField(fieldSource, newKey)?.operators[0] ?? operator;
            dispatchAction({ type: 'setKey', key: newKey, operator: newOperator });
          }}
          className={classNames?.tokenLabel}
          onOpen={() => {
            const tr = editor.state.tr;
            closeSuggestion(tr);
            tr.setMeta('addToHistory', false);
            editor.view.dispatch(tr);
          }}
        />
      )}

      {showOperator && (
        <Token.Operator
          value={operator}
          operators={operators}
          getLabel={operatorSelectLabel}
          onChange={handleOperatorChange}
          className={classNames?.tokenOperator}
          dropdownClassName={classNames?.operatorDropdown}
          itemClassName={classNames?.operatorDropdownItem}
          onOpen={() => {
            const tr = editor.state.tr;
            closeSuggestion(tr);
            tr.setMeta('addToHistory', false);
            editor.view.dispatch(tr);
          }}
        />
      )}

      {isImmutable ? (
        <ImmutableTokenValue
          valueDisplayString={valueDisplayString}
          startContent={startContent}
          endContent={endContent}
        />
      ) : (
        <FilterTokenValue
          editor={editor}
          tokenId={id}
          inputRef={inputRef}
          fieldDef={fieldDef}
          fieldKey={key}
          rawValue={rawValue}
          editableText={getEditableText(fieldDef, rawValue)}
          valueDisplayString={valueDisplayString}
          valueSuggestionsDisabled={valueSuggestionsDisabled}
          baseAllowSpaces={fieldDef?.allowSpaces || isDateField || isDateTimeField}
          toValue={toValue}
          startContent={startContent}
          endContent={endContent}
          valueClassName={classNames?.tokenValue}
        />
      )}

      <Token.DeleteButton
        ariaLabel={`Remove ${key} filter`}
        className={classNames?.tokenDeleteButton}
      />
    </Token>
  );
};

// Separated component to access Token context
interface FilterTokenValueProps {
  editor: NodeViewProps['editor'];
  tokenId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  fieldDef: FieldDefinition | undefined;
  fieldKey: string;
  rawValue: string;
  /** The text shown in the input while the token is edited */
  editableText: string;
  valueDisplayString: string;
  valueSuggestionsDisabled: boolean;
  /** Whether spaces are allowed by field config (date/datetime/allowSpaces) */
  baseAllowSpaces: boolean;
  toValue: (inputText: string) => string;
  /** Content to display before the value (e.g., icon) */
  startContent?: React.ReactNode;
  /** Content to display after the value */
  endContent?: React.ReactNode;
  /** Custom class for token value */
  valueClassName?: string;
}

function FilterTokenValue({
  editor,
  tokenId,
  inputRef,
  fieldDef,
  fieldKey,
  rawValue,
  editableText,
  valueDisplayString,
  valueSuggestionsDisabled,
  baseAllowSpaces,
  toValue,
  startContent,
  endContent,
  valueClassName,
}: FilterTokenValueProps): React.ReactElement {
  const { exitToken, currentFocusId, isFocused: tokenFocused } = useTokenFocusContext();
  const { deleteToken } = useTokenConfig();

  // Normalize date/datetime values (shared logic for confirm and blur)
  const normalizeValue = () => {
    let normalized = rawValue;
    if (fieldDef?.type === 'date') {
      normalized = normalizeDateValue(rawValue, fieldDef.formatConfig);
    } else if (fieldDef?.type === 'datetime') {
      const allowDateOnly = !fieldDef.timeRequired;
      normalized = normalizeDateTimeValue(rawValue, fieldDef.formatConfig, allowDateOnly);
    }
    const tr = editor.state.tr;
    if (applyTokenAction(tr, tokenId, { type: 'setValue', value: normalized })) {
      editor.view.dispatch(tr);
    }
  };

  // Normalize, confirm, close picker, and exit token on confirm (Enter/Space)
  const handleConfirm = () => {
    normalizeValue();

    // Close picker/suggestion and commit token in single transaction
    const tr = editor.state.tr;
    closeSuggestion(tr);
    tr.setMeta('addToHistory', false);
    commitFilterToken(tr, tokenId, fieldDef);
    editor.view.dispatch(tr);
    exitToken();
  };

  // Date/datetime fields need special handling for normalization and display
  const isDateOrDateTime = fieldDef?.type === 'date' || fieldDef?.type === 'datetime';

  // Editing shows the text that maps back to the value; display data never enters the input
  const effectiveValue = tokenFocused ? editableText : valueDisplayString;

  // allowSpaces: check current input text from inputRef for real-time quote detection
  // This allows users to type quotes and then input spaces
  const currentInputText = inputRef.current?.value ?? valueDisplayString;
  const allowSpaces = baseAllowSpaces || isInsideQuotes(currentInputText);

  // Event-driven value suggestions management
  const {
    handleValueInputFocus,
    handleValueInputBlur: baseSuggestionBlur,
    addSuggestionQuery,
  } = useValueSuggestions({
    editor,
    tokenId,
    fieldKey,
    fieldDef,
    value: rawValue,
    enabled: !valueSuggestionsDisabled,
  });

  // The transaction that writes a typed value also updates the value suggestions for it
  const handleInputChange = (inputText: string) => {
    const value = toValue(inputText);
    const tr = editor.state.tr;
    if (!applyTokenAction(tr, tokenId, { type: 'setValue', value })) return;
    addSuggestionQuery(tr, inputText, value);
    editor.view.dispatch(tr);
  };

  // Combine blur handling: normalize date/datetime values and handle suggestions
  const handleValueInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Normalize date/datetime values on blur
    if (isDateOrDateTime) {
      normalizeValue();
    }
    // Call base suggestion blur handler
    baseSuggestionBlur(e);
  };

  // Helper to check if value suggestions are open
  const isValueSuggestionOpen = () => {
    const suggestionState = getSuggestionState(editor.state);
    return (
      suggestionState?.type === 'value' &&
      !suggestionState?.dismissed &&
      suggestionState.items.length > 0
    );
  };

  const keyboardHandlers = {
    Backspace: {
      handler: (e: React.KeyboardEvent) => {
        if (currentFocusId !== 'value') return false;
        if (e.nativeEvent.isComposing) return false;
        if (rawValue !== '') return false;

        e.preventDefault();
        deleteToken();
        return true;
      },
      priority: HandlerPriority.VIEW,
    },
    ArrowDown: {
      handler: (e: React.KeyboardEvent) => {
        if (currentFocusId !== 'value') return false;
        const suggestionState = getSuggestionState(editor.state);
        if (!isValueSuggestionOpen() || !suggestionState) return false;
        e.preventDefault();
        const tr = editor.state.tr;
        navigateSuggestion(tr, suggestionState, 'down');
        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
        return true;
      },
      priority: HandlerPriority.VIEW,
    },
    ArrowUp: {
      handler: (e: React.KeyboardEvent) => {
        if (currentFocusId !== 'value') return false;
        const suggestionState = getSuggestionState(editor.state);
        if (!isValueSuggestionOpen() || !suggestionState) return false;
        e.preventDefault();
        const tr = editor.state.tr;
        navigateSuggestion(tr, suggestionState, 'up');
        tr.setMeta('addToHistory', false);
        editor.view.dispatch(tr);
        return true;
      },
      priority: HandlerPriority.VIEW,
    },
    Enter: {
      handler: (e: React.KeyboardEvent) => {
        if (currentFocusId !== 'value') return false;
        const suggestionState = getSuggestionState(editor.state);
        if (!isValueSuggestionOpen() || !suggestionState) return false;
        e.preventDefault();
        const items = suggestionState.items as EnumValue[];
        const activeIndex = suggestionState.activeIndex;
        const tr = editor.state.tr;
        closeSuggestion(tr);
        tr.setMeta('addToHistory', false);
        const selectedItem = items[activeIndex];
        if (selectedItem) {
          applyTokenAction(tr, tokenId, { type: 'setValue', value: getEnumValue(selectedItem) });
        }
        editor.view.dispatch(tr);
        exitToken();
        return true;
      },
      priority: HandlerPriority.VIEW,
    },
  };

  // Register with block ID 'filter-value' to distinguish from base 'value' handlers
  useBlockKeyboardContribution('filter-value', keyboardHandlers);

  // Use handleConfirm for date/datetime fields to normalize values on confirm
  const isDateOrDateTimeField = fieldDef?.type === 'date' || fieldDef?.type === 'datetime';

  return (
    <Token.Value
      value={effectiveValue}
      onChange={handleInputChange}
      allowSpaces={allowSpaces}
      containerClassName={valueClassName}
      ariaLabel={`Value for ${fieldKey} filter`}
      onFocus={handleValueInputFocus}
      onBlur={handleValueInputBlur}
      inputRef={inputRef}
      onConfirm={isDateOrDateTimeField ? handleConfirm : undefined}
      startContent={startContent}
      endContent={endContent}
    />
  );
}

interface ImmutableTokenValueProps {
  valueDisplayString: string;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
}

function ImmutableTokenValue({
  valueDisplayString,
  startContent,
  endContent,
}: ImmutableTokenValueProps): React.ReactElement {
  return (
    <span className="tsi-immutable-value">
      <TokenIconSlot>{startContent}</TokenIconSlot>
      <span className="tsi-token-value__display-text">{valueDisplayString}</span>
      <TokenIconSlot>{endContent}</TokenIconSlot>
    </span>
  );
}
