import { ThemeToggle } from '../components/theme-toggle';
import { REPOSITORY_URL, VERSION } from '../constants';

const NAV = [
  ['#install', 'Install'],
  ['#patterns', 'Patterns'],
  ['#styling', 'Styling'],
  ['#async', 'Async'],
  ['#features', 'Features'],
  ['#reference', 'Reference'],
] as const;

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="github-mark">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="masthead">
      <a className="brand" href="#try">
        <span className="brand__mark" aria-hidden="true">
          <span className="g-field">t</span>
          <span className="g-op">s</span>
          <span className="g-value">i</span>
        </span>
        <span className="brand__name">tokenized-search-input</span>
        <span className="brand__version">v{VERSION}</span>
      </a>
      <nav className="masthead__nav" aria-label="Sections">
        {NAV.map(([href, label]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </nav>
      <div className="masthead__actions">
        <a className="icon-button" href={REPOSITORY_URL} aria-label="Source on GitHub">
          <GitHubMark />
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
