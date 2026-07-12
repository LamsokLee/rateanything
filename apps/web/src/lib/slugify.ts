/**
 * Generates a URL-safe slug from a text string.
 * Lowercases, replaces non-alphanumeric chars with hyphens, trims hyphens, limits to 120 chars.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}
