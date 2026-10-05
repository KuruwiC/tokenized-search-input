import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { CustomSuggestion, FieldDefinition } from '../../index';
import {
  afterLastToken,
  caretLocation,
  editingTokenIndex,
  expectCaretBetween,
  fields,
  gapBetween,
  type MountedEditor,
  mountEditor,
  type Point,
} from './harness';

const colorField: FieldDefinition = {
  key: 'color',
  label: 'Color',
  type: 'enum',
  operators: ['is'],
  enumValues: ['red', 'green', 'blue'],
};

const suggestion = () => document.querySelector<HTMLElement>('[data-suggestion-root]');

async function expectSuggestionOpen(): Promise<void> {
  await vi.waitFor(() => expect(suggestion()).not.toBeNull());
}

async function expectSuggestionClosed(): Promise<void> {
  await vi.waitFor(() => expect(suggestion()).toBeNull());
}

/** A point just past the start of character `offset` of the first text in the editor. */
function insideText(m: MountedEditor, offset: number): Point {
  const walker = document.createTreeWalker(m.pm, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest('[contenteditable="false"]') || !node.textContent?.trim()
        ? NodeFilter.FILTER_SKIP
        : NodeFilter.FILTER_ACCEPT,
  });
  const text = walker.nextNode();
  if (!text) throw new Error('no text in the editor');
  const range = document.createRange();
  range.setStart(text, offset);
  range.setEnd(text, offset + 1);
  const char = range.getBoundingClientRect();
  const box = m.pm.getBoundingClientRect();
  return { x: char.left + 1 - box.left, y: char.top + char.height / 2 - box.top };
}

/** Types plain text after the last token, so that the field suggestions open. */
async function typeAfterTokens(m: MountedEditor, text: string): Promise<void> {
  await userEvent.click(m.pm, { position: afterLastToken(m) });
  await userEvent.keyboard(text);
  await expectSuggestionOpen();
}

describe('a press in the editor while a suggestion is open', () => {
  describe('field suggestion', () => {
    it('puts the caret in the gap that is pressed and suggests for it', async () => {
      const m = await mountEditor('status:is:open owner:is:bob');
      await typeAfterTokens(m, ' st');
      expect(suggestion()?.textContent).not.toContain('Owner');

      await userEvent.click(m.pm, { position: gapBetween(m, 0) });

      await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
      // Nothing is typed at the gap, so every field is suggested.
      await vi.waitFor(() => expect(suggestion()?.textContent).toContain('Owner'));
    });

    it('puts the caret in the text that is pressed and closes the suggestion', async () => {
      const m = await mountEditor('hello status:is:open');
      await typeAfterTokens(m, ' st');

      await userEvent.click(m.pm, { position: insideText(m, 3) });

      await expectSuggestionClosed();
      expect(document.activeElement).toBe(m.pm);
      expect(caretLocation(m)).toMatchObject({ collapsed: true, textBefore: 'hel' });
    });
  });

  describe('value suggestion', () => {
    async function editColorValue(): Promise<MountedEditor> {
      const m = await mountEditor('hello status:is:open', { fields: [...fields, colorField] });
      await userEvent.click(m.pm, { position: afterLastToken(m) });
      await userEvent.keyboard(' color:');
      await vi.waitFor(() => expect(editingTokenIndex(m)).toBe(1));
      await userEvent.keyboard('re');
      await expectSuggestionOpen();
      return m;
    }

    it('commits the token and puts the caret in the gap that is pressed', async () => {
      const m = await editColorValue();

      await userEvent.click(m.pm, { position: gapBetween(m, 0) });

      // The value suggestion closes with the token; the gap may suggest fields.
      await vi.waitFor(() => expect(suggestion()?.textContent ?? '').not.toContain('green'));
      expect(editingTokenIndex(m)).toBe(-1);
      expect(m.value()).toBe('hello status:is:open color:is:re');
      await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
    });

    it('commits the token and puts the caret in the text that is pressed', async () => {
      const m = await editColorValue();

      await userEvent.click(m.pm, { position: insideText(m, 3) });

      await expectSuggestionClosed();
      expect(editingTokenIndex(m)).toBe(-1);
      expect(m.value()).toBe('hello status:is:open color:is:re');
      expect(document.activeElement).toBe(m.pm);
      expect(caretLocation(m)).toMatchObject({ collapsed: true, textBefore: 'hel' });
    });
  });

  describe('custom suggestion', () => {
    const custom: CustomSuggestion = {
      label: 'Open issues',
      tokens: [{ key: 'status', operator: 'is', value: 'open' }],
    };

    it('puts the caret in the gap that is pressed and closes the suggestion for the typed text', async () => {
      const m = await mountEditor('status:is:open owner:is:bob', {
        suggestions: {
          custom: { debounceMs: 0, suggest: ({ query }) => (query === '' ? [] : [custom]) },
        },
      });
      await typeAfterTokens(m, ' op');
      expect(suggestion()?.textContent).toContain('Open issues');

      await userEvent.click(m.pm, { position: gapBetween(m, 0) });

      await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
      await vi.waitFor(() => expect(suggestion()?.textContent ?? '').not.toContain('Open issues'));
    });
  });
});
