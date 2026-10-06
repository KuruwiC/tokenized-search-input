import { useRef, useState } from 'react';
import { CLASSIFIER_CODE, FREE_TEXT_CODE, TAGS_CODE, UNKNOWN_FIELDS_CODE } from '../code-samples';
import { CodeBlock } from '../components/code-block';
import { ClassifierDemo, DynamicFieldsDemo, FreeTextDemo, TagsDemo } from './pattern-demos';

const PATTERNS = [
  {
    id: 'dynamic',
    name: 'Dynamic fields',
    prop: 'unknownFields',
    title: 'Accept keys you did not declare',
    description:
      'Keep a curated field list and still let server-defined or user-defined keys through, limited to the operators you allow.',
    code: UNKNOWN_FIELDS_CODE,
    file: 'DynamicFields.tsx',
    Demo: DynamicFieldsDemo,
  },
  {
    id: 'free-text',
    name: 'Free text',
    prop: 'freeTextMode',
    title: 'Decide what happens to words outside the syntax',
    description:
      'Drop them, keep them as plain text, or turn each word into a token. Switch modes and watch the segments change.',
    code: FREE_TEXT_CODE,
    file: 'FreeText.tsx',
    Demo: FreeTextDemo,
  },
  {
    id: 'tags',
    name: 'Tags and validation',
    prop: 'validation.rules',
    title: 'Use it as a constrained tag picker',
    description:
      'Hide the field label, offer a fixed vocabulary, and enforce rules. This one starts with a duplicate so you can see a rejected token.',
    code: TAGS_CODE,
    file: 'TagPicker.tsx',
    Demo: TagsDemo,
  },
  {
    id: 'classifier',
    name: 'Value classifier',
    prop: 'suggestions.custom',
    title: 'Let the value pick its field',
    description:
      'Custom suggestions inspect what was typed. An email becomes an email filter, user IDs offer assignee or requester, and everything else searches titles.',
    code: CLASSIFIER_CODE,
    file: 'Classifier.tsx',
    Demo: ClassifierDemo,
  },
] as const;

type PatternId = (typeof PATTERNS)[number]['id'];

const NEXT_KEYS: Record<string, (index: number, length: number) => number> = {
  ArrowDown: (index, length) => (index + 1) % length,
  ArrowRight: (index, length) => (index + 1) % length,
  ArrowUp: (index, length) => (index - 1 + length) % length,
  ArrowLeft: (index, length) => (index - 1 + length) % length,
  Home: () => 0,
  End: (_, length) => length - 1,
};

export function PatternsSection() {
  const [activeId, setActiveId] = useState<PatternId>('dynamic');
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = PATTERNS.findIndex((pattern) => pattern.id === activeId);
  const active = PATTERNS[activeIndex];

  const onKeyDown = (event: React.KeyboardEvent) => {
    const next = NEXT_KEYS[event.key];
    if (!next) return;
    event.preventDefault();
    const index = next(activeIndex, PATTERNS.length);
    setActiveId(PATTERNS[index].id);
    tabs.current[index]?.focus();
  };

  return (
    <section className="section patterns" id="patterns" aria-labelledby="patterns-title">
      <header className="section__head">
        <h2 className="section__title" id="patterns-title">
          One component, four configurations
        </h2>
        <p className="section__lede">
          Each pattern below is the same editor with different props. Pick one to try it and read
          the configuration that produces it.
        </p>
      </header>

      <div className="patterns__body">
        <div
          className="patterns__tabs"
          role="tablist"
          aria-label="Configuration patterns"
          aria-orientation="vertical"
          onKeyDown={onKeyDown}
        >
          {PATTERNS.map((pattern, index) => (
            <button
              type="button"
              role="tab"
              key={pattern.id}
              id={`pattern-tab-${pattern.id}`}
              aria-controls={`pattern-panel-${pattern.id}`}
              aria-selected={pattern.id === activeId}
              tabIndex={pattern.id === activeId ? 0 : -1}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              onClick={() => setActiveId(pattern.id)}
              className="pattern-tab"
            >
              <span className="pattern-tab__name">{pattern.name}</span>
              <code className="pattern-tab__prop">{pattern.prop}</code>
            </button>
          ))}
        </div>

        <div
          className="patterns__panel"
          role="tabpanel"
          id={`pattern-panel-${active.id}`}
          aria-labelledby={`pattern-tab-${active.id}`}
        >
          <div className="patterns__intro">
            <h3 className="patterns__title">{active.title}</h3>
            <p>{active.description}</p>
          </div>
          <active.Demo key={active.id}>
            <CodeBlock code={active.code} label={active.file} />
          </active.Demo>
        </div>
      </div>
    </section>
  );
}
