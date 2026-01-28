import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type { QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import type { Story } from '@ladle/react';
import { Mic, Search, Sliders, X } from 'lucide-react';
import { useState } from 'react';
import { ResultDisplay, TOKEN_DISPLAY_FIELDS } from './_shared';

const basicFields = TOKEN_DISPLAY_FIELDS.auto;

export const StartAdornment: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Start Adornment</h3>
      <p className="text-sm text-gray-600 mb-4">
        Display an icon at the start of the input. Commonly used for a search icon.
      </p>
      <TokenizedSearchInput
        fields={basicFields}
        startAdornment={<Search />}
        onSubmit={setResult}
        placeholder="Search..."
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export const EndAdornment: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">End Adornment</h3>
      <p className="text-sm text-gray-600 mb-4">
        Display an icon at the end of the input. Useful for filter or settings icons.
      </p>
      <TokenizedSearchInput
        fields={basicFields}
        endAdornment={<Sliders />}
        onSubmit={setResult}
        placeholder="Search..."
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export const BothAdornments: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Both Adornments</h3>
      <p className="text-sm text-gray-600 mb-4">
        Combine start and end adornments for a complete search experience.
      </p>
      <TokenizedSearchInput
        fields={basicFields}
        startAdornment={<Search />}
        endAdornment={<Mic />}
        onSubmit={setResult}
        placeholder="Search or speak..."
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export const MultiLineWrap: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Multi-line with Wrap</h3>
      <p className="text-sm text-gray-600 mb-4">
        Normal mode with multiple tokens that wrap to new lines. Adornments stay fixed at the edges.
      </p>
      <div className="max-w-md">
        <TokenizedSearchInput
          fields={basicFields}
          startAdornment={<Search />}
          endAdornment={<Sliders />}
          defaultValue="status:is:active priority:is:high status:is:pending priority:is:medium"
          onSubmit={setResult}
          placeholder="Search..."
          clearable
        />
      </div>
      <ResultDisplay result={result} />
    </div>
  );
};

export const WithClearButton: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">With Clear Button</h3>
      <p className="text-sm text-gray-600 mb-4">
        End adornment appears before the clear button when clearable is enabled.
      </p>
      <TokenizedSearchInput
        fields={basicFields}
        startAdornment={<Search />}
        endAdornment={<Sliders />}
        clearable
        defaultValue="status:is:active"
        onSubmit={setResult}
        placeholder="Search..."
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export const SingleLineMode: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Single Line Mode</h3>
      <p className="text-sm text-gray-600 mb-4">Adornments work seamlessly with singleLine mode.</p>
      <TokenizedSearchInput
        fields={basicFields}
        startAdornment={<Search />}
        endAdornment={<Sliders />}
        singleLine
        clearable
        defaultValue="status:is:active priority:is:high"
        onSubmit={setResult}
        placeholder="Search..."
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export const ExpandOnFocusMode: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Expand on Focus Mode</h3>
      <p className="text-sm text-gray-600 mb-4">
        Adornments work with expandOnFocus mode. Click to focus and see the input expand.
      </p>
      <TokenizedSearchInput
        fields={basicFields}
        startAdornment={<Search />}
        endAdornment={<Sliders />}
        expandOnFocus
        clearable
        defaultValue="status:is:active priority:is:high status:is:pending"
        onSubmit={setResult}
        placeholder="Search..."
      />
      <ResultDisplay result={result} />
      <div className="mt-8 p-3 bg-gray-100 rounded text-sm text-gray-700">
        This content is below the input to demonstrate the overlay behavior.
      </div>
    </div>
  );
};

export const InteractiveAdornment: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Interactive Adornment</h3>
      <p className="text-sm text-gray-600 mb-4">
        Wrap adornments in buttons for interactive functionality.
      </p>
      <TokenizedSearchInput
        fields={basicFields}
        startAdornment={<Search />}
        endAdornment={
          <button
            type="button"
            onClick={() => setFilterOpen(!filterOpen)}
            aria-label="Toggle filters"
            aria-pressed={filterOpen}
          >
            {filterOpen ? <X /> : <Sliders />}
          </button>
        }
        onSubmit={setResult}
        placeholder="Search..."
      />
      {filterOpen && (
        <div className="mt-2 p-3 bg-gray-100 rounded text-sm text-gray-700">
          Filter panel is open. Click the button again to close.
        </div>
      )}
      <ResultDisplay result={result} />
    </div>
  );
};

export const CustomStyling: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Custom Styling</h3>
      <p className="text-sm text-gray-600 mb-4">Use classNames to customize adornment styling.</p>
      <TokenizedSearchInput
        fields={basicFields}
        startAdornment={<Search />}
        classNames={{
          startAdornment: 'text-blue-500',
        }}
        onSubmit={setResult}
        placeholder="Search with custom icon color..."
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export default {
  title: 'Customization / Adornments',
};
