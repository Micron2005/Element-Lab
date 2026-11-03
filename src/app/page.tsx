import Link from "next/link";
import { PageIntro } from "@/components/shared";

const tools = [
  { number: "00", title: "Lab quests", href: "/play", label: "PLAY & LEARN", copy: "Game-style science quests: build molecules, mix materials, and explore nuclear processes. Earn stars as you learn.", action: "Start playing" },
  { number: "01", title: "Experiment Bench", href: "/bench", label: "EXPERIMENT BENCH", copy: "Mix ingredients, set conditions, and test how a material behaves, including in a modeled nozzle extrusion.", action: "Open the bench" },
  { number: "02", title: "Formula lab", href: "/lab", label: "MATERIALS & ENGINEERING", copy: "Explore how ingredient choices may affect a formula’s estimated strength, stretch, tack, cost, and safety.", action: "Open formula builder" },
  { number: "03", title: "Chemical lookup", href: "/chemicals", label: "REFERENCE DESK", copy: "Look up molecular properties and hazard information from PubChem.", action: "Search chemicals" },
  { number: "04", title: "Element explorer", href: "/elements", label: "NUCLEAR PHYSICS", copy: "Explore binding energy, stability, and decay estimates for known and hypothetical nuclei.", action: "Explore nuclei" },
  { number: "05", title: "Lab assistant", href: "/assistant", label: "ASK A LAB PARTNER", copy: "Ask about science concepts, experiments, or how to interpret a model’s estimates.", action: "Ask a question" },
];

export default function Home() {
  return (
    <>
      <PageIntro eyebrow="A VIRTUAL SCIENCE LAB" title="Curiosity, measured." description="Mix materials, build molecules, split and fuse atoms, and test your ideas. Made for students, teachers, scientists and anyone building a project at home." />
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
      <section className="home-note"><span className="status-dot" /><p><strong>Model, don&apos;t manufacture.</strong> Results are estimates for learning and exploring, not professional engineering sign-off or proof of safety.</p></section>
    </>
  );
}
