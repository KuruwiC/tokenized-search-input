import { REPOSITORY_URL } from '../constants';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>tokenized-search-input · MIT</span>
      <span>React 18–19 · TypeScript</span>
      <a href={REPOSITORY_URL}>Source on GitHub</a>
    </footer>
  );
}
