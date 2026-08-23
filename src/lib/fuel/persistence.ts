/**
 * FuelLog — Persistenza (Opzione D: SPA statica + IndexedDB).
 *
 * - Archivio primario: database IndexedDB locale "fuellog"
 *   (funziona nel browser, nell'APK PWABuilder e dentro la WebView
 *   di Capacitor: nessun server, nessuna configurazione di rete).
 * - Migrazione automatica: al primo avvio i dati legacy in
 *   localStorage ("vehicles_data" / "app_settings") vengono importati
 *   in IndexedDB; la copia localStorage resta come snapshot pre-migrazione
 *   finché l'utente non azzera esplicitamente i dati.
 * - Fallback: se IndexedDB non è disponibile (es. navigazione privata
 *   con quote bloccate) si torna a localStorage.
 * - Il layer è isolato dietro questa API: in futuro è possibile
 *   sostituirlo con un adattatore SQLite nativo (Capacitor) senza
 *   toccare store, componenti o regole di calcolo.
 */

import type { AppSettings, VehiclesData } from "./types";
import { DATA_KEY, SETTINGS_KEY, SCHEMA_VERSION, defaultSettings, emptyVehiclesData } from "./types";
import { loadSettings, loadVehiclesData, saveSettings, saveVehiclesData } from "./storage";
import { openFuelLogDB, type FuelLogDB } from "./idb";

export type StorageMode = "indexeddb" | "localstorage";

export interface LoadedState {
  data: VehiclesData;
  settings: AppSettings;
  mode: StorageMode;
  /** true se in questo avvio è avvenuta la migrazione localStorage → IndexedDB */
  migratedFromLocalStorage: boolean;
}

const KV_SCHEMA = "schemaVersion";
const KV_MIGRATED = "migratedFromLocalStorage";
const KV_SETTINGS = "settings";
const KV_ACTIVE = "activeVehicleId";

/** Istanza DB attiva; null se IndexedDB non utilizzabile. */
let db: FuelLogDB | null = null;
/** true solo dopo un caricamento completo da IndexedDB. */
let usingIdb = false;

function hasLegacyKey(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function sanitizeStoredSettings(raw: unknown): AppSettings | null {
  if (typeof raw !== "object" || raw === null) return null;
  const unitSystem = (raw as Record<string, unknown>).unitSystem;
  if (unitSystem === "metric" || unitSystem === "imperial") return { unitSystem };
  return null;
}

export async function loadState(): Promise<LoadedState> {
  // 1) Apertura IndexedDB (o fallback localStorage)
  try {
    db = await openFuelLogDB();
  } catch {
    db = null;
    usingIdb = false;
    return {
      data: loadVehiclesData(),
      settings: loadSettings(),
      mode: "localstorage",
      migratedFromLocalStorage: false,
    };
  }

  const storedVehicles = await db.getAllVehicles();
  const migratedFlag = await db.getKV<boolean>(KV_MIGRATED);
  const storedSettingsRaw = await db.getKV<AppSettings>(KV_SETTINGS);

  let settings: AppSettings | null = sanitizeStoredSettings(storedSettingsRaw);
  let data: VehiclesData;
  let migrated = false;

  if (storedVehicles.length > 0 || migratedFlag === true) {
    // 2a) IndexedDB già inizializzato: è la fonte di verità
    let activeVehicleId = (await db.getKV<string>(KV_ACTIVE)) ?? null;
    const ids = new Set(storedVehicles.map((v) => v.id));
    if (activeVehicleId === null || !ids.has(activeVehicleId)) {
      activeVehicleId = storedVehicles[0]?.id ?? null;
    }
    data = { version: SCHEMA_VERSION, activeVehicleId, vehicles: storedVehicles };
  } else {
    // 2b) Prima esecuzione: migra i dati localStorage se esistono
    const legacy = loadVehiclesData();
    migrated = legacy.vehicles.length > 0;
    if (migrated) {
      await db.replaceAllVehicles(legacy.vehicles);
      await db.setKV(KV_ACTIVE, legacy.activeVehicleId);
    }
    if (settings === null && hasLegacyKey(SETTINGS_KEY)) {
      settings = loadSettings();
    }
    if (settings !== null) await db.setKV(KV_SETTINGS, settings);
    await db.setKV(KV_SCHEMA, SCHEMA_VERSION);
    await db.setKV(KV_MIGRATED, true);
    data = migrated ? legacy : emptyVehiclesData();
  }

  usingIdb = true;
  return {
    data,
    settings: settings ?? defaultSettings(),
    mode: "indexeddb",
    migratedFromLocalStorage: migrated,
  };
}

export async function persistData(next: VehiclesData): Promise<void> {
  if (usingIdb && db) {
    await db.replaceAllVehicles(next.vehicles);
    await db.setKV(KV_ACTIVE, next.activeVehicleId);
  } else {
    saveVehiclesData(next);
  }
}

export async function persistSettings(next: AppSettings): Promise<void> {
  if (usingIdb && db) {
    await db.setKV(KV_SETTINGS, next);
  } else {
    saveSettings(next);
  }
}

/**
 * Rimuove le chiavi localStorage legacy. Usata dall'azzeramento
 * esplicito ("Cancella tutti i dati") perché i dati non risiedano
 * in due posti dopo la cancellazione.
 */
export function purgeLegacyLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DATA_KEY);
    window.localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // storage non disponibile: ignora
  }
}

/** Solo per diagnostica/sviluppo: modalità attiva del layer. */
export function currentStorageMode(): StorageMode {
  return usingIdb ? "indexeddb" : "localstorage";
}
