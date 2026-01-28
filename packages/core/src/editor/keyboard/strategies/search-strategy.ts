import { canAutoTokenize } from '../guards';
import type { KeyboardCallbacks, KeyboardContext } from '../types';

// Called after suggestion and tokenize handlers.
export function handleEnterSubmit(ctx: KeyboardContext, callbacks: KeyboardCallbacks): boolean {
  if (!canAutoTokenize(ctx.editor)) {
    return false;
  }

  // Finalize input based on freeTextMode (tokenize, remove, or no-op)
  ctx.editor.commands.finalizeInput();

  // Execute submit
  callbacks.onSubmit();
  return true;
}
