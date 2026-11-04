import type { Metadata } from "next";
import Link from "next/link";
import { headers, cookies } from "next/headers";
import { Suspense } from "react";
import { BetaOnly, BetaProvider } from "@/components/BetaProvider";
import { BetaAnnouncement, BetaBadge } from "@/components/BetaStatus";
import DisplaySettings from "@/components/DisplaySettings";
import { LocaleProvider } from "@/components/LocaleProvider";
import ReportProblemButton from "@/components/ReportProblemButton";
import SkipLink from "@/components/SkipLink";
import { BETA_COOKIE, isBetaCookie } from "@/lib/beta";
import { PREFS_SCRIPT } from "@/lib/prefs";
import { LOCALE_COOKIE, pickLocale, tr } from "@/lib/i18n";
import "./globals.css";
import "./accessibility.css";

export const instant = false;

const navItems = [
  ["nav.play", "/play"],
  ["nav.bench", "/bench"],
  ["nav.lab", "/lab"],
  ["nav.chemicals", "/chemicals"],
  ["nav.elements", "/elements"],
  ["nav.assistant", "/assistant"],
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const locale = pickLocale(cookieStore.get(LOCALE_COOKIE)?.value, requestHeaders.get("accept-language"));
  return {
    title: { default: tr(locale, "meta.home"), template: "%s · Science Lab" },
    description: tr(locale, "meta.description"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const locale = pickLocale(cookieStore.get(LOCALE_COOKIE)?.value, requestHeaders.get("accept-language"));
  const t = (key: Parameters<typeof tr>[1]) => tr(locale, key);
  const beta = isBetaCookie(cookieStore.get(BETA_COOKIE)?.value);
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local";
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body>
        <BetaProvider beta={beta} commit={commit}>
          <LocaleProvider locale={locale}>
            <div className="site-shell">
              <SkipLink />
              <nav className="topbar" aria-label={t("shell.navigation")}>
                <div className="topbar-brand-actions">
                  <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">S</span><span>SCIENCE <b>LAB</b></span><BetaBadge /></Link>
                  <DisplaySettings />
                </div>
                <div className="nav-links">{navItems.map(([labelKey, href]) => href === "/play"
                  ? <a href={href} key={href}>{t(labelKey)}</a>
                  : <Link href={href} key={href}>{t(labelKey)}</Link>)}</div>
                <span className="lab-status"><span className="status-dot" /> {t("shell.status")}</span>
              </nav>
              <Suspense fallback={null}>
                <BetaAnnouncement />
              </Suspense>
              <main className="main-content" id="main-content" tabIndex={-1}>{children}</main>
              <footer className="site-footer"><span className="footer-brand">{t("shell.footerBrand")}</span><p>{t("shell.footerNotice")}</p><Link className="footer-glossary" href="/glossary">{t("shell.glossary")}</Link></footer>
              <BetaOnly feature="report-problem">
                <ReportProblemButton />
              </BetaOnly>
            </div>
          </LocaleProvider>
        </BetaProvider>
      </body>
    </html>
  );
}
