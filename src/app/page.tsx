import Link from "next/link";
import { PageIntro } from "@/components/shared";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n";

const tools = [
  { number: "00", title: "home.playTitle", href: "/play", label: "home.playLabel", copy: "home.playCopy", action: "home.playAction" },
  { number: "01", title: "home.benchTitle", href: "/bench", label: "home.benchLabel", copy: "home.benchCopy", action: "home.benchAction" },
  { number: "02", title: "home.labTitle", href: "/lab", label: "home.labLabel", copy: "home.labCopy", action: "home.labAction" },
  { number: "03", title: "home.chemicalsTitle", href: "/chemicals", label: "home.chemicalsLabel", copy: "home.chemicalsCopy", action: "home.chemicalsAction" },
  { number: "04", title: "home.elementsTitle", href: "/elements", label: "home.elementsLabel", copy: "home.elementsCopy", action: "home.elementsAction" },
  { number: "05", title: "home.assistantTitle", href: "/assistant", label: "home.assistantLabel", copy: "home.assistantCopy", action: "home.assistantAction" },
];

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("meta.home") };
}

export default async function Home() {
  const { t } = await getT();
  return (
    <>
      <PageIntro eyebrow={t("home.eyebrow")} title={t("home.title")} description={t("home.description")} />
      <section className="tool-grid" aria-label={t("home.tools")}>
        {tools.map((tool) => (
          <Link className="tool-card" href={tool.href} key={tool.href}>
            <span className="tool-card-top"><span className="eyebrow">{t(tool.label as MessageKey)}</span><span className="tool-number">{tool.number}</span></span>
            <h2>{t(tool.title as MessageKey)}</h2>
            <p>{t(tool.copy as MessageKey)}</p>
            <span className="text-link">{t(tool.action as MessageKey)} <span aria-hidden="true">↗</span></span>
          </Link>
        ))}
      </section>
      <section className="home-note"><span className="status-dot" /><p><strong>{t("home.noteLead")}</strong> {t("home.note")}</p></section>
    </>
  );
}
