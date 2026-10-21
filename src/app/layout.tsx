import type { Metadata } from "next";
import Link from "next/link";
import { navItems } from "@/components/shared";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Element Lab", template: "%s · Element Lab" },
  description: "A virtual materials lab for curious minds.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <nav className="topbar" aria-label="Main navigation">
            <Link className="brand" href="/" aria-label="Element Lab home"><span className="brand-mark">E<span>·</span></span><span>ELEMENT <b>LAB</b></span></Link>
            <div className="nav-links">{navItems.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</div>
            <span className="lab-status"><span className="status-dot" /> MODEL ONLINE</span>
          </nav>
          <main className="main-content">{children}</main>
          <footer className="site-footer"><span className="footer-brand">E·LAB / ESTIMATE NOTICE</span><p>Estimates from simplified models and published property ranges, not lab results.</p></footer>
        </div>
      </body>
    </html>
  );
}
