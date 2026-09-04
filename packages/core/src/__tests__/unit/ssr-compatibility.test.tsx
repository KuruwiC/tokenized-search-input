// @vitest-environment node

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../index';

describe('SSR compatibility', () => {
  it('imports and renders without browser globals', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() =>
        renderToStaticMarkup(
          <TokenizedSearchInput
            fields={[{ key: 'status', label: 'Status', type: 'string', operators: ['is'] }]}
          />
        )
      ).not.toThrow();
      expect(warning).toHaveBeenCalledWith(
        'SSR detected. `immediatelyRender` has been set to false to avoid hydration mismatches'
      );
    } finally {
      warning.mockRestore();
    }
  });
});
