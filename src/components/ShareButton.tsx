"use client";

import { useEffect, useRef, useState } from "react";
import { shareUrl, type SharePayload } from "@/lib/share";

export default function ShareButton({
  build,
  label,
  disabledReason,
}: {
  build: () => SharePayload;
  label: string;
  disabledReason?: string;
}) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!link) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [link]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  async function share() {
    setCopied(false);
    setLink("");
    const url = shareUrl(
      window.location.origin,
      `${window.location.pathname}${window.location.search}`,
      build(),
    );

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Science Lab experiment", url });
        return;
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "name" in error &&
          error.name === "AbortError"
        ) {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 3000);
    } catch {
      setLink(url);
    }
  }

  return (
    <div className="share-actions">
      <button
        className="button button-secondary share-button"
        type="button"
        disabled={Boolean(disabledReason)}
        title={disabledReason}
        aria-label={disabledReason ?? label}
        onClick={() => void share()}
      >
        {disabledReason ?? label}
      </button>
      {copied && <span className="share-status" aria-live="polite">Link copied</span>}
      {link && (
        <input
          ref={inputRef}
          className="input share-link-input"
          type="text"
          aria-label="Share link"
          readOnly
          value={link}
        />
      )}
    </div>
  );
}
