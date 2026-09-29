import { SITE_NAME, SITE_URL } from "@/lib/site";

export const DEFAULT_OG_IMAGE_URL = `${SITE_URL}/og-image.png`;
export const DEFAULT_OG_IMAGE_ALT = "Medspa Maps";
export const DEFAULT_OG_IMAGE_WIDTH = 1200;
export const DEFAULT_OG_IMAGE_HEIGHT = 630;

export const DEFAULT_OG_IMAGE = {
  url: DEFAULT_OG_IMAGE_URL,
  width: DEFAULT_OG_IMAGE_WIDTH,
  height: DEFAULT_OG_IMAGE_HEIGHT,
  alt: DEFAULT_OG_IMAGE_ALT,
};

export const DEFAULT_TWITTER_IMAGE = DEFAULT_OG_IMAGE_URL;

/**
 * Standard openGraph object for routes that want the default brand OG image.
 */
export function defaultOpenGraph(options: {
  title: string;
  description?: string;
  url: string;
  type?: "website" | "article";
  image?: { url: string; alt?: string; width?: number; height?: number } | string;
}) {
  const img = options.image
    ? typeof options.image === "string"
      ? { url: options.image, width: DEFAULT_OG_IMAGE_WIDTH, height: DEFAULT_OG_IMAGE_HEIGHT, alt: options.title }
      : {
          url: options.image.url,
          width: options.image.width ?? DEFAULT_OG_IMAGE_WIDTH,
          height: options.image.height ?? DEFAULT_OG_IMAGE_HEIGHT,
          alt: options.image.alt ?? options.title,
        }
    : DEFAULT_OG_IMAGE;

  return {
    type: options.type ?? "website",
    title: options.title,
    description: options.description,
    url: options.url,
    siteName: SITE_NAME,
    images: [img],
  };
}
