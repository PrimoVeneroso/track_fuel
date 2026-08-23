"use client";

/**
 * Modale riutilizzabile: bottom-sheet su mobile, centrata su desktop.
 * Chiusura tramite overlay, tasto X o Esc. Nessuna dipendenza.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { XIcon } from "./icons";

interface ModalProps {
  open: boolean;
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, icon, onClose, children, footer }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      ref={ref}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-grabber" aria-hidden="true" />
        <div className="modal-head">
          <h2>
            {icon}
            {title}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Chiudi">
            <XIcon width={18} height={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
