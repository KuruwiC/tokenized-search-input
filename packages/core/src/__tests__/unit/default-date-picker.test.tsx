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

  it('leaves the day of the maximum selectable whatever time the maximum has', () => {
    render(
      <DefaultDatePicker
        value={{ date: '2024-03-05' }}
        onChange={vi.fn()}
        onClose={vi.fn()}
        fieldDef={{ ...field, maxDate: '2024-03-05T15:00' }}
      />
    );
    expect(screen.getByRole('button', { name: /March 5th, 2024/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /March 6th, 2024/ })).toBeDisabled();
  });

  it('compares a Date minimum by its local day', () => {
    render(
      <DefaultDatePicker
        value={{ date: '2024-03-05' }}
        onChange={vi.fn()}
        onClose={vi.fn()}
        fieldDef={{ ...field, minDate: new Date(2024, 2, 5, 23, 0) }}
      />
    );
    expect(screen.getByRole('button', { name: /March 5th, 2024/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /March 4th, 2024/ })).toBeDisabled();
  });

  describe('the close button', () => {
    it('calls onClose when clicked', () => {
      const onClose = vi.fn();
      render(
        <DefaultDatePicker value={null} onChange={vi.fn()} onClose={onClose} fieldDef={field} />
      );
      fireEvent.click(document.querySelector('.tsi-picker-footer button') as HTMLButtonElement);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['no closeButtonLabel', undefined, 'Close'],
      ['an element with text', <span key="label">Fertig</span>, 'Fertig'],
      ['an icon with no text', <svg key="label" aria-hidden="true" />, 'Close'],
    ] as const)('has an accessible name with %s', (_, closeButtonLabel, name) => {
      render(
        <DefaultDatePicker
          value={null}
          onChange={vi.fn()}
          onClose={vi.fn()}
          fieldDef={{ ...field, closeButtonLabel }}
        />
      );
      expect(screen.getByRole('button', { name })).toHaveClass('tsi-picker-close-btn');
    });

    it('shows the closeButtonLabel of the field', () => {
      const onClose = vi.fn();
      render(
        <DefaultDatePicker
          value={null}
          onChange={vi.fn()}
          onClose={onClose}
          fieldDef={{ ...field, closeButtonLabel: 'Done' }}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
