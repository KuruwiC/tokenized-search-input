import { REPOSITORY_URL } from '../constants';

export function ReferenceSection() {
  return (
    <section className="section reference-section" id="reference" aria-labelledby="reference-title">
      <div className="section-intro">
        <h2 id="reference-title">Configuration reference.</h2>
      </div>
      <table className="capability-table">
        <caption className="sr-only">Library capabilities</caption>
        <thead>
          <tr className="capability-head">
            <th scope="col">Concern</th>
            <th scope="col">Built-in model</th>
            <th scope="col">Extension point</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Fields</th>
            <td>string, enum, date, datetime</td>
            <td>
              <code>FieldDefinition</code>
            </td>
          </tr>
          <tr>
            <th scope="row">Parsing</th>
            <td>operators, quotes, free text</td>
            <td>
              <code>unknownFields</code>
            </td>
          </tr>
          <tr>
            <th scope="row">Suggestions</th>
            <td>field, operator, value</td>
            <td>
              <code>suggest / loadMore</code>
            </td>
          </tr>
          <tr>
            <th scope="row">Validation</th>
            <td>unique and max count rules</td>
            <td>
              <code>validation.rules</code>
            </td>
          </tr>
          <tr>
            <th scope="row">Clipboard</th>
            <td>copy and paste token text</td>
            <td>
              <code>serialization</code>
            </td>
          </tr>
          <tr>
            <th scope="row">Control</th>
            <td>value, focus, clear, submit</td>
            <td>
              <code>TokenizedSearchInputRef</code>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="reference-note">
        The README remains the source of truth for prop signatures and migration notes.{' '}
        <a href={`${REPOSITORY_URL}#readme`}>Open the full reference →</a>
      </p>
    </section>
  );
}
