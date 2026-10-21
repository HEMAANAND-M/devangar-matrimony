import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Geist, Noto_Sans_Tamil, Noto_Serif_Tamil } from "next/font/google";
import { getLocale } from "@/lib/i18n";
import { SITE_NAME } from "@/lib/constants";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

// Tamil glyphs fall back to these (Geist and Cormorant have none); browsers only download them when
// Tamil text is on the page, so the English site looks and loads exactly as before.
const notoTamil = Noto_Sans_Tamil({
  variable: "--font-noto-tamil",
  subsets: ["tamil"],
  display: "swap",
  preload: false,
});

const notoSerifTamil = Noto_Serif_Tamil({
  variable: "--font-noto-serif-tamil",
  subsets: ["tamil"],
  weight: ["500", "600", "700"],
  display: "swap",
  preload: false,
});

const DESCRIPTION = "Verified, privacy-first matrimony service for the Devangar (Devanga) community.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — Trusted matches for the Devanga community`, template: `%s · ${SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN", description: DESCRIPTION },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: "Devangar", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#5e1229",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={await getLocale()}>
      <body className={`${geistSans.variable} ${cormorant.variable} ${notoTamil.variable} ${notoSerifTamil.variable} flex min-h-screen flex-col font-sans antialiased`}>
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-maroon px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
