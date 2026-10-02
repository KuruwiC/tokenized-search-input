import type { ReactNode } from 'react';

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
    <details className="example-details">
      <summary>
        <span className="example-title">{title}</span>
        <span className="example-summary">{summary}</span>
      </summary>
      <div className="example-body">{children}</div>
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
    <fieldset className="segmented-control variant-switch">
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
