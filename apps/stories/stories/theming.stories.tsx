import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type { CustomSuggestionConfig, QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import type { Story } from '@ladle/react';
import { useState } from 'react';
import { AVAILABLE_TAGS, BASIC_FIELDS, TAG_FIELD } from './_shared';
import { InfoBox, ResultDisplay } from './_shared/components';

// =============================================================================
// CSS Variables - Theme colors, sizing, spacing
// =============================================================================

export const CSSVariables: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">CSS Variables Overview</h3>
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

      <ResultDisplay result={result} />

      <InfoBox variant="info">
        <strong>Available CSS Variables:</strong>
        <pre className="mt-2 text-xs overflow-x-auto">
          {`// Colors
--tsi-background / --tsi-foreground
--tsi-primary / --tsi-primary-muted / --tsi-primary-muted-foreground
--tsi-muted / --tsi-muted-darker / --tsi-muted-foreground
--tsi-border / --tsi-border-hover / --tsi-border-focus
--tsi-destructive / --tsi-destructive-muted

// Sizing
--tsi-font-size / --tsi-token-font-size
--tsi-token-size / --tsi-token-icon-size
--tsi-padding-x / --tsi-padding-y
--tsi-min-height

// Shape
--tsi-radius / --tsi-radius-inner
--tsi-border-width
--tsi-shadow

// Focus Ring
--tsi-ring-width / --tsi-ring-color
--tsi-ring-offset / --tsi-ring-offset-color`}
        </pre>
      </InfoBox>
    </div>
  );
};

export const ColorThemes: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Color Themes (CSS Variables)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Customize the color scheme by overriding primary, border, and token colors.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Purple</h4>
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
        <h4 className="font-medium">Blue</h4>
        <div
          style={
            {
              '--tsi-primary': 'hsl(221, 83%, 53%)',
              '--tsi-primary-muted': 'hsl(221, 83%, 95%)',
              '--tsi-primary-muted-foreground': 'hsl(221, 83%, 35%)',
              '--tsi-border-focus': 'hsl(221, 83%, 53%)',
              '--tsi-muted': 'hsl(221, 40%, 96%)',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            defaultValue="status:is:active"
            onSubmit={setResult}
            placeholder="Blue theme..."
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Green</h4>
        <div
          style={
            {
              '--tsi-primary': 'hsl(142, 76%, 36%)',
              '--tsi-primary-muted': 'hsl(142, 76%, 95%)',
              '--tsi-primary-muted-foreground': 'hsl(142, 76%, 25%)',
              '--tsi-border-focus': 'hsl(142, 76%, 36%)',
              '--tsi-muted': 'hsl(142, 40%, 96%)',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            defaultValue="priority:is:high"
            onSubmit={setResult}
            placeholder="Green theme..."
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Orange</h4>
        <div
          style={
            {
              '--tsi-primary': 'hsl(24, 95%, 50%)',
              '--tsi-primary-muted': 'hsl(24, 95%, 95%)',
              '--tsi-primary-muted-foreground': 'hsl(24, 95%, 35%)',
              '--tsi-border-focus': 'hsl(24, 95%, 50%)',
              '--tsi-muted': 'hsl(24, 50%, 96%)',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            defaultValue="status:is:pending"
            onSubmit={setResult}
            placeholder="Orange theme..."
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Rose</h4>
        <div
          style={
            {
              '--tsi-primary': 'hsl(346, 77%, 50%)',
              '--tsi-primary-muted': 'hsl(346, 77%, 95%)',
              '--tsi-primary-muted-foreground': 'hsl(346, 77%, 35%)',
              '--tsi-border-focus': 'hsl(346, 77%, 50%)',
              '--tsi-muted': 'hsl(346, 40%, 96%)',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            defaultValue="priority:is:medium"
            onSubmit={setResult}
            placeholder="Rose theme..."
          />
        </div>
      </div>

      <ResultDisplay result={result} />
    </div>
  );
};

export const SizePresets: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Size Presets (CSS Variables)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Adjust size-related variables to create compact, default, or large variants.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Compact</h4>
        <div
          style={
            {
              '--tsi-font-size': '0.8125rem',
              '--tsi-token-size': '1.25rem',
              '--tsi-token-font-size': '0.75rem',
              '--tsi-token-icon-size': '0.75rem',
              '--tsi-padding-x': '0.5rem',
              '--tsi-padding-y': '0.25rem',
              '--tsi-min-height': '2rem',
              '--tsi-radius': '0.375rem',
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

      <div className="space-y-4">
        <h4 className="font-medium">Default</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active priority:is:high"
          onSubmit={setResult}
          placeholder="Default size..."
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Large</h4>
        <div
          style={
            {
              '--tsi-font-size': '1.125rem',
              '--tsi-token-size': '2rem',
              '--tsi-token-font-size': '1.125rem',
              '--tsi-token-icon-size': '1rem',
              '--tsi-padding-x': '1rem',
              '--tsi-padding-y': '0.75rem',
              '--tsi-min-height': '3.5rem',
              '--tsi-radius': '0.75rem',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            defaultValue="status:is:active priority:is:high"
            onSubmit={setResult}
            placeholder="Large size..."
          />
        </div>
      </div>

      <ResultDisplay result={result} />

      <InfoBox variant="info">
        <strong>Size Variables:</strong>
        <pre className="mt-2 text-xs overflow-x-auto">
          {`--tsi-font-size        // Base font size
--tsi-token-size       // Token height
--tsi-token-font-size  // Token text size
--tsi-token-icon-size  // Token icon size
--tsi-padding-x/y      // Container padding
--tsi-min-height       // Minimum input height
--tsi-radius           // Border radius`}
        </pre>
      </InfoBox>
    </div>
  );
};

export const BorderRadiusVariants: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Border Radius (CSS Variables)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Customize the border radius to match your design system.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Sharp (No Radius)</h4>
        <div
          style={
            {
              '--tsi-radius': '0',
              '--tsi-radius-inner': '0',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            defaultValue="status:is:active"
            onSubmit={setResult}
            placeholder="Sharp corners..."
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Subtle</h4>
        <div
          style={
            {
              '--tsi-radius': '0.25rem',
              '--tsi-radius-inner': '0.125rem',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            defaultValue="status:is:pending"
            onSubmit={setResult}
            placeholder="Subtle radius..."
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Rounded</h4>
        <div
          style={
            {
              '--tsi-radius': '1rem',
              '--tsi-radius-inner': '0.5rem',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            defaultValue="status:is:active"
            onSubmit={setResult}
            placeholder="More rounded..."
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Pill</h4>
        <div
          style={
            {
              '--tsi-radius': '9999px',
              '--tsi-radius-inner': '9999px',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            defaultValue="status:is:pending"
            onSubmit={setResult}
            placeholder="Pill shape..."
          />
        </div>
      </div>

      <ResultDisplay result={result} />
    </div>
  );
};

export const ShadowVariants: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Shadow (CSS Variables)</h3>
        <p className="text-sm text-gray-600 mb-4">
          The <code>--tsi-shadow</code> variable affects the dropdown shadow.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">No Shadow</h4>
        <p className="text-sm text-gray-500">Type to see dropdown without shadow</p>
        <div
          style={
            {
              '--tsi-shadow': 'none',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            onSubmit={setResult}
            placeholder="Type to see flat dropdown..."
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Subtle Shadow</h4>
        <p className="text-sm text-gray-500">Type to see dropdown with subtle shadow</p>
        <div
          style={
            {
              '--tsi-shadow': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            onSubmit={setResult}
            placeholder="Type to see subtle shadow..."
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Dramatic Shadow</h4>
        <p className="text-sm text-gray-500">Type to see dropdown with dramatic shadow</p>
        <div
          style={
            {
              '--tsi-shadow':
                '0 25px 50px -12px rgb(0 0 0 / 0.25), 0 12px 24px -8px rgb(0 0 0 / 0.15)',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            onSubmit={setResult}
            placeholder="Type to see dramatic shadow..."
          />
        </div>
      </div>

      <ResultDisplay result={result} />
    </div>
  );
};

export const TokenColors: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Token Colors (CSS Variables)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Customize token appearance using muted color variables.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Default Tokens</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active priority:is:high"
          onSubmit={setResult}
          placeholder="Default tokens..."
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Blue Tinted Tokens</h4>
        <div
          style={
            {
              '--tsi-muted': 'hsl(221, 83%, 95%)',
              '--tsi-muted-darker': 'hsl(221, 83%, 90%)',
              '--tsi-muted-foreground': 'hsl(221, 83%, 40%)',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            defaultValue="status:is:active priority:is:high"
            onSubmit={setResult}
            placeholder="Blue tinted tokens..."
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Warm Tone Tokens</h4>
        <div
          style={
            {
              '--tsi-muted': 'hsl(30, 50%, 95%)',
              '--tsi-muted-darker': 'hsl(30, 50%, 88%)',
              '--tsi-muted-foreground': 'hsl(30, 50%, 40%)',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={BASIC_FIELDS}
            defaultValue="status:is:pending priority:is:medium"
            onSubmit={setResult}
            placeholder="Warm tone tokens..."
          />
        </div>
      </div>

      <ResultDisplay result={result} />
    </div>
  );
};

export const FocusRing: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Focus Ring (CSS Variables)</h3>
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

export const DarkMode: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  const [isDark, setIsDark] = useState(false);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Dark Mode (CSS Variables)</h3>
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

export const CompleteTheme: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  const customSuggestion: CustomSuggestionConfig = {
    displayMode: 'append',
    suggest: ({ query }) => {
      const filtered = AVAILABLE_TAGS.filter((tag) =>
        tag.label.toLowerCase().includes(query.toLowerCase())
      );
      return filtered.map((tag) => ({
        tokens: [
          { key: 'tag', operator: 'is' as const, value: tag.value, displayValue: tag.label },
        ],
        label: tag.label,
        description: `Tag: ${tag.value}`,
      }));
    },
  };

  const fieldsWithTag = [...BASIC_FIELDS, TAG_FIELD];

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Complete Theme (CSS Variables)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Full theme customization using CSS variables. Type to see custom suggestions.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Ocean Theme</h4>
        <div
          style={
            {
              '--tsi-background': 'hsl(222 47% 11%)',
              '--tsi-foreground': 'hsl(0 0% 100%)',
              '--tsi-muted': 'hsl(204 80% 26%)',
              '--tsi-muted-foreground': 'hsl(186 94% 82%)',
              '--tsi-muted-darker': 'hsl(204 80% 35%)',
              '--tsi-border': 'hsl(215 25% 27%)',
              '--tsi-border-hover': 'hsl(204 80% 50%)',
              '--tsi-border-focus': 'hsl(199 89% 70%)',
              '--tsi-selection': 'hsl(204 80% 35%)',
              '--tsi-ring-width': '2px',
              '--tsi-ring-color': 'hsl(199 89% 70%)',
              '--tsi-shadow': '0 10px 15px -3px rgb(0 0 0 / 0.3)',
              '--tsi-radius': '0.75rem',
              '--tsi-radius-inner': '0.375rem',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={fieldsWithTag}
            defaultValue="status:is:active priority:is:high"
            onSubmit={setResult}
            suggestions={{ custom: customSuggestion }}
            placeholder="Type to see custom suggestions..."
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Forest Theme</h4>
        <div
          style={
            {
              '--tsi-background': 'hsl(152 50% 5%)',
              '--tsi-foreground': 'hsl(152 80% 90%)',
              '--tsi-muted': 'hsl(152 50% 15%)',
              '--tsi-muted-foreground': 'hsl(152 60% 75%)',
              '--tsi-muted-darker': 'hsl(152 50% 25%)',
              '--tsi-border': 'hsl(152 40% 20%)',
              '--tsi-border-hover': 'hsl(152 50% 40%)',
              '--tsi-border-focus': 'hsl(152 70% 60%)',
              '--tsi-selection': 'hsl(152 50% 30%)',
              '--tsi-ring-width': '2px',
              '--tsi-ring-color': 'hsl(152 70% 60%)',
              '--tsi-radius': '0.5rem',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={fieldsWithTag}
            defaultValue="status:is:active priority:is:high"
            onSubmit={setResult}
            suggestions={{ custom: customSuggestion }}
            placeholder="Type to see custom suggestions..."
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Sunset Theme</h4>
        <div
          style={
            {
              '--tsi-background': 'hsl(30 100% 97%)',
              '--tsi-foreground': 'hsl(20 80% 20%)',
              '--tsi-muted': 'hsl(30 80% 92%)',
              '--tsi-muted-foreground': 'hsl(20 70% 35%)',
              '--tsi-muted-darker': 'hsl(30 60% 85%)',
              '--tsi-border': 'hsl(30 50% 80%)',
              '--tsi-border-hover': 'hsl(20 60% 60%)',
              '--tsi-border-focus': 'hsl(20 80% 50%)',
              '--tsi-selection': 'hsl(30 70% 80%)',
              '--tsi-radius': '1rem',
              '--tsi-radius-inner': '0.5rem',
            } as React.CSSProperties
          }
        >
          <TokenizedSearchInput
            fields={fieldsWithTag}
            defaultValue="status:is:active priority:is:high"
            onSubmit={setResult}
            suggestions={{ custom: customSuggestion }}
            placeholder="Type to see custom suggestions..."
          />
        </div>
      </div>

      <ResultDisplay result={result} />
    </div>
  );
};

export default {
  title: 'Customization / CSS Variables',
};
