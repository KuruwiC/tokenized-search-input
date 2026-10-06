import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type CopyState = 'idle' | 'copied' | 'failed';

const STATUS: Record<CopyState, string> = {
  idle: '',
  copied: 'Copied to clipboard',
  failed: 'Copy failed. Select the text and copy it manually.',
};

export function CopyButton({
  text,
  label,
  children,
}: {
  text: string;
  label: string;
  children?: React.ReactNode;
}) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2000);
  };

  return (
    <>
      <button
        type="button"
        className="copy"
        data-state={state}
        onClick={copy}
        aria-label={children ? undefined : label}
      >
        {state === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {children ? <span>{state === 'copied' ? 'Copied' : children}</span> : null}
      </button>
      <output className="sr-only">{STATUS[state]}</output>
    </>
  );
}
