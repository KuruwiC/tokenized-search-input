import type { TokenizedSearchInputRef } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type { FieldDefinition, QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import {
  createRule,
  MaxCount,
  RequireEnum,
  RequirePattern,
  Unique,
} from '@kuruwic/tokenized-search-input/utils';
import type { Story } from '@ladle/react';
import { Flag, Tag, User } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ENUM_STATUS_FIELD, ResultDisplay, TAG_FIELD, USER_FIELD } from './_shared';

// ============================================================================
// Types for Interactive Story
// ============================================================================

type PresetType = 'unique' | 'maxCount' | 'pattern' | 'enumValue';
type UniqueConstraintType = 'key' | 'key-operator' | 'exact';
type UniqueStrategyType = 'mark' | 'reject' | 'replace';
type MaxCountStrategyType = 'mark' | 'reject';
type PatternStrategyType = 'mark' | 'reject';
type EnumValueStrategyType = 'mark' | 'reject';

interface ValidationLogEntry {
  id: string;
  timestamp: string;
  action: 'CHANGE' | 'DELETE' | 'MARK' | 'CLEAR';
  tokenInfo: string;
  rule?: string;
}

interface TokenDisplayInfo {
  id: string;
  key: string;
  operator: string;
  value: string;
  type: 'filter' | 'freeText';
  invalid?: boolean;
}

// ============================================================================
// Field Definitions for Interactive Story
// ============================================================================

const createFieldsWithOperatorVisibility = (showOperator: boolean): FieldDefinition[] => [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ],
    icon: <Tag className="w-full h-full" />,
    tokenLabelDisplay: 'auto',
    hideSingleOperator: !showOperator,
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'enum',
    operators: ['is', 'gt', 'lt'],
    enumValues: [
      { value: 'critical', label: 'Critical' },
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ],
    icon: <Flag className="w-full h-full" />,
    tokenLabelDisplay: 'auto',
    hideSingleOperator: !showOperator,
  },
  {
    key: 'user',
    label: 'User',
    type: 'string',
    operators: ['is', 'contains'],
    icon: <User className="w-full h-full" />,
    tokenLabelDisplay: 'auto',
    hideSingleOperator: !showOperator,
  },
];

// ============================================================================
// Utility Functions for Interactive Story
// ============================================================================

const formatTimestamp = (): string => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
};

const extractTokens = (snapshot: QuerySnapshot | null): TokenDisplayInfo[] => {
  if (!snapshot) return [];

  return snapshot.segments
    .filter(
      (seg): seg is typeof seg & { id: string } => seg.type === 'filter' || seg.type === 'freeText'
    )
    .map((token) => ({
      id: token.id,
      key: 'key' in token ? token.key : '',
      operator: 'operator' in token ? token.operator : '',
      value: token.value,
      type: token.type === 'freeText' ? 'freeText' : 'filter',
      invalid: 'invalid' in token ? (token.invalid as boolean) : undefined,
    }));
};

// ============================================================================
// Sub-components for Interactive Story
// ============================================================================

interface TokenListProps {
  tokens: TokenDisplayInfo[];
  previousTokenIds: Set<string>;
}

const TokenList = ({ tokens, previousTokenIds }: TokenListProps) => (
  <div className="p-3 bg-gray-50 rounded">
    <h4 className="text-sm font-medium text-gray-700 mb-2">Current Tokens ({tokens.length})</h4>
    {tokens.length === 0 ? (
      <p className="text-xs text-gray-400">No tokens</p>
    ) : (
      <div className="space-y-1">
        {tokens.map((token, index) => {
          const isNew = !previousTokenIds.has(token.id);
          const displayText =
            token.type === 'freeText'
              ? `"${token.value}"`
              : `${token.key}:${token.operator}:${token.value}`;

          return (
            <div
              key={token.id}
              className={`flex items-center gap-2 text-xs p-2 rounded ${
                token.invalid
                  ? 'bg-red-100 border border-red-300'
                  : 'bg-white border border-gray-200'
              }`}
            >
              <span className="text-gray-400">#{index + 1}</span>
              <code className="font-mono flex-1">{displayText}</code>
              <span className="text-gray-400 text-[10px]">id:{token.id.slice(0, 8)}</span>
              {isNew && (
                <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-[10px]">
                  NEW
                </span>
              )}
              {token.invalid && (
                <span className="px-1 py-0.5 bg-red-100 text-red-700 rounded text-[10px]">
                  INVALID
                </span>
              )}
            </div>
          );
        })}
      </div>
    )}
  </div>
);

interface ValidationLogProps {
  entries: ValidationLogEntry[];
  onClear: () => void;
}

const ValidationLog = ({ entries, onClear }: ValidationLogProps) => (
  <div className="p-3 bg-gray-50 rounded">
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-sm font-medium text-gray-700">Validation Log</h4>
      {entries.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="px-2 py-0.5 text-xs bg-gray-200 hover:bg-gray-300 rounded"
        >
          Clear
        </button>
      )}
    </div>
    {entries.length === 0 ? (
      <p className="text-xs text-gray-400">No events yet</p>
    ) : (
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {entries.map((entry) => {
          const colorMap: Record<string, string> = {
            DELETE: 'text-red-600',
            MARK: 'text-yellow-600',
            CHANGE: 'text-blue-600',
            CLEAR: 'text-gray-600',
          };
          return (
            <div key={entry.id} className="flex gap-2 text-xs font-mono">
              <span className="text-gray-400">[{entry.timestamp}]</span>
              <span className={colorMap[entry.action] || 'text-gray-700'}>{entry.action}</span>
              <span className="text-gray-700">{entry.tokenInfo}</span>
              {entry.rule && <span className="text-gray-400">by {entry.rule}</span>}
            </div>
          );
        })}
      </div>
    )}
  </div>
);

interface PresetControlsProps {
  preset: PresetType;
  setPreset: (p: PresetType) => void;
  constraint: UniqueConstraintType;
  setConstraint: (c: UniqueConstraintType) => void;
  uniqueStrategy: UniqueStrategyType;
  setUniqueStrategy: (s: UniqueStrategyType) => void;
  maxCountStrategy: MaxCountStrategyType;
  setMaxCountStrategy: (s: MaxCountStrategyType) => void;
  maxCount: number;
  setMaxCount: (n: number) => void;
  patternStrategy: PatternStrategyType;
  setPatternStrategy: (s: PatternStrategyType) => void;
  enumValueStrategy: EnumValueStrategyType;
  setEnumValueStrategy: (s: EnumValueStrategyType) => void;
  showOperator: boolean;
  setShowOperator: (b: boolean) => void;
}

const PresetControls = ({
  preset,
  setPreset,
  constraint,
  setConstraint,
  uniqueStrategy,
  setUniqueStrategy,
  maxCountStrategy,
  setMaxCountStrategy,
  maxCount,
  setMaxCount,
  patternStrategy,
  setPatternStrategy,
  enumValueStrategy,
  setEnumValueStrategy,
  showOperator,
  setShowOperator,
}: PresetControlsProps) => (
  <div className="p-3 bg-blue-50 rounded space-y-3">
    <h4 className="text-sm font-medium text-blue-800">Controls</h4>

    <div className="grid grid-cols-2 gap-3">
      <div>
        <label htmlFor="validation-preset" className="block text-xs text-gray-600 mb-1">
          Preset
        </label>
        <select
          id="validation-preset"
          value={preset}
          onChange={(e) => setPreset(e.target.value as PresetType)}
          className="w-full px-2 py-1 text-sm border rounded"
        >
          <option value="unique">unique</option>
          <option value="maxCount">maxCount</option>
          <option value="pattern">pattern</option>
          <option value="enumValue">enumValue</option>
        </select>
      </div>

      <div>
        <label htmlFor="validation-show-operator" className="block text-xs text-gray-600 mb-1">
          Show Operator
        </label>
        <button
          id="validation-show-operator"
          type="button"
          onClick={() => setShowOperator(!showOperator)}
          className={`w-full px-2 py-1 text-sm border rounded ${
            showOperator ? 'bg-green-100 border-green-300' : 'bg-gray-100'
          }`}
        >
          {showOperator ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>

    {preset === 'unique' && (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="validation-constraint" className="block text-xs text-gray-600 mb-1">
            Constraint
          </label>
          <select
            id="validation-constraint"
            value={constraint}
            onChange={(e) => setConstraint(e.target.value as UniqueConstraintType)}
            className="w-full px-2 py-1 text-sm border rounded"
          >
            <option value="key">key</option>
            <option value="key-operator">key-operator</option>
            <option value="exact">exact</option>
          </select>
        </div>
        <div>
          <label htmlFor="validation-unique-strategy" className="block text-xs text-gray-600 mb-1">
            Strategy
          </label>
          <select
            id="validation-unique-strategy"
            value={uniqueStrategy}
            onChange={(e) => setUniqueStrategy(e.target.value as UniqueStrategyType)}
            className="w-full px-2 py-1 text-sm border rounded"
          >
            <option value="mark">mark</option>
            <option value="reject">reject</option>
            <option value="replace">replace</option>
          </select>
        </div>
      </div>
    )}

    {preset === 'maxCount' && (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="validation-max-count" className="block text-xs text-gray-600 mb-1">
            Max Count
          </label>
          <input
            id="validation-max-count"
            type="number"
            value={maxCount}
            onChange={(e) => setMaxCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
            min={1}
            className="w-full px-2 py-1 text-sm border rounded"
          />
        </div>
        <div>
          <label
            htmlFor="validation-maxcount-strategy"
            className="block text-xs text-gray-600 mb-1"
          >
            Strategy
          </label>
          <select
            id="validation-maxcount-strategy"
            value={maxCountStrategy}
            onChange={(e) => setMaxCountStrategy(e.target.value as MaxCountStrategyType)}
            className="w-full px-2 py-1 text-sm border rounded"
          >
            <option value="mark">mark</option>
            <option value="reject">reject</option>
          </select>
        </div>
      </div>
    )}

    {preset === 'pattern' && (
      <div className="grid grid-cols-2 gap-3">
        <div className="text-xs text-gray-500 flex items-center">
          Pattern: <code className="ml-1">/^[a-z0-9]+$/i</code> for user field
        </div>
        <div>
          <label htmlFor="validation-pattern-strategy" className="block text-xs text-gray-600 mb-1">
            Strategy
          </label>
          <select
            id="validation-pattern-strategy"
            value={patternStrategy}
            onChange={(e) => setPatternStrategy(e.target.value as PatternStrategyType)}
            className="w-full px-2 py-1 text-sm border rounded"
          >
            <option value="mark">mark</option>
            <option value="reject">reject</option>
          </select>
        </div>
      </div>
    )}

    {preset === 'enumValue' && (
      <div className="grid grid-cols-2 gap-3">
        <div className="text-xs text-gray-500 flex items-center">
          Validates enum values against defined options
        </div>
        <div>
          <label
            htmlFor="validation-enumvalue-strategy"
            className="block text-xs text-gray-600 mb-1"
          >
            Strategy
          </label>
          <select
            id="validation-enumvalue-strategy"
            value={enumValueStrategy}
            onChange={(e) => setEnumValueStrategy(e.target.value as EnumValueStrategyType)}
            className="w-full px-2 py-1 text-sm border rounded"
          >
            <option value="mark">mark</option>
            <option value="reject">reject</option>
          </select>
        </div>
      </div>
    )}
  </div>
);

// ============================================================================
// Basic Demo Stories
// ============================================================================

export const UniqueConstraint: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Unique Constraint</h3>
      <p className="text-sm text-gray-600 mb-4">
        Prevents duplicate tokens. Try adding the same tag twice.
      </p>
      <TokenizedSearchInput
        fields={[TAG_FIELD]}
        onSubmit={setResult}
        placeholder="Add tags (duplicates are prevented)..."
        validation={{ rules: [Unique.rule('exact')] }}
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800">
        <strong>Constraint types:</strong>
        <ul className="mt-1 list-disc list-inside">
          <li>
            <code>exact</code> - Same key + operator + value
          </li>
          <li>
            <code>key</code> - Same key only
          </li>
          <li>
            <code>key-operator</code> - Same key + operator
          </li>
        </ul>
      </div>
    </div>
  );
};

export const MaxTokenCount: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Max Count</h3>
      <p className="text-sm text-gray-600 mb-4">
        Maximum 3 tokens allowed. Additional tokens will be marked as invalid.
      </p>
      <TokenizedSearchInput
        fields={[TAG_FIELD]}
        onSubmit={setResult}
        placeholder="Add up to 3 tags..."
        validation={{ rules: [MaxCount.rule('*', 3)] }}
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-yellow-50 rounded text-xs text-yellow-800">
        <strong>Note:</strong> Use <code>'*'</code> for all fields, or specify a field key like{' '}
        <code>'tag'</code>.
      </div>
    </div>
  );
};

export const PatternValidation: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Pattern Validation</h3>
      <p className="text-sm text-gray-600 mb-4">
        Only alphanumeric characters are allowed. Try adding special characters.
      </p>
      <TokenizedSearchInput
        fields={[USER_FIELD]}
        onSubmit={setResult}
        placeholder="Enter alphanumeric usernames..."
        validation={{
          rules: [
            RequirePattern.rule('user', /^[a-z0-9]+$/i, undefined, {
              message: 'Only alphanumeric characters allowed',
            }),
          ],
        }}
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export const EnumValue: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Enum Validation</h3>
      <p className="text-sm text-gray-600 mb-4">
        Values must match one of the defined enum values. Invalid values are marked.
      </p>
      <TokenizedSearchInput
        fields={[ENUM_STATUS_FIELD]}
        defaultValue="status:is:active status:is:invalid"
        onSubmit={setResult}
        placeholder="Only valid enum values..."
        validation={{
          rules: [RequireEnum.rule()],
        }}
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-red-50 rounded text-xs text-red-800">
        <strong>Note:</strong> "invalid" is marked as an error because it's not a valid status.
      </div>
    </div>
  );
};

export const CustomRules: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Custom Validation Rules</h3>
      <p className="text-sm text-gray-600 mb-4">
        Create custom validation logic. This example requires tags to be at least 3 characters.
      </p>
      <TokenizedSearchInput
        fields={[TAG_FIELD]}
        onSubmit={setResult}
        placeholder="Tags must be 3+ characters..."
        validation={{
          rules: [
            createRule((token) => {
              if (token.key === 'tag' && token.value.length < 3) {
                return 'Tag must be at least 3 characters';
              }
              return null;
            }),
          ],
        }}
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export const Combined: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Combined Rules</h3>
      <p className="text-sm text-gray-600 mb-4">
        Multiple validation rules work together: unique + max 5 tokens.
      </p>
      <TokenizedSearchInput
        fields={[TAG_FIELD]}
        onSubmit={setResult}
        placeholder="Add unique tags (max 5)..."
        validation={{
          rules: [Unique.rule('exact'), MaxCount.rule('*', 5)],
        }}
      />
      <ResultDisplay result={result} />
    </div>
  );
};

// ============================================================================
// Interactive Story
// ============================================================================

export const Interactive: Story = () => {
  const inputRef = useRef<TokenizedSearchInputRef>(null);

  const [preset, setPreset] = useState<PresetType>('unique');
  const [constraint, setConstraint] = useState<UniqueConstraintType>('key');
  const [uniqueStrategy, setUniqueStrategy] = useState<UniqueStrategyType>('mark');
  const [maxCountStrategy, setMaxCountStrategy] = useState<MaxCountStrategyType>('mark');
  const [maxCount, setMaxCount] = useState(3);
  const [patternStrategy, setPatternStrategy] = useState<PatternStrategyType>('mark');
  const [enumValueStrategy, setEnumValueStrategy] = useState<EnumValueStrategyType>('mark');
  const [showOperator, setShowOperator] = useState(true);

  const [currentSnapshot, setCurrentSnapshot] = useState<QuerySnapshot | null>(null);
  const [previousTokenIds, setPreviousTokenIds] = useState<Set<string>>(new Set());
  const [logEntries, setLogEntries] = useState<ValidationLogEntry[]>([]);

  const fields = useMemo(() => createFieldsWithOperatorVisibility(showOperator), [showOperator]);

  const validationRules = useMemo(() => {
    const strategyMap = {
      mark: Unique.mark,
      reject: Unique.reject,
      replace: Unique.replace,
    };

    const maxCountStrategyMap = {
      mark: MaxCount.mark,
      reject: MaxCount.reject,
    };

    const patternStrategyMap = {
      mark: RequirePattern.mark,
      reject: RequirePattern.reject,
    };

    const enumValueStrategyMap = {
      mark: RequireEnum.mark,
      reject: RequireEnum.reject,
    };

    const ruleBuilders: Record<PresetType, () => ReturnType<typeof Unique.rule>[]> = {
      unique: () => [Unique.rule(constraint, strategyMap[uniqueStrategy])],
      maxCount: () => [MaxCount.rule('*', maxCount, maxCountStrategyMap[maxCountStrategy])],
      pattern: () => [
        RequirePattern.rule('user', /^[a-z0-9]+$/i, patternStrategyMap[patternStrategy]),
      ],
      enumValue: () => [RequireEnum.rule(enumValueStrategyMap[enumValueStrategy])],
    };

    return ruleBuilders[preset]();
  }, [
    preset,
    constraint,
    uniqueStrategy,
    maxCountStrategy,
    maxCount,
    patternStrategy,
    enumValueStrategy,
  ]);

  const handleChange = useCallback(
    (snapshot: QuerySnapshot) => {
      const currentTokens = extractTokens(snapshot);
      const previousTokens = extractTokens(currentSnapshot);

      const currentIds = new Set(currentTokens.map((t) => t.id));
      const deletedTokens = previousTokens.filter((t) => !currentIds.has(t.id));

      const previousInvalid = new Set(previousTokens.filter((t) => t.invalid).map((t) => t.id));
      const newlyMarked = currentTokens.filter((t) => t.invalid && !previousInvalid.has(t.id));

      const newEntries: ValidationLogEntry[] = [];

      deletedTokens.forEach((token) => {
        const displayText =
          token.type === 'freeText'
            ? `"${token.value}"`
            : `${token.key}:${token.operator}:${token.value}`;
        const strategyName =
          preset === 'unique'
            ? uniqueStrategy
            : preset === 'maxCount'
              ? maxCountStrategy
              : preset === 'pattern'
                ? patternStrategy
                : enumValueStrategy;
        newEntries.push({
          id: `${Date.now()}-${token.id}`,
          timestamp: formatTimestamp(),
          action: 'DELETE',
          tokenInfo: displayText,
          rule: `${preset}.${strategyName}`,
        });
      });

      newlyMarked.forEach((token) => {
        const displayText =
          token.type === 'freeText'
            ? `"${token.value}"`
            : `${token.key}:${token.operator}:${token.value}`;
        newEntries.push({
          id: `${Date.now()}-${token.id}`,
          timestamp: formatTimestamp(),
          action: 'MARK',
          tokenInfo: displayText,
          rule: `${preset}.mark`,
        });
      });

      if (newEntries.length > 0) {
        setLogEntries((prev) => [...newEntries, ...prev].slice(0, 50));
      }

      setPreviousTokenIds(new Set(currentTokens.map((t) => t.id)));
      setCurrentSnapshot(snapshot);
    },
    [currentSnapshot, preset, uniqueStrategy, maxCountStrategy, patternStrategy, enumValueStrategy]
  );

  const clearLog = useCallback(() => setLogEntries([]), []);

  const currentTokens = useMemo(() => extractTokens(currentSnapshot), [currentSnapshot]);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-lg font-bold mb-1">Interactive Validation</h2>
        <p className="text-sm text-gray-600">
          Explore validation behavior with detailed token tracking and event logging.
        </p>
      </div>

      <PresetControls
        preset={preset}
        setPreset={setPreset}
        constraint={constraint}
        setConstraint={setConstraint}
        uniqueStrategy={uniqueStrategy}
        setUniqueStrategy={setUniqueStrategy}
        maxCountStrategy={maxCountStrategy}
        setMaxCountStrategy={setMaxCountStrategy}
        maxCount={maxCount}
        setMaxCount={setMaxCount}
        patternStrategy={patternStrategy}
        setPatternStrategy={setPatternStrategy}
        enumValueStrategy={enumValueStrategy}
        setEnumValueStrategy={setEnumValueStrategy}
        showOperator={showOperator}
        setShowOperator={setShowOperator}
      />

      <div className="p-3 bg-white border-2 border-blue-200 rounded">
        <TokenizedSearchInput
          ref={inputRef}
          fields={fields}
          onChange={handleChange}
          placeholder="Add tokens to test validation..."
          validation={{ rules: validationRules }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TokenList tokens={currentTokens} previousTokenIds={previousTokenIds} />
        <ValidationLog entries={logEntries} onClear={clearLog} />
      </div>

      <div className="p-3 bg-gray-100 rounded">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Current Configuration</h4>
        <pre className="text-xs font-mono bg-white p-2 rounded overflow-auto">
          {JSON.stringify(
            {
              preset,
              ...(preset === 'unique' && { constraint, strategy: uniqueStrategy }),
              ...(preset === 'maxCount' && { max: maxCount, strategy: maxCountStrategy }),
              ...(preset === 'pattern' && { strategy: patternStrategy }),
              ...(preset === 'enumValue' && { strategy: enumValueStrategy }),
              showOperator,
            },
            null,
            2
          )}
        </pre>
      </div>
    </div>
  );
};

export default {
  title: 'Features / Validation',
};
