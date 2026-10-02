import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import { useMemo } from 'react';
import { createSearchFields } from '../../fields';
import { ExampleDetails } from './example';

const KEYBOARD: Array<[string, string]> = [
  ['Tab / Shift + Tab', 'Move focus to the next or previous token, or out of the input'],
  ['Enter', 'Submit the query, or select the highlighted suggestion'],
  ['Escape', 'Close suggestions, or deselect the token'],
  ['Backspace', 'Delete a character, or select the previous token'],
  ['Delete', 'Delete the selected token'],
  ['Arrow Up / Down', 'Move through suggestions'],
  ['Arrow Left / Right', 'Move the cursor, or step between tokens'],
];

const ARIA: Array<[string, string]> = [
  ['role="combobox"', 'the input'],
  ['role="listbox"', 'the suggestion list'],
  ['role="option"', 'each suggestion'],
  ['aria-expanded', 'whether suggestions are open'],
  ['aria-activedescendant', 'the highlighted suggestion'],
  ['aria-label', 'a spoken description of each token'],
];

export function AccessibilityExample() {
  const fields = useMemo(createSearchFields, []);
  return (
    <ExampleDetails
      title="Accessibility"
      summary="Keyboard operation, ARIA roles, and focus order; try tabbing through the fields below."
    >
      <div className="demo-surface example-focus-order">
        <label>
          <span>Before the editor</span>
          <input type="text" placeholder="Focus here, then press Tab…" />
        </label>
        <TokenizedSearchInput
          fields={fields}
          defaultValue="status:is:active priority:is:high"
          placeholder="Use the keyboard to navigate…"
        />
        <label>
          <span>After the editor</span>
          <input type="text" placeholder="Tab from the last token lands here…" />
        </label>
      </div>
      <dl className="example-list">
        {KEYBOARD.map(([keys, action]) => (
          <div key={keys}>
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
      <dl className="example-list">
        {ARIA.map(([attribute, role]) => (
          <div key={attribute}>
            <dt>
              <code>{attribute}</code>
            </dt>
            <dd>{role}</dd>
          </div>
        ))}
      </dl>
      <p className="example-note">
        Animations stop when the OS sets <code>prefers-reduced-motion: reduce</code>. Verify with a
        screen reader such as VoiceOver or NVDA: each token announces its field, operator, and
        value.
      </p>
    </ExampleDetails>
  );
}
