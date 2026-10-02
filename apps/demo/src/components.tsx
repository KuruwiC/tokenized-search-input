import type { TokenizedSearchInputRef } from '@kuruwic/tokenized-search-input';
import type { QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import { Check, Copy } from 'lucide-react';
import { Highlight, type Language, themes } from 'prism-react-renderer';
import { useCallback, useState } from 'react';

type CodeBlockProps = { code: string; label: string; language?: Language; collapsed?: boolean };

export function CodeBlock({ code, label, language = 'tsx', collapsed = false }: CodeBlockProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    window.setTimeout(() => setCopyState('idle'), 1800);
  }, [code]);

  const block = (
    <figure className="code-window">
      <figcaption className="code-toolbar">
        <span>{label}</span>
        <span className="code-language">{language}</span>
        <button type="button" onClick={copy} className="code-copy">
          {copyState === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          <span>
            {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
          </span>
        </button>
        <span className="sr-only" aria-live="polite">
          {copyState === 'copied'
            ? 'Code copied to clipboard'
            : copyState === 'failed'
              ? 'Code could not be copied'
              : ''}
        </span>
      </figcaption>
      <Highlight theme={themes.vsDark} code={code.trim()} language={language}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="code-block">
            <code>
              {tokens.map((line, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Highlighted source lines are immutable and can repeat.
                <span {...getLineProps({ line })} className="code-line" key={`${label}-${index}`}>
                  <span className="line-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="line-content">
                    {line.map((token, tokenIndex) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: Prism tokens have no stable identifier and never reorder.
                      <span {...getTokenProps({ token })} key={`${label}-${index}-${tokenIndex}`} />
                    ))}
                  </span>
                </span>
              ))}
            </code>
          </pre>
        )}
      </Highlight>
    </figure>
  );
  if (!collapsed) return block;
  return (
    <details className="code-details">
      <summary>Inspect the implementation</summary>
      {block}
    </details>
  );
}

export function Snapshot({ value, empty }: { value: QuerySnapshot | null; empty: string }) {
  const displayValue = value
    ? {
        text: value.text,
        segments: value.segments.map((segment) =>
          segment.type === 'filter'
            ? {
                type: segment.type,
                key: segment.key,
                operator: segment.operator,
                value: segment.value,
                ...(segment.invalid ? { invalid: true, reason: segment.invalidReason } : {}),
              }
            : { type: segment.type, value: segment.value }
        ),
      }
    : null;

  return (
    <div className="snapshot" aria-live="polite">
      <div className="snapshot-label">QUERY SNAPSHOT</div>
      {displayValue ? <pre>{JSON.stringify(displayValue, null, 2)}</pre> : <p>{empty}</p>}
    </div>
  );
}

export type DemoPreset = { label: string; value: string };

export function PresetButtons({
  legend,
  presets,
  onSelect,
}: {
  legend: string;
  presets: DemoPreset[];
  onSelect: (value: string) => void;
}) {
  return (
    <fieldset className="demo-presets">
      <legend>{legend}</legend>
      <div>
        {presets.map((preset) => (
          <button type="button" key={preset.label} onClick={() => onSelect(preset.value)}>
            <span>{preset.label}</span>
            <code>{preset.value}</code>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function setDemoValue(
  inputRef: React.RefObject<TokenizedSearchInputRef>,
  value: string,
  setSnapshot: (snapshot: QuerySnapshot) => void
) {
  inputRef.current?.setValue(value);
  const next = inputRef.current?.getSnapshot();
  if (next) setSnapshot(next);
  inputRef.current?.focus();
}
