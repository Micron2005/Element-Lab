"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { analyze, fmtTime, hazardWord } from "@/lib/formula";
import { byId } from "@/lib/ingredients";
import { benchById } from "@/lib/bench/library";
import { simulate } from "@/lib/bench/simulate";
import type { Experiment } from "@/lib/bench/types";
import { PageIntro, Panel } from "./shared";

type Message = { role: "user" | "assistant"; content: string };
type LearnContext = { title: string; context: string };
const STORAGE_KEY = "elementlab.chat";
const HANDOFF_KEY = "elementlab.assistant.handoff";
const welcome: Message = { role: "assistant", content: "Hi, I’m your lab partner. Ask me about a material, a formula, or what these estimates can—and can’t—tell you." };
const prompts = ["Why would this mix fail?", "What’s missing to make it hold my weight?", "Is it safe on skin?", "Do I need a vacuum to make it?", "Could we make a new element?"];
const cureNames: Record<string, string> = {
  evaporation: "solvent evaporation",
  "ionic-bath": "ionic bath",
  moisture: "moisture",
  anionic: "anionic polymerization",
  shear: "shear alignment",
  cooling: "cooling",
  covalent: "covalent reaction",
  none: "none",
};

function buildFormulaLabState(): string | null {
  try {
    const stored = JSON.parse(localStorage.getItem("elementlab.current") ?? "null");
    const parts = stored?.parts;
    if (!Array.isArray(parts)) return null;
    const result = analyze(parts);
    const ingredients = parts.map((part) => `- ${byId[part.id]?.name ?? part.id}: ${Number(part.pct).toFixed(1)}%`).join("\n");
    const checks = result.checks.length ? result.checks.map((check) => `- [${check.level}] ${check.text}`).join("\n") : "No checks raised.";
    const cureMechanisms = result.cure.map((mechanism) => cureNames[mechanism] ?? mechanism).join(", ") || "None listed";
    const environment = result.environment.length ? result.environment.map((line) => `- ${line}`).join("\n") : "No special requirements listed.";
    return [
      "Formula Lab:",
      `Ingredients:\n${ingredients || "No ingredients."}`,
      [
        "Formula analysis:",
        `Solids: ${result.solidsPct.toFixed(1)}%.`,
        `Estimated results: strength ${result.tensileMPa.toFixed(1)} MPa; stretch ${result.elongationPct.toFixed(1)}%; toughness ${result.toughnessMJm3.toFixed(2)} MJ/m³; stickiness ${result.tack.toFixed(1)}/10.`,
        `Cure mechanisms: ${cureMechanisms}.`,
        `Set time: ${fmtTime(result.cureSeconds)}.`,
        `Toxicity while mixing: ${hazardWord(result.wetToxicity)}.`,
        `Toxicity once cured: ${hazardWord(result.curedToxicity)}.`,
        `Skin hazard: ${hazardWord(result.skin)}.`,
        `Edible: ${result.edible ? "Yes" : "No"}.`,
        `Water behavior: ${result.water}; ${result.dissolveTime}.`,
        `Biodegradable: ${result.biodegradable ? "Yes" : "No"}.`,
        `Cost per kg: ${result.costPerKg.toFixed(2)}.`,
      ].join("\n"),
      `Environment and preparation:\n${environment}`,
      `Checks:\n${checks}`,
    ].join("\n\n");
  } catch {
    return null;
  }
}

function buildBenchMixState(): string | null {
  try {
    const stored = JSON.parse(localStorage.getItem("elementlab.bench.current") ?? "null");
    if (
      !stored ||
      !Array.isArray(stored.parts) ||
      !stored.conditions ||
      typeof stored.conditions !== "object"
    ) {
      return null;
    }
    const experiment = stored as Experiment;
    const result = simulate(experiment);
    const ingredients = experiment.parts
      .filter((part) => part.pct > 0)
      .map((part) => `- ${benchById[part.id]?.name ?? part.id}: ${part.pct.toFixed(1)}%`)
      .join("\n");
    const conditions = experiment.conditions;
    const events = result.events
      .filter((event) => event.status === "happened" || event.status === "partial")
      .map((event) => `- ${event.name} (${event.status}): ${event.mechanism}`);
    const warnings = result.warnings
      .slice(0, 5)
      .map((warning) => `- [${warning.level}] ${warning.text}`);
    return [
      "Bench mix:",
      `Ingredients:\n${ingredients || "No ingredients."}`,
      [
        "Conditions:",
        `${conditions.tempC} °C`,
        `${conditions.pressureKPa} kPa`,
        conditions.atmosphere,
        `${conditions.humidityPct}% humidity`,
        `${conditions.mixRpm} rpm for ${conditions.mixMinutes} min mixing`,
        `${conditions.cureMinutes} min cure`,
        `forming: ${conditions.forming}`,
        `bath: ${conditions.bathId ?? "none"}`,
      ].join("; "),
      `Effective pH: ${result.effectivePH.toFixed(1)}.`,
      `${result.productLabel}: ${result.summary}`,
      `Events:\n${events.join("\n") || "No events happened or were partial."}`,
      result.setSeconds > 0
        ? `Set time: ${fmtTime(result.setSeconds)}.`
        : "Set time: doesn't set on its own.",
      `Strength: ${result.tensileMPa.toFixed(1)} MPa tensile; stretch: ${result.elongationPct.toFixed(1)}%; stickiness: ${result.tack.toFixed(1)}/10.`,
      `Safety: wet toxicity ${hazardWord(result.wetToxicity)}; cured toxicity ${hazardWord(result.curedToxicity)}; skin hazard ${hazardWord(result.skin)}.`,
      `Warnings:\n${warnings.join("\n") || "No warnings."}`,
    ].join("\n\n");
  } catch {
    return null;
  }
}

function buildLabState() {
  const sections = [buildBenchMixState(), buildFormulaLabState()].filter(
    (section): section is string => section !== null,
  );
  return sections.length
    ? sections.join("\n\n")
    : "No current lab formula is saved in this browser.";
}

function readLearnHandoff(
  setLearnContext: (value: LearnContext | null) => void,
  setInput: (value: string) => void,
) {
  try {
    const raw = localStorage.getItem(HANDOFF_KEY);
    if (raw) {
      const handoff = JSON.parse(raw);
      const age = Date.now() - handoff?.at;
      if (
        typeof handoff?.title === "string" &&
        typeof handoff?.context === "string" &&
        typeof handoff?.prompt === "string" &&
        Number.isFinite(handoff?.at) &&
        age >= 0 &&
        age < 60 * 60 * 1000
      ) {
        setLearnContext({ title: handoff.title, context: handoff.context });
        setInput(handoff.prompt);
      }
    }
  } catch {
    return;
  } finally {
    try {
      localStorage.removeItem(HANDOFF_KEY);
    } catch {
      return;
    }
  }
}

export default function AssistantTool() {
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [includeLab, setIncludeLab] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [learnContext, setLearnContext] = useState<LearnContext | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
        if (Array.isArray(stored) && stored.every((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")) setMessages(stored.slice(-80));
      } catch {
        setNotice("Saved conversation could not be read.");
      }
      readLearnHandoff(setLearnContext, setInput);
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, ready]);

  const sendMessage = async (content: string) => {
    const question = content.trim();
    if (!question || loading) return;
    const conversation = [...messages, { role: "user" as const, content: question }];
    setMessages(conversation);
    setInput("");
    setNotice("");
    setLoading(true);
    try {
      const labState = [
        learnContext
          ? `WHAT THE USER JUST MADE IN PLAY:\n${learnContext.context}`
          : "",
        includeLab ? buildLabState() : "",
      ].filter((section) => section.trim()).join("\n\n");
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: conversation.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
          ...(labState ? { labState } : {}),
        }),
      });
      const result = await response.json();
      if (response.status === 503 && result.error === "no-key") {
        setMessages([...conversation, { role: "assistant", content: "The assistant is off. Add an `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in Vercel → Project → Settings → Environment Variables, then redeploy." }]);
      } else if (!response.ok) {
        setMessages([...conversation, { role: "assistant", content: result.error ?? "I couldn’t reach the assistant just now. Please try again." }]);
      } else {
        setMessages([...conversation, { role: "assistant", content: result.reply }]);
      }
    } catch {
      setMessages([...conversation, { role: "assistant", content: "I couldn’t reach the assistant just now. Check your connection and try again." }]);
    } finally {
      setLoading(false);
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };
  const clearChat = () => {
    setMessages([welcome]);
    setNotice("Conversation cleared.");
  };

  return (
    <>
      <PageIntro eyebrow="TOOL 05 / YOUR LAB PARTNER" title="Ask the lab assistant" description="A practical science companion for reasoning about materials, safety, and what your model can tell you." />
      <div className="assistant-layout">
        <Panel title="Conversation" subtitle="Replies are estimates and explanations—not proof that a material is safe or strong." className="chat-panel">
          <div className="chat-heading"><span className="badge"><span className="status-dot" style={{ marginRight: 6 }} /> Lab partner</span><button className="button button-secondary button-small" type="button" onClick={clearChat}>Clear chat</button></div>
          <div className="divider" />
          <div className="chat-messages" aria-live="polite">
            {messages.map((message, index) => (
              <article className={`message message-${message.role}`} key={`${index}-${message.role}`}>
                <span className="metric-label">{message.role === "user" ? "YOU" : "LAB ASSISTANT"}</span>
                <div style={{ marginTop: 5 }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ children }) => (
                        <div className="md-table">
                          <table>{children}</table>
                        </div>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              </article>
            ))}
            {loading && <div className="message message-assistant"><span className="metric-label">LAB ASSISTANT</span><p style={{ margin: "6px 0 0" }}>Thinking through the chemistry…</p></div>}
            <div ref={endRef} />
          </div>
          <form className="chat-compose" onSubmit={submit}><textarea className="textarea" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your formula…" aria-label="Your message" rows={2} /><button className="button button-primary" type="submit" disabled={loading || !input.trim()}>Send ↗</button></form>
        </Panel>
        <aside className="assistant-side">
          <Panel title="Context">
            {learnContext && (
              <div className="chat-heading">
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  From Play: {learnContext.title}
                </span>
                <button
                  className="button button-secondary button-small"
                  type="button"
                  style={{ minHeight: 44, flex: "0 0 auto" }}
                  onClick={() => setLearnContext(null)}
                >
                  Remove
                </button>
              </div>
            )}
            <label className="toggle-row"><span>Include my current Bench mix and lab formula</span><input type="checkbox" checked={includeLab} onChange={(event) => setIncludeLab(event.target.checked)} /></label>
            <p className="small muted">When enabled, the current Bench mix and Formula Lab analysis are sent with your latest question.</p>
            <p className="small muted">Chat history is saved in this browser.</p>
          </Panel>
          <Panel title="Try asking">
            <div className="prompt-list">
              {[...prompts, ...(learnContext ? ["Explain what I just made more deeply"] : [])].map((prompt) => (
                <button className="chip" type="button" key={prompt} onClick={() => void sendMessage(prompt)} disabled={loading}>{prompt}</button>
              ))}
            </div>
          </Panel>
          {notice && <p className="small muted" role="status">{notice}</p>}
          <div className="notice">This is a learning tool. Never use its estimates as a substitute for testing, safety data, or professional advice.</div>
        </aside>
      </div>
    </>
  );
}
