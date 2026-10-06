import type { ReactNode } from 'react';

/** One collapsible feature: a name and a one-line summary that open onto a live example. */
export function ExampleDetails({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="feature">
      <summary className="feature__summary">
        <span className="feature__title">{title}</span>
        <span className="feature__text">{summary}</span>
      </summary>
      <div className="feature__body">{children}</div>
    </details>
  );
}

type VariantOption<T extends string> = { id: T; label: string };

export function VariantSwitch<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: ReadonlyArray<VariantOption<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="switch switch--wrap">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <button
          type="button"
          key={option.id}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
