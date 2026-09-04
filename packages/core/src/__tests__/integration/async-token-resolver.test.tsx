import { act, render, waitFor } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import {
  type AsyncTokenResolverOptions,
  useAsyncTokenResolver,
} from '../../helpers/use-async-token-resolver';
import type { FieldDefinition } from '../../types';
import { getInternalEditor } from '../helpers/get-editor';

interface Country {
  value: string;
  label: string;
}

const fields: FieldDefinition[] = [
  {
    key: 'country',
    label: 'Country',
    type: 'string',
    operators: ['is'],
  },
];

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function getCountryTokenAttrs(inputRef: RefObject<TokenizedSearchInputRef>) {
  const editor = getInternalEditor(inputRef.current);
  const attrs: Record<string, unknown>[] = [];
  editor?.state.doc.descendants((node) => {
    if (node.type.name === 'filterToken' && node.attrs.key === 'country') {
      attrs.push(node.attrs);
    }
    return true;
  });
  return attrs;
}

interface ResolverHarnessProps
  extends Pick<
    AsyncTokenResolverOptions<Country>,
    'inputRef' | 'resolve' | 'loadingContent' | 'onError'
  > {
  defaultValue: string;
}

function ResolverHarness({
  inputRef,
  resolve,
  loadingContent,
  onError,
  defaultValue,
}: ResolverHarnessProps) {
  const { resolveTokens } = useAsyncTokenResolver({
    inputRef,
    fieldKey: 'country',
    resolve,
    getValue: (country) => country.value,
    getDisplayData: (country) => ({ displayValue: country.label }),
    loadingContent,
    onError,
  });

  return (
    <TokenizedSearchInput
      ref={inputRef}
      fields={fields}
      defaultValue={defaultValue}
      onChange={() => {
        void resolveTokens();
      }}
    />
  );
}

describe('useAsyncTokenResolver', () => {
  it('resolves confirmed tokens and applies display data', async () => {
    const inputRef = createRef<TokenizedSearchInputRef>();
    const resolve = vi.fn().mockResolvedValue([{ value: 'jp', label: 'Japan' }]);

    render(<ResolverHarness inputRef={inputRef} resolve={resolve} defaultValue="country:is:jp" />);

    await waitFor(() => expect(resolve).toHaveBeenCalledWith(['jp']));
    await waitFor(() => expect(getCountryTokenAttrs(inputRef)[0]?.displayValue).toBe('Japan'));
  });

  it('queues changes during an in-flight request and ignores results for replaced token ids', async () => {
    const inputRef = createRef<TokenizedSearchInputRef>();
    const first = createDeferred<Country[]>();
    const second = createDeferred<Country[]>();
    const resolve = vi
      .fn<(values: string[]) => Promise<Country[]>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    render(<ResolverHarness inputRef={inputRef} resolve={resolve} defaultValue="country:is:jp" />);

    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));

    act(() => {
      inputRef.current?.setValue('country:is:jp country:is:us');
    });

    await act(async () => {
      first.resolve([{ value: 'jp', label: 'stale Japan' }]);
      await first.promise;
    });

    await waitFor(() => {
      expect(resolve).toHaveBeenCalledTimes(2);
      expect(resolve).toHaveBeenLastCalledWith(['jp', 'us']);
    });
    expect(getCountryTokenAttrs(inputRef).map((attrs) => attrs.displayValue)).toEqual([null, null]);

    await act(async () => {
      second.resolve([
        { value: 'jp', label: 'Japan' },
        { value: 'us', label: 'United States' },
      ]);
      await second.promise;
    });

    await waitFor(() => {
      expect(getCountryTokenAttrs(inputRef).map((attrs) => attrs.displayValue)).toEqual([
        'Japan',
        'United States',
      ]);
    });
  });

  it('handles rejection and restores loading decoration', async () => {
    const inputRef = createRef<TokenizedSearchInputRef>();
    const error = new Error('network unavailable');
    const onError = vi.fn();
    const resolve = vi.fn().mockRejectedValue(error);

    render(
      <ResolverHarness
        inputRef={inputRef}
        resolve={resolve}
        defaultValue="country:is:jp"
        loadingContent={{ displayValue: 'Loading...', startContent: 'spinner' }}
        onError={onError}
      />
    );

    await waitFor(() => expect(onError).toHaveBeenCalledWith(error, ['jp']));
    await waitFor(() => {
      const attrs = getCountryTokenAttrs(inputRef)[0];
      expect(attrs?.displayValue).toBeNull();
      expect(attrs?.startContent).toBeNull();
    });
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
