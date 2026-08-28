import Image from "next/image";
import Link from "next/link";

import type { BlogPostMeta } from "@/lib/blog/posts";
import { formatBlogMeta } from "@/lib/blog/format";

/** Article card for the /blog index grid and the "related articles" row. */
export function BlogCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-[16px] border border-[#ECDDED] bg-white shadow-[0px_8px_14px_rgba(0,0,0,0.02)] transition-all hover:border-[#CB97CE] hover:shadow-[0px_10px_24px_rgba(203,151,206,0.14)]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#F3E5F5]">
        <Image
          src={post.heroImage}
          alt={post.heroAlt}
          fill
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <span className="font-montserrat text-[10px] font-semibold uppercase tracking-[0.08em] text-[#AC467B]">
          {post.category}
        </span>
        <h3 className="mt-1.5 font-montserrat text-[18px] font-medium leading-[1.3] tracking-[-0.01em] text-[#373634] line-clamp-2">
          {post.title}
        </h3>
        <p className="mt-2 font-montserrat text-[14px] leading-[1.55] text-zinc-600 line-clamp-2">
          {post.description}
        </p>
        <span className="mt-4 font-montserrat text-[12px] text-[#727272]">
          {formatBlogMeta(post.datePublished, post.readingMinutes)}
        </span>
      </div>
    </Link>
  );
}
