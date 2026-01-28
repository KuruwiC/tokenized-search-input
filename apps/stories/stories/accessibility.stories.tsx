import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type { QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import type { Story } from '@ladle/react';
import { useState } from 'react';
import { BASIC_FIELDS } from './_shared';
import { InfoBox, ResultDisplay } from './_shared/components';

export const KeyboardNavigation: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Keyboard Navigation</h3>
        <p className="text-sm text-gray-600 mb-4">
          Full keyboard support for efficient navigation and editing.
        </p>
      </div>

      <TokenizedSearchInput
        fields={BASIC_FIELDS}
        defaultValue="status:is:active priority:is:high"
        onSubmit={setResult}
        placeholder="Use keyboard to navigate..."
      />

      <ResultDisplay result={result} />

      <InfoBox variant="info">
        <strong>Keyboard Shortcuts:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Tab</kbd> - Move focus to
            next token or out of input
          </li>
          <li>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Shift + Tab</kbd> - Move
            focus to previous token
          </li>
          <li>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> - Submit search /
            Select suggestion
          </li>
          <li>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Escape</kbd> - Close
            suggestions / Deselect token
          </li>
          <li>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Backspace</kbd> - Delete
            character / Select previous token
          </li>
          <li>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Delete</kbd> - Delete
            selected token
          </li>
          <li>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Arrow Up/Down</kbd> -
            Navigate suggestions
          </li>
          <li>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Arrow Left/Right</kbd> - Move
            cursor / Navigate tokens
          </li>
        </ul>
      </InfoBox>
    </div>
  );
};

export const ARIALabels: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">ARIA Labels</h3>
        <p className="text-sm text-gray-600 mb-4">
          The component uses proper ARIA attributes for screen reader support.
        </p>
      </div>

      <TokenizedSearchInput
        fields={BASIC_FIELDS}
        defaultValue="status:is:active"
        onSubmit={setResult}
        placeholder="Accessible search input..."
      />

      <ResultDisplay result={result} />

      <InfoBox variant="info">
        <strong>ARIA Features:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>
            <code>role="combobox"</code> - Input behaves as a combobox
          </li>
          <li>
            <code>role="listbox"</code> - Suggestions list
          </li>
          <li>
            <code>role="option"</code> - Individual suggestions
          </li>
          <li>
            <code>aria-expanded</code> - Indicates if suggestions are open
          </li>
          <li>
            <code>aria-activedescendant</code> - Currently focused suggestion
          </li>
          <li>
            <code>aria-label</code> - Descriptive labels for tokens
          </li>
        </ul>
      </InfoBox>

      <div className="p-4 bg-yellow-50 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Testing:</strong> Use a screen reader (VoiceOver, NVDA, JAWS) to verify
          accessibility. Each token announces its field, operator, and value.
        </p>
      </div>
    </div>
  );
};

export const FocusManagement: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Focus Management</h3>
        <p className="text-sm text-gray-600 mb-4">
          Focus is properly managed when interacting with tokens and suggestions.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm text-gray-600">Before input (for Tab testing)</span>
          <input
            type="text"
            className="mt-1 block w-full rounded border px-3 py-2"
            placeholder="Focus here, then Tab..."
          />
        </label>

        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active priority:is:high"
          onSubmit={setResult}
          placeholder="Focus managed input..."
        />

        <label className="block">
          <span className="text-sm text-gray-600">After input (for Tab testing)</span>
          <input
            type="text"
            className="mt-1 block w-full rounded border px-3 py-2"
            placeholder="Tab should land here..."
          />
        </label>
      </div>

      <ResultDisplay result={result} />

      <InfoBox variant="info">
        <strong>Focus Behavior:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Tab from external input enters the search input</li>
          <li>Tab within moves between tokens</li>
          <li>Tab from last token exits to next focusable element</li>
          <li>Clicking a token focuses its value for editing</li>
          <li>Selecting a suggestion returns focus to input</li>
        </ul>
      </InfoBox>
    </div>
  );
};

export const ReducedMotion: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Reduced Motion</h3>
        <p className="text-sm text-gray-600 mb-4">
          Animations are automatically disabled when the user has enabled "reduce motion" in their
          OS settings.
        </p>
      </div>

      <TokenizedSearchInput
        fields={BASIC_FIELDS}
        defaultValue="status:is:active"
        onSubmit={setResult}
        placeholder="Respects prefers-reduced-motion..."
      />

      <ResultDisplay result={result} />

      <InfoBox variant="info">
        <strong>How it works:</strong>
        <p className="mt-1">
          CSS <code>@media (prefers-reduced-motion: reduce)</code> is respected. Enable "Reduce
          Motion" in your OS accessibility settings to test.
        </p>
      </InfoBox>
    </div>
  );
};

export default {
  title: 'API / Accessibility',
};
