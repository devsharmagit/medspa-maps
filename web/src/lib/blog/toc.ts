/**
 * Table-of-contents helpers. `slugifyText` MUST match the id the markdown
 * renderer puts on each heading (see components/blog/markdown.tsx) so the TOC
 * anchors line up with the rendered sections.
 */

export interface TocItem {
  level: 2 | 3;
  text: string;
  id: string;
}

export function slugifyText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Pull the H2/H3 headings out of a post's markdown body, in document order. */
export function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  for (const line of markdown.split("\n")) {
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const level = match[1].length as 2 | 3;
    const text = match[2].trim();
    items.push({ level, text, id: slugifyText(text) });
  }
  return items;
}
