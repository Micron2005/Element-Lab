import type { Metadata } from "next";
import {
  glossaryFor,
  GLOSSARY_GROUPS,
  GLOSSARY_GROUP_LABEL_KEYS,
  type GlossaryEntry,
  type TermId,
} from "@/lib/glossary";
import { PageIntro } from "@/components/shared";
import { getT, localizedMetadata } from "@/lib/i18n/server";
import "./glossary.css";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata("meta.glossary");
}

export default async function GlossaryPage() {
  const { locale, t } = await getT();
  const glossary = glossaryFor(locale);
  const groups = Object.entries(GLOSSARY_GROUPS) as [
    keyof typeof GLOSSARY_GROUPS,
    readonly TermId[],
  ][];
  return (
    <>
      <PageIntro
        eyebrow={t("glossary.eyebrow")}
        title={t("glossary.title")}
        description={t("glossary.description")}
      />
      <div className="glossary-groups">
        {groups.map(([group, ids]) => (
          <section className="glossary-group panel" key={group} aria-labelledby={`glossary-${group.toLowerCase()}`}>
                    <h2 id={`glossary-${group.toLowerCase()}`}>
                      {t(GLOSSARY_GROUP_LABEL_KEYS[group])}
                    </h2>
            <dl>
              {ids.map((id) => {
                const entry: GlossaryEntry = glossary[id];
                return (
                  <div className="glossary-entry" id={id} key={id}>
                    <dt>{entry.term}</dt>
                    <dd>{entry.plain}</dd>
                    {entry.example && <dd className="glossary-example">{t("glossary.example", { example: entry.example })}</dd>}
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>
    </>
  );
}
