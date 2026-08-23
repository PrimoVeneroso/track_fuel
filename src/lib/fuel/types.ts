/**
 * FuelLog — Tipi di dominio
 * Schema dati persistito in localStorage (zero backend).
 */

export type UnitSystem = "metric" | "imperial";

/** Un singolo rifornimento. I valori numerici sono "grezzi":
 *  vengono interpretati (etichette + formule) in base al sistema
 *  di unità attualmente selezionato nelle impostazioni. */
export interface Refuel {
  id: string;
  /** ISO 8601 con offset locale, es. "2026-01-05T18:30" */
  date: string;
  /** Contachilometri/contamiglia totale alla data del rifornimento */
  odometer: number;
  /** Volume erogato (litri o galloni a seconda dell'unità attiva) */
  volume: number;
  /** Spesa totale sostenuta (€ o $ a seconda dell'unità attiva) */
  cost: number;
  /** Flag "serbatoio pieno": resetta il ciclo di calcolo cumulativo */
  full: boolean;
  /** Note libere (testo, massimo 200 caratteri) */
  notes: string;
  /** Momento di creazione del record (ISO UTC) */
  createdAt: string;
}

export interface Vehicle {
  id: string;
  name: string;
  createdAt: string;
  refuels: Refuel[];
}

/** Chiave localStorage: "vehicles_data" */
export interface VehiclesData {
  version: number;
  activeVehicleId: string | null;
  vehicles: Vehicle[];
}

/** Chiave localStorage: "app_settings" */
export interface AppSettings {
  unitSystem: UnitSystem;
}

export const DATA_KEY = "vehicles_data";
export const SETTINGS_KEY = "app_settings";
export const SCHEMA_VERSION = 1;

export const emptyVehiclesData = (): VehiclesData => ({
  version: SCHEMA_VERSION,
  activeVehicleId: null,
  vehicles: [],
});

export const defaultSettings = (): AppSettings => ({
  unitSystem: "metric",
});

/** Statistiche derivate di un veicolo (ricalcolate da zero a ogni variazione) */
export interface VehicleStats {
  /** Numero totale di rifornimenti */
  count: number;
  /** Spesa totale (tutti i rifornimenti, incluso il primo) */
  totalCost: number;
  /** Percorrenza totale = odometro ultimo − odometro primo */
  totalDistance: number;
  /** Indice (nella sequenza ordinata) del rifornimento "base" del ciclo corrente */
  cycleBaseIndex: number;
  /** True se il ciclo corrente è iniziato con un reset "pieno" (non è il primissimo rifornimento) */
  cycleIsReset: boolean;
  /** Data del rifornimento base del ciclo corrente */
  cycleBaseDate: string | null;
  /** Δdistanza del ciclo corrente */
  cycleDistance: number;
  /** Volume consumato nel ciclo corrente (esclusa la base) */
  cycleVolume: number;
  /** Spesa sostenuta nel ciclo corrente (esclusa la base) */
  cycleCost: number;
  /** Numero di rifornimenti nel ciclo corrente (esclusa la base) */
  cycleCount: number;
  /** Consumo primario disponibile? (Δd>0 e volume>0) */
  hasConsumption: boolean;
  /** km/l (metrico) oppure mpg (imperiale): Δd / volume consumato */
  primaryConsumption: number | null;
  /** l/100km (solo metrico): volume×100/Δd */
  secondaryConsumption: number | null;
  /** Costo per unità distanza nel ciclo corrente */
  costPerDistance: number | null;
}

/** Rifornimenti ordinati cronologicamente (data asc, poi createdAt asc) */
export function sortRefuels(refuels: Refuel[]): Refuel[] {
  return [...refuels].sort((a, b) => {
    const da = a.date ?? "";
    const db = b.date ?? "";
    if (da !== db) return da < db ? -1 : 1;
    const ca = a.createdAt ?? "";
    const cb = b.createdAt ?? "";
    if (ca !== cb) return ca < cb ? -1 : 1;
    return 0;
  });
}
