/**
 * Unsplash URL helper for landing-page imagery. `images.unsplash.com` is
 * allow-listed in next.config, so these load through next/image with no config
 * change. IDs below are reused from `lib/images/catalog-images.ts` (already
 * verified to resolve) so the alternating image/text sections show real,
 * on-theme photos. Swap any `src` for a client-supplied final later.
 */
export const uns = (id: string, w = 1200): string =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
