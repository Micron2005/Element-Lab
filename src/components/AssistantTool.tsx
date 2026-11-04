"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { analyze, cureLabel, fmtTime, hazardWord, waterLabel } from "@/lib/formula";
import { byId, localizeIngredient } from "@/lib/ingredients";
import { CUSTOM_PREFIX } from "@/lib/bench/custom";
import { benchById, localizeBenchIngredient } from "@/lib/bench/library";
import { simulate } from "@/lib/bench/simulate";
import type { Experiment } from "@/lib/bench/types";
import { maskKey, USER_KEY_STORAGE, validateUserKey } from "@/lib/assistantKey";
import type { Provider } from "@/lib/assistantKey";
import { tr, type Locale, type MessageKey } from "@/lib/i18n";
import { loadCustomIngredients } from "./useCustomIngredients";
import { PageIntro, Panel } from "./shared";
import { useT } from "./LocaleProvider";

type Message = { role: "user" | "assistant"; content: string };
type LearnContext = { title: string; context: string };
type SavedUserKey = { provider: Provider; apiKey: string };
const STORAGE_KEY = "elementlab.chat";
const HANDOFF_KEY = "elementlab.assistant.handoff";
const ASSISTANT_API_PATH = "api/assistant";
const PROMPTS = [
  "assistant.prompt.fail",
  "assistant.prompt.capacity",
  "assistant.prompt.skin",
  "assistant.prompt.vacuum",
  "assistant.prompt.element",
  "assistant.prompt.learn",
] as const;
const FORMULA_LEVEL_KEYS: Record<"good" | "warn" | "bad", MessageKey> = {
  good: "assistant.state.level.good",
  warn: "assistant.state.level.warn",
  bad: "assistant.state.level.bad",
};
const EVENT_STATUS_KEYS: Record<"happened" | "partial" | "blocked", MessageKey> = {
  happened: "assistant.state.status.happened",
  partial: "assistant.state.status.partial",
  blocked: "assistant.state.status.partial",
};
const ATMOSPHERE_KEYS: Record<Experiment["conditions"]["atmosphere"], MessageKey> = {
  air: "bench.model.compare.atmosphere.air",
  nitrogen: "bench.model.compare.atmosphere.nitrogen",
  vacuum: "bench.model.compare.atmosphere.vacuum",
};
const FORMING_KEYS: Record<Experiment["conditions"]["forming"], MessageKey> = {
  beaker: "assistant.state.forming.beaker",
  "extrude-air": "assistant.state.forming.extrudeAir",
  "extrude-bath": "assistant.state.forming.extrudeBath",
  "cast-film": "assistant.state.forming.castFilm",
  "heat-cure": "assistant.state.forming.heatCure",
};

function welcomeMessage(locale: Locale): Message {
  return { role: "assistant", content: tr(locale, "assistant.welcome") };
}

function buildFormulaLabState(locale: Locale): string | null {
  try {
    const stored = JSON.parse(localStorage.getItem("elementlab.current") ?? "null");
    const parts = stored?.parts;
    if (!Array.isArray(parts)) return null;
    const result = analyze(parts, locale);
    const ingredients = parts.map((part) => {
      const ingredient = byId[part.id];
      return tr(locale, "assistant.state.ingredientLine", {
        name: ingredient ? localizeIngredient(ingredient, locale).name : part.id,
        percent: Number(part.pct).toFixed(1),
      });
    }).join("\n");
    const checks = result.checks.length
      ? result.checks.map((check) => tr(locale, "assistant.state.checkLine", {
          level: tr(locale, FORMULA_LEVEL_KEYS[check.level]),
          text: check.text,
        })).join("\n")
      : tr(locale, "assistant.state.noChecks");
    const cureMechanisms = result.cure.map((mechanism) => cureLabel(mechanism, locale)).join(", ") ||
      tr(locale, "assistant.state.noneListed");
    const environment = result.environment.length
      ? result.environment.map((line) => `- ${line}`).join("\n")
      : tr(locale, "assistant.state.noRequirements");
    return [
      tr(locale, "assistant.state.formulaLab"),
      `${tr(locale, "assistant.state.ingredients")}\n${ingredients || tr(locale, "assistant.state.noIngredients")}`,
      [
        tr(locale, "assistant.state.formulaAnalysis"),
        tr(locale, "assistant.state.solids", { value: result.solidsPct.toFixed(1) }),
        tr(locale, "assistant.state.estimatedResults", {
          strength: result.tensileMPa.toFixed(1),
          stretch: result.elongationPct.toFixed(1),
          toughness: result.toughnessMJm3.toFixed(2),
          stickiness: result.tack.toFixed(1),
        }),
        tr(locale, "assistant.state.cureMechanisms", { value: cureMechanisms }),
        tr(locale, "assistant.state.setTime", { value: fmtTime(result.cureSeconds, locale) }),
        tr(locale, "assistant.state.toxicityMixing", { value: hazardWord(result.wetToxicity, locale) }),
        tr(locale, "assistant.state.toxicityCured", { value: hazardWord(result.curedToxicity, locale) }),
        tr(locale, "assistant.state.skinHazard", { value: hazardWord(result.skin, locale) }),
        tr(locale, "assistant.state.edible", { value: tr(locale, result.edible ? "assistant.state.yes" : "assistant.state.no") }),
        tr(locale, "assistant.state.waterBehavior", {
          water: waterLabel(result.water, locale),
          time: result.dissolveTime,
        }),
        tr(locale, "assistant.state.biodegradable", {
          value: tr(locale, result.biodegradable ? "assistant.state.yes" : "assistant.state.no"),
        }),
        tr(locale, "assistant.state.costPerKg", { value: result.costPerKg.toFixed(2) }),
      ].join("\n"),
      `${tr(locale, "assistant.state.environment")}\n${environment}`,
      `${tr(locale, "assistant.state.checks")}\n${checks}`,
    ].join("\n\n");
  } catch {
    return null;
  }
}

function buildBenchMixState(locale: Locale): string | null {
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
    const result = simulate(experiment, locale);
    const ingredients = experiment.parts
      .filter((part) => part.pct > 0)
      .map((part) => {
        const ingredient = benchById[part.id];
        const name = ingredient
          ? localizeBenchIngredient(ingredient, locale).name
          : part.id.startsWith(CUSTOM_PREFIX)
            ? tr(locale, "assistant.state.deletedIngredient")
            : part.id;
        const properties = ingredient && part.id.startsWith(CUSTOM_PREFIX)
          ? [
              ingredient.tensileMPa !== undefined
                ? tr(locale, "assistant.state.strength", { value: ingredient.tensileMPa })
                : "",
              ingredient.elongationPct !== undefined
                ? tr(locale, "assistant.state.stretch", { value: ingredient.elongationPct })
                : "",
              Number.isFinite(ingredient.density)
                ? tr(locale, "assistant.state.density", { value: ingredient.density })
                : "",
            ].filter(Boolean).join(", ")
          : "";
        const suffix = properties
          ? tr(locale, "assistant.state.userDefined", { properties })
          : "";
        return tr(locale, "assistant.state.ingredientLine", { name: `${name}${suffix}`, percent: part.pct.toFixed(1) });
      })
      .join("\n");
    const conditions = experiment.conditions;
    const events = result.events
      .filter((event) => event.status === "happened" || event.status === "partial")
      .map((event) => tr(locale, "assistant.state.eventLine", {
        name: event.name,
        status: tr(locale, EVENT_STATUS_KEYS[event.status]),
        mechanism: event.mechanism,
      }));
    const warnings = result.warnings
      .slice(0, 5)
      .map((warning) => `- ${warning.text}`);
    return [
      tr(locale, "assistant.state.benchMix"),
      `${tr(locale, "assistant.state.ingredients")}\n${ingredients || tr(locale, "assistant.state.noIngredients")}`,
      [
        tr(locale, "assistant.state.conditions"),
        tr(locale, "assistant.state.temperature", { value: conditions.tempC }),
        tr(locale, "assistant.state.pressure", { value: conditions.pressureKPa }),
        tr(locale, ATMOSPHERE_KEYS[conditions.atmosphere]),
        tr(locale, "assistant.state.humidity", { value: conditions.humidityPct }),
        tr(locale, "assistant.state.mixing", { rpm: conditions.mixRpm, minutes: conditions.mixMinutes }),
        tr(locale, "assistant.state.cure", { minutes: conditions.cureMinutes }),
        tr(locale, "assistant.state.forming", { value: tr(locale, FORMING_KEYS[conditions.forming]) }),
        tr(locale, "assistant.state.bath", {
          value: conditions.bathId
            ? benchById[conditions.bathId]
              ? localizeBenchIngredient(benchById[conditions.bathId], locale).name
              : conditions.bathId
            : tr(locale, "assistant.state.none"),
        }),
      ].join("; "),
      tr(locale, "assistant.state.effectivePH", { value: result.effectivePH.toFixed(1) }),
      `${result.productLabel}: ${result.summary}`,
      `${tr(locale, "assistant.state.events")}\n${events.join("\n") || tr(locale, "assistant.state.noEvents")}`,
      result.setSeconds > 0
        ? tr(locale, "assistant.state.setTime", { value: fmtTime(result.setSeconds, locale) })
        : tr(locale, "assistant.state.noSet"),
      tr(locale, "assistant.state.strengthStretch", {
        strength: result.tensileMPa.toFixed(1),
        stretch: result.elongationPct.toFixed(1),
        stickiness: result.tack.toFixed(1),
      }),
      tr(locale, "assistant.state.safety", {
        wet: hazardWord(result.wetToxicity, locale),
        cured: hazardWord(result.curedToxicity, locale),
        skin: hazardWord(result.skin, locale),
      }),
      `${tr(locale, "assistant.state.warnings")}\n${warnings.join("\n") || tr(locale, "assistant.state.noWarnings")}`,
    ].join("\n\n");
  } catch {
    return null;
  }
}

function buildLabState(locale: Locale) {
  const sections = [buildBenchMixState(locale), buildFormulaLabState(locale)].filter(
    (section): section is string => section !== null,
  );
  return sections.length
    ? sections.join("\n\n")
    : tr(locale, "assistant.state.noLab");
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
  const [messages, setMessages] = useState<Message[]>(() => [welcomeMessage(locale)]);
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
        setNotice("assistant.error.savedConversation");
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
        setKeyError("assistant.error.savedKey");
      }
      readLearnHandoff(setLearnContext, setInput);
      setReady(true);
    });
    void fetch(`/${ASSISTANT_API_PATH}`)
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
    const validated = validateUserKey(provider, keyDraft, locale);
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
      setKeyError(t("assistant.error.saveKey"));
    }
  };
  const removeUserKey = () => {
    try {
      localStorage.removeItem(USER_KEY_STORAGE);
      setUserKey(null);
      setKeyDraft("");
      setKeyError("");
    } catch {
      setKeyError(t("assistant.error.removeKey"));
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
          ? `${tr(locale, "assistant.state.playContext")}\n${learnContext.context}`
          : "",
        includeLab ? buildLabState(locale) : "",
      ].filter((section) => section.trim()).join("\n\n");
      const response = await fetch(`/${ASSISTANT_API_PATH}`, {
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
          ? t("assistant.error.keyRejectedUser", { provider: userKey.provider === "anthropic" ? "Anthropic" : "OpenAI" })
          : t("assistant.error.keyRejectedSite");
        setMessages([...conversation, { role: "assistant", content: rejectionMessage }]);
      } else if (response.status === 400 && result.error === "bad-key") {
        setMessages([...conversation, { role: "assistant", content: typeof result.message === "string" ? result.message : t("assistant.error.invalidKey") }]);
      } else if (!response.ok) {
        setMessages([...conversation, { role: "assistant", content: t("assistant.error.unavailable") }]);
      } else {
        setMessages([...conversation, { role: "assistant", content: result.reply }]);
      }
    } catch {
      setMessages([...conversation, { role: "assistant", content: t("assistant.error.network") }]);
    } finally {
      setLoading(false);
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };
  const clearChat = () => {
    setMessages([welcomeMessage(locale)]);
    setNotice(t("assistant.clearNotice"));
  };

  return (
    <>
      <PageIntro eyebrow="assistant.pageEyebrow" title="assistant.title" description="home.assistantCopy" />
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
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
                  {t("assistant.remove")}
                </button>
              </div>
            )}
            <label className="toggle-row"><span>{t("assistant.includeLab")}</span><input type="checkbox" checked={includeLab} onChange={(event) => setIncludeLab(event.target.checked)} /></label>
            <p className="small muted">{t("assistant.contextHint")}</p>
            <p className="small muted">{t("assistant.historyHint")}</p>
          </Panel>
          <Panel title="assistant.tryAsking">
            <div className="prompt-list">
              {[...PROMPTS.slice(0, 5), ...(learnContext ? [PROMPTS[5]] : [])].map((prompt) => (
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
