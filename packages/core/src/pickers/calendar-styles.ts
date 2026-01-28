/**
 * CSS class names for react-day-picker v9.
 * Provides consistent styling across date and datetime pickers.
 * Uses tsi-calendar-* classes defined in index.css.
 *
 * Note: In react-day-picker v9, modifier classes (selected, outside, etc.)
 * are applied to `day` (td element) alongside the base `day` class.
 */
export const calendarClassNames = {
  root: 'tsi-calendar',
  months: 'tsi-calendar-months',
  month: 'tsi-calendar-month',
  month_caption: 'tsi-calendar-caption',
  caption_label: 'tsi-calendar-caption-label',
  nav: 'tsi-calendar-nav',
  button_previous: 'tsi-calendar-nav-btn tsi-calendar-nav-btn--prev',
  button_next: 'tsi-calendar-nav-btn tsi-calendar-nav-btn--next',
  chevron: 'tsi-calendar-chevron',
  month_grid: 'tsi-calendar-grid',
  weekdays: 'tsi-calendar-weekdays',
  weekday: 'tsi-calendar-weekday',
  week: 'tsi-calendar-week',
  day: 'tsi-calendar-day',
  day_button: 'tsi-calendar-day-btn',
  today: 'tsi-calendar-today',
  selected: 'tsi-calendar-selected',
  outside: 'tsi-calendar-outside',
  disabled: 'tsi-calendar-disabled',
  hidden: 'tsi-calendar-hidden',
};

/**
 * CSS class name for close button in date/datetime pickers.
 */
export const closeButtonClassName = 'tsi-picker-close-btn';
