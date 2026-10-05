import { act, render, waitFor } from '@testing-library/react';
import { createRef, useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type {
  TokenDisplay,
  TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input.types';
import {
  type AsyncTokenResolverOptions,
  useAsyncTokenResolver,
} from '../../helpers/use-async-token-resolver';
import { getApplicableDisplay, getTokenMeta } from '../../plugins/token-meta-plugin';
import type { FieldDefinition } from '../../types';

// What createRef returns: React 19 types widen it to include null, React 18 types do not.
type InputRef = ReturnType<typeof createRef<TokenizedSearchInputRef>>;

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

/** Each country token's attributes together with the display data of its current value (`null` when unset). */
function getCountryTokenAttrs(inputRef: InputRef) {
  const editor = inputRef.current?.getEditor();
  const attrs: Record<string, unknown>[] = [];
  editor?.state.doc.descendants((node) => {
    if (node.type.name === 'filterToken' && node.attrs.key === 'country') {
      const display = getApplicableDisplay(
        getTokenMeta(editor.state, node.attrs.id)?.display,
        node.attrs.key,
        node.attrs.value
      );
      attrs.push({
        ...node.attrs,
        displayValue: display?.displayValue ?? null,
        startContent: display?.startContent ?? null,
      });
    }
    return true;
  });
  return attrs;
}

interface ResolverHarnessProps
  extends Pick<AsyncTokenResolverOptions<Country>, 'resolve' | 'loadingContent' | 'onError'> {
  inputRef: InputRef;
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

  describe('writes through the ref commands', () => {
    function spyOnCommands(realRef: InputRef) {
      const setTokenDisplay = vi.fn();
      const deleteToken = vi.fn();
      const wrapped: InputRef = {
        get current(): TokenizedSearchInputRef | null {
          const real = realRef.current;
          if (!real) return null;
          return {
            ...real,
            setTokenDisplay: (id: string, display: TokenDisplay) => {
              setTokenDisplay(id, display);
              real.setTokenDisplay(id, display);
            },
            deleteToken: (id: string) => {
              deleteToken(id);
              real.deleteToken(id);
            },
          };
        },
      };
      return { wrapped, setTokenDisplay, deleteToken };
    }

    function WrappedHarness({
      realRef,
      wrapped,
      resolve,
      defaultValue,
      onNotFound,
      loadingContent,
    }: {
      realRef: InputRef;
      wrapped: InputRef;
      resolve: AsyncTokenResolverOptions<Country>['resolve'];
      defaultValue: string;
      onNotFound?: AsyncTokenResolverOptions<Country>['onNotFound'];
      loadingContent?: AsyncTokenResolverOptions<Country>['loadingContent'];
    }) {
      const { resolveTokens } = useAsyncTokenResolver({
        inputRef: wrapped,
        fieldKey: 'country',
        resolve,
        getValue: (country) => country.value,
        getDisplayData: (country) => ({ displayValue: country.label }),
        onNotFound,
        loadingContent,
      });
      return (
        <TokenizedSearchInput
          ref={realRef}
          fields={fields}
          defaultValue={defaultValue}
          onChange={() => {
            void resolveTokens();
          }}
        />
      );
    }

    it('applies resolved display data with setTokenDisplay', async () => {
      const realRef = createRef<TokenizedSearchInputRef>();
      const { wrapped, setTokenDisplay } = spyOnCommands(realRef);
      const resolve = vi.fn().mockResolvedValue([{ value: 'jp', label: 'Japan' }]);

      render(
        <WrappedHarness
          realRef={realRef}
          wrapped={wrapped}
          resolve={resolve}
          defaultValue="country:is:jp"
        />
      );

      await waitFor(() => expect(getCountryTokenAttrs(realRef)[0]?.displayValue).toBe('Japan'));
      const tokenId = getCountryTokenAttrs(realRef)[0]?.id;
      expect(setTokenDisplay).toHaveBeenCalledWith(tokenId, { displayValue: 'Japan' });
    });

    it('sets the loading decoration with setTokenDisplay', async () => {
      const realRef = createRef<TokenizedSearchInputRef>();
      const { wrapped, setTokenDisplay } = spyOnCommands(realRef);
      const deferred = createDeferred<Country[]>();
      const resolve = vi.fn().mockReturnValue(deferred.promise);

      render(
        <WrappedHarness
          realRef={realRef}
          wrapped={wrapped}
          resolve={resolve}
          defaultValue="country:is:jp"
          loadingContent={{ displayValue: 'Loading...', startContent: 'spinner' }}
        />
      );

      await waitFor(() =>
        expect(getCountryTokenAttrs(realRef)[0]?.displayValue).toBe('Loading...')
      );
      expect(setTokenDisplay).toHaveBeenCalledWith(getCountryTokenAttrs(realRef)[0]?.id, {
        displayValue: 'Loading...',
        startContent: 'spinner',
      });

      await act(async () => {
        deferred.resolve([{ value: 'jp', label: 'Japan' }]);
        await deferred.promise;
      });
      await waitFor(() => expect(getCountryTokenAttrs(realRef)[0]?.displayValue).toBe('Japan'));
    });

    it('removes unresolved tokens with deleteToken', async () => {
      const realRef = createRef<TokenizedSearchInputRef>();
      const { wrapped, deleteToken } = spyOnCommands(realRef);
      const resolve = vi.fn().mockResolvedValue([]);

      render(
        <WrappedHarness
          realRef={realRef}
          wrapped={wrapped}
          resolve={resolve}
          defaultValue="country:is:zz"
        />
      );

      await waitFor(() => expect(getCountryTokenAttrs(realRef)).toHaveLength(0));
      expect(deleteToken).toHaveBeenCalledTimes(1);
    });
  });

  it('accepts a ref created by useRef(null) typed as nullable', () => {
    function NullableRefHarness() {
      const ref = useRef<TokenizedSearchInputRef>(null);
      const nullableRef: InputRef = ref;
      useAsyncTokenResolver({
        inputRef: nullableRef,
        fieldKey: 'country',
        resolve: async () => [] as Country[],
        getValue: (country) => country.value,
        getDisplayData: (country) => ({ displayValue: country.label }),
      });
      return <TokenizedSearchInput ref={ref} fields={fields} />;
    }

    render(<NullableRefHarness />);
    expect(document.querySelector('[role="combobox"]')).not.toBeNull();
  });
});
