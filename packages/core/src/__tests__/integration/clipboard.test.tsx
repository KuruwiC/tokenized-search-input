/**
 * Copy, cut and paste as the browser delivers them: DOM events that carry a
 * `clipboardData` object, handled by the editor's clipboard serializer and by its
 * paste handling.
 *
 * jsdom has neither `ClipboardEvent` nor `DataTransfer`. The handlers only call
 * `getData`, `setData` and `clearData` on `clipboardData`, so each event carries an
 * in-memory stand-in with those methods.
 */
import { act, cleanup, createEvent, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FreeTextMode } from '../../types';
import { fieldsWithDotNotation } from '../fixtures';
import { mountInput } from '../helpers/mount-input';

const testFields = fieldsWithDotNotation;

afterEach(() => {
  cleanup();
});

class ClipboardData {
  private readonly data = new Map<string, string>();

  constructor(plainText?: string) {
    if (plainText !== undefined) this.setData('text/plain', plainText);
  }

  get types(): string[] {
    return [...this.data.keys()];
  }

  getData(type: string): string {
    return this.data.get(type) ?? '';
  }

  setData(type: string, value: string): void {
    this.data.set(type, value);
  }

  clearData(): void {
    this.data.clear();
  }
}

/** Dispatches the clipboard event on the editor and reports whether the editor handled it. */
function dispatchClipboardEvent(
  editor: Editor,
  type: 'copy' | 'cut' | 'paste',
  clipboardData: ClipboardData
): boolean {
  const event = createEvent[type](editor.view.dom, { clipboardData });
  act(() => {
    fireEvent(editor.view.dom, event);
  });
  return event.defaultPrevented;
}

function selectAll(editor: Editor): void {
  act(() => {
    editor.commands.selectAll();
  });
}

function copyAll(editor: Editor): { clipboard: ClipboardData; handled: boolean } {
  selectAll(editor);
  const clipboard = new ClipboardData();
  return { clipboard, handled: dispatchClipboardEvent(editor, 'copy', clipboard) };
}

async function pasteIntoEmpty(text: string, freeTextMode: FreeTextMode = 'tokenize') {
  const mounted = await mountInput('', { fields: testFields, freeTextMode });
  dispatchClipboardEvent(mounted.editor, 'paste', new ClipboardData(text));
  return mounted;
}

describe('copy', () => {
  it('writes the query as plain text only when the selection holds tokens', async () => {
    const query = 'status:is:active "search term" priority:is_not:low keyword';
    const { editor, value } = await mountInput(query, {
      fields: testFields,
      freeTextMode: 'tokenize',
    });

    const { clipboard, handled } = copyAll(editor);

    expect(handled).toBe(true);
    expect(clipboard.types).toEqual(['text/plain']);
    expect(clipboard.getData('text/plain')).toBe(value());
    expect(clipboard.getData('text/plain')).toBe(query);
  });

  it('writes each token as serialization.serializeToken returns it', async () => {
    const { editor } = await mountInput('status:is:active priority:is:high', {
      fields: testFields,
      serialization: { serializeToken: (token) => `[${token.key}]` },
    });

    const { clipboard } = copyAll(editor);

    expect(clipboard.getData('text/plain')).toBe('[status] [priority]');
  });

  it('leaves a selection without tokens to the default copy', async () => {
    const { editor } = await mountInput('hello world', { fields: testFields });

    const { clipboard, handled } = copyAll(editor);

    expect(handled).toBe(true);
    expect(clipboard.getData('text/plain')).toBe('hello world');
    expect(clipboard.types).toContain('text/html');
  });

  it('writes nothing when the selection is empty', async () => {
    const { editor } = await mountInput('status:is:active', { fields: testFields });
    act(() => {
      editor.commands.setTextSelection(1);
    });
    const clipboard = new ClipboardData();

    const handled = dispatchClipboardEvent(editor, 'copy', clipboard);

    expect(handled).toBe(false);
    expect(clipboard.types).toEqual([]);
  });

  it('writes the value a token was edited to', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { editor } = await mountInput('status:is:active', { fields: testFields, onChange });
    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    // Edit token: change value to trigger onChange
    await user.click(screen.getByRole('group', { name: /Filter: status/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
    });
    const valueInput = screen.getByPlaceholderText('...');
    await user.clear(valueInput);
    await user.type(valueInput, 'inactive');
    await user.keyboard('{Enter}');

    // Check serialized output with new value
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'status:is:inactive' })
      );
    });
    const { clipboard } = copyAll(editor);
    expect(clipboard.getData('text/plain')).toBe('status:is:inactive');
  });

  it('writes the edited token and leaves the others as they were', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { editor } = await mountInput('status:is:active priority:is:high', {
      fields: testFields,
      onChange,
    });
    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Priority')).toBeInTheDocument();
    });

    // Edit status token
    await user.click(screen.getByRole('group', { name: /Filter: status/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
    });

    // Change value
    const valueInput = screen.getByPlaceholderText('...');
    await user.clear(valueInput);
    await user.type(valueInput, 'inactive');
    await user.keyboard('{Enter}');

    // Verify only the edited token changed
    await waitFor(() => {
      const snapshot = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(snapshot.text).toContain('status:is:inactive');
      expect(snapshot.text).toContain('priority:is:high');
    });
    const { clipboard } = copyAll(editor);
    expect(clipboard.getData('text/plain')).toBe('status:is:inactive priority:is:high');
  });
});

describe('cut', () => {
  it('writes the query as plain text and removes the selection', async () => {
    const { editor, value } = await mountInput('status:is:active "search term"', {
      fields: testFields,
      freeTextMode: 'tokenize',
    });
    selectAll(editor);
    const clipboard = new ClipboardData();

    const handled = dispatchClipboardEvent(editor, 'cut', clipboard);

    expect(handled).toBe(true);
    expect(clipboard.types).toEqual(['text/plain']);
    expect(clipboard.getData('text/plain')).toBe('status:is:active "search term"');
    expect(value()).toBe('');
    expect(document.querySelectorAll('.node-filterToken')).toHaveLength(0);
  });

  it('leaves the document alone when the selection is empty', async () => {
    const { editor, value } = await mountInput('status:is:active', { fields: testFields });
    act(() => {
      editor.commands.setTextSelection(1);
    });
    const clipboard = new ClipboardData();

    const handled = dispatchClipboardEvent(editor, 'cut', clipboard);

    expect(handled).toBe(false);
    expect(clipboard.types).toEqual([]);
    expect(value()).toBe('status:is:active');
  });
});

describe('paste', () => {
  it('reads a single filter token', async () => {
    await pasteIntoEmpty('status:is:active');

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('is')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
    });
  });

  it('reads multiple filter tokens', async () => {
    await pasteIntoEmpty('status:is:active priority:is:high');

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Priority')).toBeInTheDocument();
    });
  });

  it('reads a filter token with the is_not operator', async () => {
    await pasteIntoEmpty('status:is_not:inactive');

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('is not')).toBeInTheDocument();
      expect(screen.getByText('inactive')).toBeInTheDocument();
    });
  });

  it('reads a filter token with the contains operator', async () => {
    await pasteIntoEmpty('user.email:contains:@example.com');

    await waitFor(() => {
      expect(screen.getByText('User Email')).toBeInTheDocument();
      expect(screen.getByText('contains')).toBeInTheDocument();
      expect(screen.getByText('@example.com')).toBeInTheDocument();
    });
  });

  it('reads a comma in a value as part of the one value', async () => {
    await pasteIntoEmpty('status:is:active,pending');

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
      // Comma-containing value is treated as single string
      expect(screen.getByText('active,pending')).toBeInTheDocument();
    });
  });

  it('reads free text as free text tokens in tokenize mode', async () => {
    await pasteIntoEmpty('status:is:active "search term"', 'tokenize');

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /Free text: search term/i })).toBeInTheDocument();
    });
  });

  it('reads mixed filter and free text tokens', async () => {
    await pasteIntoEmpty('status:is:active keyword priority:is:high', 'tokenize');

    await waitFor(() => {
      expect(screen.getByRole('group', { name: /Filter: status/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /Free text: keyword/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /Filter: priority/i })).toBeInTheDocument();
    });
  });

  it('reads filter tokens as token nodes in plain mode and keeps the free text plain', async () => {
    const { editor, value } = await pasteIntoEmpty(
      'status:is:active freetext priority:is:high',
      'plain'
    );

    await waitFor(() => {
      // Filter tokens should be rendered as token nodes
      expect(screen.getByRole('group', { name: /Filter: status/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /Filter: priority/i })).toBeInTheDocument();
    });
    const nodes: string[] = [];
    editor.state.doc.firstChild?.forEach((node) => {
      nodes.push(node.isText ? `text:${node.text}` : node.type.name);
    });
    expect(nodes).toEqual(['filterToken', 'text:freetext', 'filterToken']);
    expect(screen.queryByRole('group', { name: /Free text/i })).not.toBeInTheDocument();
    expect(value()).toBe('status:is:active freetext priority:is:high');
  });

  it('reads filter tokens as token nodes in none mode and drops the free text', async () => {
    await pasteIntoEmpty('status:is:active freetext priority:is:high', 'none');

    await waitFor(() => {
      // Filter tokens should be rendered as token nodes
      expect(screen.getByRole('group', { name: /Filter: status/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /Filter: priority/i })).toBeInTheDocument();
      // Free text should be ignored in none mode
      expect(screen.queryByText('freetext')).not.toBeInTheDocument();
    });
  });

  it('reads a query with every token type', async () => {
    await pasteIntoEmpty('status:is:active "search term" priority:is_not:low keyword', 'tokenize');

    await waitFor(() => {
      expect(screen.getByRole('group', { name: /Filter: status/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /Free text: search term/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /Filter: priority/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /Free text: keyword/i })).toBeInTheDocument();
    });
  });
});

describe('copy then paste', () => {
  it.each([
    ['tokenize', 'status:is:active "search term" priority:is_not:low keyword'],
    ['plain', 'status:is:active hello priority:is_not:low'],
  ] satisfies [
    FreeTextMode,
    string,
  ][])('brings back the query that was copied in %s mode', async (mode, query) => {
    const { editor, value } = await mountInput(query, {
      fields: testFields,
      freeTextMode: mode,
    });
    const { clipboard } = copyAll(editor);
    act(() => {
      editor.commands.clearContent();
    });
    expect(value()).toBe('');

    dispatchClipboardEvent(editor, 'paste', clipboard);

    await waitFor(() => expect(value()).toBe(query));
    expect(document.querySelectorAll('.node-filterToken')).toHaveLength(2);
  });
});
