/**
 * The suggestion overlay and the combobox attributes re-render when the suggestion state
 * changes, and not for a transaction that leaves it as it was. The overlay renders again
 * as its position settles. Renders are counted by wrapping the two components.
 */
import { act, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeSuggestion, openFieldSuggestion } from '../../plugins/suggestion';
import { basicFields } from '../fixtures';
import { mountInput } from '../helpers/mount-input';

const renders = vi.hoisted(() => ({ overlay: 0, aria: 0 }));

vi.mock('../../suggestions/suggestion-overlay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../suggestions/suggestion-overlay')>();
  const CountedOverlay = (props: Parameters<typeof actual.SuggestionOverlay>[0]) => {
    renders.overlay++;
    return actual.SuggestionOverlay(props);
  };
  return { ...actual, SuggestionOverlay: CountedOverlay };
});

vi.mock('../../editor/suggestion-aria', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../editor/suggestion-aria')>();
  const CountedAria = (props: Parameters<typeof actual.SuggestionAria>[0]) => {
    renders.aria++;
    return actual.SuggestionAria(props);
  };
  return { ...actual, SuggestionAria: CountedAria };
});

afterEach(() => {
  cleanup();
});

function resetRenders(): void {
  renders.overlay = 0;
  renders.aria = 0;
}

describe('Suggestion renders', () => {
  it('re-renders neither for transactions that leave the suggestion state as it was', async () => {
    const { editor } = await mountInput('status:is:active');
    resetRenders();

    act(() => {
      for (let i = 0; i < 3; i++) editor.view.dispatch(editor.state.tr.setMeta('unrelated', i));
    });

    expect(renders).toEqual({ overlay: 0, aria: 0 });
  });

  it('re-renders as many times when the suggestion opens and when it closes', async () => {
    const { editor } = await mountInput('status:is:active');
    resetRenders();

    act(() => {
      editor.view.dispatch(openFieldSuggestion(editor.state.tr, basicFields, '', 1));
    });
    expect(renders).toEqual({ overlay: 3, aria: 1 });

    resetRenders();
    act(() => {
      editor.view.dispatch(closeSuggestion(editor.state.tr));
    });
    expect(renders).toEqual({ overlay: 3, aria: 1 });
  });
});
