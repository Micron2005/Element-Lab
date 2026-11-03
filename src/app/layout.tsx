import type { Metadata } from "next";
import Link from "next/link";
import { navItems } from "@/components/shared";
import DisplaySettings from "@/components/DisplaySettings";
import SkipLink from "@/components/SkipLink";
import { PREFS_SCRIPT } from "@/lib/prefs";
import "./globals.css";
import "./accessibility.css";

export const metadata: Metadata = {
  title: { default: "Science Lab", template: "%s · Science Lab" },
  description: "A virtual science lab for curious minds: chemistry, materials, physics and more.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body>
        <div className="site-shell">
          <SkipLink />
          <nav className="topbar" aria-label="Main navigation">
            <div className="topbar-brand-actions">
              <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">S</span><span>SCIENCE <b>LAB</b></span></Link>
              <DisplaySettings />
            </div>
            <div className="nav-links">{navItems.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</div>
            <span className="lab-status"><span className="status-dot" /> MODEL ONLINE</span>
          </nav>
          <main className="main-content" id="main-content" tabIndex={-1}>{children}</main>
          <footer className="site-footer"><span className="footer-brand">S·LAB / ESTIMATE NOTICE</span><p>Estimates from simplified models and published property ranges, not lab results.</p><Link className="footer-glossary" href="/glossary">Glossary</Link></footer>
        </div>
      </body>
    </html>
  );
}
