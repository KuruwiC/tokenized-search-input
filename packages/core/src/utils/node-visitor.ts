import type { JSONContent } from '@tiptap/core';
import { NODE_TYPE_NAMES } from './node-predicates';

/**
 * Visitor interface for processing TipTap document nodes.
 * Each method is optional - only implement handlers for node types you care about.
 *
 * @template TContext - Context passed to each visitor method
 */
export interface NodeVisitor<TContext> {
  filterToken?: (node: JSONContent, ctx: TContext) => void;
  freeTextToken?: (node: JSONContent, ctx: TContext) => void;
  /** Visual separators, not serialized */
  spacer?: (node: JSONContent, ctx: TContext) => void;
  text?: (node: JSONContent, ctx: TContext) => void;
  /** Call visitChildren() to process child nodes. */
  paragraph?: (node: JSONContent, ctx: TContext, visitChildren: () => void) => void;
  doc?: (node: JSONContent, ctx: TContext, visitChildren: () => void) => void;
  default?: (node: JSONContent, ctx: TContext) => void;
}

/**
 * Visit all nodes in a TipTap document using the Visitor pattern.
 * Recursively processes the document tree, calling appropriate visitor methods.
 *
 * @param doc - The TipTap document (JSONContent)
 * @param visitor - Visitor object with handlers for each node type
 * @param context - Context passed to each visitor method
 */
export function visitDocument<TContext>(
  doc: JSONContent,
  visitor: NodeVisitor<TContext>,
  context: TContext
): void {
  const visit = (node: JSONContent): void => {
    const visitChildren = () => {
      if (node.content) {
        node.content.forEach(visit);
      }
    };

    switch (node.type) {
      case NODE_TYPE_NAMES.doc:
        if (visitor.doc) {
          visitor.doc(node, context, visitChildren);
        } else {
          visitChildren();
        }
        break;

      case NODE_TYPE_NAMES.paragraph:
        if (visitor.paragraph) {
          visitor.paragraph(node, context, visitChildren);
        } else {
          visitChildren();
        }
        break;

      case NODE_TYPE_NAMES.filterToken:
        visitor.filterToken?.(node, context);
        break;

      case NODE_TYPE_NAMES.freeTextToken:
        visitor.freeTextToken?.(node, context);
        break;

      case NODE_TYPE_NAMES.spacer:
        visitor.spacer?.(node, context);
        break;

      case NODE_TYPE_NAMES.text:
        visitor.text?.(node, context);
        break;

      default:
        if (visitor.default) {
          visitor.default(node, context);
        }
        // Recursively visit children for unknown container nodes
        visitChildren();
        break;
    }
  };

  visit(doc);
}
