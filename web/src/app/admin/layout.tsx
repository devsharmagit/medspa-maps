import type { Metadata } from "next";

// Admin is not public — keep the whole /admin subtree out of search indexes
// (overrides the site-wide index/follow default set in the root layout).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
