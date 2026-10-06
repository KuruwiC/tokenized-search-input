import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import { type CSSProperties, useMemo, useState, useSyncExternalStore } from 'react';
import { CodeBlock } from '../../components/code-block';
import { createSearchFields } from '../../fields';
import { ExampleDetails, VariantSwitch } from './example';

type ThemeId = 'default' | 'brand' | 'compact' | 'large' | 'pill' | 'ring' | 'ocean';

type Vars = Record<string, string>;

/** `darkVars` override `vars` while the page is in its dark theme. */
const THEMES: Array<{ id: ThemeId; label: string; vars: Vars; darkVars?: Vars }> = [
  { id: 'default', label: 'Default', vars: {} },
  {
    id: 'brand',
    label: 'Brand color',
    vars: {
      '--tsi-muted': 'hsl(262, 80%, 96%)',
      '--tsi-muted-foreground': 'hsl(262, 40%, 42%)',
      '--tsi-muted-darker': 'hsl(262, 70%, 89%)',
      '--tsi-primary': 'hsl(262, 83%, 58%)',
      '--tsi-primary-muted': 'hsl(262, 83%, 92%)',
      '--tsi-primary-muted-foreground': 'hsl(262, 83%, 36%)',
      '--tsi-border-focus': 'hsl(262, 83%, 58%)',
    },
    darkVars: {
      '--tsi-muted': 'hsl(262, 35%, 20%)',
      '--tsi-muted-foreground': 'hsl(262, 70%, 80%)',
      '--tsi-muted-darker': 'hsl(262, 35%, 30%)',
      '--tsi-primary': 'hsl(262, 83%, 70%)',
      '--tsi-primary-muted': 'hsl(262, 40%, 26%)',
      '--tsi-primary-muted-foreground': 'hsl(262, 90%, 88%)',
      '--tsi-border-focus': 'hsl(262, 83%, 70%)',
    },
  },
  {
    id: 'compact',
    label: 'Compact',
    vars: {
      '--tsi-font-size': '0.8125rem',
      '--tsi-token-size': '1.25rem',
      '--tsi-token-font-size': '0.75rem',
      '--tsi-token-icon-size': '0.75rem',
      '--tsi-padding-x': '0.5rem',
      '--tsi-padding-y': '0.25rem',
      '--tsi-min-height': '2rem',
    },
  },
  {
    id: 'large',
    label: 'Large',
    vars: {
      '--tsi-font-size': '1.125rem',
      '--tsi-token-size': '2rem',
      '--tsi-token-font-size': '1.125rem',
      '--tsi-token-icon-size': '1rem',
      '--tsi-padding-x': '1rem',
      '--tsi-padding-y': '0.75rem',
      '--tsi-min-height': '3.5rem',
    },
  },
  {
    id: 'pill',
    label: 'Pill',
    vars: { '--tsi-radius': '9999px', '--tsi-radius-inner': '9999px' },
  },
  {
    id: 'ring',
    label: 'Focus ring',
    vars: {
      '--tsi-ring-width': '2px',
      '--tsi-ring-color': 'hsl(221, 83%, 53%)',
      '--tsi-ring-offset': '2px',
    },
  },
  {
    id: 'ocean',
    label: 'Complete theme',
    vars: {
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
    },
  },
];

const rule = (selector: string, vars: Vars) =>
  `${selector} {\n${Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')}\n}`;

const toCss = (vars: Vars, darkVars?: Vars) => {
  if (Object.keys(vars).length === 0) return '/* No overrides: the stylesheet defaults apply. */';
  const light = rule('.my-search', vars);
  return darkVars ? `${light}\n\n${rule('[data-theme="dark"] .my-search', darkVars)}` : light;
};

/** The page theme, read from `data-theme` on <html>, which the header's theme button sets. */
const subscribeToPageTheme = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
};
const isPageDark = () => document.documentElement.dataset.theme === 'dark';

export function ThemingExample() {
  const [themeId, setThemeId] = useState<ThemeId>('brand');
  const fields = useMemo(createSearchFields, []);
  const theme = THEMES.find((item) => item.id === themeId) ?? THEMES[0];
  const dark = useSyncExternalStore(subscribeToPageTheme, isPageDark, () => false);
  const vars = dark && theme.darkVars ? { ...theme.vars, ...theme.darkVars } : theme.vars;
  return (
    <ExampleDetails
      title="Theming"
      summary="Override --tsi-* CSS variables on any ancestor to change color, size, shape, and focus ring."
    >
      <VariantSwitch legend="Theme preset" options={THEMES} value={themeId} onChange={setThemeId} />
      <div className="demo-surface" style={vars as CSSProperties}>
        <TokenizedSearchInput
          key={theme.id}
          fields={fields}
          defaultValue="status:is:active priority:is:high"
          placeholder="Start with status:, priority:…"
          clearable
        />
      </div>
      <CodeBlock
        code={toCss(theme.vars, theme.darkVars)}
        label={`${theme.id}.css`}
        language="css"
      />
      <p className="example-note">
        Dark mode applies when an ancestor has the <code>dark</code> class or{' '}
        <code>data-theme="dark"</code>. The theme button in the header toggles it for this page.
      </p>
    </ExampleDetails>
  );
}
