import { useState } from 'react';
import { BASIC_CODE, BASIC_CODE_STEPS } from '../code-samples';
import { CodeBlock } from '../components/code-block';
import { CopyButton } from '../components/copy-button';
import { INSTALL_COMMAND } from '../constants';

type StepId = keyof typeof BASIC_CODE_STEPS;

const STEPS: ReadonlyArray<{ id: StepId; title: string; body: string }> = [
  {
    id: 'imports',
    title: 'Import the component and its stylesheet',
    body: 'Styles live in CSS layers with zero-specificity selectors, so your own CSS wins without !important.',
  },
  {
    id: 'fields',
    title: 'Describe your fields',
    body: 'Each field names its type and allowed operators. The editor builds suggestions and parsing from this list.',
  },
  {
    id: 'render',
    title: 'Render it and read the result',
    body: 'onSubmit and onChange receive a snapshot: the query text plus typed segments you can map to an API call.',
  },
];

export function QuickStartSection() {
  const [active, setActive] = useState<StepId>('fields');

  return (
    <section className="section install" id="install" aria-labelledby="install-title">
      <div className="install__copy">
        <h2 className="section__title" id="install-title">
          Four steps to a working filter bar
        </h2>
        <ol className="steps">
          <li className="step step--static">
            <span className="step__title">Add the package</span>
            <div className="command">
              <code className="command__text">{INSTALL_COMMAND}</code>
              <CopyButton text={INSTALL_COMMAND} label="Copy install command" />
            </div>
          </li>
          {STEPS.map((step) => (
            <li key={step.id} className="step">
              <button
                type="button"
                className="step__button"
                aria-pressed={active === step.id}
                onClick={() => setActive(step.id)}
                onMouseEnter={() => setActive(step.id)}
              >
                <span className="step__title">{step.title}</span>
                <span className="step__body">{step.body}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <CodeBlock
        className="install__code"
        code={BASIC_CODE}
        label="IssueSearch.tsx"
        highlight={BASIC_CODE_STEPS[active]}
      />
    </section>
  );
}
