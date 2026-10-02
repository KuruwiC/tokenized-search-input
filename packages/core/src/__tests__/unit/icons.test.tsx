import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Check } from '../../icons/check';
import { ChevronDown } from '../../icons/chevron-down';
import { ChevronLeft } from '../../icons/chevron-left';
import { ChevronRight } from '../../icons/chevron-right';
import { X } from '../../icons/x';

const icons = { Check, ChevronDown, ChevronLeft, ChevronRight, X };

describe.each(Object.entries(icons))('%s icon', (_name, Icon) => {
  it('is hidden from assistive technology and drawn with currentColor', () => {
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
    expect(svg?.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('applies the size prop to width and height', () => {
    const { container } = render(<Icon size={12} className="custom" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('12');
    expect(svg?.getAttribute('height')).toBe('12');
    expect(svg?.getAttribute('class')).toBe('custom');
  });
});
