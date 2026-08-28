import type { Metadata } from "next";
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
  title: "Med Spa Maps — Find the Right Local Med Spa",
  description:
    "Explore 600+ vetted med spas, read expert treatment guides, and book with confidence.",
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
      <body
        className="flex min-h-full flex-col"
        suppressHydrationWarning
      >
        <NextAuthProvider>
          <LocationProvider>
            {children}
            {/* Single global "USA-only" notice — never doubles up across pages. */}
            <UsaOnlyNotice />
          </LocationProvider>
        </NextAuthProvider>
        {/* AI assistant — self-hides on /admin routes */}
        <ChatWidget />
      </body>

    </html>
  );
}
