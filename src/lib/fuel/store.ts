"use client";

/**
 * Store reattivo sopra localStorage, basato su useSyncExternalStore.
 * - Lettura iniziale lazy (nessun mismatch di idratazione: il server
 *   usa uno snapshot costante, il client passa ai dati reali al mount).
 * - Ogni scrittura aggiorna lo snapshot, persiste e notifica i subscriber.
 */

import { useSyncExternalStore } from "react";
import type { AppSettings, VehiclesData } from "./types";
import { emptyVehiclesData, defaultSettings } from "./types";
import { loadSettings, loadVehiclesData, saveSettings, saveVehiclesData } from "./storage";

const SERVER_DATA: VehiclesData = emptyVehiclesData();
const SERVER_SETTINGS: AppSettings = defaultSettings();

let data: VehiclesData | null = null;
let settings: AppSettings | null = null;

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

function getDataSnapshot(): VehiclesData {
  if (data === null) data = loadVehiclesData();
  return data;
}

function getSettingsSnapshot(): AppSettings {
  if (settings === null) settings = loadSettings();
  return settings;
}

function getServerDataSnapshot(): VehiclesData {
  return SERVER_DATA;
}

function getServerSettingsSnapshot(): AppSettings {
  return SERVER_SETTINGS;
}

export function setDataStore(next: VehiclesData): void {
  data = next;
  saveVehiclesData(next);
  notify();
}

export function setSettingsStore(next: AppSettings): void {
  settings = next;
  saveSettings(next);
  notify();
}

export function useFuelStore(): {
  data: VehiclesData;
  settings: AppSettings;
  /** false durante SSR/idratazione, true quando lo snapshot client è attivo */
  hydrated: boolean;
} {
  const dataSnap = useSyncExternalStore(subscribe, getDataSnapshot, getServerDataSnapshot);
  const settingsSnap = useSyncExternalStore(
    subscribe,
    getSettingsSnapshot,
    getServerSettingsSnapshot
  );
  const hydrated = dataSnap !== SERVER_DATA;
  return { data: dataSnap, settings: settingsSnap, hydrated };
}
