import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DefaultDatePicker } from '../../pickers/default-date-picker';
import type { DateFieldDefinition } from '../../types';

const field: DateFieldDefinition = { key: 'due', label: 'Due', type: 'date', operators: ['is'] };

describe('DefaultDatePicker', () => {
  it('writes the chosen day as a date', () => {
    const onChange = vi.fn();
    render(
      <DefaultDatePicker
        value={{ date: '2024-03-05' }}
        onChange={onChange}
        onClose={vi.fn()}
        fieldDef={field}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /March 10th, 2024/ }));
    expect(onChange).toHaveBeenCalledWith({ date: '2024-03-10' });
  });

  it('selects the day of the value', () => {
    render(
      <DefaultDatePicker
        value={{ date: '2024-03-05' }}
        onChange={vi.fn()}
        onClose={vi.fn()}
        fieldDef={field}
      />
    );
    expect(screen.getByRole('gridcell', { selected: true })).toHaveTextContent('5');
    expect(screen.getByRole('gridcell', { selected: true })).toContainElement(
      screen.getByRole('button', { name: /March 5th, 2024/ })
    );
  });

  it('follows the value to another month', () => {
    const props = { onChange: vi.fn(), onClose: vi.fn(), fieldDef: field };
    const { rerender } = render(<DefaultDatePicker {...props} value={{ date: '2024-03-05' }} />);
    rerender(<DefaultDatePicker {...props} value={{ date: '2024-07-04' }} />);
    expect(screen.getByRole('button', { name: /July 4th, 2024/ })).toBeInTheDocument();
  });
});
