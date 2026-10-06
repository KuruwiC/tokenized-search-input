import type { QuerySnapshot, QuerySnapshotSegment } from '@kuruwic/tokenized-search-input';
import { CircleAlert } from 'lucide-react';
import { useId, useState } from 'react';

type View = 'table' | 'json';

const KIND_LABEL: Record<QuerySnapshotSegment['type'], string> = {
  filter: 'Filter',
  freeText: 'Free-text token',
  plaintext: 'Plain text',
};

/** Drops volatile ids so the JSON view shows only what an application would read. */
function toDisplayJson(snapshot: QuerySnapshot) {
  return {
    text: snapshot.text,
    segments: snapshot.segments.map((segment) => {
      switch (segment.type) {
        case 'filter':
          return {
            type: segment.type,
            key: segment.key,
            operator: segment.operator,
            value: segment.value,
            ...(segment.invalid ? { invalid: true, invalidReason: segment.invalidReason } : {}),
          };
        case 'freeText':
        case 'plaintext':
          return { type: segment.type, value: segment.value };
        default: {
          const exhaustive: never = segment;
          return exhaustive;
        }
      }
    }),
  };
}

function SegmentRow({ segment }: { segment: QuerySnapshotSegment }) {
  if (segment.type !== 'filter') {
    return (
      <tr>
        <th scope="row">{KIND_LABEL[segment.type]}</th>
        <td className="readout__none">none</td>
        <td className="readout__none">none</td>
        <td className="readout__value">{segment.value}</td>
      </tr>
    );
  }
  return (
    <tr data-invalid={segment.invalid ? 'true' : undefined}>
      <th scope="row">{KIND_LABEL.filter}</th>
      <td className="readout__field">{segment.key}</td>
      <td className="readout__op">{segment.operator}</td>
      <td className="readout__value">
        {segment.value}
        {segment.invalid ? (
          <span className="readout__reason">
            <CircleAlert aria-hidden="true" />
            <span>
              Rejected, invalidReason <code>{segment.invalidReason ?? 'unknown'}</code>
            </span>
          </span>
        ) : null}
      </td>
    </tr>
  );
}

export function Readout({
  snapshot,
  empty,
  title = 'What your app receives',
}: {
  snapshot: QuerySnapshot | null;
  empty: string;
  title?: string;
}) {
  const [view, setView] = useState<View>('table');
  const headingId = useId();
  const segments = snapshot?.segments ?? [];

  return (
    <section className="readout" aria-labelledby={headingId}>
      <header className="readout__head">
        <h3 id={headingId} className="readout__title">
          {title}
        </h3>
        <fieldset className="switch" aria-label="Output format">
          {(['table', 'json'] as const).map((option) => (
            <button
              type="button"
              key={option}
              aria-pressed={view === option}
              onClick={() => setView(option)}
            >
              {option === 'table' ? 'Segments' : 'JSON'}
            </button>
          ))}
        </fieldset>
      </header>

      <p className="readout__text">
        <span className="readout__text-key">text</span>
        <code>{snapshot?.text || <span className="readout__none">empty string</span>}</code>
      </p>

      {view === 'json' ? (
        <pre className="readout__json">
          {snapshot ? JSON.stringify(toDisplayJson(snapshot), null, 2) : 'null'}
        </pre>
      ) : segments.length === 0 ? (
        <p className="readout__empty">{empty}</p>
      ) : (
        <div className="readout__scroll">
          <table className="readout__table">
            <caption className="sr-only">Parsed segments</caption>
            <thead>
              <tr>
                <th scope="col">Segment</th>
                <th scope="col" className="readout__field">
                  field
                </th>
                <th scope="col" className="readout__op">
                  operator
                </th>
                <th scope="col" className="readout__value">
                  value
                </th>
              </tr>
            </thead>
            <tbody>
              {segments.map((segment, index) => (
                <SegmentRow
                  segment={segment}
                  key={segment.type === 'plaintext' ? `text-${index}` : segment.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
