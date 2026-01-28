import type { Story } from '@ladle/react';

export const Docs: Story = () => {
  return (
    <div className="max-w-3xl mx-auto p-6 prose prose-sm">
      <h1 className="text-3xl font-bold mb-4">Tokenized Search Input</h1>
      <p className="text-gray-600 mb-6">
        A powerful React component for building advanced search interfaces with tokenized filters,
        autocomplete, and validation.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-4">Features</h2>
      <ul className="list-disc list-inside space-y-2 text-gray-700">
        <li>
          <strong>Structured Filter Tokens</strong>: Create search filters in{' '}
          <code className="bg-gray-100 px-1 rounded">field:operator:value</code> format
        </li>
        <li>
          <strong>Multiple Field Types</strong>: String, Enum, Date, and DateTime fields
        </li>
        <li>
          <strong>Rich Autocomplete</strong>: Field and value suggestions with fuzzy matching
        </li>
        <li>
          <strong>Custom Suggestions</strong>: Async data fetching, pagination, and custom display
          modes
        </li>
        <li>
          <strong>Validation</strong>: Built-in rules for uniqueness, max count, patterns, and
          custom logic
        </li>
        <li>
          <strong>Keyboard Navigation</strong>: Full keyboard support for accessibility
        </li>
        <li>
          <strong>Theming</strong>: CSS Variables for easy customization
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-4">Quick Start</h2>
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
        {`import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import '@kuruwic/tokenized-search-input/styles';

const fields = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: ['active', 'inactive', 'pending'],
  },
  {
    key: 'assignee',
    label: 'Assignee',
    type: 'string',
    operators: ['is', 'contains'],
  },
];

function App() {
  return (
    <TokenizedSearchInput
      fields={fields}
      onSubmit={(snapshot) => console.log(snapshot)}
      placeholder="Search..."
    />
  );
}`}
      </pre>

      <h2 className="text-xl font-semibold mt-8 mb-4">Story Categories</h2>

      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-gray-800">Getting Started</h3>
          <p className="text-gray-600 text-sm">Basic usage examples and common configurations.</p>
        </div>

        <div>
          <h3 className="font-semibold text-gray-800">Core</h3>
          <ul className="text-gray-600 text-sm list-disc list-inside">
            <li>Field Types: String, Enum, Date, DateTime field configurations</li>
            <li>Operators: Comparison operators and custom labels</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-gray-800">Features</h3>
          <ul className="text-gray-600 text-sm list-disc list-inside">
            <li>Validation: Uniqueness, max count, pattern validation</li>
            <li>Suggestions: Custom async suggestions with pagination</li>
            <li>Free Text: Different modes for handling free text input</li>
            <li>Unknown Fields: Allow dynamic field creation</li>
            <li>Clipboard: Custom serialization for copy/paste</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-gray-800">Customization</h3>
          <ul className="text-gray-600 text-sm list-disc list-inside">
            <li>Display Options: Token label visibility, icons, immutable tokens</li>
            <li>Theming: CSS Variables and dark mode</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-gray-800">API</h3>
          <ul className="text-gray-600 text-sm list-disc list-inside">
            <li>Ref Methods: Programmatic control (setValue, getValue, focus, etc.)</li>
            <li>Accessibility: Keyboard navigation and ARIA support</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-gray-800">Advanced</h3>
          <ul className="text-gray-600 text-sm list-disc list-inside">
            <li>Edge Cases: Long text, many tokens, large lists</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-gray-800">Playground</h3>
          <p className="text-gray-600 text-sm">Interactive demo with all features and controls.</p>
        </div>
      </div>
    </div>
  );
};

export default {
  title: 'Introduction',
};
