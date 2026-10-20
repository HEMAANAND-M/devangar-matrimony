import type { Metadata } from "next";
import { Cormorant_Garamond, Geist } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { SITE_NAME } from "@/lib/constants";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} — Trusted matches for the Devanga community`, template: `%s · ${SITE_NAME}` },
  description: "Verified, privacy-first matrimony service for the Devangar (Devanga) community.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${cormorant.variable} flex min-h-screen flex-col font-sans antialiased`}>
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
