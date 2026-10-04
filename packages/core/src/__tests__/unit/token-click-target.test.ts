/**
 * Unit tests for resolveClickTarget: which part of a token a press lands on.
 */
import { describe, expect, it } from 'vitest';
import { resolveClickTarget } from '../../tokens/composition/token';

function token(): Record<
  'label' | 'operator' | 'value' | 'delete' | 'padding' | 'text',
  HTMLElement
> {
  const root = document.createElement('span');
  root.innerHTML = `
    <span class="padding">
      <span data-token-block="label"><span class="text">Status</span></span>
      <button data-token-block="operator"></button>
      <input data-token-block="value" />
      <button data-token-block="delete"><svg></svg></button>
    </span>`;
  const find = (selector: string): HTMLElement => {
    const element = root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`missing ${selector}`);
    return element;
  };
  return {
    label: find('[data-token-block="label"]'),
    operator: find('[data-token-block="operator"]'),
    value: find('[data-token-block="value"]'),
    delete: find('[data-token-block="delete"]'),
    padding: find('.padding'),
    text: find('.text'),
  };
}

const plain = { shiftKey: false };

describe('resolveClickTarget', () => {
  it('names the block a press lands in, including what it contains', () => {
    const parts = token();

    expect(resolveClickTarget(plain, parts.label)).toBe('label');
    expect(resolveClickTarget(plain, parts.text)).toBe('label');
    expect(resolveClickTarget(plain, parts.operator)).toBe('operator');
    expect(resolveClickTarget(plain, parts.delete)).toBe('delete');
    expect(resolveClickTarget(plain, parts.delete.firstElementChild as Element)).toBe('delete');
  });

  it('acts on the value for a press anywhere else', () => {
    expect(resolveClickTarget(plain, token().padding)).toBe('value');
  });

  it('leaves a press in a text input to the input', () => {
    expect(resolveClickTarget(plain, token().value)).toBe('text-selection');
  });

  it('leaves a press with Shift held to the selection, except on the delete button', () => {
    const parts = token();
    const shift = { shiftKey: true };

    expect(resolveClickTarget(shift, parts.padding)).toBe('text-selection');
    expect(resolveClickTarget(shift, parts.label)).toBe('text-selection');
    expect(resolveClickTarget(shift, parts.delete)).toBe('delete');
  });
});
