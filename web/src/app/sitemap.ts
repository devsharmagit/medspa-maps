import type { MetadataRoute } from "next";

import { getAllPosts } from "@/lib/blog";
import { query } from "@/lib/db";
import { allStateSlugs } from "@/lib/locations/state-content";
import { absoluteUrl } from "@/lib/site";

// Re-query active practices hourly so newly-added clinics enter the sitemap
// without a redeploy.
export const revalidate = 3600;

/**
 * Site sitemap. Enumerates the core indexable routes, every blog post (from the
 * registry, so new articles register automatically), the 12 state landing
 * pages, and every active practice page (from the DB). City-level location
 * pages are not built yet, so they're not listed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const core: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "monthly", priority: 1 },
    { url: absoluteUrl("/search"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/blog"), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/treatments"), changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/conditions"), changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/providers"), changeFrequency: "monthly", priority: 0.7 },
    {
      url: absoluteUrl("/ai-aesthetic-treatment-finder"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  const posts: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: post.dateModified,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const states: MetadataRoute.Sitemap = allStateSlugs().map((slug) => ({
    url: absoluteUrl(`/locations/${slug}`),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // Every active practice page. A DB hiccup degrades to core + posts rather
  // than failing the sitemap entirely.
  let practices: MetadataRoute.Sitemap = [];
  try {
    const rows = await query<{ slug: string; updated_at: string | Date }>(
      `SELECT slug, updated_at FROM clinics WHERE is_active = true ORDER BY updated_at DESC`,
    );
    practices = rows.map((r) => ({
      url: absoluteUrl(`/practices/${r.slug}`),
      lastModified: new Date(r.updated_at),
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch (err) {
    console.error("sitemap: failed to load practice slugs:", err);
  }

  return [...core, ...posts, ...states, ...practices];
}
