/** Media ponderata su tutti gli intervalli completati tra pieni.
 * I parziali prima del primo pieno e dopo l'ultimo restano nello storico,
 * ma non misurano ancora un consumo a parità di livello del serbatoio.
 */
import type { Refuel, UnitSystem, VehicleStats } from "./types";
import { sortRefuels } from "./types";

export function computeStats(refuels: Refuel[], unit: UnitSystem): VehicleStats | null {
  const sorted = sortRefuels(refuels);
  if (!sorted.length) return null;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const start = sorted.findIndex(r => r.full);
  let end = start;
  sorted.forEach((r, i) => { if (r.full) end = i; });
  const measured = start >= 0 ? sorted.slice(start + 1, end + 1) : [];
  const measuredDistance = start >= 0 ? sorted[end].odometer - sorted[start].odometer : 0;
  const measuredVolume = measured.reduce((sum, r) => sum + r.volume, 0);
  const measuredCost = measured.reduce((sum, r) => sum + r.cost, 0);
  const hasConsumption = firstOdometerConflict(sorted) === -1 && measuredDistance > 0 && measuredVolume > 0;
  return {
    count: sorted.length,
    totalCost: sorted.reduce((sum, r) => sum + r.cost, 0),
    totalDistance: Math.max(0, last.odometer - first.odometer),
    measuredDistance,
    measuredVolume,
    measuredCount: measured.length,
    measuredThrough: end >= 0 ? sorted[end].date : null,
    pendingCount: end >= 0 ? sorted.length - end - 1 : sorted.length,
    cycleBaseIndex: end,
    hasConsumption,
    primaryConsumption: hasConsumption ? measuredDistance / measuredVolume : null,
    secondaryConsumption: hasConsumption && unit === "metric" ? measuredVolume * 100 / measuredDistance : null,
    costPerDistance: hasConsumption ? measuredCost / measuredDistance : null,
  };
}

/** Indice del primo odometro decrescente nella sequenza cronologica. */
export function firstOdometerConflict(sorted: Refuel[]): number {
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].odometer < sorted[i - 1].odometer) return i;
  }
  return -1;
}
