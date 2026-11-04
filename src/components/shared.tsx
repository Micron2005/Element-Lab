"use client";

import Link from "next/link";
import { useT } from "./LocaleProvider";

export function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  const { t } = useT();
  return <header className="page-intro"><p className="eyebrow">{t(eyebrow)}</p><h1>{t(title)}</h1><p className="intro-copy">{t(description)}</p></header>;
}

export function Panel({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  const { t } = useT();
  return <section className={`panel ${className}`}><div className="panel-heading"><div><h2>{t(title)}</h2>{subtitle && <p>{t(subtitle)}</p>}</div></div>{children}</section>;
}

export const roleNames: Record<string, string> = { polymer: "Polymer", crosslinker: "Crosslinker", adhesive: "Adhesive", plasticizer: "Plasticizer", solvent: "Solvent", filler: "Filler" };
export function ToolLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className="button button-secondary" href={href}>{children}</Link>;
}
