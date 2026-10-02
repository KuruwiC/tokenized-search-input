import { Schema } from '@tiptap/pm/model';
import { Decoration } from '@tiptap/pm/view';
import { describe, expect, it, vi } from 'vitest';
import { updateTokenNodeView } from '../../tokens/composition/node-view-update';

const schema = new Schema({
  nodes: {
    doc: { content: 'inline*' },
    text: { group: 'inline' },
    token: { group: 'inline', inline: true, atom: true },
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
});
