import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Flatten React children to a plain string (headings are plain text here). */
function toText(children: ReactNode): string {
  if (children == null || children === false) return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(toText).join("");
  if (typeof children === "object" && "props" in (children as never)) {
    return toText((children as { props: { children: ReactNode } }).props.children);
  }
  return "";
}

/** Stable anchor id from a heading's text (enables deep-linking to sections). */
function slugify(children: ReactNode): string {
  return toText(children)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Long-form markdown renderer with a house Tailwind component map (the app has
 * no @tailwindcss/typography). remark-gfm enables the comparison tables. The
 * "snippet answer" — a paragraph that is entirely bold in the source — is
 * detected and rendered as an emphasized lead, matching the featured-snippet
 * intent of the source docs.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children }) => (
          <h2
            id={slugify(children)}
            className="mt-12 scroll-mt-28 font-montserrat text-[24px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#373634] sm:text-[28px]"
          >
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3
            id={slugify(children)}
            className="mt-8 scroll-mt-28 font-montserrat text-[18px] font-semibold leading-[1.3] text-[#373634] sm:text-[20px]"
          >
            {children}
          </h3>
        ),
        p: ({ node, children }) => {
          const kids = node?.children ?? [];
          const isLead =
            kids.length === 1 &&
            kids[0]?.type === "element" &&
            kids[0]?.tagName === "strong";
          if (isLead) {
            return (
              <p className="mt-6 font-montserrat text-[17px] leading-[1.65] sm:text-[18px]">
                {children}
              </p>
            );
          }
          return (
            <p className="mt-4 font-montserrat text-[16px] leading-[1.75] text-zinc-700">
              {children}
            </p>
          );
        },
        a: ({ href, children }) => {
          const url = href ?? "#";
          const isInternal = url.startsWith("/");
          const className =
            "font-medium text-[#b0339c] underline decoration-[#e6b8dd] underline-offset-2 transition-colors hover:text-[#7b2d6b]";
          if (isInternal) {
            return (
              <Link href={url} className={className}>
                {children}
              </Link>
            );
          }
          return (
            <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
              {children}
            </a>
          );
        },
        strong: ({ children }) => (
          <strong className="font-semibold text-[#373634]">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="mt-4 space-y-2.5 pl-1 font-montserrat text-[16px] leading-[1.7] text-zinc-700">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mt-4 list-decimal space-y-2.5 pl-5 font-montserrat text-[16px] leading-[1.7] text-zinc-700">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="relative pl-5 marker:text-[#CF5B9D] [ol_&]:pl-1">
            <span
              aria-hidden
              className="absolute left-0 top-[0.62em] size-[6px] rounded-full bg-[#CF5B9D] [ol_&]:hidden"
            />
            {children}
          </li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-8 rounded-r-[10px] border-l-[3px] border-[#CF5B9D] bg-[#faf5fa] py-4 pl-5 pr-4 [&_p]:m-0 [&_p]:font-fraunces [&_p]:text-[18px] [&_p]:italic [&_p]:leading-[1.5] [&_p]:text-[#7b2d6b] sm:[&_p]:text-[19px]">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="my-7 w-full overflow-x-auto rounded-[12px] border border-[#F0E2EC]">
            <table className="w-full min-w-[560px] border-collapse text-left font-montserrat text-[14px] sm:text-[15px]">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-[#faf5fa]">{children}</thead>,
        th: ({ children }) => (
          <th className="border-b border-[#F0E2EC] px-4 py-3 font-semibold text-[#373634]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-[#F4EAF1] px-4 py-3 align-top text-zinc-700">
            {children}
          </td>
        ),
        hr: () => <hr className="my-10 border-[#F0E2EC]" />,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

export type MarkdownProps = ComponentPropsWithoutRef<typeof Markdown>;
