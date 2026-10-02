/** The calendar cells of a picker are days; a day is `yyyy-MM-dd`, with no time zone. */

function pad(n: number, length = 2): string {
  return String(n).padStart(length, '0');
}

/** The day a calendar cell shows, which is its local date. */
export function toCalendarDay(cell: Date): string {
  return `${pad(cell.getFullYear(), 4)}-${pad(cell.getMonth() + 1)}-${pad(cell.getDate())}`;
}

/** The calendar cell of a day: its local midnight. */
export function calendarDayToDate(day: string): Date {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  const cell = new Date(0);
  cell.setFullYear(year, month - 1, date);
  cell.setHours(0, 0, 0, 0);
  return cell;
}
