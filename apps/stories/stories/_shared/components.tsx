import type { TokenizedSearchInputRef } from '@kuruwic/tokenized-search-input';
import type { QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import {
  getFilterTokens,
  getFreeTextTokens,
  getPlainText,
} from '@kuruwic/tokenized-search-input/utils';
import type { FC, RefObject } from 'react';
import { useCallback, useState } from 'react';

interface ResultDisplayProps {
  result: QuerySnapshot | null;
  title?: string;
}

export const ResultDisplay: FC<ResultDisplayProps> = ({ result, title = 'Search Result' }) => {
  if (!result) return null;
  return (
    <div className="mt-4 p-3 bg-gray-100 rounded text-sm">
      <p className="text-gray-600 mb-1">{title}:</p>
      <pre className="text-xs overflow-auto max-h-64">{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
};

interface SnapshotViewerProps {
  snapshot: QuerySnapshot | null;
}

export const SnapshotViewer: FC<SnapshotViewerProps> = ({ snapshot }) => {
  if (!snapshot) {
    return (
      <div className="p-3 bg-gray-50 rounded text-sm text-gray-400">No snapshot available</div>
    );
  }

  const filterTokens = getFilterTokens(snapshot);
  const freeTextTokens = getFreeTextTokens(snapshot);
  const plainText = getPlainText(snapshot);

  return (
    <div className="space-y-3">
      <div className="p-3 bg-blue-50 rounded text-sm">
        <p className="text-blue-800 font-medium mb-1">Serialized Text</p>
        <code className="text-xs bg-white px-2 py-1 rounded block overflow-auto">
          {snapshot.text || '(empty)'}
        </code>
      </div>

      {filterTokens.length > 0 && (
        <div className="p-3 bg-green-50 rounded text-sm">
          <p className="text-green-800 font-medium mb-1">Filter Tokens ({filterTokens.length})</p>
          <div className="flex flex-wrap gap-1">
            {filterTokens.map((t) => (
              <span
                key={t.id}
                className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-mono"
              >
                {t.key}:{t.operator}:{t.value}
              </span>
            ))}
          </div>
        </div>
      )}

      {freeTextTokens.length > 0 && (
        <div className="p-3 bg-purple-50 rounded text-sm">
          <p className="text-purple-800 font-medium mb-1">
            Free Text Tokens ({freeTextTokens.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {freeTextTokens.map((t) => (
              <span
                key={t.id}
                className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-mono"
              >
                "{t.value}"
              </span>
            ))}
          </div>
        </div>
      )}

      {plainText && (
        <div className="p-3 bg-yellow-50 rounded text-sm">
          <p className="text-yellow-800 font-medium mb-1">Plain Text</p>
          <code className="text-xs bg-white px-2 py-1 rounded block overflow-auto">
            "{plainText}"
          </code>
        </div>
      )}
    </div>
  );
};

interface RefMethodsPanelProps {
  inputRef: RefObject<TokenizedSearchInputRef | null>;
}

export const RefMethodsPanel: FC<RefMethodsPanelProps> = ({ inputRef }) => {
  const [queryInput, setQueryInput] = useState('');
  const [output, setOutput] = useState<string>('');

  const handleSetValue = useCallback(() => {
    inputRef.current?.setValue(queryInput);
    setOutput(`setValue("${queryInput}") called`);
  }, [inputRef, queryInput]);

  const handleGetValue = useCallback(() => {
    const value = inputRef.current?.getValue() ?? '';
    setOutput(`getValue() = "${value}"`);
  }, [inputRef]);

  const handleGetSnapshot = useCallback(() => {
    const snapshot = inputRef.current?.getSnapshot();
    setOutput(`getSnapshot() = ${JSON.stringify(snapshot, null, 2)}`);
  }, [inputRef]);

  const handleFocus = useCallback(() => {
    inputRef.current?.focus();
    setOutput('focus() called');
  }, [inputRef]);

  const handleClear = useCallback(() => {
    inputRef.current?.clear();
    setOutput('clear() called');
  }, [inputRef]);

  const handleSubmit = useCallback(() => {
    inputRef.current?.submit();
    setOutput('submit() called');
  }, [inputRef]);

  return (
    <div className="p-4 bg-gray-50 rounded-lg space-y-4">
      <h4 className="font-medium text-gray-700">Ref Methods</h4>

      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          placeholder="Query string for setValue"
          className="flex-1 px-3 py-1.5 border rounded text-sm"
        />
        <button
          type="button"
          onClick={handleSetValue}
          className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          setValue
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGetValue}
          className="px-3 py-1.5 bg-gray-200 rounded text-sm hover:bg-gray-300"
        >
          getValue()
        </button>
        <button
          type="button"
          onClick={handleGetSnapshot}
          className="px-3 py-1.5 bg-gray-200 rounded text-sm hover:bg-gray-300"
        >
          getSnapshot()
        </button>
        <button
          type="button"
          onClick={handleFocus}
          className="px-3 py-1.5 bg-gray-200 rounded text-sm hover:bg-gray-300"
        >
          focus()
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="px-3 py-1.5 bg-gray-200 rounded text-sm hover:bg-gray-300"
        >
          clear()
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-3 py-1.5 bg-gray-200 rounded text-sm hover:bg-gray-300"
        >
          submit()
        </button>
      </div>

      {output && (
        <div className="p-3 bg-white rounded border text-xs font-mono overflow-auto max-h-48">
          <pre>{output}</pre>
        </div>
      )}
    </div>
  );
};

interface EventLogProps {
  events: string[];
  onClear?: () => void;
}

export const EventLog: FC<EventLogProps> = ({ events, onClear }) => {
  if (events.length === 0) return null;
  return (
    <div className="mt-4 p-3 bg-gray-100 rounded text-sm">
      <div className="flex items-center justify-between mb-1">
        <p className="text-gray-600 font-medium">Event Log:</p>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="px-2 py-0.5 text-xs bg-gray-200 hover:bg-gray-300 rounded"
          >
            Clear
          </button>
        )}
      </div>
      <ul className="text-xs space-y-1 font-mono max-h-48 overflow-y-auto">
        {events.map((event, i) => (
          <li key={`${i}-${event}`} className="text-gray-700">
            {event}
          </li>
        ))}
      </ul>
    </div>
  );
};

interface InfoBoxProps {
  children: React.ReactNode;
  variant?: 'info' | 'warning' | 'success' | 'error';
}

export const InfoBox: FC<InfoBoxProps> = ({ children, variant = 'info' }) => {
  const styles = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
  };

  return <div className={`mt-3 p-3 rounded border text-xs ${styles[variant]}`}>{children}</div>;
};
