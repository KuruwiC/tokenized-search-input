import { canAutoTokenize } from '../guards';
import type { KeyboardContext } from '../types';

// Called after suggestion and tokenize handlers.
export function handleEnterSubmit(ctx: KeyboardContext): boolean {
  if (!canAutoTokenize(ctx.editor)) {
    return false;
  }
  ctx.editor.commands.submit();
  return true;
}
