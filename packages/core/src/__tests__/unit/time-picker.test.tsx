/**
 * Unit tests for TimePicker component.
 *
 * Tests focus/blur behavior, editing mode, and keyboard interactions.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimePicker } from '../../pickers/time-picker';

// Helper to get time input (input[type="time"] doesn't have textbox role)
function getTimeInput() {
  return screen.getByLabelText(/time/i) as HTMLInputElement;
}

describe('TimePicker', () => {
  describe('rendering', () => {
    it('renders with null value', () => {
      render(<TimePicker value={null} onChange={vi.fn()} />);
      const input = getTimeInput();
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('');
    });

    it('renders with initial value', () => {
      render(<TimePicker value={{ hours: 14, minutes: 30 }} onChange={vi.fn()} />);
      const input = getTimeInput();
      expect(input).toHaveValue('14:30');
    });

    it('is labelled Time, with no 12-hour or 24-hour claim, since the browser decides the format', () => {
      render(<TimePicker value={{ hours: 14, minutes: 30 }} onChange={vi.fn()} />);
      expect(screen.getByLabelText('Time')).toBeInTheDocument();
    });

    it('has no AM/PM toggle', () => {
      render(<TimePicker value={{ hours: 14, minutes: 30 }} onChange={vi.fn()} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('editing mode', () => {
    it('exits editing mode on blur', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <TimePicker value={{ hours: 14, minutes: 30 }} onChange={onChange} />
      );
      const input = getTimeInput();

      fireEvent.focus(input);
      rerender(<TimePicker value={{ hours: 10, minutes: 0 }} onChange={onChange} />);
      expect(input).toHaveValue('14:30');

      fireEvent.blur(input);

      expect(input).toHaveValue('10:00');
    });

    it('syncs with external value when not editing', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <TimePicker value={{ hours: 14, minutes: 30 }} onChange={onChange} />
      );

      const input = getTimeInput();
      expect(input).toHaveValue('14:30');

      // Update external value
      rerender(<TimePicker value={{ hours: 10, minutes: 0 }} onChange={onChange} />);

      // Should update when not editing
      expect(input).toHaveValue('10:00');
    });

    it('does not sync with external value while editing', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <TimePicker value={{ hours: 14, minutes: 30 }} onChange={onChange} />
      );

      const input = getTimeInput();
      fireEvent.focus(input);

      // Simulate user typing a new value
      fireEvent.change(input, { target: { value: '09:15' } });

      // External value changes
      rerender(<TimePicker value={{ hours: 10, minutes: 0 }} onChange={onChange} />);

      // Should maintain local value while editing
      expect(input).toHaveValue('09:15');
    });
  });

  describe('value changes', () => {
    it('calls onChange with parsed time value', () => {
      const onChange = vi.fn();
      render(<TimePicker value={null} onChange={onChange} />);
      const input = getTimeInput();

      fireEvent.change(input, { target: { value: '15:45' } });

      expect(onChange).toHaveBeenCalledWith({ hours: 15, minutes: 45 });
    });

    it('does not call onChange for invalid time', () => {
      const onChange = vi.fn();
      render(<TimePicker value={{ hours: 14, minutes: 30 }} onChange={onChange} />);
      const input = getTimeInput();

      fireEvent.change(input, { target: { value: '' } });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('reverts to external value on blur with invalid input', () => {
      const onChange = vi.fn();
      render(<TimePicker value={{ hours: 14, minutes: 30 }} onChange={onChange} />);
      const input = getTimeInput();

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);

      // Should revert to original value
      expect(input).toHaveValue('14:30');
    });
  });

  describe('keyboard interactions', () => {
    it('blurs input on Enter key', () => {
      const onChange = vi.fn();
      render(<TimePicker value={{ hours: 14, minutes: 30 }} onChange={onChange} />);
      const input = getTimeInput();

      act(() => input.focus());
      expect(input).toHaveFocus();

      fireEvent.keyDown(input, { key: 'Enter' });

      expect(input).not.toHaveFocus();
    });
  });

  describe('disabled state', () => {
    it('disables input when disabled is true', () => {
      render(<TimePicker value={{ hours: 14, minutes: 30 }} onChange={vi.fn()} disabled />);
      const input = getTimeInput();
      expect(input).toBeDisabled();
    });
  });
});
