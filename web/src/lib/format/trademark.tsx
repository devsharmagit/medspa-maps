import { Fragment, type ReactNode } from "react";

/**
 * Display-time formatter for registered-trademark / trademark / copyright symbols.
 *
 * Treatment names are stored with a literal symbol baked into the string
 * (e.g. "Botox®", "HydraFacial®"). Rendered as-is the "®" sits on the baseline at
 * full size, which reads wrong. This wraps each ® / ™ / © in a small superscript.
 *
 * IMPORTANT: only use this at HTML render sites. Never feed the result into
 * <title>/meta, JSON-LD, alt, or aria-label — those need the raw string.
 */

const TM_SYMBOL = /([®™©])/;

/** Returns the text with each ®/™/© wrapped in a superscript. No symbol → the plain string. */
export function superscriptTrademark(text: string | null | undefined): ReactNode {
  if (!text) return text ?? null;
  if (!TM_SYMBOL.test(text)) return text;

  // Split on the capturing group (non-global regex → no lastIndex state to leak).
  const parts = text.split(TM_SYMBOL);
  return parts.map((part, i) =>
    part === "®" || part === "™" || part === "©" ? (
      <sup key={i} className="align-super text-[0.6em] leading-none">
        {part}
      </sup>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

/** Component form: <Trademark>{name}</Trademark> */
export function Trademark({ children }: { children: string | null | undefined }): ReactNode {
  return superscriptTrademark(children);
}

/* ------------------------------------------------------------------ *
 * rehype plugin — superscript ®/™/© inside react-markdown-rendered
 * prose (blog bodies, etc.). Zero-dependency: hand-walks the hast tree
 * and splits text nodes into `sup` elements. Skips code/pre and any
 * text already inside a `sup`.
 * ------------------------------------------------------------------ */

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  children?: HastNode[];
  properties?: Record<string, unknown>;
}

const SKIP_TAGS = new Set(["code", "pre", "sup", "sub"]);

function makeSup(symbol: string): HastNode {
  return {
    type: "element",
    tagName: "sup",
    properties: { className: ["align-super", "text-[0.6em]", "leading-none"] },
    children: [{ type: "text", value: symbol }],
  };
}

function walk(node: HastNode): void {
  if (!node.children || node.children.length === 0) return;
  if (node.tagName && SKIP_TAGS.has(node.tagName)) return;

  const next: HastNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && child.value && TM_SYMBOL.test(child.value)) {
      for (const part of child.value.split(TM_SYMBOL)) {
        if (part === "") continue;
        next.push(
          part === "®" || part === "™" || part === "©"
            ? makeSup(part)
            : { type: "text", value: part }
        );
      }
    } else {
      if (child.type === "element") walk(child);
      next.push(child);
    }
  }
  node.children = next;
}

/** react-markdown rehypePlugins entry: superscripts ®/™/© in rendered prose. */
export function rehypeTrademark() {
  return (tree: HastNode): void => walk(tree);
}
