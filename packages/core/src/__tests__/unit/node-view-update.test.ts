import { Schema } from '@tiptap/pm/model';
import { Decoration } from '@tiptap/pm/view';
import { describe, expect, it, vi } from 'vitest';
import { updateTokenNodeView } from '../../tokens/composition/node-view-update';

const schema = new Schema({
  nodes: {
    doc: { content: 'inline*' },
    text: { group: 'inline' },
    token: { group: 'inline', inline: true, atom: true },
    other: { group: 'inline', inline: true, atom: true },
  },
});
const node = schema.nodes.token.create();
const validation = { ruleId: 'r', reason: 'x' };

describe('updateTokenNodeView', () => {
  it('does not re-render when only the position of an equal decoration moved', () => {
    const updateProps = vi.fn();
    updateTokenNodeView({
      oldNode: node,
      newNode: node,
      oldDecorations: [Decoration.node(1, 2, {}, { tokenValidation: validation })],
      newDecorations: [Decoration.node(4, 5, {}, { tokenValidation: validation })],
      updateProps,
    });
    expect(updateProps).not.toHaveBeenCalled();
  });

  it('re-renders when a decoration spec value changed', () => {
    const updateProps = vi.fn();
    updateTokenNodeView({
      oldNode: node,
      newNode: node,
      oldDecorations: [Decoration.node(1, 2, {}, { tokenValidation: validation })],
      newDecorations: [Decoration.node(1, 2, {}, { tokenValidation: { ...validation } })],
      updateProps,
    });
    expect(updateProps).toHaveBeenCalledTimes(1);
  });

  it('refuses a node of another type, so the view is recreated', () => {
    const updateProps = vi.fn();
    const handled = updateTokenNodeView({
      oldNode: node,
      newNode: schema.nodes.other.create(),
      oldDecorations: [],
      newDecorations: [],
      updateProps,
    });
    expect(handled).toBe(false);
    expect(updateProps).not.toHaveBeenCalled();
  });

  it('re-renders when the node changed and the decorations did not', () => {
    const updateProps = vi.fn();
    const handled = updateTokenNodeView({
      oldNode: node,
      newNode: schema.nodes.token.create(),
      oldDecorations: [],
      newDecorations: [],
      updateProps,
    });
    expect(handled).toBe(true);
    expect(updateProps).toHaveBeenCalledTimes(1);
  });

  it('re-renders when a decoration was added or removed', () => {
    const decoration = Decoration.node(1, 2, {}, { tokenValidation: validation });
    for (const [oldDecorations, newDecorations] of [
      [[], [decoration]],
      [[decoration], []],
    ]) {
      const updateProps = vi.fn();
      const handled = updateTokenNodeView({
        oldNode: node,
        newNode: node,
        oldDecorations,
        newDecorations,
        updateProps,
      });
      expect(handled).toBe(true);
      expect(updateProps).toHaveBeenCalledTimes(1);
    }
  });

  it('accepts the same node with the same decorations without re-rendering', () => {
    const updateProps = vi.fn();
    const handled = updateTokenNodeView({
      oldNode: node,
      newNode: node,
      oldDecorations: [],
      newDecorations: [],
      updateProps,
    });
    expect(handled).toBe(true);
    expect(updateProps).not.toHaveBeenCalled();
  });
});
