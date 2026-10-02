import { Extension } from '@tiptap/core';
import { createTokenMetaPlugin } from '../plugins/token-meta-plugin';

/**
 * Registers the token meta plugin ahead of the other extensions, so duplicate
 * token ids are re-issued before any id-keyed plugin sees the document.
 */
export const TokenMetaExtension = Extension.create({
  name: 'tokenMeta',

  priority: 1000,

  addProseMirrorPlugins() {
    return [createTokenMetaPlugin()];
  },
});
