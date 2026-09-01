import moment from 'moment';

/**
 * Base44 stores timestamps as naive UTC strings without a timezone designator
 * (e.g. "2026-09-01T10:33:44.911000"). Browsers parse such strings as LOCAL
 * time, which shifts every displayed time by the user's UTC offset (3 hours
 * for Jerusalem). This appends a "Z" when no designator is present so the
 * value is treated as UTC, then converted to the user's local timezone for
 * display. Strings that already carry a "Z" or a numeric offset pass through.
 *
 * @param {string|Date} date
 * @returns {Date|null}
 */
export function parseUserDate(date) {
  if (!date) return null;
  if (typeof date === 'string') {
    const s = date.trim();
    const withZ = /([zZ]$)|([+-]\d{2}:?\d{2}$)/.test(s) ? s : s + 'Z';
    return new Date(withZ);
  }
  return new Date(date);
}

function asMoment(date) {
  return moment(parseUserDate(date));
}

/**
 * Format a date/time string to the user's local timezone
 * @param {string|Date} date - The date to format (ISO string or Date object)
 * @param {string} format - The format string (default: 'DD/MM/YYYY HH:mm')
 * @returns {string} - Formatted date in user's local timezone
 */
export function formatLocalDateTime(date, format = 'DD/MM/YYYY HH:mm') {
  if (!date) return '';
  return asMoment(date).local().format(format);
}

/**
 * Format a date/time string as relative time (e.g., "2 hours ago")
 * @param {string|Date} date - The date to format
 * @returns {string} - Relative time string in user's local timezone
 */
export function formatRelativeTime(date) {
  if (!date) return '';
  return asMoment(date).local().fromNow();
}

/**
 * Format just the date (no time)
 * @param {string|Date} date - The date to format
 * @param {string} format - The format string (default: 'DD/MM/YYYY')
 * @returns {string} - Formatted date in user's local timezone
 */
export function formatLocalDate(date, format = 'DD/MM/YYYY') {
  if (!date) return '';
  return asMoment(date).local().format(format);
}

/**
 * Format just the time
 * @param {string|Date} date - The date to format
 * @param {string} format - The format string (default: 'HH:mm')
 * @returns {string} - Formatted time in user's local timezone
 */
export function formatLocalTime(date, format = 'HH:mm') {
  if (!date) return '';
  return asMoment(date).local().format(format);
}

/**
 * Get full timestamp with day, date, and time
 * @param {string|Date} date - The date to format
 * @returns {string} - Full formatted timestamp (e.g., "Sunday, 06/02/2026, 11:30")
 */
export function formatFullTimestamp(date) {
  if (!date) return '';
  return asMoment(date).local().format('dddd, DD/MM/YYYY, HH:mm');
}