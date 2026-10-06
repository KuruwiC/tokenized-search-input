// @vitest-environment node

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../index';

describe('SSR compatibility', () => {
  it('imports and renders without browser globals', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const markup = renderToStaticMarkup(
        <TokenizedSearchInput
          fields={[{ key: 'status', label: 'Status', type: 'string', operators: ['is'] }]}
        />
      );
      expect(markup).toBe(
        '<div class="tsi-root"><div class="tsi-container"><div class="tsi-input tsi-input--full-width"></div><div class="tsi-placeholder" aria-hidden="true">Search...</div></div></div>'
      );
      expect(warning).toHaveBeenCalledWith(expect.stringContaining('immediatelyRender'));
    } finally {
      warning.mockRestore();
    }
  });
});
