import Link from "next/link";
import { PageIntro } from "@/components/shared";

const tools = [
  { number: "01", title: "Experiment Bench", href: "/bench", label: "EXPERIMENT BENCH", copy: "Mix elements, proteins, enzymes and chemicals, set the conditions, and see what forms — or let it search for the best mix.", action: "Open the bench" },
  { number: "02", title: "Formula lab", href: "/lab", label: "MATERIALS DESIGN", copy: "Blend polymers, crosslinkers, and fillers. See how the mix might behave before you make it.", action: "Open formula builder" },
  { number: "03", title: "Jet shooter", href: "/shooter", label: "FLUID DYNAMICS", copy: "Explore flight, sag, breakup, and the pressure behind a hypothetical strand launcher.", action: "Model a jet" },
  { number: "04", title: "Chemical lookup", href: "/chemicals", label: "REFERENCE DESK", copy: "Look up molecular properties and GHS hazard information from PubChem.", action: "Search chemicals" },
  { number: "05", title: "Element explorer", href: "/elements", label: "NUCLEAR PHYSICS", copy: "Explore binding energy, stability, and decay estimates for known and hypothetical nuclei.", action: "Explore nuclei" },
  { number: "06", title: "Lab assistant", href: "/assistant", label: "ASK A LAB PARTNER", copy: "Get a clear, practical read on your formula, process, and what the estimates mean.", action: "Ask a question" },
];

export default function Home() {
  return (
    <>
      <PageIntro eyebrow="A VIRTUAL MATERIALS LAB" title="Curiosity, measured." description="Build a material. Put it through its paces. Follow the science wherever it leads." />
      <section className="tool-grid" aria-label="Lab tools">
        {tools.map((tool) => (
          <Link className="tool-card" href={tool.href} key={tool.href}>
            <span className="tool-card-top"><span className="eyebrow">{tool.label}</span><span className="tool-number">{tool.number}</span></span>
            <h2>{tool.title}</h2>
            <p>{tool.copy}</p>
            <span className="text-link">{tool.action} <span aria-hidden="true">↗</span></span>
          </Link>
        ))}
      </section>
      <section className="home-note"><span className="status-dot" /><p><strong>Model, don&apos;t manufacture.</strong> The tools are for learning and exploring—not engineering advice or proof of safety.</p></section>
    </>
  );
}
