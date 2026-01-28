/**
 * Integration tests for startAdornment and endAdornment props.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import { basicFields } from '../fixtures/fields';

describe('Adornments', () => {
  describe('startAdornment', () => {
    it('renders startAdornment at the beginning of the input', () => {
      render(
        <TokenizedSearchInput
          fields={basicFields}
          startAdornment={<span data-testid="start-icon">S</span>}
        />
      );

      const startIcon = screen.getByTestId('start-icon');
      expect(startIcon).toBeInTheDocument();
      expect(startIcon.closest('.tsi-adornment--start')).toBeInTheDocument();
    });

    it('applies custom className via classNames.startAdornment', () => {
      render(
        <TokenizedSearchInput
          fields={basicFields}
          startAdornment={<span>S</span>}
          classNames={{ startAdornment: 'custom-start-class' }}
        />
      );

      expect(document.querySelector('.custom-start-class')).toBeInTheDocument();
    });

    it('has aria-hidden on the adornment container', () => {
      render(
        <TokenizedSearchInput
          fields={basicFields}
          startAdornment={<span data-testid="start-icon">S</span>}
        />
      );

      const adornmentContainer = screen.getByTestId('start-icon').parentElement;
      expect(adornmentContainer).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('endAdornment', () => {
    it('renders endAdornment at the end of the input', () => {
      render(
        <TokenizedSearchInput
          fields={basicFields}
          endAdornment={<span data-testid="end-icon">E</span>}
        />
      );

      const endIcon = screen.getByTestId('end-icon');
      expect(endIcon).toBeInTheDocument();
      expect(endIcon.closest('.tsi-adornment--end')).toBeInTheDocument();
    });

    it('renders endAdornment before clear button when clearable', () => {
      render(
        <TokenizedSearchInput
          fields={basicFields}
          endAdornment={<span data-testid="end-icon">E</span>}
          clearable
          defaultValue="status:is:active"
        />
      );

      const endIcon = screen.getByTestId('end-icon');
      const clearButton = document.querySelector('.tsi-clear-button');

      expect(endIcon).toBeInTheDocument();
      expect(clearButton).toBeInTheDocument();

      // clear button should come before endAdornment in DOM order
      const endAdornment = endIcon.closest('.tsi-adornment--end');
      if (clearButton && endAdornment) {
        expect(clearButton.compareDocumentPosition(endAdornment)).toBe(
          Node.DOCUMENT_POSITION_FOLLOWING
        );
      }
    });

    it('applies custom className via classNames.endAdornment', () => {
      render(
        <TokenizedSearchInput
          fields={basicFields}
          endAdornment={<span>E</span>}
          classNames={{ endAdornment: 'custom-end-class' }}
        />
      );

      expect(document.querySelector('.custom-end-class')).toBeInTheDocument();
    });
  });

  describe('interactive adornments', () => {
    it('supports button elements with click handlers', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput
          fields={basicFields}
          endAdornment={
            <button
              type="button"
              data-testid="submit-btn"
              onClick={handleClick}
              aria-label="Submit"
            >
              Submit
            </button>
          }
        />
      );

      await user.click(screen.getByTestId('submit-btn'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('allows focus on interactive adornment buttons', async () => {
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput
          fields={basicFields}
          endAdornment={
            <button type="button" data-testid="action-btn">
              Action
            </button>
          }
        />
      );

      const button = screen.getByTestId('action-btn');
      await user.click(button);
      expect(button).toHaveFocus();
    });
  });

  describe('disabled state', () => {
    it('does not automatically disable adornment buttons when input is disabled', () => {
      render(
        <TokenizedSearchInput
          fields={basicFields}
          disabled
          endAdornment={
            <button type="button" data-testid="btn">
              Action
            </button>
          }
        />
      );

      // Button is not automatically disabled - user controls this
      expect(screen.getByTestId('btn')).not.toBeDisabled();
    });
  });
});
