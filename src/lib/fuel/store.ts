"use client";

/**
 * Store reattivo dell'app: fonte di verità in memoria + persistenza
 * asincrona su IndexedDB (con fallback localStorage, vedi persistence.ts).
 *
 * - useSyncExternalStore con snapshot server costante → nessun mismatch
 *   di idratazione; al termine del caricamento asincrono i subscriber
 *   vengono notificati e la UI passa dallo splash ai dati reali.
 * - Il caricamento parte alla valutazione del modulo (solo client),
 *   PRIMA del primo render: getSnapshot resta una funzione pura.
 */

import { useSyncExternalStore } from "react";
import type { AppSettings, VehiclesData } from "./types";
import { emptyVehiclesData, defaultSettings } from "./types";
import { loadSettings, loadVehiclesData } from "./storage";
import { loadState, persistData, persistSettings, type StorageMode } from "./persistence";

const SERVER_DATA: VehiclesData = emptyVehiclesData();
const SERVER_SETTINGS: AppSettings = defaultSettings();

interface ClientState {
  data: VehiclesData;
  settings: AppSettings;
  mode: StorageMode;
}

let client: ClientState | null = null;

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  loadState()
    .then((state) => {
      client = state;
      notify();
      if (state.migratedFromLocalStorage) {
        // Notifica one-shot per l'UI (il listener è montato al primo effect)
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent("fuellog:migrated"));
        }, 300);
      }
    })
    .catch(() => {
      // Fallback estremo: storage sincrono legacy
      client = { data: loadVehiclesData(), settings: loadSettings(), mode: "localstorage" };
      notify();
    });
}

function getDataSnapshot(): VehiclesData {
  return client?.data ?? SERVER_DATA;
}

function getSettingsSnapshot(): AppSettings {
  return client?.settings ?? SERVER_SETTINGS;
}

function getServerDataSnapshot(): VehiclesData {
  return SERVER_DATA;
}

function getServerSettingsSnapshot(): AppSettings {
  return SERVER_SETTINGS;
}

export function setDataStore(next: VehiclesData): void {
  client = client
    ? { ...client, data: next }
    : { data: next, settings: SERVER_SETTINGS, mode: "localstorage" };
  persistData(next).catch((err) => {
    console.warn("FuelLog: persistenza dati non riuscita:", err);
  });
  notify();
}

export function setSettingsStore(next: AppSettings): void {
  client = client
    ? { ...client, settings: next }
    : { data: SERVER_DATA, settings: next, mode: "localstorage" };
  persistSettings(next).catch((err) => {
    console.warn("FuelLog: persistenza impostazioni non riuscita:", err);
  });
  notify();
}

export function useFuelStore(): {
  data: VehiclesData;
  settings: AppSettings;
  /** false durante SSR/idratazione, true quando lo snapshot client è attivo */
  hydrated: boolean;
  /** Archivio attivo: "indexeddb" oppure fallback "localstorage" */
  mode: StorageMode;
} {
  const dataSnap = useSyncExternalStore(subscribe, getDataSnapshot, getServerDataSnapshot);
  const settingsSnap = useSyncExternalStore(
    subscribe,
    getSettingsSnapshot,
    getServerSettingsSnapshot
  );
  const hydrated = dataSnap !== SERVER_DATA;
  return { data: dataSnap, settings: settingsSnap, hydrated, mode: client?.mode ?? "localstorage" };
}
