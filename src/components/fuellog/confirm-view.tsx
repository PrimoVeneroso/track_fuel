"use client";

/**
 * Vista di conferma riutilizzabile (eliminazioni, reset).
 */

import { AlertIcon } from "./icons";

interface ConfirmViewProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmView({
  title,
  message,
  confirmLabel,
  cancelLabel = "Annulla",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmViewProps) {
  return (
    <div className="info-block" style={{ borderColor: danger ? "rgba(255,95,95,.45)" : undefined }}>
      <h3 style={{ color: danger ? "var(--red)" : undefined }}>
        <AlertIcon width={16} height={16} />
        {title}
      </h3>
      <p>{message}</p>
      <div className="btn-row" style={{ marginTop: 4 }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={danger ? "btn btn-danger" : "btn btn-primary"}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
