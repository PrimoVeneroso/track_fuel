/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { buildHistoryCsv } from '../../src/lib/fuel/csv';
import { consumptionHistory } from '../../src/lib/fuel/history';
import { backupReminderDue, dataFingerprint, DAY } from '../../src/lib/fuel/backup-reminder';
import { computeStats } from '../../src/lib/fuel/calc';
import { applyImport, buildBackup, parseBackupFile } from '../../src/lib/fuel/storage';
import type { Refuel, VehiclesData } from '../../src/lib/fuel/types';
const r = (day: number, odometer: number, volume: number, full = false): Refuel => ({
  id: String(day), date: `2025-01-${String(day).padStart(2, '0')}T12:00`,
  odometer, volume, cost: volume * 2, full, notes: '', createdAt: '2025-01-01T12:00:00.000Z',
});
const rows = [r(1, 1000, 40, true), r(2, 1200, 10), r(3, 1600, 30, true)];
const data = (refuels = rows): VehiclesData => ({version: 1, activeVehicleId: 'car', vehicles: [{id: 'car', name: 'Auto', createdAt: '2025-01-01T12:00:00.000Z', refuels}]});
describe('Media totale', () => {
  test('include parziali e pieno finale, esclude il pieno iniziale', () => {
    const stats = computeStats(rows, 'metric')!;
    expect(stats.primaryConsumption).toBe(15);
    expect(stats.secondaryConsumption).toBeCloseTo(6.666667);
    expect(stats.totalCost).toBe(160);
    expect(stats.costPerDistance).toBeCloseTo(80 / 600);
  });
  test('mantiene la media durante i parziali successivi', () => {
    expect(computeStats([...rows, r(4, 1800, 12)], 'metric')!.primaryConsumption).toBe(15);
  });
  test('accumula intervalli con media ponderata senza reset', () => {
    expect(computeStats([...rows, r(4, 1800, 20, true)], 'metric')!.primaryConsumption).toBeCloseTo(800 / 60);
  });
  test('non inventa consumi prima di due pieni', () => {
    expect(computeStats([r(1, 1000, 10), r(2, 1200, 20, true)], 'metric')!.hasConsumption).toBe(false);
    expect(computeStats([], 'metric')).toBeNull();
  });
  test('esclude i parziali precedenti, ordina e ricalcola dopo cancellazioni', () => {
    expect(computeStats([rows[2], r(0 + 1, 900, 5), {...rows[0], date: '2025-01-01T13:00'}, rows[1]], 'metric')!.primaryConsumption).toBe(15);
    expect(computeStats(rows.slice(0, 2), 'metric')!.hasConsumption).toBe(false);
    expect(computeStats([rows[0], {...rows[1], volume: 20}, rows[2]], 'metric')!.primaryConsumption).toBe(12);
  });
  test('gestisce distanza nulla e unità imperiali', () => {
    expect(computeStats([r(1, 1000, 10, true), r(2, 1000, 10, true)], 'metric')!.hasConsumption).toBe(false);
    expect(computeStats(rows, 'imperial')!.secondaryConsumption).toBeNull();
  });
});
describe('Backup', () => {
  test('esporta e reimporta senza perdere dati', () => {
    const parsed = parseBackupFile(JSON.stringify(buildBackup(data(), {unitSystem: 'metric'})));
    expect(parsed.ok).toBe(true);
    expect(parsed.data).toEqual(data());
    expect(applyImport(parsed.data!, data(), 'merge').data).toEqual(data());
  });
  test('rifiuta numeri, date e sequenze non validi', () => {
    for (const bad of [{...rows[1], volume: -1}, {...rows[1], date: '2025-02-30T12:00'}, {...rows[1], odometer: 900}]) {
      expect(parseBackupFile(JSON.stringify(buildBackup(data([rows[0], bad]), {unitSystem: 'metric'}))).ok).toBe(false);
    }
    expect(parseBackupFile('invalid').ok).toBe(false);
  });
  test('unione conflittuale lascia lo stato originale intatto', () => {
    const current = data();
    expect(() => applyImport(data([r(4, 1100, 20)]), current, 'merge')).toThrow();
    expect(current).toEqual(data());
  });
});

describe('Funzioni offline', () => {
  test('CSV Excel: accenti, decimali, note multilinea e formule neutralizzate', () => {
    const exported = data([{...rows[0], volume: 12.5, notes: '=SUM(A1)\n"nota";ciao'}]);
    const csv = buildHistoryCsv(exported, {unitSystem: 'metric'});
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"12,5"');
    expect(csv).toContain('"\'=SUM(A1)\n""nota"";ciao"');
    expect(csv).toContain('Volume (L)');
    expect(buildHistoryCsv(data(), {unitSystem: 'imperial'})).toContain('Volume (gal)');
  });
  test('grafico coerente con la media totale e indipendente dai parziali in attesa', () => {
    const refuels = [...rows, r(4, 1800, 20, true), r(5, 1900, 5)];
    const history = consumptionHistory(refuels);
    expect(history).toHaveLength(2);
    expect(history[0].consumption).toBe(15);
    expect(history[1].consumption).toBe(10);
    expect(history[1].cumulative).toBe(computeStats(refuels, 'metric')!.primaryConsumption!);
    expect(consumptionHistory(rows.slice(0, 2))).toEqual([]);
  });
  test('promemoria solo su modifiche, con scadenza e rinvio', () => {
    const fingerprint = dataFingerprint(data());
    const state = {lastBackupAt: DAY, snoozedUntil: 0, fingerprint};
    expect(backupReminderDue(state, fingerprint, 40 * DAY)).toBe(false);
    expect(backupReminderDue(state, 'modified', 20 * DAY)).toBe(false);
    expect(backupReminderDue(state, 'modified', 31 * DAY)).toBe(true);
    expect(backupReminderDue({...state, snoozedUntil: 45 * DAY}, 'modified', 40 * DAY)).toBe(false);
    expect(backupReminderDue({lastBackupAt: 0, snoozedUntil: 0, fingerprint: ''}, fingerprint, DAY)).toBe(true);
    expect(dataFingerprint({...data(), activeVehicleId: null})).toBe(fingerprint);
  });
});
