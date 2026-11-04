"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useBeta } from "./BetaProvider";
import { useT } from "./LocaleProvider";

export function BetaBadge() {
  const { beta } = useBeta();
  const { t } = useT();
  return beta ? <span className="beta-badge">{t("beta.badge")}</span> : null;
}

export function BetaAnnouncement() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { beta } = useBeta();
  const { t } = useT();
  const status = searchParams.get("beta");
  const messageKey = status === "joined" && beta
    ? "beta.banner.joined"
    : status === "left" && !beta
      ? "beta.banner.left"
      : null;

  if (!messageKey) return null;

  function dismiss() {
    const url = new URL(window.location.href);
    url.searchParams.delete("beta");
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  }

  return (
    <div className="beta-banner" role="status">
      <p>{t(messageKey)}</p>
      <button type="button" className="icon-button" aria-label={t("beta.banner.dismiss")} onClick={dismiss}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
