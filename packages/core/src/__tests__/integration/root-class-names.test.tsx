import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import { basicFields } from '../fixtures';

describe('root class names', () => {
  it.each([
    { expandOnFocus: false },
    { expandOnFocus: true },
  ])('puts className and classNames.root on the outermost element (expandOnFocus: $expandOnFocus)', ({
    expandOnFocus,
  }) => {
    const { container } = render(
      <TokenizedSearchInput
        fields={basicFields}
        expandOnFocus={expandOnFocus}
        className="from-class-name"
        classNames={{ root: 'from-root-slot' }}
      />
    );

    const root = container.firstElementChild;
    expect(root).toHaveClass('from-class-name', 'from-root-slot');
    expect(container.querySelectorAll('.from-class-name')).toHaveLength(1);
    expect(container.querySelectorAll('.from-root-slot')).toHaveLength(1);
    expect(root?.querySelector('.tsi-container')).not.toBeNull();
  });

  it.each([
    { expandOnFocus: false },
    { expandOnFocus: true },
  ])('puts classNames.container on the visible box inside the root (expandOnFocus: $expandOnFocus)', ({
    expandOnFocus,
  }) => {
    const { container } = render(
      <TokenizedSearchInput
        fields={basicFields}
        expandOnFocus={expandOnFocus}
        classNames={{ root: 'from-root-slot', container: 'from-container-slot' }}
      />
    );

    const boxes = container.querySelectorAll('.from-container-slot');
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toHaveClass('tsi-container');
    expect(container.firstElementChild).not.toHaveClass('from-container-slot');
  });
});
