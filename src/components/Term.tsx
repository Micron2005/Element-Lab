"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { glossaryFor, type GlossaryEntry, type TermId } from "@/lib/glossary";
import { usePrefs } from "./usePrefs";
import { useT } from "./LocaleProvider";

const OPEN_TERM_EVENT = "elementlab:term-open";

export function Term({ id, children }: { id: TermId; children: ReactNode }) {
  const prefs = usePrefs();
  const { locale, t } = useT();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8, width: 280 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const popoverId = useId();
  const titleId = useId();
  const entry: GlossaryEntry = glossaryFor(locale)[id];

  useEffect(() => {
    const closeOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== popoverId) setOpen(false);
    };
    window.addEventListener(OPEN_TERM_EVENT, closeOther);
    return () => window.removeEventListener(OPEN_TERM_EVENT, closeOther);
  }, [popoverId]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (
        !triggerRef.current?.contains(event.target as Node) &&
        !popoverRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popoverRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const popover = popoverRef.current.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 16);
    const left = Math.max(8, Math.min(trigger.left, window.innerWidth - width - 8));
    const below = trigger.bottom + 8;
    const top = below + popover.height <= window.innerHeight - 8
      ? below
      : Math.max(8, trigger.top - popover.height - 8);
    setPosition({ left, top, width });
  }, [open]);

  if (!prefs.beginner) return <>{children}</>;

  return (
    <span className="term-wrap">
      <button
        ref={triggerRef}
        type="button"
        className="term"
        aria-expanded={open}
        aria-describedby={popoverId}
        aria-haspopup="dialog"
        onClick={() => {
          if (!open) window.dispatchEvent(new CustomEvent(OPEN_TERM_EVENT, { detail: popoverId }));
          setOpen((value) => !value);
        }}
      >
        {children}
      </button>
      <span
        ref={popoverRef}
        id={popoverId}
        className="term-popover"
        role="dialog"
        aria-labelledby={titleId}
        hidden={!open}
        style={position}
      >
        <strong id={titleId}>{entry.term}</strong>
        <span>{entry.plain}</span>
        {entry.example && <span className="term-example">{entry.example}</span>}
        <Link href={`/glossary#${id}`} onClick={() => setOpen(false)}>
          {t("glossary.more")}
        </Link>
      </span>
    </span>
  );
}
