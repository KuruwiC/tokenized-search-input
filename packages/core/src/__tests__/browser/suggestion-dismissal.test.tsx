import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { getSuggestionState, isSuggestionOpen } from '../../plugins/suggestion';
import { afterLastToken, type MountedEditor, mountEditor } from './harness';

const suggestion = () => document.querySelector<HTMLElement>('[data-suggestion-root]');

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

async function frames(count: number): Promise<void> {
  for (let i = 0; i < count; i++) await frame();
}

async function openFieldSuggestions(): Promise<MountedEditor> {
  const m = await mountEditor('owner:is:x ');
  await userEvent.click(m.pm, { position: afterLastToken(m) });
  await vi.waitFor(() => expect(suggestion()).not.toBeNull());
  await frames(2);
  return m;
}

/**
 * Moves the caret and presses `key` in one task, so the re-evaluation the move schedules for
 * the next frame is still pending when the key closes the list.
 */
function moveCaretAndPress(m: MountedEditor, key: string): void {
  const end = m.editor.state.doc.content.size - 1;
  const before = m.editor.state.selection.from;
  m.editor.commands.setTextSelection(before === end ? end - 1 : end);
  expect(m.editor.state.selection.from).not.toBe(before);
  m.pm.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('a suggestion list the user closes before a pending re-evaluation runs', () => {
  it.each(['Escape', 'Enter'])('stays closed after %s', async (key) => {
    const m = await openFieldSuggestions();

    moveCaretAndPress(m, key);
    expect(isSuggestionOpen(getSuggestionState(m.editor.state))).toBe(false);
    await frames(4);

    expect(suggestion()).toBeNull();
    expect(m.pm.getAttribute('aria-expanded')).not.toBe('true');
  });

  it('opens again on the next key typed', async () => {
    const m = await openFieldSuggestions();
    moveCaretAndPress(m, 'Escape');
    await frames(4);

    await userEvent.keyboard('s');

    await vi.waitFor(() => expect(suggestion()?.textContent).toContain('Status'));
  });
});
