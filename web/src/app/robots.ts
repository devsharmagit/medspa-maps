import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

// AI answer-engine crawlers we explicitly welcome. Being AEO-visible is a stated
// goal, so we grant these the same access as everyone else — the explicit allow
// signals intent and future-proofs against a blanket disallow being added later.
const AI_CRAWLERS = [
  "GPTBot", // OpenAI training crawler
  "OAI-SearchBot", // ChatGPT Search
  "ChatGPT-User", // ChatGPT browsing on a user's behalf
  "ClaudeBot", // Anthropic crawler
  "anthropic-ai",
  "Claude-Web",
  "Google-Extended", // Gemini / Vertex training
  "PerplexityBot",
  "CCBot", // Common Crawl (feeds many LLMs)
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api"],
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/admin", "/api"],
      })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
