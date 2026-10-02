import { REPOSITORY_URL } from '../constants';

export function Hero() {
  return (
    <>
      <section className="hero" id="top" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">Turn typed queries into editable, typed filters.</h1>
          <p>
            The editor handles autocomplete, parsing, validation, async values, and clipboard
            conversion. Your application defines the fields and consumes text or typed segments.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#playground">
              Try the editor <span aria-hidden="true">↓</span>
            </a>
            <a className="secondary-action" href={`${REPOSITORY_URL}#readme`}>
              Read the API
            </a>
          </div>
        </div>
        <aside className="grammar" aria-label="Query grammar">
          <div className="grammar-label">QUERY GRAMMAR</div>
          <code>
            <span>field</span>:<span>operator</span>:<span>value</span>
          </code>
          <ol>
            <li>
              <b>01</b> Select a field
            </li>
            <li>
              <b>02</b> Narrow the operation
            </li>
            <li>
              <b>03</b> Keep the result editable
            </li>
          </ol>
        </aside>
      </section>
      <ul className="fact-strip" aria-label="Compatibility summary">
        <li>
          <b>React</b> 18 and 19
        </li>
        <li>
          <b>Input</b> keyboard + paste
        </li>
        <li>
          <b>Output</b> text + typed segments
        </li>
        <li>
          <b>License</b> MIT
        </li>
      </ul>
    </>
  );
}
