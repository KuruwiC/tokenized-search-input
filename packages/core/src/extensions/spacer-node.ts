import { Node } from '@tiptap/core';

// Zero-Width Space for cursor anchoring.
// Some mobile browsers cannot render caret without text content.
const ZERO_WIDTH_SPACE = '\u200B';

/**
 * SpacerNode - Visual separator between tokens.
 *
 * Purpose:
 * - Provides clickable/tappable area between tokens
 * - Enables cursor placement and text insertion between tokens
 * - Not serialized to data (purely visual)
 *
 * Document structure:
 * [spacer][token1][spacer][spacer][token2][spacer]
 *
 * Implementation notes:
 * - renderHTML: Used for getHTML() and clipboard serialization
 * - addNodeView: Used for editor display (required for caret positioning on some mobile browsers)
 * - Both include ZWSP because they serve different purposes
 */
export const SpacerNode = Node.create({
  name: 'spacer',

  group: 'inline',

  inline: true,

  atom: true,

  selectable: false,

  draggable: false,

  parseHTML() {
    // atom: true ensures ProseMirror ignores any text content (ZWSP) when parsing
    return [{ tag: 'span[data-spacer]' }];
  },

  renderHTML() {
    return [
      'span',
      {
        'data-spacer': '',
        class: '_tsi-spacer',
      },
      ZERO_WIDTH_SPACE,
    ];
  },

  renderText() {
    return '';
  },

  addNodeView() {
    return () => {
      const dom = document.createElement('span');
      dom.setAttribute('data-spacer', '');
      dom.className = '_tsi-spacer';
      dom.textContent = ZERO_WIDTH_SPACE;

      return { dom };
    };
  },
});
