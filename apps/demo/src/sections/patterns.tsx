import { useState } from 'react';
import { CLASSIFIER_CODE, FREE_TEXT_CODE, TAGS_CODE, UNKNOWN_FIELDS_CODE } from '../code-samples';
import { CodeBlock } from '../components';
import { ClassifierDemo, FreeTextDemo, TagsDemo, UnknownFieldsDemo } from './pattern-demos';

type PatternId = 'dynamic' | 'free-text' | 'tags' | 'classifier';
const PATTERNS: Array<{
  id: PatternId;
  label: string;
  title: string;
  description: string;
  code: string;
}> = [
  {
    id: 'dynamic',
    label: 'Dynamic fields',
    title: 'Accept server-defined and user-defined filter keys.',
    description:
      'Keep a curated field list while allowing server-defined or user-defined keys with a controlled operator set.',
    code: UNKNOWN_FIELDS_CODE,
  },
  {
    id: 'free-text',
    label: 'Free text',
    title: 'Choose what happens outside filter syntax.',
    description:
      'Discard it, preserve it, or tokenize it. The mode is explicit rather than an accidental parser side effect.',
    code: FREE_TEXT_CODE,
  },
  {
    id: 'tags',
    label: 'Tags + validation',
    title: 'Use the editor as a constrained tag picker.',
    description:
      'The duplicate starts invalid. Use the presets to compare a valid query, duplicate detection, and the three-token limit.',
    code: TAGS_CODE,
  },
  {
    id: 'classifier',
    label: 'Value classifier',
    title: 'Let typed values suggest their own field.',
    description:
      'Email-shaped text maps to Email. user# IDs offer Assignee and Requester. Other text maps to Title.',
    code: CLASSIFIER_CODE,
  },
];

function PatternDemo({ id }: { id: PatternId }) {
  if (id === 'dynamic') return <UnknownFieldsDemo />;
  if (id === 'free-text') return <FreeTextDemo />;
  if (id === 'tags') return <TagsDemo />;
  return <ClassifierDemo />;
}

export function PatternsSection() {
  const [pattern, setPattern] = useState<PatternId>('dynamic');
  const active = PATTERNS.find((item) => item.id === pattern) ?? PATTERNS[0];
  return (
    <section className="section patterns-section" id="patterns" aria-labelledby="patterns-title">
      <div className="section-intro">
        <h2 id="patterns-title">Compare four configurations of the same editor.</h2>
        <p>
          Switch examples to compare configuration and interaction without scrolling through four
          isolated mini-sites.
        </p>
      </div>
      <div className="pattern-tabs" role="tablist" aria-label="Demo patterns">
        {PATTERNS.map((item, index) => (
          <button
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-controls={`panel-${item.id}`}
            aria-selected={pattern === item.id}
            tabIndex={pattern === item.id ? 0 : -1}
            onClick={() => setPattern(item.id)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const current = PATTERNS.findIndex((candidate) => candidate.id === pattern);
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? PATTERNS.length - 1
                    : (current + (event.key === 'ArrowRight' ? 1 : -1) + PATTERNS.length) %
                      PATTERNS.length;
              const nextPattern = PATTERNS[next];
              setPattern(nextPattern.id);
              window.requestAnimationFrame(() =>
                document.getElementById(`tab-${nextPattern.id}`)?.focus()
              );
            }}
            key={item.id}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="pattern-panel"
        role="tabpanel"
        id={`panel-${active.id}`}
        aria-labelledby={`tab-${active.id}`}
      >
        <div className="pattern-copy">
          <h3>{active.title}</h3>
          <p>{active.description}</p>
          <CodeBlock code={active.code} label={`${active.label}.tsx`} collapsed />
        </div>
        <PatternDemo id={active.id} />
      </div>
    </section>
  );
}
