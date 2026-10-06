import { Highlight, type Language, type PrismTheme } from 'prism-react-renderer';
import { CopyButton } from './copy-button';

/** Colors resolve through CSS custom properties so code follows the page theme. */
const theme: PrismTheme = {
  plain: { color: 'var(--code-ink)', backgroundColor: 'transparent' },
  styles: [
    { types: ['comment'], style: { color: 'var(--code-comment)' } },
    { types: ['keyword', 'module', 'boolean'], style: { color: 'var(--code-keyword)' } },
    { types: ['string', 'template-string', 'char'], style: { color: 'var(--value)' } },
    { types: ['attr-name', 'property', 'property-access'], style: { color: 'var(--field)' } },
    { types: ['tag', 'class-name', 'maybe-class-name'], style: { color: 'var(--code-tag)' } },
    { types: ['function', 'method'], style: { color: 'var(--code-function)' } },
    { types: ['number', 'regex'], style: { color: 'var(--code-number)' } },
    {
      types: ['punctuation', 'operator', 'spread', 'arrow'],
      style: { color: 'var(--code-punctuation)' },
    },
  ],
};

type CodeBlockProps = {
  code: string;
  label: string;
  language?: Language;
  /** 1-based inclusive line range to emphasise. */
  highlight?: readonly [number, number] | null;
  className?: string;
};

export function CodeBlock({
  code,
  label,
  language = 'tsx',
  highlight = null,
  className,
}: CodeBlockProps) {
  const source = code.trim();
  return (
    <figure className={['code', className].filter(Boolean).join(' ')}>
      <figcaption className="code__bar">
        <span className="code__label">{label}</span>
        <CopyButton text={source} label="Copy code" />
      </figcaption>
      <Highlight theme={theme} code={source} language={language}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="code__pre" data-has-highlight={highlight ? 'true' : undefined}>
            <code>
              {tokens.map((line, index) => {
                const lineNumber = index + 1;
                const lit =
                  highlight !== null && lineNumber >= highlight[0] && lineNumber <= highlight[1];
                return (
                  <span
                    {...getLineProps({ line })}
                    className="code__line"
                    data-lit={lit ? 'true' : undefined}
                    // biome-ignore lint/suspicious/noArrayIndexKey: Highlighted source lines are immutable and can repeat.
                    key={index}
                  >
                    <span className="code__number" aria-hidden="true">
                      {lineNumber}
                    </span>
                    <span>
                      {line.map((token, tokenIndex) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: Prism tokens have no stable identifier and never reorder.
                        <span {...getTokenProps({ token })} key={tokenIndex} />
                      ))}
                    </span>
                  </span>
                );
              })}
            </code>
          </pre>
        )}
      </Highlight>
    </figure>
  );
}
