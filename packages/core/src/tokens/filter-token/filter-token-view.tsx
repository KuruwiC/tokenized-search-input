import type { NodeViewProps } from '@tiptap/react';
import { getEditorContext, getFocusContext } from '../../extensions/editor-context';
import { useEditorContextUpdate } from '../../hooks/use-editor-context-update';
import { useTokenMeta } from '../../hooks/use-editor-selector';
import {
  getDateDisplayValue,
  getDateTimeDisplayValue,
  isDateOrDateTimeField,
} from '../../pickers/date-format';
import {
  dispatchCloseSuggestion,
  getEditableValueText,
  getSuggestionState,
  navigateSuggestion,
} from '../../plugins/suggestion';
import { getApplicableDisplay, getDecorationValidation } from '../../plugins/token-meta-plugin';
import { isInsideQuotes } from '../../serializer/quote-state';
import { type EnumValue, type FieldDefinition, getOperatorSelectLabel } from '../../types';
import { getEnumValue } from '../../utils/enum-value';
import { findTokenById } from '../../utils/find-token';
import { resolveField } from '../../utils/resolve-field';
import { Token, TokenIconSlot, useTokenConfig, useTokenFocusContext } from '../composition';
import { resolveDisplayValue } from './resolve-display-value';
import { applyTokenAction, type FilterTokenAction } from './token-actions';
import { writeTypedValue } from './typed-value';
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

  const editorContext = getEditorContext(editor);
  const { fields } = editorContext;
  const globalOperatorLabels = editorContext.operatorLabels;
  const valueSuggestionsDisabled = editorContext.valueSuggestionsDisabled;
  const classNames = editorContext.classNames;
  const fieldSource = { fields, unknownFields: editorContext.unknownFields };
  const fieldDef = resolveField(fieldSource, key) ?? undefined;
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

  const tokenLabelDisplay = fieldDef?.tokenLabelDisplay ?? 'auto';
  const showLabel = tokenLabelDisplay !== 'hidden';
  const hasMultipleOperators = operators.length > 1;
  // An operator the field does not allow has to stay visible and changeable.
  const operatorAllowed = operators.includes(operator);
  // Operator visibility: multiple operators always show (user needs to switch between them)
  // hideSingleOperator only applies when exactly one operator exists
  const showOperator = hasMultipleOperators || !operatorAllowed || !fieldDef?.hideSingleOperator;
  const isImmutable = node.attrs.immutable ?? false;

  const rangeSelected = decorations.some((decoration) => decoration.spec?.rangeSelected === true);

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
            dispatchCloseSuggestion(editor.view);
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
            dispatchCloseSuggestion(editor.view);
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
          fieldDef={fieldDef}
          fieldKey={key}
          rawValue={rawValue}
          editableText={getEditableValueText(fieldDef, rawValue)}
          valueDisplayString={valueDisplayString}
          valueSuggestionsDisabled={valueSuggestionsDisabled}
          baseAllowSpaces={fieldDef?.allowSpaces || isDateOrDateTimeField(fieldDef)}
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
  const { exitToken, showsControls } = useTokenFocusContext();
  const { deleteToken } = useTokenConfig();
  const fieldSource = getEditorContext(editor);

  // Editing shows the text that maps back to the value; display data never enters the input
  const effectiveValue = showsControls ? editableText : valueDisplayString;

  // A space is part of the value once the typed text opens a quote
  const allowSpaces = baseAllowSpaces || isInsideQuotes(effectiveValue);

  const { handleValueInputFocus, markValueTyped } = useValueSuggestions({
    editor,
    tokenId,
    fieldKey,
    fieldDef,
    value: rawValue,
    enabled: !valueSuggestionsDisabled,
  });

  // The transaction that writes a typed value also shows the value suggestions for it
  const handleInputChange = (inputText: string, composing: boolean): string => {
    const tr = editor.state.tr;
    const ctx = getFocusContext(editor);
    if (writeTypedValue(tr, ctx, fieldSource.delimiter, tokenId, inputText, composing)) {
      markValueTyped(tr);
      editor.view.dispatch(tr);
    }
    const token = findTokenById(editor.state.doc, tokenId);
    return getEditableValueText(fieldDef, String(token?.node.attrs.value ?? ''));
  };

  const isValueSuggestionOpen = () => {
    const suggestionState = getSuggestionState(editor.state);
    return (
      suggestionState?.type === 'value' &&
      !suggestionState?.dismissed &&
      suggestionState.items.length > 0
    );
  };

  // Keys that act on the value suggestions or on an empty value, before the value block's own
  const handleKey = (e: React.KeyboardEvent): boolean => {
    switch (e.key) {
      case 'Backspace':
        if (rawValue !== '') return false;
        e.preventDefault();
        deleteToken();
        return true;
      case 'ArrowDown':
      case 'ArrowUp': {
        const suggestionState = getSuggestionState(editor.state);
        if (!isValueSuggestionOpen() || !suggestionState) return false;
        e.preventDefault();
        const tr = editor.state.tr;
        navigateSuggestion(tr, suggestionState, e.key === 'ArrowDown' ? 'down' : 'up');
        editor.view.dispatch(tr);
        return true;
      }
      case 'Enter': {
        const suggestionState = getSuggestionState(editor.state);
        if (!isValueSuggestionOpen() || !suggestionState) return false;
        e.preventDefault();
        // Leaving the token sets the chosen value and commits it in one transaction.
        const selectedItem = (suggestionState.items as EnumValue[])[suggestionState.activeIndex];
        exitToken(selectedItem ? getEnumValue(selectedItem) : undefined);
        return true;
      }
      default:
        return false;
    }
  };

  return (
    <Token.Value
      value={effectiveValue}
      onChange={handleInputChange}
      allowSpaces={allowSpaces}
      containerClassName={valueClassName}
      ariaLabel={`Value for ${fieldKey} filter`}
      onFocus={handleValueInputFocus}
      handleKey={handleKey}
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
