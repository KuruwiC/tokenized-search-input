import type { TokenizedSearchInputRef } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type { CustomSuggestionConfig } from '@kuruwic/tokenized-search-input/utils';
import { useCallback, useMemo, useRef, useState } from 'react';
import { CodeBlock } from '../../components';
import {
  ALL_COUNTRIES,
  deserializeCountryText,
  matchesCountry,
  serializeCountryToken,
} from '../../countries';
import { countrySuggestion, useCountryResolver } from '../../country-field';
import { COUNTRY_FIELDS } from '../../fields';
import { ExampleDetails, VariantSwitch } from './example';

type ClipboardMode = 'default' | 'serialize' | 'deserialize' | 'both';

const MODES: Array<{ id: ClipboardMode; label: string; description: string; code: string }> = [
  {
    id: 'default',
    label: 'Default',
    description:
      'Copy writes the stored form, country:is:jp. Pasting “Japan, France” finds no field syntax, so nothing is added.',
    code: '<TokenizedSearchInput fields={fields} />',
  },
  {
    id: 'serialize',
    label: 'serializeToken',
    description: 'Select a token and copy: the clipboard holds “Japan” instead of country:is:jp.',
    code: '<TokenizedSearchInput serialization={{ serializeToken }} />',
  },
  {
    id: 'deserialize',
    label: 'deserializeText',
    description: 'Paste “Japan, France” or “jp us”: the text becomes country tokens.',
    code: '<TokenizedSearchInput serialization={{ deserializeText }} />',
  },
  {
    id: 'both',
    label: 'Both',
    description: 'Copy exports names and paste imports them, so a selection round-trips as text.',
    code: '<TokenizedSearchInput serialization={{ serializeToken, deserializeText }} />',
  },
];

function ClipboardInput({ mode }: { mode: ClipboardMode }) {
  const inputRef = useRef<TokenizedSearchInputRef>(null);
  const [clipboardText, setClipboardText] = useState<string | null>(null);
  const { resolveTokens } = useCountryResolver(inputRef);
  const custom = useMemo<CustomSuggestionConfig>(
    () => ({
      displayMode: 'replace',
      suggest: ({ query }) =>
        ALL_COUNTRIES.filter((country) => matchesCountry(country, query.trim()))
          .slice(0, 8)
          .map((country) => countrySuggestion(country, false)),
    }),
    []
  );
  const serialization = {
    ...(mode === 'serialize' || mode === 'both' ? { serializeToken: serializeCountryToken } : {}),
    ...(mode === 'deserialize' || mode === 'both'
      ? { deserializeText: deserializeCountryText }
      : {}),
  };
  const change = useCallback(() => {
    void resolveTokens();
  }, [resolveTokens]);
  const readClipboard = async () => {
    try {
      setClipboardText(await navigator.clipboard.readText());
    } catch {
      setClipboardText(null);
    }
  };
  const copySample = async () => {
    try {
      await navigator.clipboard.writeText('Japan, France');
    } catch {
      // Clipboard writes can be blocked by the browser; the input still gets focus.
    }
    inputRef.current?.focus();
  };
  return (
    <>
      <div className="demo-surface">
        <TokenizedSearchInput
          ref={inputRef}
          fields={COUNTRY_FIELDS}
          defaultValue="country:is:jp country:is:fr"
          freeTextMode="none"
          suggestions={{ field: { disabled: true }, custom }}
          serialization={serialization}
          onChange={change}
          placeholder="Select countries, copy, paste…"
          clearable
        />
      </div>
      <div className="example-actions">
        <button type="button" onClick={copySample}>
          Copy “Japan, France” to the clipboard
        </button>
        <button type="button" onClick={readClipboard}>
          Read the clipboard
        </button>
      </div>
      {clipboardText !== null && (
        <p className="example-result" aria-live="polite">
          Clipboard: <code>{clipboardText || '(empty)'}</code>
        </p>
      )}
    </>
  );
}

export function ClipboardExample() {
  const [modeId, setModeId] = useState<ClipboardMode>('both');
  const mode = MODES.find((item) => item.id === modeId) ?? MODES[0];
  return (
    <ExampleDetails
      title="Clipboard"
      summary="Control the text a copied token becomes and how pasted text is parsed into tokens."
    >
      <VariantSwitch legend="Serialization" options={MODES} value={modeId} onChange={setModeId} />
      <p className="example-note">{mode.description}</p>
      <ClipboardInput key={mode.id} mode={mode.id} />
      <CodeBlock code={mode.code} label={`${mode.id}.tsx`} />
      <p className="example-note">
        Select tokens with the keyboard, copy with Cmd/Ctrl + C, then paste with Cmd/Ctrl + V.
        Reading the clipboard needs the browser’s permission.
      </p>
    </ExampleDetails>
  );
}
