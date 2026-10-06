import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import { Search } from 'lucide-react';
import { Presets } from '../components/presets';
import { Readout } from '../components/readout';
import { useEditorSnapshot } from '../components/use-editor-snapshot';
import { createSearchFields } from '../fields';

const ISSUE_FIELDS = createSearchFields();

const EXAMPLES = [
  { label: 'Open work', query: 'status:is:active priority:is_not:low' },
  { label: 'Recent bugs', query: 'title:contains:"bug report" created:gt:2026-01-01' },
  { label: 'Updated today', query: 'updated:gt:2026-09-05T00:00' },
] as const;

const FIELD_TYPES = [
  ['status', 'enum'],
  ['priority', 'enum'],
  ['title', 'string'],
  ['created', 'date'],
  ['updated', 'datetime'],
] as const;

const FACTS = [
  ['Works with', 'React 18 and 19'],
  ['Input', 'Keyboard, mouse, and paste'],
  ['Output', 'Query text and typed segments'],
  ['License', 'MIT'],
] as const;

const KEYS = [
  [['↑', '↓'], 'Move through suggestions'],
  [['Enter'], 'Accept the highlighted suggestion'],
  [['Backspace'], 'Reopen the last token for editing'],
] as const;

/** The second headline line is drawn as a filter token: field, operator, value. */
const TOKEN_WORDS = [
  ['Get', 'g-field'],
  ['typed', 'g-op'],
  ['filters', 'g-value'],
] as const;

export function Hero() {
  const { ref, snapshot, setSnapshot, load } = useEditorSnapshot();

  return (
    <section className="hero" id="try" aria-labelledby="hero-title">
      <div className="hero__intro">
        <h1 className="hero__title" id="hero-title">
          <span className="sr-only">Type a query. Get typed filters.</span>
          <span className="hero__line" aria-hidden="true">
            Type a query.
          </span>
          <span className="hero__line hero__line--token" aria-hidden="true">
            {TOKEN_WORDS.map(([word, tone], index) => (
              <span key={word} className="hero__part">
                {index > 0 ? <span className="hero__colon">:</span> : null}
                <span className={`hero__word ${tone}`}>{word}</span>
              </span>
            ))}
            .
          </span>
        </h1>
        <div className="hero__sub">
          <p className="hero__lede">
            A React search input that turns <code className="grammar">status:is:active</code> into
            an editable token. It handles suggestions, validation, async values, and the clipboard.
            You define the fields; it gives you back text and typed segments.
          </p>
          <dl className="facts">
            {FACTS.map(([term, detail]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="hero__stage">
        <div className="editor editor--hero">
          <TokenizedSearchInput
            ref={ref}
            fields={ISSUE_FIELDS}
            defaultValue="status:is:active priority:is_not:low"
            onChange={setSnapshot}
            onSubmit={setSnapshot}
            placeholder="Type status, priority, title, created, or updated"
            startAdornment={<Search aria-hidden="true" className="editor__search-icon" />}
            clearable
          />
        </div>
        <Presets legend="Or load an example" presets={EXAMPLES} onSelect={load} />
      </div>

      <div className="hero__output">
        <Readout
          snapshot={snapshot}
          empty="Start typing. Each token you complete appears here as a typed segment."
        />
        <aside className="hero__aside" aria-label="About this example">
          <div className="aside-block">
            <h3 className="aside-title">Fields in this example</h3>
            <dl className="field-types">
              {FIELD_TYPES.map(([key, type]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{type}</dd>
                </div>
              ))}
            </dl>
            <p className="aside-note">
              Dates open a calendar, datetimes add a time picker, and enum values are offered as
              suggestions.
            </p>
          </div>
          <div className="aside-block">
            <h3 className="aside-title">Keyboard</h3>
            <dl className="keys">
              {KEYS.map(([keys, action]) => (
                <div key={action}>
                  <dt>
                    {keys.map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
}
