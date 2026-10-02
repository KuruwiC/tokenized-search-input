import { BASIC_CODE } from '../code-samples';
import { CodeBlock } from '../components';

export function QuickStartSection() {
  return (
    <section className="section quick-start" aria-labelledby="quick-start-title">
      <div className="section-intro narrow-intro">
        <h2 id="quick-start-title">Install, define fields, listen for a snapshot.</h2>
        <p>
          The component owns editing mechanics. Your application owns the vocabulary and what the
          submitted query means.
        </p>
        <CodeBlock
          code="pnpm add https://github.com/KuruwiC/tokenized-search-input/releases/download/v0.1.1/kuruwic-tokenized-search-input-0.1.1.tgz"
          label="Install"
          language="bash"
        />
      </div>
      <CodeBlock code={BASIC_CODE} label="IssueSearch.tsx" />
    </section>
  );
}
