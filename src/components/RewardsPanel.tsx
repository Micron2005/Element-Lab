"use client";

import { useEffect, useRef, useState } from "react";
import {
  BADGES,
  GEAR,
  RANKS,
  earnedBadges,
  rankFor,
  saveGear,
  unlockedGear,
  type RewardState,
} from "@/lib/play/rewards";
import type { MessageKey } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { renderCertificateBytes } from "@/lib/play/certificate";
import { CHAPTERS, QUESTS, localizeChapter } from "@/lib/play/quests";
import { useT } from "./LocaleProvider";
import { useGearLoadout } from "./useGearLoadout";
import "./rewards.css";

const COAT_COLORS = { white: "#e9eef1", teal: "#52b9b2", purple: "#956fca", orange: "#e79445", black: "#303744" } as const;
const COAT_KEYS: Record<(typeof GEAR.coats)[number]["id"], MessageKey> = {
  white: "play.reward.coat.white", teal: "play.reward.coat.teal", purple: "play.reward.coat.purple", orange: "play.reward.coat.orange", black: "play.reward.coat.black",
};
const GOGGLE_KEYS: Record<(typeof GEAR.goggles)[number]["id"], MessageKey> = {
  classic: "play.reward.goggles.classic", round: "play.reward.goggles.round", visor: "play.reward.goggles.visor",
};
const BOARD_KEYS: Record<(typeof GEAR.boards)[number]["id"], MessageKey> = {
  grid: "play.reward.board.grid", dots: "play.reward.board.dots", blueprint: "play.reward.board.blueprint", space: "play.reward.board.space",
};

function BadgeIcon({ kind }: { kind: string }) {
  return (
    <svg className="reward-badge-icon" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d={kind === "atom" ? "M6 16h20M16 6v20" : kind === "mix" ? "M10 11h12M12 16h8M14 21h4" : "M10 16h12M16 10v12"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CertificateActions({ xp, locale, state }: { xp: number; locale: Locale; state: RewardState }) {
  const { t } = useT();
  const [studentName, setStudentName] = useState("");
  const ranks = RANKS.filter((rank) => rank.threshold <= xp);
  const chapters = CHAPTERS.filter((chapter) => {
    const quests = QUESTS.filter((quest) => quest.chapter === chapter.id);
    return quests.length > 0 && quests.every((quest) => (state.progress.stars[quest.id] ?? 0) >= 1);
  });
  async function print(achievement: string) {
    const bytes = await renderCertificateBytes({ studentName, achievement, date: new Date(), locale });
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "science-lab-certificate.pdf";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="certificate-actions">
      <h2>{t("play.reward.printCertificate")}</h2>
      <label>{t("play.reward.studentName")}<input className="input" maxLength={80} value={studentName} onChange={(event) => setStudentName(event.target.value)} /></label>
      {ranks.map((rank) => (
        <button className="button button-secondary" type="button" key={rank.id} onClick={() => void print(t("play.reward.rankCertificate", { rank: t(rank.titleKey) }))}>
          {t("play.reward.rankCertificate", { rank: t(rank.titleKey) })}
        </button>
      ))}
      {chapters.map((chapter) => (
        <button className="button button-secondary" type="button" key={chapter.id} onClick={() => void print(t("play.reward.chapterCertificate", { chapter: localizeChapter(chapter, locale).title }))}>
          {t("play.reward.chapterCertificate", { chapter: localizeChapter(chapter, locale).title })}
        </button>
      ))}
    </section>
  );
}

function Scientist({ coat, goggles, label }: { coat: keyof typeof COAT_COLORS; goggles: string; label: string }) {
  return (
    <svg className="reward-scientist" viewBox="0 0 80 92" role="img" aria-label={label}>
      <path d="M14 88c1-21 9-32 26-32s25 11 26 32z" fill={COAT_COLORS[coat]} stroke="#425263" strokeWidth="2" />
      <path d="M28 56l12 14 12-14" fill="#fff" stroke="#425263" strokeWidth="2" />
      <circle cx="40" cy="34" r="20" fill="#edc3a1" stroke="#425263" strokeWidth="2" />
      {goggles === "visor" ? (
        <path d="M20 31q20-12 40 0v9q-20 9-40 0z" fill="#8bd1df" fillOpacity=".65" stroke="#425263" strokeWidth="2" />
      ) : (
        <g fill="none" stroke="#425263" strokeWidth="2">
          <circle cx="32" cy="34" r={goggles === "round" ? 7 : 6} />
          <circle cx="48" cy="34" r={goggles === "round" ? 7 : 6} />
          <path d="M38 34h4M25 32l-5-2M55 32l5-2" />
        </g>
      )}
      <path d="M35 46q5 4 10 0" fill="none" stroke="#425263" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function RewardsPanel({ xp, state }: { xp: number; state: RewardState }) {
  const { t, locale } = useT();
  const [showBadges, setShowBadges] = useState(false);
  const badgeDialog = useRef<HTMLDialogElement>(null);
  const badgeTrigger = useRef<HTMLButtonElement>(null);
  const gear = useGearLoadout();
  const rank = rankFor(xp);
  const rankIndex = RANKS.findIndex(({ id }) => id === rank.current.id);
  const unlocked = unlockedGear(rankIndex);
  const earned = new Set(earnedBadges(state).map(({ id }) => id));

  useEffect(() => {
    const dialog = badgeDialog.current;
    if (showBadges && dialog && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>("[data-badge-close]")?.focus();
    } else if (!showBadges && dialog?.open) {
      dialog.close();
      badgeTrigger.current?.focus();
    }
  }, [showBadges]);

  return (
    <section className="rewards-panel" aria-label={t("play.reward.labGear")}>
      <div className="rewards-rank">
        <div>
          <p className="eyebrow">{t("play.reward.xp")}</p>
          <strong>{t(rank.current.titleKey)}</strong>
          <span>{xp} {t("play.reward.xp")}{rank.next ? ` · ${rank.next.threshold - xp} ${t("play.reward.nextRank")}` : ""}</span>
        </div>
        <div className="reward-progress" role="progressbar" aria-label={t(rank.current.titleKey)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rank.progress * 100)}>
          <span style={{ width: `${rank.progress * 100}%` }} />
        </div>
      </div>
      <button ref={badgeTrigger} className="button button-secondary" type="button" aria-haspopup="dialog" aria-expanded={showBadges} onClick={() => setShowBadges(true)}>
        {t("play.reward.badges")} · {earned.size}/{BADGES.length}
      </button>
      <dialog
        ref={badgeDialog}
        className="reward-badges-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-badges-title"
        onCancel={(event) => { event.preventDefault(); setShowBadges(false); }}
        onClose={() => {
          setShowBadges(false);
          badgeTrigger.current?.focus();
        }}
      >
        <div className="reward-badges-heading">
          <h2 id="reward-badges-title">{t("play.reward.badges")}</h2>
          <button data-badge-close className="icon-button" type="button" aria-label={t("play.reward.closeBadges")} onClick={() => setShowBadges(false)}>×</button>
        </div>
        <div className="reward-badge-grid">
          {BADGES.map((badge) => (
            <article className={`reward-badge${earned.has(badge.id) ? " is-earned" : " is-locked"}`} key={badge.id}>
              <BadgeIcon kind={badge.icon} />
              <strong>{t(badge.titleKey)}</strong>
              <p>{t(badge.descKey)}</p>
            </article>
          ))}
        </div>
      </dialog>
      <div className="reward-gear">
        <h2>{t("play.reward.labGear")}</h2>
        <Scientist coat={gear.coat} goggles={gear.goggles} label={t("play.reward.scientistAvatar")} />
        <label>{t("play.reward.coat")}
          <select value={gear.coat} onChange={(event) => saveGear({ ...gear, coat: event.target.value as typeof gear.coat })}>
            {GEAR.coats.filter(({ id }) => unlocked.coats.includes(id)).map(({ id }) => <option value={id} key={id}>{t(COAT_KEYS[id])}</option>)}
          </select>
        </label>
        <label>{t("play.reward.goggles")}
          <select value={gear.goggles} onChange={(event) => saveGear({ ...gear, goggles: event.target.value as typeof gear.goggles })}>
            {GEAR.goggles.filter(({ id }) => unlocked.goggles.includes(id)).map(({ id }) => <option value={id} key={id}>{t(GOGGLE_KEYS[id])}</option>)}
          </select>
        </label>
        <label>{t("play.reward.board")}
          <select value={gear.board} onChange={(event) => saveGear({ ...gear, board: event.target.value as typeof gear.board })}>
            {GEAR.boards.filter(({ id }) => unlocked.boards.includes(id)).map(({ id }) => <option value={id} key={id}>{t(BOARD_KEYS[id])}</option>)}
          </select>
        </label>
      </div>
      <CertificateActions xp={xp} locale={locale} state={state} />
    </section>
  );
}
