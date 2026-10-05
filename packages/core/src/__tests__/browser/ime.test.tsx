import { describe, expect, it } from 'vitest';
import { cdp, commands, server, userEvent } from 'vitest/browser';
import {
  afterLastToken,
  beforeFirstToken,
  expectCaretBetween,
  expectCaretWithText,
  gapBetween,
  type MountedEditor,
  mountEditor,
  mountWrapped,
  tokenElements,
} from './harness';

const TWO_TOKENS = 'status:is:open owner:is:bob';

/*
 * How composition is driven:
 * - chromium: the DevTools Input domain. `imeSetComposition` updates the pre-edit text and
 *   `insertText` commits it, so the page receives real compositionstart / compositionupdate /
 *   compositionend events with isComposing input events in between.
 * - webkit: Playwright has no IME protocol for it. The commit is a real text insertion from the
 *   `insertText` browser command (a beforeinput/input pair without composition events), wrapped
 *   in synthetic composition events dispatched on the editor, so the editor's composition
 *   handling is entered and left around a genuine browser insertion.
 */
const hasImeProtocol = () => server.browser === 'chromium';

function compositionEvent(m: MountedEditor, type: string, data: string): void {
  m.pm.dispatchEvent(new CompositionEvent(type, { bubbles: true, data }));
}

async function startComposition(m: MountedEditor, preedit: readonly string[]): Promise<void> {
  if (hasImeProtocol()) {
    for (const text of preedit) {
      await cdp().send('Input.imeSetComposition', {
        text,
        selectionStart: text.length,
        selectionEnd: text.length,
      });
    }
    return;
  }
  compositionEvent(m, 'compositionstart', '');
  for (const text of preedit) compositionEvent(m, 'compositionupdate', text);
}

async function commitComposition(m: MountedEditor, committed: string): Promise<void> {
  if (hasImeProtocol()) {
    await cdp().send('Input.insertText', { text: committed });
    return;
  }
  await commands.insertText(committed);
  compositionEvent(m, 'compositionend', committed);
}

async function cancelComposition(m: MountedEditor): Promise<void> {
  if (hasImeProtocol()) {
    await cdp().send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
    return;
  }
  compositionEvent(m, 'compositionend', '');
}

async function compose(m: MountedEditor, preedit: readonly string[], committed: string) {
  await startComposition(m, preedit);
  await commitComposition(m, committed);
}

function recordCompositionEvents(m: MountedEditor): string[] {
  const seen: string[] = [];
  for (const type of ['compositionstart', 'compositionend']) {
    m.pm.addEventListener(type, () => seen.push(type));
  }
  return seen;
}

describe('IME composition', () => {
  it('commits composed text between two tokens', async () => {
    const m = await mountEditor(TWO_TOKENS);
    const events = recordCompositionEvents(m);
    await userEvent.click(m.pm, { position: gapBetween(m, 0) });

    await compose(m, ['に', 'にほ'], '日本');
    expect(m.value()).toBe('status:is:open 日本 owner:is:bob');
    expect(tokenElements(m)).toHaveLength(2);
    expect(events).toEqual(['compositionstart', 'compositionend']);
    await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
  });

  it('commits composed text after the last token', async () => {
    const m = await mountEditor(TWO_TOKENS);
    await userEvent.click(m.pm, { position: afterLastToken(m) });

    await compose(m, ['に', 'にほ', 'にほん'], '日本語');
    expect(m.value()).toBe('status:is:open owner:is:bob 日本語');
    await expectCaretBetween(m, { tokensBefore: 2, tokensAfter: 0 });
  });

  it('commits composed text before the first token', async () => {
    const m = await mountEditor(TWO_TOKENS);
    await userEvent.click(m.pm, { position: beforeFirstToken(m) });

    await compose(m, ['に'], '日');
    expect(m.value()).toBe('日 status:is:open owner:is:bob');
    await expectCaretBetween(m, { tokensBefore: 0, tokensAfter: 2 });
  });

  it('replaces a backward selection that holds a token with the composed text', async () => {
    const m = await mountEditor(TWO_TOKENS);
    await userEvent.click(m.pm, { position: gapBetween(m, 0) });
    await userEvent.click(m.pm, { position: beforeFirstToken(m), modifiers: ['Shift'] });
    expect(m.editor.state.selection.empty).toBe(false);

    await compose(m, ['に'], '日');
    expect(m.value()).toBe('日 owner:is:bob');
    expect(tokenElements(m)).toHaveLength(1);
  });

  it('leaves the tokens in place while a composition is in progress', async () => {
    const m = await mountEditor(TWO_TOKENS);
    await userEvent.click(m.pm, { position: gapBetween(m, 0) });

    await startComposition(m, ['に']);
    expect(tokenElements(m)).toHaveLength(2);
    expect(m.value()).toContain('status:is:open');
    expect(m.value()).toContain('owner:is:bob');

    await commitComposition(m, '日');
    expect(m.value()).toBe('status:is:open 日 owner:is:bob');
  });

  it('keeps the query unchanged when a composition is cancelled', async () => {
    const m = await mountEditor(TWO_TOKENS);
    await userEvent.click(m.pm, { position: gapBetween(m, 0) });

    await startComposition(m, ['に']);
    await cancelComposition(m);
    expect(m.value()).toBe(TWO_TOKENS);
    expect(tokenElements(m)).toHaveLength(2);
  });

  it('accepts ordinary typing and deletion after a composition', async () => {
    const m = await mountEditor(TWO_TOKENS);
    await userEvent.click(m.pm, { position: gapBetween(m, 0) });
    await compose(m, ['に', 'にほ'], '日本');

    await userEvent.keyboard('a');
    expect(m.value()).toBe('status:is:open 日本a owner:is:bob');

    await userEvent.keyboard('{Backspace}{Backspace}');
    expect(m.value()).toBe('status:is:open 日 owner:is:bob');
    await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
  });

  it('commits composed text at the end of a row before a token that wrapped to the next', async () => {
    const m = await mountWrapped(TWO_TOKENS);
    m.editor.chain().focus().setTextSelection(2).run();
    await expect.poll(() => document.activeElement).toBe(m.pm);

    await compose(m, ['に'], '日');
    expect(m.value()).toBe('status:is:open 日 owner:is:bob');
    await expectCaretWithText(m, -1);

    await compose(m, ['ほ'], '本');
    expect(m.value()).toBe('status:is:open 日本 owner:is:bob');
    await expectCaretWithText(m, -1);
  });
});
