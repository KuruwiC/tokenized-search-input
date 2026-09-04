import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TokenizedSearchInput } from '../../index';

describe('browser smoke', () => {
  it('mounts an interactive search input and accepts text', async () => {
    const { getByRole } = render(
      <TokenizedSearchInput
        fields={[{ key: 'status', label: 'Status', type: 'string', operators: ['is'] }]}
      />
    );
    const textbox = getByRole('combobox');
    expect(textbox).toBeTruthy();
    const user = userEvent.setup();
    await user.click(textbox);
    await user.keyboard('draft');
    expect(textbox).toHaveTextContent('draft');
  });
});
