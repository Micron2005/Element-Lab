"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { analyze, fmtTime, hazardWord } from "@/lib/formula";
import { byId } from "@/lib/ingredients";
import { CUSTOM_PREFIX } from "@/lib/bench/custom";
import { benchById } from "@/lib/bench/library";
import { simulate } from "@/lib/bench/simulate";
import type { Experiment } from "@/lib/bench/types";
import { maskKey, USER_KEY_STORAGE, validateUserKey } from "@/lib/assistantKey";
import type { Provider } from "@/lib/assistantKey";
import { loadCustomIngredients } from "./useCustomIngredients";
import { PageIntro, Panel } from "./shared";
import { useT } from "./LocaleProvider";

type Message = { role: "user" | "assistant"; content: string };
type LearnContext = { title: string; context: string };
type SavedUserKey = { provider: Provider; apiKey: string };
const STORAGE_KEY = "elementlab.chat";
const HANDOFF_KEY = "elementlab.assistant.handoff";
const welcome: Message = { role: "assistant", content: "Hi, I’m your lab partner. Ask about a science question, an experiment, or what these estimates can—and can’t—tell you." };
const prompts = ["Why might this experiment fail?", "What could improve this material’s load capacity?", "Is it safe on skin?", "Do I need a vacuum for this process?", "Could we make a new element?"];
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
  loadCustomIngredients();
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
      .map((part) => {
        const ingredient = benchById[part.id];
        const name = ingredient?.name ??
          (part.id.startsWith(CUSTOM_PREFIX) ? "Deleted ingredient" : part.id);
        const properties = ingredient && part.id.startsWith(CUSTOM_PREFIX)
          ? [
              ingredient.tensileMPa !== undefined
                ? `strength ${ingredient.tensileMPa} MPa`
                : "",
              ingredient.elongationPct !== undefined
                ? `stretch ${ingredient.elongationPct}%`
                : "",
              Number.isFinite(ingredient.density)
                ? `density ${ingredient.density} g/cm³`
                : "",
            ].filter(Boolean).join(", ")
          : "";
        const suffix = properties
          ? ` (user-defined ingredient: ${properties})`
          : "";
        return `- ${name}${suffix}: ${part.pct.toFixed(1)}%`;
      })
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
  const { locale, t } = useT();
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [includeLab, setIncludeLab] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [learnContext, setLearnContext] = useState<LearnContext | null>(null);
  const [userKey, setUserKey] = useState<SavedUserKey | null>(null);
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [keyDraft, setKeyDraft] = useState("");
  const [keyError, setKeyError] = useState("");
  const [siteKey, setSiteKey] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCustomIngredients();
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
        if (Array.isArray(stored) && stored.every((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")) setMessages(stored.slice(-80));
      } catch {
        setNotice("Saved conversation could not be read.");
      }
      try {
        const storedKey = JSON.parse(localStorage.getItem(USER_KEY_STORAGE) ?? "null");
        if (storedKey && typeof storedKey === "object") {
          const validated = validateUserKey(storedKey.provider, storedKey.apiKey);
          if ("error" in validated) {
            localStorage.removeItem(USER_KEY_STORAGE);
          } else {
            setUserKey(validated);
            setProvider(validated.provider);
          }
        }
      } catch {
        setKeyError("Saved key could not be read from this device.");
      }
      readLearnHandoff(setLearnContext, setInput);
      setReady(true);
    });
    void fetch("/api/assistant")
      .then((response) => response.ok ? response.json() : null)
      .then((result: unknown) => {
        if (!active || typeof result !== "object" || result === null || !("siteKey" in result)) return;
        if (typeof result.siteKey === "boolean") setSiteKey(result.siteKey);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, ready]);

  const saveUserKey = () => {
    const validated = validateUserKey(provider, keyDraft);
    if ("error" in validated) {
      setKeyError(validated.error);
      return;
    }
    try {
      localStorage.setItem(USER_KEY_STORAGE, JSON.stringify(validated));
      setUserKey(validated);
      setProvider(validated.provider);
      setKeyDraft("");
      setKeyError("");
    } catch {
      setKeyError("Could not save the key on this device. Check browser storage settings.");
    }
  };
  const removeUserKey = () => {
    try {
      localStorage.removeItem(USER_KEY_STORAGE);
      setUserKey(null);
      setKeyDraft("");
      setKeyError("");
    } catch {
      setKeyError("Could not remove the saved key from this device.");
    }
  };
  const keyStatus = userKey
    ? t("assistant.keyUsing", { provider: userKey.provider === "anthropic" ? "Anthropic" : "OpenAI" })
    : siteKey
      ? t("assistant.keySite")
      : t("assistant.keyOff");

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
        headers: {
          "content-type": "application/json",
          "x-lang": locale,
          ...(userKey
            ? { "x-user-api-key": userKey.apiKey, "x-user-provider": userKey.provider }
            : {}),
        },
        body: JSON.stringify({
          messages: conversation.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
          ...(labState ? { labState } : {}),
        }),
      });
      const result = await response.json();
      if (response.status === 503 && result.error === "no-key") {
        setMessages([...conversation, { role: "assistant", content: t("assistant.noKeyMessage") }]);
      } else if (response.status === 401 && result.error === "key-rejected") {
        const rejectionMessage = userKey
          ? `Your key was rejected by ${userKey.provider === "anthropic" ? "Anthropic" : "OpenAI"}. Check it, or remove it and paste a new one.`
          : "The site's key was rejected. The site owner can update it, or you can add your own key.";
        setMessages([...conversation, { role: "assistant", content: rejectionMessage }]);
      } else if (response.status === 400 && result.error === "bad-key") {
        setMessages([...conversation, { role: "assistant", content: typeof result.message === "string" ? result.message : "The supplied API key is invalid." }]);
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
    setNotice(t("assistant.clearNotice"));
  };

  return (
    <>
      <PageIntro eyebrow="TOOL 05 / YOUR LAB PARTNER" title="Ask the lab assistant" description="A practical science partner for exploring questions, planning safe tests, and understanding what estimates can tell you." />
      <div className="assistant-layout">
        <Panel title="assistant.conversation" subtitle="assistant.conversationHint" className="chat-panel">
          <div className="chat-heading"><span className="badge"><span className="status-dot" style={{ marginRight: 6 }} /> {t("assistant.partner")}</span><button className="button button-secondary button-small" type="button" onClick={clearChat}>{t("assistant.clear")}</button></div>
          <div className="divider" />
          <div className="chat-messages" aria-live="polite">
            {messages.map((message, index) => (
              <article className={`message message-${message.role}`} key={`${index}-${message.role}`}>
                <span className="metric-label">{message.role === "user" ? t("assistant.you") : t("assistant.label")}</span>
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
                    {message.role === "assistant" ? t(message.content) : message.content}
                  </ReactMarkdown>
                </div>
              </article>
            ))}
            {loading && <div className="message message-assistant"><span className="metric-label">{t("assistant.label")}</span><p style={{ margin: "6px 0 0" }}>{t("assistant.thinking")}</p></div>}
            <div ref={endRef} />
          </div>
          <form className="chat-compose" onSubmit={submit}><textarea className="textarea" value={input} onChange={(event) => setInput(event.target.value)} placeholder={t("assistant.askFormula")} aria-label={t("assistant.yourMessage")} rows={2} /><button className="button button-primary" type="submit" disabled={loading || !input.trim()}>{t("assistant.send")}</button></form>
        </Panel>
        <aside className="assistant-side">
          <Panel title="assistant.keyTitle">
            <p className="small muted" role="status">{keyStatus}</p>
            <fieldset style={{ border: 0, margin: "12px 0 0", padding: 0 }}>
              <legend className="field-label">{t("assistant.provider")}</legend>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 7 }}>
                {(["anthropic", "openai"] as const).map((option) => (
                  <label
                    key={option}
                    style={{
                      display: "flex",
                      minHeight: 44,
                      alignItems: "center",
                      gap: 7,
                      padding: "8px 10px",
                      border: "1px solid #304144",
                      borderRadius: 8,
                      background: "#0b1214",
                      color: "#b4c2bf",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="assistant-provider"
                      value={option}
                      checked={provider === option}
                      onChange={() => setProvider(option)}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    {option === "anthropic" ? "Anthropic" : "OpenAI"}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field-label" htmlFor="assistant-user-key">{t("assistant.apiKey")}</label>
            <input
              id="assistant-user-key"
              className="input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              style={{ fontSize: 16 }}
              value={keyDraft}
              onChange={(event) => setKeyDraft(event.target.value)}
            />
            {keyError && <p className="small bad" role="alert">{t(keyError)}</p>}
            {userKey && (
              <p className="small muted" style={{ overflowWrap: "anywhere" }} role="status">
                {t("assistant.savedDevice")} <code>{maskKey(userKey.apiKey)}</code>
              </p>
            )}
            <div className="button-row" style={{ marginTop: 10 }}>
              <button className="button button-primary" type="button" style={{ minHeight: 44, flex: 1 }} onClick={saveUserKey}>{t("assistant.save")}</button>
              {userKey && (
                <button className="button button-secondary" type="button" style={{ minHeight: 44, flex: 1 }} onClick={removeUserKey}>{t("assistant.remove")}</button>
              )}
            </div>
            <p className="small muted" style={{ margin: "12px 0 0" }}>
              {t("assistant.keyPrivacy")}
            </p>
            <div className="small" style={{ display: "flex", flexWrap: "wrap", gap: "8px 12px", marginTop: 7 }}>
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, color: "#9de7da", textDecoration: "underline", overflowWrap: "anywhere" }}>{t("assistant.getAnthropic")}</a>
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, color: "#9de7da", textDecoration: "underline", overflowWrap: "anywhere" }}>{t("assistant.getOpenai")}</a>
            </div>
          </Panel>
          <Panel title="assistant.context">
            {learnContext && (
              <div className="chat-heading">
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  {t("assistant.fromPlay", { title: learnContext.title })}
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
            <label className="toggle-row"><span>{t("assistant.includeLab")}</span><input type="checkbox" checked={includeLab} onChange={(event) => setIncludeLab(event.target.checked)} /></label>
            <p className="small muted">{t("assistant.contextHint")}</p>
            <p className="small muted">{t("assistant.historyHint")}</p>
          </Panel>
          <Panel title="assistant.tryAsking">
            <div className="prompt-list">
              {[...prompts, ...(learnContext ? ["Explain what I just made more deeply"] : [])].map((prompt) => (
                <button className="chip" type="button" key={prompt} onClick={() => void sendMessage(prompt)} disabled={loading}>{t(prompt)}</button>
              ))}
            </div>
          </Panel>
          {notice && <p className="small muted" role="status">{t(notice)}</p>}
          <div className="notice">{t("assistant.notice")}</div>
        </aside>
      </div>
    </>
  );
}
