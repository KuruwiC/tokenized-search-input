import { REPOSITORY_URL } from '../constants';

export function SiteFooter() {
  return (
    <footer className="colophon">
      <p>
        <code className="grammar">
          <span className="g-field">license</span>:<span className="g-op">is</span>:
          <span className="g-value">MIT</span>
        </code>
      </p>
      <p>React 18 and 19. Written in TypeScript. Built on TipTap and ProseMirror.</p>
      <p>
        <a href={REPOSITORY_URL}>Source and issues on GitHub</a>
      </p>
    </footer>
  );
}
