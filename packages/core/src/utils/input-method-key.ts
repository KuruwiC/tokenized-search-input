const INPUT_METHOD_KEY_CODE = 229;

/**
 * Whether an input method takes the key: it is composing text, or the keydown names no key of
 * its own (keyCode 229), as the one that starts a composition does.
 */
export function isInputMethodKey(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === INPUT_METHOD_KEY_CODE;
}
