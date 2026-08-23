/**
 * FuelLog — Motore di calcolo "media cumulativa corretta".
 *
 * Regole (per veicolo, rifornimenti ordinati cronologicamente):
 *
 * 1. Il PRIMO rifornimento registrato fissa distanza iniziale e volume
 *    iniziale e NON è contato nel consumo (serbatoio riempito da vuoto).
 *
 * 2. Ciclo corrente:
 *      Δdistanza        = odometro_ultimo − odometro_base
 *      Volume consumato = Σ volume dei rifornimenti SUCCESSIVI alla base
 *      Spesa di ciclo   = Σ spesa dei rifornimenti SUCCESSIVI alla base
 *    dove la "base" è l'ultimo rifornimento con flag "pieno"
 *    (oppure il primo rifornimento se nessun "pieno" è presente).
 *
 * 3. Un rifornimento con flag "pieno" successivo al primo resetta il ciclo:
 *    la sua distanza diventa la nuova base e il suo volume è escluso
 *    dal consumo del ciclo successivo.
 *
 * 4. Formule:
 *      Metrico:   km/l   = Δd / volume consumato
 *                 l/100km = volume consumato × 100 / Δd
 *      Imperiale: mpg    = Δd / volume consumato
 *      Costo per unità distanza = spesa di ciclo / Δd
 *
 * 5. Totali lifetime (indipendenti dai reset):
 *      Spesa totale     = Σ spesa di TUTTI i rifornimenti
 *      Percorrenza tot. = odometro ultimo − odometro primo
 *
 * Le statistiche sono valori derivati: ricalcolate da zero a ogni
 * modifica/cancellazione di un rifornimento.
 */

import type { Refuel, UnitSystem, VehicleStats } from "./types";
import { sortRefuels } from "./types";

export function computeStats(refuels: Refuel[], unit: UnitSystem): VehicleStats | null {
  const sorted = sortRefuels(refuels);
  const n = sorted.length;
  if (n === 0) return null;

  const first = sorted[0];
  const last = sorted[n - 1];

  const count = n;
  const totalCost = sorted.reduce((s, r) => s + (Number.isFinite(r.cost) ? r.cost : 0), 0);
  const totalDistance = Math.max(0, last.odometer - first.odometer);

  // Base del ciclo corrente: ultimo rifornimento "pieno", altrimenti il primo.
  let baseIndex = 0;
  for (let i = 0; i < n; i++) {
    if (sorted[i].full) baseIndex = i;
  }
  const cycleIsReset = baseIndex > 0;
  const base = sorted[baseIndex];

  const cycleDistance = Math.max(0, last.odometer - base.odometer);

  let cycleVolume = 0;
  let cycleCost = 0;
  for (let i = baseIndex + 1; i < n; i++) {
    cycleVolume += sorted[i].volume;
    cycleCost += sorted[i].cost;
  }
  const cycleCount = n - 1 - baseIndex;

  const hasConsumption = cycleDistance > 0 && cycleVolume > 0;

  let primaryConsumption: number | null = null;
  let secondaryConsumption: number | null = null;
  let costPerDistance: number | null = null;

  if (hasConsumption) {
    primaryConsumption = cycleDistance / cycleVolume;
    if (unit === "metric") {
      secondaryConsumption = (cycleVolume * 100) / cycleDistance;
    }
    costPerDistance = cycleCost / cycleDistance;
  }

  return {
    count,
    totalCost,
    totalDistance,
    cycleBaseIndex: baseIndex,
    cycleIsReset,
    cycleBaseDate: base.date,
    cycleDistance,
    cycleVolume,
    cycleCost,
    cycleCount,
    hasConsumption,
    primaryConsumption,
    secondaryConsumption,
    costPerDistance,
  };
}

/** Verifica la monotonia non-decrescente dell'odometro su una lista
 *  già ordinata per data. Restituisce l'indice del primo conflitto. */
export function firstOdometerConflict(sorted: Refuel[]): number {
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].odometer < sorted[i - 1].odometer) return i;
  }
  return -1;
}
