/**
 * Every cinema on SightLine is in Delhi, so show dates and times are India
 * Standard Time (UTC+5:30, no daylight saving) whatever clock the browser or
 * the server runs on.
 */
export const TIME_ZONE = 'Asia/Kolkata';
const OFFSET_MS = 330 * 60_000;

export interface Clock {
  year: number;
  /** 1 to 12 */
  month: number;
  day: number;
  /** 0 is Sunday */
  weekday: number;
  hour: number;
  minute: number;
}

/** The date and time in Delhi at an instant. */
export function delhiClock(at: Date | number = Date.now()): Clock {
  const t = new Date(+at + OFFSET_MS);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
    weekday: t.getUTCDay(),
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
  };
}

/** The instant a Delhi date and time happens. Days past the end of a month roll over, as with Date. */
export function delhiTime(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - OFFSET_MS);
}
