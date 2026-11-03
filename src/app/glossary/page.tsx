import type { Metadata } from "next";
import {
  GLOSSARY,
  GLOSSARY_GROUPS,
  type GlossaryEntry,
  type TermId,
} from "@/lib/glossary";
import { PageIntro } from "@/components/shared";
import "./glossary.css";

export const metadata: Metadata = {
  title: "Glossary",
};

export default function GlossaryPage() {
  const groups = Object.entries(GLOSSARY_GROUPS) as [
    keyof typeof GLOSSARY_GROUPS,
    readonly TermId[],
  ][];
  return (
    <>
      <PageIntro
        eyebrow="LEARN THE LANGUAGE"
        title="Glossary"
        description="Short explanations for words used in the virtual lab."
      />
      <div className="glossary-groups">
        {groups.map(([group, ids]) => (
          <section className="glossary-group panel" key={group} aria-labelledby={`glossary-${group.toLowerCase()}`}>
            <h2 id={`glossary-${group.toLowerCase()}`}>{group}</h2>
            <dl>
              {ids.map((id) => {
                const entry: GlossaryEntry = GLOSSARY[id];
                return (
                  <div className="glossary-entry" id={id} key={id}>
                    <dt>{entry.term}</dt>
                    <dd>{entry.plain}</dd>
                    {entry.example && <dd className="glossary-example">Example: {entry.example}</dd>}
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
