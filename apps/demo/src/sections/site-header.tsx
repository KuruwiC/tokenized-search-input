import { Moon, Sun } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { REPOSITORY_URL } from '../constants';

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const stored = window.localStorage.getItem('demo-theme');
    const next = stored
      ? stored === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(next);
    applyTheme(next);
  }, []);
  const toggle = useCallback(() => {
    setIsDark((current) => {
      const next = !current;
      applyTheme(next);
      window.localStorage.setItem('demo-theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);
  return (
    <button
      type="button"
      onClick={toggle}
      className="icon-button"
      aria-label={isDark ? 'Use light theme' : 'Use dark theme'}
    >
      {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Tokenized Search Input home">
        <span className="brand-mark" aria-hidden="true">
          t:
        </span>
        <span>tokenized-search-input</span>
        <span className="version">v0.1.2</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="#playground">Playground</a>
        <a href="#patterns">Patterns</a>
        <a href="#reference">Reference</a>
      </nav>
      <div className="header-actions">
        <a className="text-link" href={REPOSITORY_URL}>
          GitHub
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
