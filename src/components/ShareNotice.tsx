"use client";

import { useT } from "./LocaleProvider";

export default function ShareNotice({
  invalid = false,
  dropped = [],
  message,
  onUndo,
  onDismiss,
}: {
  invalid?: boolean;
  dropped?: string[];
  message?: string;
  onUndo?: () => void;
  onDismiss: () => void;
}) {
  const { t } = useT();
  return (
    <div
      className={`share-banner${invalid ? " share-banner-invalid" : ""}`}
      role={invalid ? "alert" : "status"}
    >
      <div className="share-banner-copy">
        <p>
          {message ?? (invalid ? t("share.invalidLink") : t("share.opened"))}
        </p>
        {!invalid && onUndo && <p>{t("share.replaced")}</p>}
        {!invalid && dropped.length > 0 && (
          <p>
            {t("share.unrecognized", { names: dropped.join(", ") })}
          </p>
        )}
      </div>
      {!invalid && onUndo && (
        <button className="button button-secondary share-banner-action" type="button" onClick={onUndo}>
          {t("share.undo")}
        </button>
      )}
      <button
        className="share-banner-close"
        type="button"
        aria-label={t("share.dismiss")}
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
