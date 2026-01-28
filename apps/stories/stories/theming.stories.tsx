import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type { QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import type { Story } from '@ladle/react';
import { useState } from 'react';
import { BASIC_FIELDS } from './_shared';
import { InfoBox, ResultDisplay } from './_shared/components';

export const CSSVariables: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">CSS Variables</h3>
        <p className="text-sm text-gray-600 mb-4">
          All visual aspects can be customized via CSS custom properties. Override at the container
          level or globally at :root.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Default Theme</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active"
          onSubmit={setResult}
          placeholder="Default styling..."
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Custom Colors</h4>
        <div
          style={
            {
              '--tsi-primary': 'hsl(262, 83%, 58%)',
              '--tsi-primary-muted': 'hsl(262, 83%, 95%)',
              '--tsi-primary-muted-foreground': 'hsl(262, 83%, 40%)',
              '--tsi-border-focus': 'hsl(262, 83%, 58%)',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            defaultValue="status:is:pending"
            onSubmit={setResult}
            placeholder="Purple theme..."
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Custom Size</h4>
        <div
          style={
            {
              '--tsi-font-size': '0.875rem',
              '--tsi-token-size': '1.25rem',
              '--tsi-token-font-size': '0.875rem',
              '--tsi-padding-x': '0.5rem',
              '--tsi-padding-y': '0.375rem',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            defaultValue="status:is:active priority:is:high"
            onSubmit={setResult}
            placeholder="Compact size..."
          />
        </div>
      </div>

      <ResultDisplay result={result} />

      <InfoBox variant="info">
        <strong>Available CSS Variables:</strong>
        <pre className="mt-2 text-xs overflow-x-auto">
          {`--tsi-font-size
--tsi-padding-x / --tsi-padding-y
--tsi-token-size / --tsi-token-font-size
--tsi-radius / --tsi-radius-inner
--tsi-border-width
--tsi-background / --tsi-foreground
--tsi-primary / --tsi-primary-muted
--tsi-border / --tsi-border-hover / --tsi-border-focus
--tsi-destructive / --tsi-destructive-muted`}
        </pre>
      </InfoBox>
    </div>
  );
};

export const DarkMode: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  const [isDark, setIsDark] = useState(false);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Dark Mode</h3>
        <p className="text-sm text-gray-600 mb-4">
          Dark mode is automatically applied when a parent element has the <code>.dark</code> class
          or <code>data-theme="dark"</code> attribute.
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setIsDark(false)}
          className={`px-3 py-1.5 text-sm rounded ${
            !isDark ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-900'
          }`}
        >
          Light
        </button>
        <button
          type="button"
          onClick={() => setIsDark(true)}
          className={`px-3 py-1.5 text-sm rounded ${
            isDark ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-900'
          }`}
        >
          Dark
        </button>
      </div>

      <div className={`p-4 rounded-lg ${isDark ? 'dark bg-neutral-950' : 'bg-white border'}`}>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active priority:is:high"
          onSubmit={setResult}
          placeholder="Search..."
        />
      </div>

      <ResultDisplay result={result} />

      <InfoBox variant="info">
        <strong>Usage:</strong> Add <code>.dark</code> class or <code>data-theme="dark"</code> to
        any parent element.
      </InfoBox>
    </div>
  );
};

export const CustomClassNames: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Custom Class Names</h3>
        <p className="text-sm text-gray-600 mb-4">
          Use the <code>classNames</code> prop to add custom classes to specific parts of the
          component. This provides fine-grained control over styling without CSS specificity issues.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Root & Input Styling</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active"
          onSubmit={setResult}
          placeholder="Custom styled input..."
          classNames={{
            root: 'shadow-lg',
            input: 'bg-slate-50',
          }}
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Token Styling</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:pending priority:is:high"
          onSubmit={setResult}
          placeholder="Custom token styles..."
          classNames={{
            token: 'bg-indigo-100 border-indigo-300',
            tokenLabel: 'text-indigo-700 font-semibold',
            tokenValue: 'text-indigo-900',
          }}
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Dropdown Styling</h4>
        <p className="text-sm text-gray-500 mb-2">Type to see custom dropdown styles</p>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          onSubmit={setResult}
          placeholder="Type to see dropdown..."
          classNames={{
            dropdown: 'shadow-2xl border-2 border-purple-200',
            suggestionItem: 'hover:bg-purple-50',
          }}
        />
      </div>

      <ResultDisplay result={result} />

      <InfoBox variant="info">
        <strong>Available Slots:</strong>
        <pre className="mt-2 text-xs overflow-x-auto">
          {`// Root-level
root, input, placeholder, clearButton

// Token parts
token, tokenLabel, tokenOperator,
tokenValue, tokenDeleteButton

// Dropdown
dropdown, suggestionItem, fieldCategory`}
        </pre>
        <p className="mt-3 text-xs">
          <strong>Tailwind v4:</strong> Component styles use <code>:where()</code> for zero
          specificity, so Tailwind utilities override defaults automatically:
        </p>
        <pre className="mt-1 text-xs overflow-x-auto">
          {`@import "tailwindcss";
@import "@kuruwic/tokenized-search-input/styles";`}
        </pre>
      </InfoBox>
    </div>
  );
};

export const FocusRing: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Focus Ring</h3>
        <p className="text-sm text-gray-600 mb-4">
          Focus ring is disabled by default. Enable it via CSS variables for better accessibility.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Default (No Ring)</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          onSubmit={setResult}
          placeholder="Focus me - no ring..."
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">With Focus Ring</h4>
        <div
          style={
            {
              '--tsi-ring-width': '2px',
              '--tsi-ring-color': 'hsl(221, 83%, 53%)',
              '--tsi-ring-offset': '2px',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            onSubmit={setResult}
            placeholder="Focus me - with ring..."
          />
        </div>
      </div>

      <ResultDisplay result={result} />

      <InfoBox variant="info">
        <strong>Focus Ring Variables:</strong>
        <pre className="mt-2 text-xs">
          {`--tsi-ring-width: 2px;
--tsi-ring-color: hsl(221, 83%, 53%);
--tsi-ring-offset: 2px;
--tsi-ring-offset-color: white;`}
        </pre>
      </InfoBox>
    </div>
  );
};

export default {
  title: 'Customization / Theming',
};
