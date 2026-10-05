import type { ReactNode } from 'react';
import { useScrollActiveIntoView } from '../hooks/use-scroll-active-into-view';
import { cn } from '../utils/cn';

export interface SuggestionGroup {
  /** Items next to each other with the same key form one group. */
  key: string;
  /** Names the group; a group without a label is only set apart by a divider, if any. */
  label?: ReactNode;
  labelClassName?: string;
  /** Whether a divider separates the group from the one before it. */
  separated?: boolean;
}

export interface SuggestionListProps<T> {
  /** The options in the order they are shown; `activeIndex` is an index into it. */
  items: readonly T[];
  activeIndex: number;
  onActiveChange: (index: number) => void;
  onSelect: (item: T) => void;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** The id of the listbox, which the element that holds focus names in `aria-controls`. */
  listboxId: string;
  /** Option `index` has the id `${optionIdPrefix}-${index}`, for `aria-activedescendant`. */
  optionIdPrefix: string;
  getOptionClassName?: (item: T) => string;
  getGroup?: (item: T) => SuggestionGroup | undefined;
  dividerClassName?: string;
  /** Shown below the listbox, such as a row that loads more options. */
  footer?: ReactNode;
}

interface Run<T> {
  group: SuggestionGroup | undefined;
  entries: Array<{ item: T; index: number }>;
}

function toRuns<T>(items: readonly T[], getGroup: SuggestionListProps<T>['getGroup']): Run<T>[] {
  const runs: Run<T>[] = [];
  items.forEach((item, index) => {
    const group = getGroup?.(item);
    const last = runs[runs.length - 1];
    if (last && last.group?.key === group?.key) {
      last.entries.push({ item, index });
    } else {
      runs.push({ group, entries: [{ item, index }] });
    }
  });
  return runs;
}

/**
 * The listbox of every kind of suggestion. It owns the option markup, the ids and
 * `aria-selected` that `aria-activedescendant` points at, pointer handling, and scrolling
 * the active option into view; what an option shows is up to `renderItem`.
 */
export function SuggestionList<T>({
  items,
  activeIndex,
  onActiveChange,
  onSelect,
  getKey,
  renderItem,
  listboxId,
  optionIdPrefix,
  getOptionClassName,
  getGroup,
  dividerClassName,
  footer,
}: SuggestionListProps<T>): React.ReactElement {
  const optionRefs = useScrollActiveIntoView<HTMLButtonElement>(activeIndex);

  const renderOption = (
    { item, index }: Run<T>['entries'][number],
    leavesRoomForLabel: boolean
  ) => {
    const active = index === activeIndex;
    return (
      <button
        key={getKey(item)}
        type="button"
        ref={(element) => {
          if (element) optionRefs.current.set(index, element);
          else optionRefs.current.delete(index);
        }}
        id={`${optionIdPrefix}-${index}`}
        role="option"
        // Reached through aria-activedescendant, never by Tab
        tabIndex={-1}
        aria-selected={active}
        data-active={active}
        // Focus stays where the user types
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onSelect(item)}
        onMouseEnter={() => onActiveChange(index)}
        // Leave room for the label of the group when scrolling its first option into view
        style={leavesRoomForLabel ? { scrollMarginTop: '2rem' } : undefined}
        className={cn('tsi-suggestion-item', getOptionClassName?.(item))}
      >
        {renderItem(item)}
      </button>
    );
  };

  return (
    <div className="tsi-suggestion-list">
      <div role="listbox" id={listboxId}>
        {toRuns(items, getGroup).map((run, runIndex) => {
          const { group } = run;
          if (!group) return run.entries.map((entry) => renderOption(entry, false));

          const labelId = `${optionIdPrefix}-group-${runIndex}`;
          const labeled = group.label !== undefined;
          return (
            <fieldset key={group.key} aria-labelledby={labeled ? labelId : undefined}>
              {group.separated && <hr className={cn('tsi-divider', dividerClassName)} />}
              {labeled && (
                <div
                  id={labelId}
                  role="presentation"
                  className={cn('tsi-field-category', group.labelClassName)}
                >
                  {group.label}
                </div>
              )}
              {run.entries.map((entry, i) => renderOption(entry, labeled && i === 0))}
            </fieldset>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
