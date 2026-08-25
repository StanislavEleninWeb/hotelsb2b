import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { QueryProvider } from "../lib/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Harbor Stays — Book your hotel", template: "%s · Harbor Stays" },
  description: "Search and book hotels with real-time availability.",
};

// Render every route dynamically so the per-request CSP nonce (set in middleware)
// reaches Next's inline + external scripts. A strict nonce CSP and static
// prerendering are mutually exclusive — the app is dynamic (SSR, still crawlable).
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <nav className="nav">
            <div className="container">
              <Link href="/" className="brand">
                Harbor Stays
              </Link>
              <div className="spacer" />
              <Link href="/search">Search</Link>
              <Link href="/account">My bookings</Link>
              <Link href="/account/login">Sign in</Link>
            </div>
          </nav>
          <main className="container">{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
