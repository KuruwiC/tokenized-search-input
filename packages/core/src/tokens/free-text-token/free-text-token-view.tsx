import type { NodeViewProps } from '@tiptap/react';
import { getEditorContext } from '../../extensions/editor-context';
import { useEditorContextUpdate } from '../../hooks/use-editor-context-update';
import { getDecorationValidation } from '../../plugins/token-meta-plugin';
import { Token } from '../composition';
import { applyTokenAction } from '../filter-token/token-actions';

export const FreeTextTokenView: React.FC<NodeViewProps> = ({
  node,
  deleteNode,
  editor,
  getPos,
  decorations,
}) => {
  useEditorContextUpdate(editor);
  const { id, value, quoted } = node.attrs;

  const editorContext = getEditorContext(editor);
  const classNames = editorContext.classNames;

  const rangeSelected = decorations.some((decoration) => decoration.spec?.rangeSelected === true);
  const validation = getDecorationValidation(decorations);

  const handleValueChange = (newValue: string) => {
    const tr = editor.state.tr;
    // A space typed into an unquoted token turns it into a quoted one.
    const changed = applyTokenAction(
      tr,
      id,
      { type: 'setValue', value: newValue, quoted: quoted || newValue.includes(' ') },
      editorContext
    );
    if (changed) editor.view.dispatch(tr);
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
      deleteNode={deleteNode}
      ariaLabel={`Free text: ${value}`}
      validation={validation}
      className={classNames?.token}
      dataAttrs={{ 'data-free-text-token': '', 'data-quoted': String(quoted) }}
      rangeSelected={rangeSelected}
    >
      {quoted && <span className="tsi-free-text-quote">"</span>}
      <Token.Value
        value={value || ''}
        onChange={handleValueChange}
        allowSpaces={quoted}
        containerClassName={classNames?.tokenValue}
        ariaLabel="Free text value"
        onSpaceNotAtEnd={handleSpaceNotAtEnd}
      />
      {quoted && <span className="tsi-free-text-quote--end">"</span>}
      <Token.DeleteButton ariaLabel="Remove free text" className={classNames?.tokenDeleteButton} />
    </Token>
  );
};
