/**
 * Unit tests for TimePicker component.
 *
 * Tests focus/blur behavior, editing mode, AM/PM toggle,
 * and keyboard interactions.
 */

import { fireEvent, render, screen } from '@testing-library/react';
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

    it('renders AM/PM toggle when hour24 is false', () => {
      render(<TimePicker value={{ hours: 14, minutes: 30 }} onChange={vi.fn()} hour24={false} />);
      expect(screen.getByRole('button', { name: /switch to am/i })).toBeInTheDocument();
    });

    it('does not render AM/PM toggle when hour24 is true', () => {
      render(<TimePicker value={{ hours: 14, minutes: 30 }} onChange={vi.fn()} hour24={true} />);
      expect(screen.queryByRole('button', { name: /switch/i })).not.toBeInTheDocument();
    });
  });

  describe('editing mode', () => {
    it('enters editing mode on focus', () => {
      const onChange = vi.fn();
      render(<TimePicker value={{ hours: 14, minutes: 30 }} onChange={onChange} />);
      const input = getTimeInput();

      fireEvent.focus(input);

      // During editing, external value updates should not override local state
      // This is tested by the fact that input maintains its value during focus
      expect(input).toHaveValue('14:30');
    });

    it('exits editing mode on blur', () => {
      const onChange = vi.fn();
      render(<TimePicker value={{ hours: 14, minutes: 30 }} onChange={onChange} />);
      const input = getTimeInput();

      fireEvent.focus(input);
      fireEvent.blur(input);

      // After blur, should sync with external value
      expect(input).toHaveValue('14:30');
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

      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(document.activeElement).not.toBe(input);
    });
  });

  describe('AM/PM toggle', () => {
    it('shows PM when hours >= 12', () => {
      render(<TimePicker value={{ hours: 14, minutes: 30 }} onChange={vi.fn()} hour24={false} />);
      expect(screen.getByRole('button')).toHaveTextContent('PM');
    });

    it('shows AM when hours < 12', () => {
      render(<TimePicker value={{ hours: 9, minutes: 30 }} onChange={vi.fn()} hour24={false} />);
      expect(screen.getByRole('button')).toHaveTextContent('AM');
    });

    it('toggles from PM to AM correctly', () => {
      const onChange = vi.fn();
      render(<TimePicker value={{ hours: 14, minutes: 30 }} onChange={onChange} hour24={false} />);
      const button = screen.getByRole('button', { name: /switch to am/i });

      fireEvent.click(button);

      // 14:30 PM -> 2:30 AM (hours: 2)
      expect(onChange).toHaveBeenCalledWith({ hours: 2, minutes: 30 });
    });

    it('toggles from AM to PM correctly', () => {
      const onChange = vi.fn();
      render(<TimePicker value={{ hours: 9, minutes: 15 }} onChange={onChange} hour24={false} />);
      const button = screen.getByRole('button', { name: /switch to pm/i });

      fireEvent.click(button);

      // 9:15 AM -> 21:15 PM (hours: 21)
      expect(onChange).toHaveBeenCalledWith({ hours: 21, minutes: 15 });
    });

    it('handles midnight (00:00) toggle correctly', () => {
      const onChange = vi.fn();
      render(<TimePicker value={{ hours: 0, minutes: 0 }} onChange={onChange} hour24={false} />);

      const button = screen.getByRole('button', { name: /switch to pm/i });
      fireEvent.click(button);

      // 00:00 (12 AM) -> 12:00 (12 PM)
      expect(onChange).toHaveBeenCalledWith({ hours: 12, minutes: 0 });
    });

    it('handles noon (12:00) toggle correctly', () => {
      const onChange = vi.fn();
      render(<TimePicker value={{ hours: 12, minutes: 0 }} onChange={onChange} hour24={false} />);

      const button = screen.getByRole('button', { name: /switch to am/i });
      fireEvent.click(button);

      // 12:00 (12 PM) -> 00:00 (12 AM)
      expect(onChange).toHaveBeenCalledWith({ hours: 0, minutes: 0 });
    });

    it('is disabled when value is null', () => {
      render(<TimePicker value={null} onChange={vi.fn()} hour24={false} />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('is disabled when picker is disabled', () => {
      render(
        <TimePicker value={{ hours: 14, minutes: 30 }} onChange={vi.fn()} hour24={false} disabled />
      );
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
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
