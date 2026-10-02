import type { NodeViewProps } from '@tiptap/react';
import { useRef } from 'react';
import { getEditorContext, resolveField } from '../../extensions/editor-context';
import { useEditorContextUpdate } from '../../hooks/use-editor-context-update';
import { useTokenMeta } from '../../hooks/use-editor-store';
import { getDateDisplayValue, getDateTimeDisplayValue } from '../../pickers/date-format';
import { getApplicableDisplay } from '../../plugins/shared/meta';
import {
  closeSuggestion,
  getEditableValueText,
  getSuggestionState,
  navigateSuggestion,
} from '../../plugins/suggestion-plugin';
import { getDecorationValidation } from '../../plugins/token-meta-plugin';
import { type EnumValue, type FieldDefinition, getOperatorSelectLabel } from '../../types';
import { isRangeSelected } from '../../utils/decoration-helpers';
import { getEnumValue } from '../../utils/enum-value';
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
import { applyTokenAction, type FilterTokenAction } from './token-actions';
import { useValueSuggestions } from './use-value-suggestions';

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
    if (applyTokenAction(tr, id, action, fieldSource)) editor.view.dispatch(tr);
  };

  const handleOperatorChange = (op: string) => {
    dispatchAction({ type: 'setOperator', operator: op });
  };

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
          editableText={getEditableValueText(fieldDef, rawValue)}
          valueDisplayString={valueDisplayString}
          valueSuggestionsDisabled={valueSuggestionsDisabled}
          baseAllowSpaces={fieldDef?.allowSpaces || isDateField || isDateTimeField}
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
  startContent,
  endContent,
  valueClassName,
}: FilterTokenValueProps): React.ReactElement {
  const { exitToken, currentFocusId, isFocused: tokenFocused } = useTokenFocusContext();
  const { deleteToken } = useTokenConfig();
  const fieldSource = getEditorContext(editor);

  // Editing shows the text that maps back to the value; display data never enters the input
  const effectiveValue = tokenFocused ? editableText : valueDisplayString;

  // allowSpaces: check current input text from inputRef for real-time quote detection
  // This allows users to type quotes and then input spaces
  const currentInputText = inputRef.current?.value ?? valueDisplayString;
  const allowSpaces = baseAllowSpaces || isInsideQuotes(currentInputText);

  // Event-driven value suggestions management
  const { handleValueInputFocus, handleValueInputBlur, addSuggestionQuery } = useValueSuggestions({
    editor,
    tokenId,
    fieldKey,
    fieldDef,
    value: rawValue,
    enabled: !valueSuggestionsDisabled,
  });

  // The transaction that writes a typed value also shows the value suggestions for it
  const handleInputChange = (inputText: string) => {
    const tr = editor.state.tr;
    if (!applyTokenAction(tr, tokenId, { type: 'setValue', value: inputText }, fieldSource)) return;
    addSuggestionQuery(tr);
    editor.view.dispatch(tr);
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
        // Leaving the token sets the chosen value and commits it in one transaction.
        const selectedItem = (suggestionState.items as EnumValue[])[suggestionState.activeIndex];
        exitToken(selectedItem ? getEnumValue(selectedItem) : undefined);
        return true;
      },
      priority: HandlerPriority.VIEW,
    },
  };

  // Register with block ID 'filter-value' to distinguish from base 'value' handlers
  useBlockKeyboardContribution('filter-value', keyboardHandlers);

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
