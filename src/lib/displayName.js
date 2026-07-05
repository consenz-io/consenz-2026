/**
 * Cleans a display name that was incorrectly stored as an email prefix.
 * Some UserPublicProfile records have fullName equal to the email's local part
 * (e.g. "aharon.porath+2" for "aharon.porath+2@gmail.com") because the user
 * had no real full_name set when their profile was auto-created.
 *
 * When we detect this pattern, we derive a readable name from the email prefix:
 * strip the +alias suffix, replace separators with spaces, title-case.
 *
 * Names that already contain a space (real names) are returned unchanged.
 */
export function cleanDisplayName(name, email) {
  if (!name) return name;
  // Real names contain a space — return as-is
  if (/\s/.test(name)) return name;

  const emailPrefix = email ? email.split('@')[0] : null;
  // Only clean when the name exactly matches the email local part
  if (!emailPrefix || name !== emailPrefix) return name;

  let derived = name
    .replace(/\+.*$/, '') // strip +alias suffix (e.g. "+2")
    .replace(/[._-]+/g, ' ') // replace separators with spaces
    .trim();
  if (!derived) return name;

  // Title case each word
  derived = derived
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return derived;
}