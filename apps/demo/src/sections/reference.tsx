import { REPOSITORY_URL } from '../constants';

const ROWS = [
  ['Fields', 'string, enum, date, datetime', 'FieldDefinition'],
  ['Parsing', 'operators, quoted values, free text', 'unknownFields'],
  ['Suggestions', 'autocomplete for fields, operators, and values', 'suggestions.custom'],
  ['Validation', 'unique and max-count rules', 'validation.rules'],
  ['Clipboard', 'copy and paste token text', 'serialization'],
  ['Control', 'value, focus, clear, submit', 'TokenizedSearchInputRef'],
  ['Theming', 'light and dark via CSS variables', '--tsi-* and classNames'],
] as const;

export function ReferenceSection() {
  return (
    <section className="section reference" id="reference" aria-labelledby="reference-title">
      <header className="section__head">
        <h2 className="section__title" id="reference-title">
          Where to plug in
        </h2>
        <p className="section__lede">
          What the editor handles for you, and the prop or type to reach for when you need something
          else. Full signatures are in the <a href={`${REPOSITORY_URL}#readme`}>README on GitHub</a>
          .
        </p>
      </header>
      <div className="reference__scroll">
        <table className="reference__table">
          <caption className="sr-only">Built-in behavior and extension points</caption>
          <thead>
            <tr>
              <th scope="col">Concern</th>
              <th scope="col">Built in</th>
              <th scope="col">Extend with</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([concern, builtIn, api]) => (
              <tr key={concern}>
                <th scope="row">{concern}</th>
                <td>{builtIn}</td>
                <td>
                  <code>{api}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
