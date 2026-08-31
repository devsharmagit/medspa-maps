import Image from "next/image";
import Link from "next/link";

import { formatBlogDate } from "@/lib/blog/format";
import type { BlogPostMeta } from "@/lib/blog/posts";

/**
 * Sidebar "Recent articles" widget. Server-rendered from the registry (no
 * fetch), so it lands in the initial HTML and cross-links every article for
 * crawlers.
 */
export function RecentPosts({ posts }: { posts: BlogPostMeta[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="rounded-[18px] border border-[#F0E2EC] bg-white p-5 shadow-[0px_8px_14px_rgba(0,0,0,0.02)]">
      <h2 className="font-montserrat text-[13px] font-semibold uppercase tracking-[0.1em] text-[#AC467B]">
        Recent articles
      </h2>

      <ul className="mt-4 flex flex-col divide-y divide-[#F0E2EC]">
        {posts.map((post) => (
          <li key={post.slug} className="py-3 first:pt-0 last:pb-0">
            <Link href={`/blog/${post.slug}`} className="group flex gap-3">
              <div className="relative h-[58px] w-[74px] shrink-0 overflow-hidden rounded-lg bg-[#F3E5F5]">
                <Image
                  src={post.heroImage}
                  alt={post.heroAlt}
                  fill
                  sizes="74px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <h3 className="line-clamp-2 font-montserrat text-[13.5px] font-medium leading-[1.35] text-[#373634] transition-colors group-hover:text-[#CF5B9D]">
                  {post.title}
                </h3>
                <p className="mt-1 font-montserrat text-[11px] text-zinc-400">
                  {formatBlogDate(post.dateModified)} · {post.readingMinutes} min read
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
