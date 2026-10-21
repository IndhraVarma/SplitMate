/**
 * Escapes every character that has a special meaning in a regular expression,
 * so user-supplied search text can be used inside a Mongo `$regex` query
 * without acting as a pattern. Without this, a search for "(" would throw, and
 * a search for ".*" would match everything.
 */
export function escapeRegExp(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds a case-insensitive "contains" matcher from untrusted text. */
export function containsRegex(input) {
  return new RegExp(escapeRegExp(input), 'i');
}

/** Builds a case-insensitive "starts with" matcher from untrusted text. */
export function startsWithRegex(input) {
  return new RegExp(`^${escapeRegExp(input)}`, 'i');
}

export default escapeRegExp;
