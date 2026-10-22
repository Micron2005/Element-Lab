import Link from "next/link";

export function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="page-intro"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="intro-copy">{description}</p></header>;
}

export function Panel({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>{children}</section>;
}

export const roleNames: Record<string, string> = { polymer: "Polymer", crosslinker: "Crosslinker", adhesive: "Adhesive", plasticizer: "Plasticizer", solvent: "Solvent", filler: "Filler" };
export const navItems = [["Play", "/play"], ["Bench", "/bench"], ["Lab", "/lab"], ["Shooter", "/shooter"], ["Chemicals", "/chemicals"], ["Elements", "/elements"], ["Assistant", "/assistant"]] as const;
export function ToolLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className="button button-secondary" href={href}>{children}</Link>;
}
