/** Match every query word across the public story metadata. */
export function matchesStorySearch(fields: string[], query: string): boolean {
  const words = query.normalize('NFKC').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = fields.join(' ').normalize('NFKC').toLowerCase();
  return words.every(word => text.includes(word));
}
