import { waitFor } from '@testing-library/react';
import { createRef, Suspense, useEffect, version } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import type { QuerySnapshot } from '../../types';
import { basicFields } from '../fixtures';
import { getInternalEditor } from '../helpers/get-editor';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createSuspendOnce(delayMs: number) {
  let pending: Promise<void> | null = wait(delayMs).then(() => {
    pending = null;
  });
  return function SuspendOnce() {
    if (pending) throw pending;
    return null;
  };
}

// React 19 prerenders the siblings of a suspended child and commits them only
// once the boundary resolves. act() flushes that work synchronously and hides
// the gap between render and commit, so these tests drive a real root instead.
describe('TokenizedSearchInput inside Suspense', () => {
  let container: HTMLDivElement;
  let root: Root;
  let uncaughtErrors: unknown[];
  let previousActEnvironment: unknown;

  beforeEach(() => {
    previousActEnvironment = Reflect.get(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', false);
    uncaughtErrors = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container, {
      // React 18 ignores this option; uncaught render errors there still fail the test.
      onUncaughtError: (error: unknown) => uncaughtErrors.push(error),
    } as Parameters<typeof createRoot>[1]);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousActEnvironment);
  });

  it('mounts an editable input after a sibling in the same boundary resolves', async () => {
    const SuspendOnce = createSuspendOnce(50);

    root.render(
      <Suspense fallback={<p>loading</p>}>
        <TokenizedSearchInput fields={basicFields} placeholder="search" />
        <SuspendOnce />
      </Suspense>
    );
    await waitFor(() => {
      expect(uncaughtErrors).toEqual([]);
      const input = container.querySelector('[role="combobox"]');
      expect(input).toHaveAttribute('contenteditable', 'true');
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('keeps handle writes and reads ordered from an ancestor effect in the same boundary', async () => {
    const SuspendOnce = createSuspendOnce(50);
    const ref = createRef<TokenizedSearchInputRef>();
    const onSubmit = vi.fn<(snapshot: QuerySnapshot) => void>();
    const seenInEffect: { editorDestroyed?: boolean; valueAfterSet?: string } = {};
    function SearchPage() {
      useEffect(() => {
        seenInEffect.editorDestroyed = getInternalEditor(ref.current)?.isDestroyed;
        ref.current?.setValue('hello');
        seenInEffect.valueAfterSet = ref.current?.getValue();
        ref.current?.submit();
      }, []);
      return (
        <>
          <TokenizedSearchInput ref={ref} fields={basicFields} onSubmit={onSubmit} />
          <SuspendOnce />
        </>
      );
    }

    root.render(
      <Suspense fallback={<p>loading</p>}>
        <SearchPage />
      </Suspense>
    );
    await waitFor(() => {
      expect(uncaughtErrors).toEqual([]);
      expect(container.querySelector('[role="combobox"]')).toHaveAttribute(
        'contenteditable',
        'true'
      );
      expect(ref.current?.getValue()).toBe('hello');
    });

    // React 18 discards the suspended render instead, so only React 19 reaches
    // the ancestor effect with the destroyed editor this test is about.
    if (Number(version.split('.')[0]) >= 19) {
      expect(seenInEffect.editorDestroyed).toBe(true);
    }
    expect(seenInEffect.valueAfterSet).toBe('hello');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0].text).toBe('hello');
  });

  it('clears through the clear command once the live editor renders', async () => {
    const SuspendOnce = createSuspendOnce(50);
    const ref = createRef<TokenizedSearchInputRef>();
    const onClear = vi.fn();
    const seenInEffect: { valueAfterClear?: string } = {};
    function SearchPage() {
      useEffect(() => {
        ref.current?.clear();
        seenInEffect.valueAfterClear = ref.current?.getValue();
      }, []);
      return (
        <>
          <TokenizedSearchInput
            ref={ref}
            fields={basicFields}
            defaultValue="status:is:active"
            onClear={onClear}
          />
          <SuspendOnce />
        </>
      );
    }

    root.render(
      <Suspense fallback={<p>loading</p>}>
        <SearchPage />
      </Suspense>
    );
    await waitFor(() => {
      expect(uncaughtErrors).toEqual([]);
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    expect(seenInEffect.valueAfterClear).toBe('');
    expect(ref.current?.getValue()).toBe('');
  });

  it('applies token display set from an ancestor effect once the live editor renders', async () => {
    const SuspendOnce = createSuspendOnce(50);
    const ref = createRef<TokenizedSearchInputRef>();
    function SearchPage() {
      useEffect(() => {
        const [token] = ref.current?.getSnapshot().segments ?? [];
        if (token?.type === 'filter') {
          ref.current?.setTokenDisplay(token.id, { displayValue: 'Shown active' });
        }
      }, []);
      return (
        <>
          <TokenizedSearchInput ref={ref} fields={basicFields} defaultValue="status:is:active" />
          <SuspendOnce />
        </>
      );
    }

    root.render(
      <Suspense fallback={<p>loading</p>}>
        <SearchPage />
      </Suspense>
    );
    await waitFor(() => {
      expect(uncaughtErrors).toEqual([]);
      expect(ref.current?.getValue()).toBe('status:is:active');
      expect(container.textContent).toContain('Shown active');
    });
  });
});
