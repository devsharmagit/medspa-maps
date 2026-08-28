import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BLOG_POSTS, type BlogPostMeta } from "./posts";

export type { BlogPostMeta, BlogFaq, BlogCta, BlogImageCredit } from "./posts";

const BLOG_CONTENT_DIR = join(process.cwd(), "src", "content", "blog");

/** All posts, newest first. Registry-only (no filesystem) — safe anywhere. */
export function getAllPosts(): BlogPostMeta[] {
  return [...BLOG_POSTS].sort((a, b) =>
    b.datePublished.localeCompare(a.datePublished),
  );
}

/** The N most recent posts (for the homepage "latest articles" cards). */
export function getRecentPosts(n: number): BlogPostMeta[] {
  return getAllPosts().slice(0, n);
}

export function getPostMeta(slug: string): BlogPostMeta | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
  return BLOG_POSTS.map((p) => p.slug);
}

/**
 * Read a post's markdown body. Uses the filesystem, so call it ONLY from the
 * fully-prerendered /blog/[slug] route (force-static) — the read then happens
 * at build time and never at request time.
 */
export function getPostBody(slug: string): string {
  return readFileSync(join(BLOG_CONTENT_DIR, `${slug}.md`), "utf8");
}

/**
 * Simple related-posts helper: other posts, newest first, capped at `limit`.
 * (With a small catalog, "everything else" is the sensible related set.)
 */
export function getRelatedPosts(slug: string, limit = 2): BlogPostMeta[] {
  return getAllPosts()
    .filter((p) => p.slug !== slug)
    .slice(0, limit);
}
