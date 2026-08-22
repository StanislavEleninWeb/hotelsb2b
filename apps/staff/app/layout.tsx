import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { QueryProvider } from "../lib/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Staff Panel", template: "%s · Staff" },
  description: "Internal reservation management.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <nav className="nav">
            <div className="container">
              <Link href="/" className="brand">
                Harbor Stays · Staff
              </Link>
              <div className="spacer" />
              <Link href="/">Properties</Link>
              <Link href="/login">Sign in</Link>
            </div>
          </nav>
          <main className="container">{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
