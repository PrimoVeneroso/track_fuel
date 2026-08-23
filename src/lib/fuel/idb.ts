/**
 * FuelLog — Livello basso IndexedDB.
 *
 * Database locale "fuellog" (versione 1):
 *  - store "vehicles": un documento per veicolo (keyPath "id"),
 *    con i rifornimenti annidati nel documento stesso;
 *  - store "kv": chiave/valore per impostazioni e metadati
 *    (veicolo attivo, versione schema, flag di migrazione).
 *
 * Nessuna dipendenza esterna, nessuna richiesta di rete.
 */

import type { Vehicle } from "./types";

const DB_NAME = "fuellog";
const DB_VERSION = 1;
const STORE_VEHICLES = "vehicles";
const STORE_KV = "kv";

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Operazione IndexedDB fallita"));
  });
}

function transactionToPromise(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Transazione IndexedDB fallita"));
    tx.onabort = () => reject(tx.error ?? new Error("Transazione IndexedDB interrotta"));
  });
}

function openRaw(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB non disponibile in questo ambiente"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_VEHICLES)) {
        db.createObjectStore(STORE_VEHICLES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Impossibile aprire il database locale"));
    req.onblocked = () => reject(new Error("Database bloccato da un'altra scheda"));
  });
}

export interface FuelLogDB {
  getAllVehicles(): Promise<Vehicle[]>;
  /** Sostituisce atomicamente l'intero set di veicoli. */
  replaceAllVehicles(vehicles: Vehicle[]): Promise<void>;
  getKV<T>(key: string): Promise<T | undefined>;
  setKV(key: string, value: unknown): Promise<void>;
  deleteKV(key: string): Promise<void>;
  clearAll(): Promise<void>;
}

export async function openFuelLogDB(): Promise<FuelLogDB> {
  const db = await openRaw();

  return {
    getAllVehicles() {
      const tx = db.transaction(STORE_VEHICLES, "readonly");
      return requestToPromise(tx.objectStore(STORE_VEHICLES).getAll()) as Promise<Vehicle[]>;
    },

    async replaceAllVehicles(vehicles) {
      const tx = db.transaction(STORE_VEHICLES, "readwrite");
      const store = tx.objectStore(STORE_VEHICLES);
      store.clear();
      for (const v of vehicles) store.put(v);
      await transactionToPromise(tx);
    },

    getKV<T>(key: string) {
      const tx = db.transaction(STORE_KV, "readonly");
      return requestToPromise(tx.objectStore(STORE_KV).get(key)) as Promise<T | undefined>;
    },

    async setKV(key: string, value: unknown) {
      const tx = db.transaction(STORE_KV, "readwrite");
      tx.objectStore(STORE_KV).put(value, key);
      await transactionToPromise(tx);
    },

    async deleteKV(key: string) {
      const tx = db.transaction(STORE_KV, "readwrite");
      tx.objectStore(STORE_KV).delete(key);
      await transactionToPromise(tx);
    },

    async clearAll() {
      const tx = db.transaction([STORE_VEHICLES, STORE_KV], "readwrite");
      tx.objectStore(STORE_VEHICLES).clear();
      tx.objectStore(STORE_KV).clear();
      await transactionToPromise(tx);
    },
  };
}
