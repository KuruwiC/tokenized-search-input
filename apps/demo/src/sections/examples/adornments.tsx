import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import { Mic, Search, Sliders, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createSearchFields } from '../../fields';
import { ExampleDetails, VariantSwitch } from './example';

type LayoutId = 'start' | 'end' | 'both' | 'wrap' | 'single-line' | 'expand' | 'interactive';

const LAYOUTS: Array<{ id: LayoutId; label: string }> = [
  { id: 'start', label: 'Start' },
  { id: 'end', label: 'End' },
  { id: 'both', label: 'Both' },
  { id: 'wrap', label: 'Wrapping tokens' },
  { id: 'single-line', label: 'Single line' },
  { id: 'expand', label: 'Expand on focus' },
  { id: 'interactive', label: 'Interactive' },
];

const MANY_TOKENS = 'status:is:active priority:is:high status:is:pending priority:is:medium';

export function AdornmentsExample() {
  const [layout, setLayout] = useState<LayoutId>('both');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const fields = useMemo(createSearchFields, []);
  const toggle = (
    <button
      type="button"
      onClick={() => setFiltersOpen((open) => !open)}
      aria-label="Toggle filters"
      aria-pressed={filtersOpen}
    >
      {filtersOpen ? <X /> : <Sliders />}
    </button>
  );
  return (
    <ExampleDetails
      title="Adornments"
      summary="Fixed icons or controls at the edges of the input; they stay put as tokens wrap."
    >
      <VariantSwitch legend="Layout" options={LAYOUTS} value={layout} onChange={setLayout} />
      <div className="demo-surface">
        <div className={layout === 'wrap' ? 'max-w-md' : undefined}>
          <TokenizedSearchInput
            key={layout}
            fields={fields}
            startAdornment={layout === 'end' ? undefined : <Search />}
            endAdornment={
              layout === 'start' ? undefined : layout === 'both' ? (
                <Mic />
              ) : layout === 'interactive' ? (
                toggle
              ) : (
                <Sliders />
              )
            }
            defaultValue={layout === 'wrap' ? MANY_TOKENS : 'status:is:active'}
            singleLine={layout === 'single-line'}
            expandOnFocus={layout === 'expand'}
            placeholder="Search…"
            clearable
          />
        </div>
      </div>
      {layout === 'interactive' && filtersOpen ? (
        <p className="example-note">Filter panel is open. Press the button again to close it.</p>
      ) : (
        <p className="example-note">
          The end adornment sits before the clear button. Wrap a control in a button, as in the
          Interactive layout, to make it clickable.
        </p>
      )}
    </ExampleDetails>
  );
}
