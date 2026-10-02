import { Document } from '@tiptap/extension-document';
import { Fragment, type Node as ProseMirrorNode, type Schema, Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';

function paragraphSlice(schema: Schema, content: Fragment | ProseMirrorNode[]): Slice {
  return new Slice(Fragment.from(schema.nodes.paragraph.createChecked(null, content)), 1, 1);
}

/**
 * Joins the textblocks of a pasted slice into one paragraph, with a space where one
 * textblock ends and the next begins. A slice whose inline content the paragraph
 * cannot hold is pasted as its plain text.
 */
export function joinIntoOneParagraph(slice: Slice, schema: Schema): Slice {
  const inline: ProseMirrorNode[] = [];
  let textblocks = 0;
  slice.content.descendants((node) => {
    if (!node.isTextblock) return true;
    textblocks++;
    if (node.content.size > 0) {
      if (inline.length > 0) inline.push(schema.text(' '));
      node.forEach((child) => {
        inline.push(child);
      });
    }
    return false;
  });
  if (textblocks < 2) return slice;

  try {
    return paragraphSlice(schema, inline);
  } catch {
    const text = slice.content.textBetween(0, slice.content.size, ' ', ' ');
    return paragraphSlice(schema, text ? [schema.text(text)] : []);
  }
}

export const SingleParagraphDocument = Document.extend({
  content: 'paragraph',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('singleParagraphDocument'),
        props: {
          transformPasted: (slice, view) => joinIntoOneParagraph(slice, view.state.schema),
        },
      }),
    ];
  },
});
