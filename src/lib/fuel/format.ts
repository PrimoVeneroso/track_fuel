/**
 * FuelLog — Formattazione numeri, date ed etichette dinamiche.
 * Le etichette riflettono il sistema di unità selezionato:
 *   Metrico   → km, Litri, €
 *   Imperiale → miglia (mi), galloni (gal), $
 * I valori storici sono interpretati con l'unità attualmente attiva.
 */

import type { UnitSystem } from "./types";

export interface UnitLabels {
  distance: string; // "km" | "mi"
  distanceLong: string; // "Chilometri" | "Miglia"
  volume: string; // "L" | "gal"
  volumeLong: string; // "Litri" | "Galloni"
  currency: string; // "€" | "$"
  consumptionPrimary: string; // "km/l" | "mpg"
  consumptionSecondary: string | null; // "l/100km" | null
}

export function unitLabels(unit: UnitSystem): UnitLabels {
  if (unit === "imperial") {
    return {
      distance: "mi",
      distanceLong: "Miglia",
      volume: "gal",
      volumeLong: "Galloni",
      currency: "$",
      consumptionPrimary: "mpg",
      consumptionSecondary: null,
    };
  }
  return {
    distance: "km",
    distanceLong: "Chilometri",
    volume: "L",
    volumeLong: "Litri",
    currency: "€",
    consumptionPrimary: "km/l",
    consumptionSecondary: "l/100km",
  };
}

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("it-IT", { minimumFractionDigits: min, maximumFractionDigits: max });

export function fmt(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return nf(0, decimals).format(n);
}

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return nf(0, 0).format(n);
}

/** Valuta: € o $ in base all'unità attiva. */
export function fmtMoney(n: number | null | undefined, currency: string, decimals = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${nf(0, decimals).format(n)} ${currency}`;
}

export function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function fmtDateLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

/** Date → valore per <input type="datetime-local"> (minuto, ora locale). */
export function toDatetimeLocalValue(d: Date): string {
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nowDatetimeLocalValue(): string {
  return toDatetimeLocalValue(new Date());
}
