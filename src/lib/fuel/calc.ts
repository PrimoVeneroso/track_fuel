/** Stima cumulativa dal primo rifornimento, senza reset ai pieni.
 * Il volume aggiunto può differire da quello effettivamente consumato. */
import type { Refuel, UnitSystem, VehicleStats } from "./types";
import { sortRefuels } from "./types";

export function computeStats(refuels: Refuel[], unit: UnitSystem): VehicleStats | null {
  const sorted = sortRefuels(refuels);
  if (!sorted.length) return null;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const measured = sorted.slice(1);
  const measuredDistance = Math.max(0, last.odometer - first.odometer);
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
    measuredThrough: measured.length ? last.date : null,
    cycleBaseIndex: 0,
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
