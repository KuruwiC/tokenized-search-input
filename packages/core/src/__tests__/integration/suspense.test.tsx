import { createRef, type ReactNode, Suspense, useEffect, version } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import type { QuerySnapshot } from '../../types';
import { basicFields } from '../fixtures';
import { getInternalEditor } from '../helpers/get-editor';

function createDeferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

// The suspension starts on the first render of SuspendOnce, after its earlier
// sibling created an editor in that render, so the editor's deferred destroy is
// always due before the boundary resolves.
function createSuspendOnce() {
  let pending: Promise<void> | null = null;
  let resolved = false;
  return function SuspendOnce() {
    if (resolved) return null;
    pending ??= new Promise<void>((resolve) => setTimeout(resolve, 50)).then(() => {
      resolved = true;
    });
    throw pending;
  };
}

// Inside the boundary, the outermost component's passive effect runs after every
// effect of the content, once the boundary has committed.
function CommitSignal({ onCommit, children }: { onCommit: () => void; children: ReactNode }) {
  useEffect(onCommit, []);
  return children;
}

// Resolves once the container holds the text, on the mutation that adds it.
function untilText(container: HTMLElement, text: string): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (!container.textContent?.includes(text)) return false;
      observer.disconnect();
      resolve();
      return true;
    };
    const observer = new MutationObserver(check);
    if (!check()) {
      observer.observe(container, { childList: true, subtree: true, characterData: true });
    }
  });
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
    const SuspendOnce = createSuspendOnce();
    const ref = createRef<TokenizedSearchInputRef>();
    const committed = createDeferred();

    root.render(
      <Suspense fallback={<p>loading</p>}>
        <CommitSignal onCommit={committed.resolve}>
          <TokenizedSearchInput ref={ref} fields={basicFields} placeholder="search" />
          <SuspendOnce />
        </CommitSignal>
      </Suspense>
    );
    // The editor that replaces a destroyed one renders in the same task as the
    // commit, so it is in place once the commit's effects have run.
    await committed.promise;

    expect(uncaughtErrors).toEqual([]);
    const input = container.querySelector('[role="combobox"]');
    expect(input).toHaveAttribute('contenteditable', 'true');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    // A destroyed view keeps its contenteditable attribute; the combobox must be the
    // view of the editor that is live.
    const editor = getInternalEditor(ref.current);
    expect(editor?.isDestroyed).toBe(false);
    expect(editor?.view.dom).toBe(input);
  });

  it('keeps handle writes and reads ordered from an ancestor effect in the same boundary', async () => {
    const SuspendOnce = createSuspendOnce();
    const ref = createRef<TokenizedSearchInputRef>();
    const submitted = createDeferred();
    const onSubmit = vi.fn<(snapshot: QuerySnapshot) => void>(() => submitted.resolve());
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
    // The submit is the last call the effect makes; a held call runs after the
    // ones before it.
    await submitted.promise;

    expect(uncaughtErrors).toEqual([]);
    expect(container.querySelector('[role="combobox"]')).toHaveAttribute('contenteditable', 'true');
    expect(ref.current?.getValue()).toBe('hello');

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
    const SuspendOnce = createSuspendOnce();
    const ref = createRef<TokenizedSearchInputRef>();
    const cleared = createDeferred();
    const onClear = vi.fn(() => cleared.resolve());
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
    await cleared.promise;

    expect(uncaughtErrors).toEqual([]);
    expect(onClear).toHaveBeenCalledTimes(1);

    expect(seenInEffect.valueAfterClear).toBe('');
    expect(ref.current?.getValue()).toBe('');
  });

  it('applies token display set from an ancestor effect once the live editor renders', async () => {
    const SuspendOnce = createSuspendOnce();
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
    await untilText(container, 'Shown active');

    expect(uncaughtErrors).toEqual([]);
    expect(ref.current?.getValue()).toBe('status:is:active');
    expect(container.textContent).toContain('Shown active');
  });
});
