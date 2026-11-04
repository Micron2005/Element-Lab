"use client";

import { useT } from "./LocaleProvider";

export default function SkipLink() {
  const { t } = useT();
  return (
    <a className="skip-link" href="#main-content">
      {t("ui.skipToContent")}
    </a>
  );
}
