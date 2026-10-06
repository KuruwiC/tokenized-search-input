/**
 * Integration tests for startAdornment and endAdornment props.
 */
import { render, screen, waitFor } from '@testing-library/react';
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

    it('does not hide the adornment subtree from assistive technology', () => {
      render(
        <TokenizedSearchInput
          fields={basicFields}
          startAdornment={<span data-testid="start-icon">S</span>}
        />
      );

      const adornmentContainer = screen.getByTestId('start-icon').parentElement;
      expect(adornmentContainer).not.toHaveAttribute('aria-hidden');
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

    it('renders the clear button before endAdornment when clearable', () => {
      render(
        <TokenizedSearchInput
          fields={basicFields}
          endAdornment={<span data-testid="end-icon">E</span>}
          clearable
          defaultValue="status:is:active"
        />
      );

      const clearButton = screen.getByRole('button', { name: 'Clear search' });
      const endAdornment = screen.getByTestId('end-icon').closest('.tsi-adornment--end');

      expect(endAdornment).toBeInstanceOf(HTMLElement);
      expect(clearButton.compareDocumentPosition(endAdornment as Node)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
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
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
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

  describe('focus moving into an adornment', () => {
    it('stays inside the input: no onBlur and the typed text is not finalized', async () => {
      const onBlur = vi.fn();
      const user = userEvent.setup();
      render(
        <div>
          <TokenizedSearchInput
            fields={basicFields}
            freeTextMode="tokenize"
            onBlur={onBlur}
            endAdornment={
              <button type="button" data-testid="adornment-btn">
                Action
              </button>
            }
          />
          <button type="button">Outside</button>
        </div>
      );

      await user.click(screen.getByRole('combobox'));
      await user.keyboard('hello');
      await user.click(screen.getByTestId('adornment-btn'));

      expect(screen.getByTestId('adornment-btn')).toHaveFocus();
      expect(onBlur).not.toHaveBeenCalled();
      expect(document.querySelectorAll('.node-freeTextToken')).toHaveLength(0);

      // Leaving the input from the adornment is a blur that finalizes the text.
      await user.click(screen.getByRole('button', { name: 'Outside' }));

      expect(onBlur).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(document.querySelectorAll('.node-freeTextToken')).toHaveLength(1));
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
