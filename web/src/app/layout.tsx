import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter, Montserrat } from "next/font/google";
import NextAuthProvider from "@/app/_providers/session-provider";
import ChatWidget from "@/components/chat/chat-widget";
import { LocationProvider } from "@/lib/location/location-context";
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
  title: "Medspa Map — Find the Right Medspa Near You",
  description:
    "Explore 10,000+ vetted medspas, read expert treatment guides, and book with confidence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${inter.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="flex min-h-full flex-col"
        suppressHydrationWarning
      >
        <NextAuthProvider>
          <LocationProvider>
            {children}
          </LocationProvider>
        </NextAuthProvider>
        {/* AI assistant — self-hides on /admin routes */}
        <ChatWidget />
      </body>

    </html>
  );
}
