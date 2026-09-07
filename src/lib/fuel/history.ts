import { firstOdometerConflict } from './calc';
import { sortRefuels, type Refuel } from './types';

export interface ConsumptionPoint {
  id: string;
  date: string;
  distance: number;
  volume: number;
  consumption: number | null;
  cumulative: number;
}

export function consumptionHistory(refuels: Refuel[]): ConsumptionPoint[] {
  const sorted = sortRefuels(refuels);
  if (firstOdometerConflict(sorted) !== -1) return [];
  let first: Refuel | null = null;
  let previous: Refuel | null = null;
  let volume = 0;
  let totalVolume = 0;
  const points: ConsumptionPoint[] = [];
  for (const refuel of sorted) {
    if (!first) {
      if (refuel.full) first = previous = refuel;
      continue;
    }
    volume += refuel.volume;
    totalVolume += refuel.volume;
    if (!refuel.full) continue;
    const distance = refuel.odometer - previous!.odometer;
    const totalDistance = refuel.odometer - first.odometer;
    if (totalDistance > 0 && totalVolume > 0) {
      points.push({id: refuel.id, date: refuel.date, distance, volume,
        consumption: distance > 0 && volume > 0 ? distance / volume : null,
        cumulative: totalDistance / totalVolume});
    }
    previous = refuel;
    volume = 0;
  }
  return points;
}
