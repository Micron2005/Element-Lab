"use client";

import { useRouter } from "next/navigation";
import type { LearnCard as LearnCardData } from "@/lib/play/learn";

const HANDOFF_KEY = "elementlab.assistant.handoff";

export default function LearnCard({ card }: { card: LearnCardData }) {
  const router = useRouter();

  function askLabPartner() {
    localStorage.setItem(
      HANDOFF_KEY,
      JSON.stringify({
        title: card.title,
        context: card.context,
        prompt: card.askPrompt,
        at: Date.now(),
      }),
    );
    router.push("/assistant");
  }

  return (
    <section className="play-learn-card" aria-label="What you just made">
      <p className="eyebrow">WHAT YOU JUST MADE</p>
      <h3>{card.title}</h3>
      <div className="play-learn-sections">
        {card.sections.map((section) => (
          <div key={section.heading}>
            <h4>{section.heading}</h4>
            <p>{section.body}</p>
          </div>
        ))}
      </div>
      <div className="play-learn-uses">
        <h4>Used for</h4>
        <ul>{card.usedFor.map((use) => <li key={use}>{use}</li>)}</ul>
      </div>
      <button
        type="button"
        className="button button-secondary play-learn-ask"
        onClick={askLabPartner}
      >
        Ask your lab partner ↗
      </button>
    </section>
  );
}
