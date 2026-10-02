import type { QuerySnapshot, TokenizedSearchInputRef } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import { useMemo, useRef, useState } from 'react';
import { Snapshot } from '../components';
import { createSearchFields } from '../fields';

function SearchWorkbench() {
  const fields = useMemo(createSearchFields, []);
  const inputRef = useRef<TokenizedSearchInputRef>(null);
  const [snapshot, setSnapshot] = useState<QuerySnapshot | null>(null);
  const examples = [
    ['Open work', 'status:is:active priority:is_not:low'],
    ['Recent bugs', 'title:contains:"bug report" created:gt:2026-01-01'],
    ['Updated today', 'updated:gt:2026-09-05T00:00'],
  ] as const;
  const load = (query: string) => {
    inputRef.current?.setValue(query);
    setSnapshot(inputRef.current?.getSnapshot() ?? null);
    inputRef.current?.focus();
  };
  return (
    <div className="workbench-grid">
      <div className="workbench-input">
        <h2 id="playground-title">Build a filter and inspect its typed output.</h2>
        <p>Pick a field, choose its operator, then enter a value. Every token remains editable.</p>
        <div className="demo-surface focus-surface">
          <TokenizedSearchInput
            ref={inputRef}
            fields={fields}
            onChange={setSnapshot}
            onSubmit={setSnapshot}
            placeholder="Start with status:, priority:, title:…"
            clearable
          />
        </div>
        <fieldset className="example-queries">
          <legend className="sr-only">Example queries</legend>
          {examples.map(([label, query]) => (
            <button type="button" key={label} onClick={() => load(query)}>
              <span>{label}</span>
              <code>{query}</code>
            </button>
          ))}
        </fieldset>
        <p className="keyboard-note">
          <kbd>↑</kbd>
          <kbd>↓</kbd> suggestions · <kbd>Enter</kbd> select · <kbd>Backspace</kbd> edit
        </p>
      </div>
      <Snapshot value={snapshot} empty="The parsed query will appear here as you type." />
    </div>
  );
}

export function PlaygroundSection() {
  return (
    <section
      className="section workbench-section"
      id="playground"
      aria-labelledby="playground-title"
    >
      <SearchWorkbench />
    </section>
  );
}
