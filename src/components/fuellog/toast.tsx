"use client";

/**
 * Sistema toast minimale (nessuna dipendenza).
 */

import { useCallback, useRef, useState } from "react";
import { AlertIcon, CheckIcon, InfoIcon } from "./icons";

export type ToastKind = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  leaving?: boolean;
}

export interface ToastApi {
  show: (message: string, kind?: ToastKind) => void;
}

export function useToasts(): ToastApi & { stack: ToastItem[] } {
  const [stack, setStack] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++seq.current;
    setStack((s) => [...s.slice(-2), { id, kind, message }]);
    window.setTimeout(() => {
      setStack((s) => s.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      window.setTimeout(() => {
        setStack((s) => s.filter((t) => t.id !== id));
      }, 220);
    }, 3400);
  }, []);

  return { show, stack };
}

export function ToastStack({ stack }: { stack: ToastItem[] }) {
  if (stack.length === 0) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {stack.map((t) => (
        <div key={t.id} className={t.leaving ? "toast toast-leaving" : "toast"} data-kind={t.kind}>
          {t.kind === "success" ? <CheckIcon width={18} height={18} /> : null}
          {t.kind === "error" ? <AlertIcon width={18} height={18} /> : null}
          {t.kind === "info" ? <InfoIcon width={18} height={18} /> : null}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
