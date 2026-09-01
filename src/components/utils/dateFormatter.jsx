import moment from 'moment';

/**
 * Centralized user-timezone formatting.
 *
 * The app's users are on Asia/Jerusalem time, but the runtime/browser may be
 * configured for UTC. Relying on `.local()` or bare `toLocaleString` therefore
 * displays UTC timestamps (3 hours off). All formatting here pins the
 * timezone to Asia/Jerusalem explicitly so timestamps always match the user's
 * clock regardless of the runtime timezone.
 */

const USER_TIME_ZONE = 'Asia/Jerusalem';
const DATE_LOCALE = 'en-GB';

// Map the moment-style format strings used across the app to Intl options.
// en-GB preserves the DD/MM/YYYY slash layout the previous moment formatter produced.
function intlOptionsFor(format) {
  switch (format) {
    case 'DD/MM/YYYY HH:mm':
      return { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    case 'DD/MM HH:mm':
      return { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
    case 'DD/MM/YYYY':
      return { day: '2-digit', month: '2-digit', year: 'numeric' };
    case 'HH:mm':
      return { hour: '2-digit', minute: '2-digit' };
    case 'dddd, DD/MM/YYYY, HH:mm':
      return { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    default:
      return { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  }
}

function formatInUserTimezone(date, format) {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    timeZone: USER_TIME_ZONE,
    ...intlOptionsFor(format),
  }).format(new Date(date));
}

/**
 * Format a date/time string to the user's local timezone
 * @param {string|Date} date - The date to format (ISO string or Date object)
 * @param {string} format - moment-style format string (default: 'DD/MM/YYYY HH:mm')
 * @returns {string} - Formatted date in the user's timezone (Asia/Jerusalem)
 */
export function formatLocalDateTime(date, format = 'DD/MM/YYYY HH:mm') {
  if (!date) return '';
  return formatInUserTimezone(date, format);
}

/**
 * Format just the date (no time)
 * @param {string|Date} date - The date to format
 * @param {string} format - moment-style format string (default: 'DD/MM/YYYY')
 * @returns {string} - Formatted date in the user's timezone (Asia/Jerusalem)
 */
export function formatLocalDate(date, format = 'DD/MM/YYYY') {
  if (!date) return '';
  return formatInUserTimezone(date, format);
}

/**
 * Format just the time
 * @param {string|Date} date - The date to format
 * @param {string} format - moment-style format string (default: 'HH:mm')
 * @returns {string} - Formatted time in the user's timezone (Asia/Jerusalem)
 */
export function formatLocalTime(date, format = 'HH:mm') {
  if (!date) return '';
  return formatInUserTimezone(date, format);
}

/**
 * Format a date/time string as relative time (e.g., "2 hours ago").
 * Relative durations are timezone-independent, so no explicit timezone is needed.
 * @param {string|Date} date - The date to format
 * @returns {string} - Relative time string
 */
export function formatRelativeTime(date) {
  if (!date) return '';
  return moment(date).fromNow();
}

/**
 * Get full timestamp with day, date, and time
 * @param {string|Date} date - The date to format
 * @returns {string} - Full formatted timestamp (e.g., "Tuesday, 01/09/2026, 13:33")
 */
export function formatFullTimestamp(date) {
  if (!date) return '';
  return formatInUserTimezone(date, 'dddd, DD/MM/YYYY, HH:mm');
}