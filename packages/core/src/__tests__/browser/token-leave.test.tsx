import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  afterLastToken,
  editingTokenIndex,
  finishAnimations,
  type MountedEditor,
  mountEditor,
  type Point,
  tokenElements,
  waitForFrames,
} from './harness';

/** Starts a token of the immutable `lock` field after `status:is:a` and types a value. */
async function editLockToken(): Promise<MountedEditor> {
  const m = await mountEditor('status:is:a');
  await userEvent.click(m.pm, { position: afterLastToken(m) });
  await userEvent.keyboard(' lock:');
  await waitForFrames(() => expect(editingTokenIndex(m)).toBe(1));
  await finishAnimations();
  await userEvent.keyboard('jp');
  return m;
}

/** A point in the editor's padding, outside its content. */
const PADDING: Point = { x: 2, y: 2 };

describe('leaving a token by a press in the editor', () => {
  it('commits the token when the row is pressed past it', async () => {
    const m = await editLockToken();

    await userEvent.click(m.pm, { position: afterLastToken(m) });

    await waitForFrames(() => expect(editingTokenIndex(m)).toBe(-1));
    expect(m.value()).toBe('status:is:a lock:is:jp');
    expect(tokenElements(m)[1]?.dataset.immutable).toBe('true');
  });

  it('commits the token when the editor padding is pressed', async () => {
    const m = await editLockToken();

    await userEvent.click(m.pm, { position: PADDING });

    await waitForFrames(() => expect(editingTokenIndex(m)).toBe(-1));
    expect(m.value()).toBe('status:is:a lock:is:jp');
    expect(tokenElements(m)[1]?.dataset.immutable).toBe('true');
  });
});
