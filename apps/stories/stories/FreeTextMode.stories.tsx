import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type { FieldDefinition, QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import type { Story } from '@ladle/react';
import { Tag } from 'lucide-react';
import { useState } from 'react';
import { ResultDisplay } from './_shared';

const tagFields: FieldDefinition[] = [
  {
    key: 'tag',
    label: 'Tag',
    type: 'string',
    operators: ['is'],
    icon: <Tag className="w-full h-full" />,
    tokenLabelDisplay: 'hidden',
    hideSingleOperator: true,
  },
];

export const ModeNone: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Free Text Mode: none</h3>
      <p className="text-sm text-gray-600 mb-4">
        Free text is discarded on submit. Only structured tokens (tag:is:value) are kept. Try typing
        "hello world" and pressing Enter.
      </p>
      <TokenizedSearchInput
        fields={tagFields}
        freeTextMode="none"
        onSubmit={setResult}
        placeholder="Only structured tokens are kept..."
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-yellow-50 rounded text-xs text-yellow-800">
        <strong>Note:</strong> Plain text without field:value format will be ignored in the result.
      </div>
    </div>
  );
};

export const ModePlain: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Free Text Mode: plain</h3>
      <p className="text-sm text-gray-600 mb-4">
        Free text is preserved as-is alongside tokens. Type "hello world" and press Enter.
      </p>
      <TokenizedSearchInput
        fields={tagFields}
        freeTextMode="plain"
        onSubmit={setResult}
        placeholder="Free text is preserved..."
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800">
        <strong>Note:</strong> Free text appears as a separate entry in the result array.
      </div>
    </div>
  );
};

export const ModeTokenize: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Free Text Mode: tokenize</h3>
      <p className="text-sm text-gray-600 mb-4">
        Free text becomes visual tags when you press Space or Enter. Each word becomes a separate
        token.
      </p>
      <TokenizedSearchInput
        fields={tagFields}
        freeTextMode="tokenize"
        onSubmit={setResult}
        placeholder="Words become tags on space/enter..."
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-green-50 rounded text-xs text-green-800">
        <strong>Try:</strong> Type "react typescript vue" with spaces between words.
      </div>
    </div>
  );
};

export const QuotedFreeText: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Quoted Free Text</h3>
      <p className="text-sm text-gray-600 mb-4">
        In tokenize mode, wrap text in double quotes to preserve spaces. Type "hello world" (with
        quotes) and press Space.
      </p>
      <TokenizedSearchInput
        fields={tagFields}
        freeTextMode="tokenize"
        onSubmit={setResult}
        placeholder='Try: "hello world" ...'
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-purple-50 rounded text-xs text-purple-800">
        <strong>Tip:</strong> Quoted text creates a single free text token with the full phrase.
      </div>
    </div>
  );
};

export default {
  title: 'Features / Free Text',
};
