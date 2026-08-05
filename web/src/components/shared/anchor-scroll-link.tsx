"use client";

/**
 * A same-page anchor link with a JS-driven smooth scroll that survives layout
 * shift. Plain `<a href="#id">` + CSS `scroll-behavior: smooth` computes its
 * scroll target once and can get cancelled/stranded mid-animation if content
 * above the target (e.g. a lazy-loading image) shifts height while it's
 * animating — the browser never resumes it. We re-issue `scrollIntoView` a
 * few times over the following second so it re-targets and lands correctly
 * regardless of any shift. The `href` stays a real anchor for no-JS/SEO.
 */
export function AnchorScrollLink({
  targetId,
  className,
  children,
}: {
  targetId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(targetId);
    if (!el) return; // let the browser's default hash-jump handle it
    e.preventDefault();
    history.pushState(null, "", `#${targetId}`);
    const scroll = () => el.scrollIntoView({ behavior: "smooth", block: "start" });
    scroll();
    // Re-correct a few times as late-loading images above the target shift
    // layout; each call is a no-op once we're already there.
    [150, 350, 600, 1000].forEach((ms) => setTimeout(scroll, ms));
  };

  return (
    <a href={`#${targetId}`} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
