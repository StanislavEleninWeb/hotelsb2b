import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo } from "next/font/google";
import { QueryProvider } from "../lib/query-provider";
import { Nav } from "./_components/nav";
import { Footer } from "./_components/footer";
import { ScrollReveal } from "./_components/scroll-reveal";
import "./globals.css";

// Self-hosted at build (no runtime request to Google) — keeps the strict nonce CSP
// (font-src 'self') intact while giving the Modernist system its Archivo type.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Harbor Stays — Book direct", template: "%s · Harbor Stays" },
  description: "Two properties, run by the people who own them. Real-time availability, booked direct.",
};

// Render every route dynamically so the per-request CSP nonce (set in middleware)
// reaches Next's inline + external scripts. A strict nonce CSP and static
// prerendering are mutually exclusive — the app is dynamic (SSR, still crawlable).
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        <QueryProvider>
          <div className="shell">
            <Nav />
            <main>{children}</main>
            <Footer />
          </div>
          <ScrollReveal />
        </QueryProvider>
      </body>
    </html>
  );
}
