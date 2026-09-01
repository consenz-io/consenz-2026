import moment from 'moment';

/**
 * Format a date/time string to the user's local timezone
 * @param {string|Date} date - The date to format (ISO string or Date object)
 * @param {string} format - The format string (default: 'DD/MM/YYYY HH:mm')
 * @returns {string} - Formatted date in user's local timezone
 */
export function formatLocalDateTime(date, format = 'DD/MM/YYYY HH:mm') {
  if (!date) return '';
  return moment(date).local().format(format);
}

/**
 * Format a date/time string as relative time (e.g., "2 hours ago")
 * @param {string|Date} date - The date to format
 * @returns {string} - Relative time string in user's local timezone
 */
export function formatRelativeTime(date) {
  if (!date) return '';
  return moment(date).local().fromNow();
}

/**
 * Format just the date (no time)
 * @param {string|Date} date - The date to format
 * @param {string} format - The format string (default: 'DD/MM/YYYY')
 * @returns {string} - Formatted date in user's local timezone
 */
export function formatLocalDate(date, format = 'DD/MM/YYYY') {
  if (!date) return '';
  return moment(date).local().format(format);
}

/**
 * Format just the time
 * @param {string|Date} date - The date to format
 * @param {string} format - The format string (default: 'HH:mm')
 * @returns {string} - Formatted time in user's local timezone
 */
export function formatLocalTime(date, format = 'HH:mm') {
  if (!date) return '';
  return moment(date).local().format(format);
}

/**
 * Get full timestamp with day, date, and time
 * @param {string|Date} date - The date to format
 * @returns {string} - Full formatted timestamp (e.g., "Sunday, 06/02/2026, 11:30")
 */
export function formatFullTimestamp(date) {
  if (!date) return '';
  return moment(date).local().format('dddd, DD/MM/YYYY, HH:mm');
}