import type { NodeViewProps } from '@tiptap/react';
import { useMemo, useRef } from 'react';
import { getEditorContextFromEditor } from '../../extensions/editor-context';
import {
  getDateDisplayValue,
  getDateTimeDisplayValue,
  normalizeDateTimeValue,
  normalizeDateValue,
} from '../../pickers/date-format';
import {
  closeSuggestion,
  getSuggestionState,
  navigateSuggestion,
} from '../../plugins/suggestion-plugin';
import { type EnumValue, type FieldDefinition, getOperatorSelectLabel } from '../../types';
import { isRangeSelected } from '../../utils/decoration-helpers';
import { getEnumValue, resolveEnumValue } from '../../utils/enum-value';
import { isInsideQuotes } from '../../utils/quoted-string';
import {
  HandlerPriority,
  Token,
  TokenIconSlot,
  useBlockKeyboardContribution,
  useTokenConfig,
  useTokenFocusContext,
} from '../composition';
import { commitFilterToken } from './commit-token';
import { resolveDisplayValue } from './resolve-display-value';
import { computeAttrsPatch, type TokenEditableAttrs, tokenAttrReducer } from './token-attr-reducer';
import { useNativeUndoFallback } from './use-native-undo-fallback';
import { useValueSuggestions } from './use-value-suggestions';

export const FilterTokenView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
  getPos,
  extension,
  decorations,
}) => {
  const { key, operator, value, invalid: storedInvalid } = node.attrs;
  const inputRef = useRef<HTMLInputElement>(null);

  const editorContext = getEditorContextFromEditor(editor);
  const fields =
    editorContext.fields.length > 0
      ? editorContext.fields
      : (extension.options.fields as FieldDefinition[]);
  const unknownFieldOperators =
    editorContext.unknownFieldOperators ??
    (extension.options.unknownFieldOperators as string[] | undefined);
  const globalOperatorLabels = editorContext.operatorLabels;
  const valueSuggestionsDisabled = editorContext.valueSuggestionsDisabled;
  const classNames = editorContext.classNames;
  const fieldDef = fields.find((f) => f.key === key);
  const isEnumField = fieldDef?.type === 'enum';
  const isDateField = fieldDef?.type === 'date';
  const isDateTimeField = fieldDef?.type === 'datetime';
  const operatorLabels = fieldDef?.operatorLabels
    ? { ...globalOperatorLabels, ...fieldDef.operatorLabels }
    : globalOperatorLabels;
  const operatorSelectLabel = (op: string) => getOperatorSelectLabel(operatorLabels, op);
  const operators = fieldDef?.operators || unknownFieldOperators || ['is'];
  const rawValue = value || '';

  // Compute invalid state: combine stored value (from global ValidationRules) with field-level validate
  // Memoize to avoid re-running validation on every render
  const fieldValidationFailed = useMemo(() => {
    if (!fieldDef?.validate || !rawValue) return false;
    return fieldDef.validate(rawValue) !== true;
  }, [fieldDef, rawValue]);
  const invalid = storedInvalid || fieldValidationFailed;

  // Display control options
  const tokenLabelDisplay = fieldDef?.tokenLabelDisplay ?? 'auto';
  const showLabel = tokenLabelDisplay !== 'hidden';
  const isUnknownField = !fieldDef;
  const hasMultipleOperators = operators.length > 1;
  // Operator visibility: multiple operators always show (user needs to switch between them)
  // hideSingleOperator only applies when exactly one operator exists
  const showOperator =
    operators.length === 0
      ? false
      : hasMultipleOperators
        ? true
        : isUnknownField
          ? !editorContext.hideUnknownFieldSingleOperator
          : !fieldDef.hideSingleOperator;
  const isImmutable = node.attrs.immutable ?? false;

  const rangeSelected = isRangeSelected(decorations);

  // Resolve display value using pure function (extracted for testability)
  const { valueDisplayString, startContent, endContent } = resolveDisplayValue({
    rawValue,
    fieldDef,
    nodeAttrs: {
      displayValue: node.attrs.displayValue,
      startContent: node.attrs.startContent,
      endContent: node.attrs.endContent,
    },
    getDateDisplayValue,
    getDateTimeDisplayValue,
  });

  // Helper to get current editable attrs from node
  const getCurrentAttrs = (): TokenEditableAttrs => ({
    value: node.attrs.value ?? '',
    operator: node.attrs.operator ?? '',
    key: node.attrs.key ?? '',
    confirmed: node.attrs.confirmed ?? false,
    immutable: node.attrs.immutable ?? false,
    invalid: node.attrs.invalid ?? false,
    displayValue: node.attrs.displayValue ?? null,
    startContent: node.attrs.startContent ?? null,
    endContent: node.attrs.endContent ?? null,
  });

  const handleOperatorChange = (op: string) => {
    const current = getCurrentAttrs();
    const next = tokenAttrReducer(current, { type: 'OPERATOR_CHANGED', operator: op });
    const patch = computeAttrsPatch(current, next);
    updateAttributes(patch);
  };

  const handleValueChange = (inputValue: string) => {
    const internalValue =
      isEnumField && fieldDef?.enumValues
        ? resolveEnumValue(fieldDef.enumValues, inputValue, {
            resolver: fieldDef.valueResolver,
          })
        : inputValue;

    const current = getCurrentAttrs();
    if (internalValue !== current.value) {
      const next = tokenAttrReducer(current, { type: 'VALUE_CHANGED', value: internalValue });
      const patch = computeAttrsPatch(current, next);
      updateAttributes(patch);
    }
  };

  return (
    <Token
      editor={editor}
      getPos={getPos}
      node={node}
      updateAttributes={updateAttributes}
      deleteNode={deleteNode}
      invalid={invalid}
      ariaLabel={`Filter: ${key} ${operator} ${valueDisplayString}`}
      className={classNames?.token}
      dataAttrs={{ 'data-filter-token': '' }}
      value={rawValue}
      validate={fieldDef?.validate}
      onInvalidChange={(inv) => updateAttributes({ invalid: inv })}
      onBlur={() => {
        try {
          const pos = getPos();
          if (typeof pos !== 'number') return;

          const tr = editor.state.tr;
          const committed = commitFilterToken({
            tr,
            pos,
            fieldDef,
            validate: fieldDef?.validate,
          });

          if (committed) {
            editor.view.dispatch(tr);
          }
        } catch {
          // Node may have been deleted during blur
        }
      }}
      immutable={isImmutable}
      rangeSelected={rangeSelected}
    >
      {showLabel && (
        <Token.LabelCombobox
          field={fieldDef}
          fallback={key}
          selectableFields={fields}
          allowUnknownFields={editorContext.allowUnknownFields}
          onFieldChange={(newKey) => {
            const newField = fields.find((f) => f.key === newKey);
            const newOperator = newField?.operators[0] || unknownFieldOperators?.[0] || 'is';

            const current = getCurrentAttrs();
            const next = tokenAttrReducer(current, {
              type: 'FIELD_CHANGED',
              key: newKey,
              operator: newOperator,
            });
            const patch = computeAttrsPatch(current, next);
            updateAttributes(patch);
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
          getPos={getPos}
          inputRef={inputRef}
          fieldDef={fieldDef}
          fieldKey={key}
          rawValue={rawValue}
          valueDisplayString={valueDisplayString}
          valueSuggestionsDisabled={valueSuggestionsDisabled}
          baseAllowSpaces={fieldDef?.allowSpaces || isDateField || isDateTimeField}
          onChange={handleValueChange}
          updateAttributes={updateAttributes}
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
  getPos: NodeViewProps['getPos'];
  inputRef: React.RefObject<HTMLInputElement | null>;
  fieldDef: FieldDefinition | undefined;
  fieldKey: string;
  rawValue: string;
  valueDisplayString: string;
  valueSuggestionsDisabled: boolean;
  /** Whether spaces are allowed by field config (date/datetime/allowSpaces) */
  baseAllowSpaces: boolean;
  onChange: (value: string) => void;
  updateAttributes: NodeViewProps['updateAttributes'];
  /** Content to display before the value (e.g., icon) */
  startContent?: React.ReactNode;
  /** Content to display after the value */
  endContent?: React.ReactNode;
  /** Custom class for token value */
  valueClassName?: string;
}

function FilterTokenValue({
  editor,
  getPos,
  inputRef,
  fieldDef,
  fieldKey,
  rawValue,
  valueDisplayString,
  valueSuggestionsDisabled,
  baseAllowSpaces,
  onChange,
  updateAttributes,
  startContent,
  endContent,
  valueClassName,
}: FilterTokenValueProps): React.ReactElement {
  const { exitToken, currentFocusId, isFocused: tokenFocused } = useTokenFocusContext();
  const { deleteToken } = useTokenConfig();

  // Native undo fallback: when Cmd+Z is pressed on empty input and browser has no undo history,
  // delete the token so user can continue undoing in the editor
  const { handleUndoKeyDown } = useNativeUndoFallback({
    inputRef,
    onFallback: deleteToken,
    enabled: currentFocusId === 'value' && rawValue === '',
  });

  // Normalize date/datetime values (shared logic for confirm and blur)
  const normalizeValue = () => {
    if (fieldDef?.type === 'date') {
      const normalized = normalizeDateValue(rawValue, fieldDef.formatConfig);
      if (normalized !== rawValue) {
        // Clear display metadata so resolveDisplayValue can resolve fresh value
        updateAttributes({
          value: normalized,
          displayValue: null,
          startContent: null,
          endContent: null,
        });
      }
    } else if (fieldDef?.type === 'datetime') {
      const allowDateOnly = !fieldDef.timeRequired;
      const normalized = normalizeDateTimeValue(rawValue, fieldDef.formatConfig, allowDateOnly);
      if (normalized !== rawValue) {
        // Clear display metadata so resolveDisplayValue can resolve fresh value
        updateAttributes({
          value: normalized,
          displayValue: null,
          startContent: null,
          endContent: null,
        });
      }
    }
  };

  // Normalize, confirm, close picker, and exit token on confirm (Enter/Space)
  const handleConfirm = () => {
    normalizeValue();

    const pos = getPos();
    if (typeof pos !== 'number') return;

    // Close picker/suggestion and commit token in single transaction
    const tr = editor.state.tr;
    closeSuggestion(tr);

    // Commit token (confirm + immutable + validation)
    commitFilterToken({
      tr,
      pos,
      fieldDef,
      validate: fieldDef?.validate,
    });

    tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);
    exitToken();
  };

  // Date/datetime fields need special handling for normalization and display
  const isDateOrDateTime = fieldDef?.type === 'date' || fieldDef?.type === 'datetime';

  // For date/datetime fields: show rawValue when editing, displayFormat when confirmed
  // For other fields: always show label-based display (user edits "有効", not "active")
  const effectiveValue = isDateOrDateTime && tokenFocused ? rawValue : valueDisplayString;

  // allowSpaces: check current input text from inputRef for real-time quote detection
  // This allows users to type quotes and then input spaces
  const currentInputText = inputRef.current?.value ?? valueDisplayString;
  const allowSpaces = baseAllowSpaces || isInsideQuotes(currentInputText);

  // Event-driven value suggestions management
  // Pass inputRef so the hook can get current input text for filtering
  const { handleValueInputFocus, handleValueInputBlur: baseSuggestionBlur } = useValueSuggestions({
    editor,
    getPos,
    inputRef,
    fieldKey,
    fieldDef,
    value: rawValue,
    valueDisplay: valueDisplayString,
    enabled: !valueSuggestionsDisabled,
  });

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
    z: {
      handler: (e: React.KeyboardEvent) => {
        if (e.nativeEvent.isComposing) return false;
        if (currentFocusId !== 'value') return false;
        if (rawValue !== '') return false;
        return handleUndoKeyDown(e);
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
        if (activeIndex >= 0 && activeIndex < items.length) {
          const selectedItem = items[activeIndex];
          const selectedValue = selectedItem ? getEnumValue(selectedItem) : '';
          // Clear custom display metadata so resolveDisplayValue can resolve from enumValues
          updateAttributes({
            value: selectedValue,
            displayValue: null,
            startContent: null,
            endContent: null,
            invalid: false,
          });
        }
        const tr = editor.state.tr;
        closeSuggestion(tr);
        tr.setMeta('addToHistory', false);
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
      onChange={onChange}
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
