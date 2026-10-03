import type { JSONContent } from '@tiptap/core';
import { NODE_TYPE_NAMES } from './node-predicates';

/**
 * Visitor interface for processing TipTap document nodes.
 */
export interface NodeVisitor<TContext> {
  filterToken?: (node: JSONContent, ctx: TContext) => void;
  freeTextToken?: (node: JSONContent, ctx: TContext) => void;
  text?: (node: JSONContent, ctx: TContext) => void;
  /** Call visitChildren() to process child nodes. */
  paragraph?: (node: JSONContent, ctx: TContext, visitChildren: () => void) => void;
  doc?: (node: JSONContent, ctx: TContext, visitChildren: () => void) => void;
  default?: (node: JSONContent, ctx: TContext) => void;
}

/**
 * Visits all nodes in a TipTap document, calling the visitor method for each node type and
 * passing `context` to every call.
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
