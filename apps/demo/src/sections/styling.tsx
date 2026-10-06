import type { ClassNames } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type { CSSProperties } from 'react';
import { CodeBlock } from '../components/code-block';
import { createSearchFields } from '../fields';

const FIELDS = createSearchFields();
const QUERY = 'status:is:active priority:is_not:low';

type Skin = {
  id: string;
  name: string;
  how: string;
  /** Class on the wrapping element; `editor` opts into this page's own skin. */
  wrapperClass?: string;
  vars?: Record<string, string>;
  classNames?: ClassNames;
  code: string;
  language: 'css' | 'tsx';
};

const TERMINAL_VARS = {
  '--tsi-background': '#0b0f0a',
  '--tsi-foreground': '#d4f8d0',
  '--tsi-muted': '#132012',
  '--tsi-muted-foreground': '#86d97f',
  '--tsi-muted-darker': '#1e381b',
  '--tsi-border': '#2b4a28',
  '--tsi-border-hover': '#4f8f49',
  '--tsi-border-focus': '#86d97f',
  '--tsi-primary': '#86d97f',
  '--tsi-primary-muted': '#132012',
  '--tsi-primary-muted-foreground': '#d4f8d0',
  '--tsi-radius': '2px',
  '--tsi-radius-inner': '0px',
};

const TERMINAL_CLASSES: ClassNames = {
  root: 'font-mono',
  token: 'uppercase tracking-wider',
  tokenOperator: 'opacity-60',
};

const SOFT_VARS = {
  '--tsi-background': '#f7f4ff',
  '--tsi-foreground': '#2a2160',
  '--tsi-muted': '#ebe4ff',
  '--tsi-muted-foreground': '#5a48b8',
  '--tsi-muted-darker': '#d9ceff',
  '--tsi-border': '#ddd3fb',
  '--tsi-border-focus': '#7c5cff',
  '--tsi-ring-width': '4px',
  '--tsi-ring-color': 'rgb(124 92 255 / 0.22)',
  '--tsi-radius': '9999px',
  '--tsi-radius-inner': '9999px',
  '--tsi-min-height': '3.5rem',
  '--tsi-padding-x': '1.25rem',
  '--tsi-token-size': '1.875rem',
};

const toCss = (selector: string, vars: Record<string, string>) =>
  `${selector} {\n${Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')}\n}`;

const SKINS: Skin[] = [
  {
    id: 'defaults',
    name: 'Defaults',
    how: 'Import the stylesheet and nothing else. Light and dark follow the page.',
    code: `import '@kuruwic/tokenized-search-input/styles';`,
    language: 'tsx',
  },
  {
    id: 'page',
    name: 'This page',
    how: 'A few variables plus three selectors for the field, operator, and value colours.',
    wrapperClass: 'editor',
    code: `.editor {
  --tsi-border-focus: var(--field);
  --tsi-ring-width: 3px;
  --tsi-radius: 10px;
}

.editor .tsi-token { font-variation-settings: "MONO" 1; }
.editor .tsi-token-label { color: var(--field); }
.editor .tsi-token-operator { color: var(--op); }
.editor .tsi-token-value { color: var(--value); }`,
    language: 'css',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    how: 'Colour and corners from variables, typography from Tailwind classes on three slots.',
    vars: TERMINAL_VARS,
    classNames: TERMINAL_CLASSES,
    code: `${toCss('.terminal', TERMINAL_VARS)}

<TokenizedSearchInput
  className="terminal"
  classNames={{
    root: 'font-mono',
    token: 'uppercase tracking-wider',
    tokenOperator: 'opacity-60',
  }}
/>`,
    language: 'tsx',
  },
  {
    id: 'soft',
    name: 'Soft',
    how: 'Variables only: pill shapes, a wide focus ring, and roomier tokens.',
    vars: SOFT_VARS,
    code: toCss('.soft', SOFT_VARS),
    language: 'css',
  },
];

const MANY =
  'status:is:active priority:is_not:low title:contains:"bug report" created:gt:2026-01-01';

const LAYOUTS = [
  {
    id: 'wrap',
    name: 'Wraps',
    prop: 'default',
    how: 'Grows a line at a time so every token stays visible. Suits a filter panel.',
    props: {},
  },
  {
    id: 'single-line',
    name: 'Single line',
    prop: 'singleLine',
    how: 'Keeps one row and scrolls sideways. Suits a toolbar or a table header.',
    props: { singleLine: true },
  },
  {
    id: 'expand',
    name: 'Expand on focus',
    prop: 'expandOnFocus',
    how: 'One row at rest, then opens over the content below while you edit.',
    props: { expandOnFocus: true },
  },
] as const;

export function StylingSection() {
  return (
    <section className="section styling" id="styling" aria-labelledby="styling-title">
      <header className="section__head">
        <h2 className="section__title" id="styling-title">
          It takes on your product's look
        </h2>
        <p className="section__lede">
          Every colour, size, and radius is a <code>--tsi-*</code> variable, and every part accepts
          a class through <code>classNames</code>. These four are the same component with the same
          query. Each one is live.
        </p>
      </header>

      <ul className="skins">
        {SKINS.map((skin) => (
          <li key={skin.id} className="skin">
            <div className="skin__head">
              <h3 className="skin__name">{skin.name}</h3>
              <p className="skin__how">{skin.how}</p>
            </div>
            <div
              className={['skin__stage', skin.wrapperClass].filter(Boolean).join(' ')}
              data-skin={skin.id}
              style={skin.vars as CSSProperties | undefined}
            >
              <TokenizedSearchInput
                fields={FIELDS}
                defaultValue={QUERY}
                classNames={skin.classNames}
                placeholder="Add a filter"
                clearable
              />
            </div>
            <details className="disclosure skin__code">
              <summary>Show the code</summary>
              <CodeBlock
                code={skin.code}
                label={`${skin.id}.${skin.language}`}
                language={skin.language}
              />
            </details>
          </li>
        ))}
      </ul>

      <div className="layouts">
        <header className="layouts__head">
          <h3 className="layouts__title">And it fits the space you give it</h3>
          <p className="section__lede">
            The same four filters in three layouts. Click into each one to see how it behaves while
            you edit.
          </p>
        </header>
        <ul className="layouts__list">
          {LAYOUTS.map((layout) => (
            <li key={layout.id} className="layout">
              <h4 className="layout__name">{layout.name}</h4>
              <code className="layout__prop">{layout.prop}</code>
              <p className="layout__how">{layout.how}</p>
              <div className="layout__stage editor">
                <TokenizedSearchInput
                  fields={FIELDS}
                  defaultValue={MANY}
                  placeholder="Add a filter"
                  clearable
                  {...layout.props}
                />
                <p className="layout__below" aria-hidden="true">
                  Content below the input
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
