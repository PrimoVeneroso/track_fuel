/**
 * FuelLog — Persistenza localStorage + Import/Export JSON.
 * Schema: chiave "vehicles_data" (veicoli + rifornimenti + veicolo attivo)
 *         chiave "app_settings" (sistema di unità di misura).
 */

import type { AppSettings, Refuel, VehiclesData, Vehicle } from "./types";
import { DATA_KEY, SETTINGS_KEY, SCHEMA_VERSION, emptyVehiclesData, defaultSettings } from "./types";
import { firstOdometerConflict } from "./calc";
import { sortRefuels } from "./types";
import { sanitizeRefuel, sanitizeVehicle, validateRefuel, uid } from "./validation";
import { triggerFileDownloadOrShare } from "./download";

export function loadVehiclesData(): VehiclesData {
  if (typeof window === "undefined") return emptyVehiclesData();
  try {
    const raw = window.localStorage.getItem(DATA_KEY);
    if (!raw) return emptyVehiclesData();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return emptyVehiclesData();
    const obj = parsed as Record<string, unknown>;
    const vehicles = Array.isArray(obj.vehicles)
      ? obj.vehicles.map(sanitizeVehicle).filter((v): v is Vehicle => v !== null)
      : [];
    const ids = new Set<string>();
    const unique = vehicles.filter((v) => {
      if (ids.has(v.id)) return false;
      ids.add(v.id);
      return true;
    });
    let activeVehicleId =
      typeof obj.activeVehicleId === "string" && ids.has(obj.activeVehicleId)
        ? obj.activeVehicleId
        : null;
    if (activeVehicleId === null && unique.length > 0) {
      activeVehicleId = unique[0].id;
    }
    return { version: SCHEMA_VERSION, activeVehicleId, vehicles: unique };
  } catch {
    return emptyVehiclesData();
  }
}

export function saveVehiclesData(data: VehiclesData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch {
    // quota superata o storage non disponibile: l'app continua a funzionare in memoria
  }
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings();
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return defaultSettings();
    const obj = parsed as Record<string, unknown>;
    return {
      unitSystem: obj.unitSystem === "imperial" ? "imperial" : "metric",
    };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignora
  }
}

/* ------------------------------------------------------------------ */
/* Creazione entità                                                    */
/* ------------------------------------------------------------------ */

export function createVehicle(name: string): Vehicle {
  return { id: uid(), name: name.trim(), createdAt: new Date().toISOString(), refuels: [] };
}

export function createRefuel(
  value: { date: string; odometer: number; volume: number; cost: number; full: boolean; notes: string },
  existingCreatedAt?: string
): Refuel {
  return {
    id: uid(),
    date: value.date,
    odometer: value.odometer,
    volume: value.volume,
    cost: value.cost,
    full: value.full,
    notes: value.notes,
    createdAt: existingCreatedAt ?? new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Export / Import                                                     */
/* ------------------------------------------------------------------ */

export interface BackupFile {
  app: "fuellog";
  schemaVersion: number;
  exportedAt: string;
  vehicles_data: VehiclesData;
  app_settings: AppSettings;
}

export function buildBackup(data: VehiclesData, settings: AppSettings): BackupFile {
  return {
    app: "fuellog",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    vehicles_data: data,
    app_settings: settings,
  };
}

export function downloadBackup(data: VehiclesData, settings: AppSettings): boolean {
  try {
    const backup = buildBackup(data, settings);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const d = new Date();
    const pad = (x: number) => String(x).padStart(2, "0");
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    const filename = `fuellog-backup-${stamp}.json`;
    return triggerFileDownloadOrShare(blob, filename);
  } catch {
    return false;
  }
}

export type ImportMode = "overwrite" | "merge";

export interface ImportResult {
  ok: boolean;
  error?: string;
  data?: VehiclesData;
  settings?: AppSettings;
  report?: { vehicles: number; refuels: number; addedVehicles: number; mergedVehicles: number; skipped: number };
}

/** Legge e valida un file di backup. La sanitizzazione profonda blocca
 *  record malformati; nessun contenuto del file finisce mai nel DOM come HTML. */
export function parseBackupFile(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "File JSON non valido." };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "Struttura del file non riconosciuta." };
  }
  const obj = parsed as Record<string, unknown>;

  if ((obj.schemaVersion !== undefined && obj.schemaVersion !== SCHEMA_VERSION) ||
      (obj.app !== undefined && obj.app !== "fuellog")) {
    return { ok: false, error: "Formato o versione del backup non supportati." };
  }
  const rawVehiclesData =
    obj.vehicles_data ?? (Array.isArray(obj.vehicles) ? obj : null); // accetta anche export semplificato
  if (rawVehiclesData === null || typeof rawVehiclesData !== "object") {
    return { ok: false, error: "Nel file manca la sezione \"vehicles_data\"." };
  }
  const vd = rawVehiclesData as Record<string, unknown>;
  if (!Array.isArray(vd.vehicles)) {
    return { ok: false, error: "Nel file manca l'elenco dei veicoli." };
  }

  let skipped = 0;
  const vehicles: Vehicle[] = [];
  for (const raw of vd.vehicles) {
    const candidate = raw as Record<string, unknown> | null;
    if (!candidate || !Array.isArray(candidate.refuels)) {
      return { ok: false, error: "Elenco rifornimenti mancante o non valido." };
    }
    for (const entry of candidate.refuels) {
      const r = entry as Record<string, unknown> | null;
      if (!r || typeof r.full !== "boolean" || typeof r.date !== "string" ||
          !validateRefuel({ date: r.date, odometer: String(r.odometer), volume: String(r.volume),
            cost: String(r.cost), full: r.full, notes: typeof r.notes === "string" ? r.notes : "" },
            [], null, { distance: "km/mi" }).ok) {
        return { ok: false, error: "Il backup contiene un rifornimento non valido. Nessun dato è stato importato." };
      }
    }
    const v = sanitizeVehicle(raw);
    if (v === null) {
      skipped++;
      continue;
    }
    if (v.refuels.length !== candidate.refuels.length || firstOdometerConflict(sortRefuels(v.refuels)) !== -1) {
      return { ok: false, error: "Il backup contiene ID duplicati o odometri non coerenti con le date." };
    }
    if (vehicles.some((x) => x.id === v.id)) {
      return { ok: false, error: "Il backup contiene veicoli con ID duplicati." };
    }
    vehicles.push(v);
  }
  if (vehicles.length === 0) {
    return { ok: false, error: "Nessun veicolo valido trovato nel file." };
  }

  const ids = new Set(vehicles.map((v) => v.id));
  const activeVehicleId =
    typeof vd.activeVehicleId === "string" && ids.has(vd.activeVehicleId)
      ? vd.activeVehicleId
      : vehicles[0].id;

  const settingsRaw = obj.app_settings as Record<string, unknown> | undefined;
  if (settingsRaw && settingsRaw.unitSystem !== "metric" && settingsRaw.unitSystem !== "imperial") {
    return { ok: false, error: "Unità di misura del backup non riconosciute." };
  }
  const settings: AppSettings = {
    unitSystem: settingsRaw?.unitSystem === "imperial" ? "imperial" : "metric",
  };

  const refuelsCount = vehicles.reduce((s, v) => s + v.refuels.length, 0);
  return {
    ok: true,
    data: { version: SCHEMA_VERSION, activeVehicleId, vehicles },
    settings,
    report: { vehicles: vehicles.length, refuels: refuelsCount, addedVehicles: 0, mergedVehicles: 0, skipped },
  };
}

/** Applica l'import: "overwrite" sostituisce tutto, "merge" unisce per id. */
export function applyImport(
  incoming: VehiclesData,
  current: VehiclesData,
  mode: ImportMode
): { data: VehiclesData; addedVehicles: number; mergedVehicles: number } {
  if (mode === "overwrite") {
    return { data: incoming, addedVehicles: incoming.vehicles.length, mergedVehicles: 0 };
  }
  const result: Vehicle[] = [...current.vehicles];
  let added = 0;
  let merged = 0;
  for (const inc of incoming.vehicles) {
    const idx = result.findIndex((v) => v.id === inc.id);
    if (idx === -1) {
      result.push(inc);
      added++;
    } else {
      const local = result[idx];
      const refuelsById = new Map(local.refuels.map((r) => [r.id, r]));
      for (const r of inc.refuels) refuelsById.set(r.id, r);
      result[idx] = { ...local, name: inc.name || local.name, refuels: [...refuelsById.values()] };
      merged++;
    }
  }
  for (const vehicle of result) {
    if (firstOdometerConflict(sortRefuels(vehicle.refuels)) !== -1) {
      throw new Error(`Unione annullata: odometri non coerenti per ${vehicle.name}.`);
    }
  }
  const ids = new Set(result.map((v) => v.id));
  const activeVehicleId =
    current.activeVehicleId && ids.has(current.activeVehicleId)
      ? current.activeVehicleId
      : result[0]?.id ?? null;
  return { data: { version: SCHEMA_VERSION, activeVehicleId, vehicles: result }, addedVehicles: added, mergedVehicles: merged };
}

/** Ri-sanitizza un rifornimento importato per il merge (mantieni tipi stretti). */
export function sanitizeImportedRefuel(raw: unknown): Refuel | null {
  return sanitizeRefuel(raw);
}
