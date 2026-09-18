import type { Metadata } from "next";
import Script from "next/script";
import { Fraunces, Geist_Mono, Inter, Montserrat } from "next/font/google";
import NextAuthProvider from "@/app/_providers/session-provider";
import ChatWidget from "@/components/chat/chat-widget";
import { LocationProvider } from "@/lib/location/location-context";
import { UsaOnlyNotice } from "@/components/location/usa-only-notice";
import { SITE_URL } from "@/lib/site";
import "./globals.css";


const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Medspa Maps - Find the Right Local Medspa",
  description:
    "Explore 600+ vetted medspas, read expert treatment guides, and book with confidence.",
  verification: {
    google: "9fds86az679AXZLrdij1vD9s5RYzIhW3_m4_LEyKCao",
  },
  // Site-wide crawler directive. Renders:
  //   <meta name="robots" content="index, follow, max-snippet:-1,
  //     max-image-preview:large, max-video-preview:-1">
  // Individual pages can override (e.g. /search noindexes empty query
  // permutations, /admin noindexes the whole subtree).
  robots: {
    index: true,
    follow: true,
    "max-snippet": -1,
    "max-image-preview": "large",
    "max-video-preview": -1,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${montserrat.variable} ${inter.variable} ${fraunces.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-15B6X0YF9T"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-15B6X0YF9T');
          `}
        </Script>
      </head>
      <body
        className="flex min-h-full flex-col"
        suppressHydrationWarning
      >
        <NextAuthProvider>
          <LocationProvider>
            {children}
            {/* Single global "USA-only" notice — never doubles up across pages. */}
            <UsaOnlyNotice />
            {/* AI assistant — self-hides on /admin routes. Inside LocationProvider
                so "near me" can search a real radius around the visitor. */}
            <ChatWidget />
          </LocationProvider>
        </NextAuthProvider>
      </body>

    </html>
  );
}
