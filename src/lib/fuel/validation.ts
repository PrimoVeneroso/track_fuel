/**
 * FuelLog — Validazione input e sanitizzazione.
 *
 * Sicurezza XSS: i testi utente (note, nomi veicolo) non vengono mai
 * iniettati come HTML. React li renderizza come nodi di testo puri
 * (equivale a textContent / createElement). Nessun uso di innerHTML
 * o dangerouslySetInnerHTML.
 */

import type { Refuel } from "./types";
import { sortRefuels } from "./types";

export const MAX_NAME_LENGTH = 30;
export const MAX_NOTES_LENGTH = 200;
export const MAX_ODOMETER = 100_000_000;
export const MAX_VOLUME = 10_000;
export const MAX_COST = 1_000_000;

export type ValidationResult = { ok: true } | { ok: false; error: string };

/** Accetta sia "1234,5" che "1234.5" (tastiera italiana). */
export function parseDecimal(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s+/g, "").replace(",", ".");
  if (cleaned === "" || !/^\d*\.?\d*$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function validateVehicleName(raw: string): ValidationResult {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, error: "Il nome del veicolo è obbligatorio." };
  if (name.length > MAX_NAME_LENGTH)
    return { ok: false, error: `Massimo ${MAX_NAME_LENGTH} caratteri per il nome.` };
  return { ok: true };
}

export interface RefuelDraft {
  date: string; // valore input datetime-local "YYYY-MM-DDTHH:mm"
  odometer: string;
  volume: string;
  cost: string;
  full: boolean;
  notes: string;
}

export interface RefuelNumbers {
  date: string;
  odometer: number;
  volume: number;
  cost: number;
  full: boolean;
  notes: string;
}

/**
 * Valida un rifornimento rispetto alla lista esistente del veicolo.
 * Regole:
 *  - data valida e non nel futuro;
 *  - odometro > 0 e volume > 0, cost >= 0;
 *  - l'odometro non può essere inferiore all'ultimo registrato:
 *    dopo l'inserimento la sequenza ordinata per data deve avere
 *    odometro non-decrescente (vale anche per modifiche/inserimenti retrodatati).
 */
export function validateRefuel(
  draft: RefuelDraft,
  existing: Refuel[],
  editingId: string | null,
  unitLabels: { distance: string }
): { ok: true; value: RefuelNumbers } | { ok: false; error: string } {
  // --- Data ---
  if (!draft.date || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.date)) {
    return { ok: false, error: "Inserisci una data e un'ora valide." };
  }
  const dateMs = new Date(draft.date).getTime();
  if (!Number.isFinite(dateMs)) {
    return { ok: false, error: "Inserisci una data e un'ora valide." };
  }
  if (dateMs > Date.now() + 60_000) {
    return { ok: false, error: "La data non può essere nel futuro." };
  }

  // --- Numeri ---
  const odometer = parseDecimal(draft.odometer);
  if (odometer === null || !Number.isFinite(odometer)) {
    return { ok: false, error: `Il valore dell'odometro non è un numero valido.` };
  }
  if (odometer <= 0) {
    return { ok: false, error: `Il valore dell'odometro deve essere maggiore di zero.` };
  }
  if (odometer > MAX_ODOMETER) {
    return { ok: false, error: `Valore odometro troppo alto (max ${MAX_ODOMETER}).` };
  }

  const volume = parseDecimal(draft.volume);
  if (volume === null || !Number.isFinite(volume) || volume <= 0) {
    return { ok: false, error: "Il volume erogato deve essere un numero maggiore di zero." };
  }
  if (volume > MAX_VOLUME) {
    return { ok: false, error: `Volume troppo alto (max ${MAX_VOLUME}).` };
  }

  const cost = parseDecimal(draft.cost);
  if (cost === null || !Number.isFinite(cost) || cost < 0) {
    return { ok: false, error: "La spesa deve essere un numero non negativo." };
  }
  if (cost > MAX_COST) {
    return { ok: false, error: `Spesa troppo alta (max ${MAX_COST}).` };
  }

  // --- Note ---
  let notes = (draft.notes ?? "").trim();
  if (notes.length > MAX_NOTES_LENGTH) {
    return { ok: false, error: `Le note possono contenere al massimo ${MAX_NOTES_LENGTH} caratteri.` };
  }
  notes = notes.slice(0, MAX_NOTES_LENGTH);

  // --- Monotonia odometro nella sequenza cronologica risultante ---
  const probe: Refuel = {
    id: editingId ?? "__probe__",
    date: draft.date,
    odometer,
    volume,
    cost,
    full: draft.full,
    notes,
    createdAt: editingId ? existing.find((r) => r.id === editingId)?.createdAt ?? new Date().toISOString() : new Date().toISOString(),
  };
  const others = editingId ? existing.filter((r) => r.id !== editingId) : existing;
  const merged = sortRefuels([...others, probe]);
  for (let i = 1; i < merged.length; i++) {
    if (merged[i].odometer < merged[i - 1].odometer) {
      const prev = merged[i - 1];
      const distance = unitLabels.distance;
      return {
        ok: false,
        error:
          merged[i].id === probe.id
            ? `Odometro non valido: il valore è inferiore a quello registrato il ${formatShort(prev.date)} (${prev.odometer.toLocaleString("it-IT")} ${distance}).`
            : `Odometro non valido: inferiore al rifornimento successivo del ${formatShort(merged[i].date)}.`,
      };
    }
  }

  return { ok: true, value: { date: draft.date, odometer, volume, cost, full: draft.full, notes } };
}

function formatShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "?";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/* ------------------------------------------------------------------ */
/* Sanitizzazione per load/import: qualsiasi JSON esterno viene       */
/* normalizzato in un record sicuro prima di toccare lo stato.        */
/* ------------------------------------------------------------------ */

const uid = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

function toFiniteNumber(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function toCleanText(v: unknown, maxLen: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maxLen);
}

function toIsoLocal(v: unknown): string {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return v.slice(0, 16);
  }
  const now = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function toIsoUtc(v: unknown): string {
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

export function sanitizeRefuel(raw: unknown): Refuel | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const odometer = toFiniteNumber(r.odometer, 0, MAX_ODOMETER, -1);
  const volume = toFiniteNumber(r.volume, 0, MAX_VOLUME, -1);
  const cost = toFiniteNumber(r.cost, 0, MAX_COST, 0);
  if (odometer < 0 || volume < 0) return null; // valori essenziali mancanti
  return {
    id: typeof r.id === "string" && r.id.length > 0 && r.id.length <= 64 ? r.id : uid(),
    date: toIsoLocal(r.date),
    odometer,
    volume,
    cost,
    full: r.full === true,
    notes: toCleanText(r.notes, MAX_NOTES_LENGTH),
    createdAt: toIsoUtc(r.createdAt),
  };
}

export function sanitizeVehicle(raw: unknown): { id: string; name: string; createdAt: string; refuels: Refuel[] } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const v = raw as Record<string, unknown>;
  const name = toCleanText(v.name, MAX_NAME_LENGTH);
  if (name.length === 0) return null;
  const refuels = Array.isArray(v.refuels)
    ? v.refuels.map(sanitizeRefuel).filter((x): x is Refuel => x !== null)
    : [];
  // deduplica per id
  const seen = new Set<string>();
  const uniqueRefuels = refuels.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  return {
    id: typeof v.id === "string" && v.id.length > 0 && v.id.length <= 64 ? v.id : uid(),
    name,
    createdAt: toIsoUtc(v.createdAt),
    refuels: uniqueRefuels,
  };
}

export { uid };
