import type { NodeViewProps } from '@tiptap/react';
import { getEditorContextFromEditor } from '../../extensions/editor-context';
import { cn } from '../../utils/cn';
import { Token } from '../composition';

export const FreeTextTokenView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  editor,
  getPos,
}) => {
  const { value, quoted } = node.attrs;

  const editorContext = getEditorContextFromEditor(editor);
  const classNames = editorContext.classNames;

  const handleValueChange = (newValue: string) => {
    // Auto-convert to quoted token when space is entered in non-quoted token
    if (!quoted && newValue.includes(' ')) {
      updateAttributes({ value: newValue, quoted: true });
    } else {
      updateAttributes({ value: newValue });
    }
  };

  // Allow space insertion at non-end position for non-quoted tokens
  // This enables auto-quote conversion via onChange
  const handleSpaceNotAtEnd = (_cursorState: { atStart: boolean }) => {
    return !quoted;
  };

  return (
    <Token
      editor={editor}
      getPos={getPos}
      node={node}
      updateAttributes={updateAttributes}
      deleteNode={deleteNode}
      ariaLabel={`Free text: ${value}`}
      className={classNames?.token}
      dataAttrs={{ 'data-free-text-token': '', 'data-quoted': String(quoted) }}
    >
      {quoted && <span className="tsi-free-text-quote">"</span>}
      <Token.Value
        value={value || ''}
        onChange={handleValueChange}
        allowSpaces={quoted}
        className={cn('tsi-text-foreground', classNames?.tokenValue)}
        ariaLabel="Free text value"
        onSpaceNotAtEnd={handleSpaceNotAtEnd}
      />
      {quoted && <span className="tsi-free-text-quote--end">"</span>}
      <Token.DeleteButton ariaLabel="Remove free text" className={classNames?.tokenDeleteButton} />
    </Token>
  );
};
