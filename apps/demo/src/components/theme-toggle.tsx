import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';

const STORAGE_KEY = 'demo-theme';

/**
 * index.html sets `data-theme` on <html> before first paint, from the stored choice or the
 * system preference; this reads that result. An explicit `data-theme` also tells the
 * component's default styles which palette to use.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // Storage can be unavailable (private mode); the theme still applies for this visit.
    }
  };

  return (
    <button
      type="button"
      className="icon-button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}
