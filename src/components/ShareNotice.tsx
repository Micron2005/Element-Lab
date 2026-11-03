"use client";

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
  return (
    <aside
      className={`share-banner${invalid ? " share-banner-invalid" : ""}`}
      role={invalid ? "alert" : "status"}
    >
      <div className="share-banner-copy">
        <p>
          {message ?? (invalid
            ? "This share link is broken or from a newer version."
            : "Opened a shared experiment.")}
        </p>
        {!invalid && onUndo && <p>Your previous mix was replaced.</p>}
        {!invalid && dropped.length > 0 && (
          <p>
            Some ingredients weren&apos;t recognized and were left out: {dropped.join(", ")}.
          </p>
        )}
      </div>
      {!invalid && onUndo && (
        <button className="button button-secondary share-banner-action" type="button" onClick={onUndo}>
          Undo
        </button>
      )}
      <button
        className="share-banner-close"
        type="button"
        aria-label="Dismiss share message"
        onClick={onDismiss}
      >
        ×
      </button>
    </aside>
  );
}
