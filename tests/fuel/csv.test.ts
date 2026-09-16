/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  applyCsvImport,
  buildHistoryCsv,
  buildHistoryTsv,
  parseCsvImport,
  parseDateCell,
  parseDecimalFlexible,
  parseDelimitedRows,
} from '../../src/lib/fuel/csv';
import { buildBackup, parseBackupFile } from '../../src/lib/fuel/storage';
import type { Refuel, VehiclesData } from '../../src/lib/fuel/types';

const r = (id: string, day: number, odometer: number, volume: number, full = false, notes = ''): Refuel => ({
  id, date: `2025-01-${String(day).padStart(2, '0')}T12:00`,
  odometer, volume, cost: volume * 2, full, notes, createdAt: '2025-01-01T12:00:00.000Z',
});
const data = (): VehiclesData => ({
  version: 1, activeVehicleId: 'car1',
  vehicles: [
    { id: 'car1', name: 'Panda', createdAt: '2025-01-01T12:00:00.000Z', refuels: [r('r1', 1, 1000, 40, true), r('r2', 2, 1200, 10, false, 'autostrada')] },
    { id: 'car2', name: 'Moto', createdAt: '2025-01-01T12:00:00.000Z', refuels: [r('r3', 1, 50000, 8, true)] },
  ],
});

describe('CSV/TSV: parsing', () => {
  test('detecta separatore, virgolette e celle multilinea', () => {
    const { rows } = parseDelimitedRows('a;b\n"1""2";3\n"x\ny";z\n', ';');
    expect(rows).toEqual([['a', 'b'], ['1"2', '3'], ['x\ny', 'z']]);
  });
  test('numeri: virgola, punto e migliaia (it/uk)', () => {
    expect(parseDecimalFlexible('12,5')).toBe(12.5);
    expect(parseDecimalFlexible('12.5')).toBe(12.5);
    expect(parseDecimalFlexible('1.234,56')).toBe(1234.56);
    expect(parseDecimalFlexible('1,234.56')).toBe(1234.56);
    expect(parseDecimalFlexible('1234')).toBe(1234);
    expect(parseDecimalFlexible('12,34,56')).toBeNull();
    expect(parseDecimalFlexible('abc')).toBeNull();
    expect(parseDecimalFlexible('')).toBeNull();
  });
  test('date ISO con e senza ora; rigetta date inesistenti', () => {
    expect(parseDateCell('2025-01-05')).toBe('2025-01-05T00:00');
    expect(parseDateCell('2025-01-05 18:30')).toBe('2025-01-05T18:30');
    expect(parseDateCell('2025-01-05T18:30')).toBe('2025-01-05T18:30');
    expect(parseDateCell('2025-01-05 18:30:45')).toBe('2025-01-05T18:30');
    expect(parseDateCell('2025-02-30T12:00')).toBeNull();
    expect(parseDateCell('2025-13-01T12:00')).toBeNull();
    expect(parseDateCell('05/01/2025')).toBeNull();
  });
});

describe('CSV/TSV: import', () => {
  test('round-trip: esporta CSV poi riimporta senza perdere dati', () => {
    const csv = buildHistoryCsv(data(), { unitSystem: 'metric' });
    const parsed = parseCsvImport(csv);
    expect(parsed.ok).toBe(true);
    expect(parsed.report).toMatchObject({ vehicles: 2, refuels: 3, delimiter: ';' });
    const byName = new Map((parsed.vehicles ?? []).map(v => [v.name, v]));
    const panda = byName.get('Panda')!;
    expect(panda.id).toBe('car1');
    expect(panda.refuels).toHaveLength(2);
    expect(panda.refuels[0]).toMatchObject({ id: 'r1', date: '2025-01-01T12:00', odometer: 1000, volume: 40, cost: 80, full: true });
    expect(panda.refuels[1].notes).toBe('autostrada');
    expect(byName.get('Moto')!.id).toBe('car2');
  });

  test('accetta header inglesi, virgole e decimali con punto (TSV)', () => {
    const tsv = buildHistoryTsv(data(), { unitSystem: 'metric' });
    expect(tsv.charCodeAt(0)).not.toBe(0xfeff); // nessun BOM
    expect(tsv).toContain('1000');
    expect(tsv).toContain('\t');
    const parsed = parseCsvImport(tsv);
    expect(parsed.ok).toBe(true);
    expect(parsed.report?.delimiter).toBe('\t');
    expect(parsed.report?.refuels).toBe(3);

    const english = 'vehicle,date,odometer,volume,cost\n"Panda",2025-01-01 12:00,1000,40.0,80.00\n"Panda",2025-01-02 12:00,1200,10.0,20.00\n';
    const parsedEn = parseCsvImport(english);
    expect(parsedEn.ok).toBe(true);
    expect(parsedEn.vehicles![0].refuels[0]).toMatchObject({ odometer: 1000, volume: 40, cost: 80 });
  });

  test('righe con errore: import bloccato con elenco per riga', () => {
    const bad = 'Veicolo;Data e ora;Odometro (km);Volume (L);Spesa (€);Serbatoio pieno;Note\n' +
      'Panda;2025-01-01 12:00;1000;40;80;Sì;\n' +
      'Panda;2025-02-30 12:00;1200;10;20;No;\n' +
      'Panda;2025-01-03 12:00;900;5;10;No;\n';
    const parsed = parseCsvImport(bad);
    expect(parsed.ok).toBe(false);
    expect(parsed.errors).toBeDefined();
    expect(parsed.errors!.some(e => e.startsWith('Riga 3') && e.includes('data non valida'))).toBe(true);
    expect(parsed.errors!.some(e => e.startsWith('Riga 4') && e.toLowerCase().includes('odometro'))).toBe(true);
  });

  test('colonne mancanti segnalate per nome', () => {
    const parsed = parseCsvImport('Veicolo;Data e ora;Volume\nPanda;2025-01-01;40\n');
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain('Odometro');
    expect(parsed.error).toContain('Spesa');
  });

  test('file vuoto e header senza dati', () => {
    expect(parseCsvImport('   \n\n').ok).toBe(false);
    const headerOnly = parseCsvImport('Veicolo;Data e ora;Odometro;Volume;Spesa\n');
    expect(headerOnly.ok).toBe(false);
    expect(headerOnly.error).toContain('Nessun rifornimento');
  });

  test('tolera BOM, righe vuote in testa e prefisso anti-formula', () => {
    const text = '\uFEFF\nVeicolo;Data e ora;Odometro;Volume;Spesa;Serbatoio pieno;Note\n' +
      'Panda;2025-01-01 12:00;1000;40;80;Sì;=SUM(A1)\n' +
      'Panda;2025-01-02 12:00;1200;10;20;No;"nota \'con apice"\n';
    const parsed = parseCsvImport(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.vehicles![0].name).toBe('Panda');
    // prefisso anti-formula dell'export rimosso; apice di contenuto intatto
    expect(parsed.vehicles![0].refuels[0].notes).toBe('=SUM(A1)');
    expect(parsed.vehicles![0].refuels[1].notes).toBe("nota 'con apice");
  });

  test('valori limite e "Serbatoio pieno" non riconosciuto', () => {
    const text = 'Veicolo;Data e ora;Odometro;Volume;Spesa;Serbatoio pieno\n' +
      'Panda;2025-01-01 12:00;1000;40;80;forse\n';
    const parsed = parseCsvImport(text);
    expect(parsed.ok).toBe(false);
    expect(parsed.errors![0]).toContain('Serbatoio pieno');
  });
});

describe('CSV/TSV: applicazione', () => {
  const current = (): VehiclesData => data();

  test('merge per nome: aggiorna per id, aggiunge i nuovi, non duplica i record identici', () => {
    const incoming = {
      version: 1 as const, activeVehicleId: null,
      vehicles: [{
        id: 'ext1', name: 'panda', createdAt: '2025-01-01T12:00:00.000Z',
        refuels: [
          { id: 'r1', date: '2025-01-01T12:00', odometer: 1000, volume: 41, cost: 82, full: true, notes: 'corretto', createdAt: '2025-01-01T12:00:00.000Z' },
          { id: 'r9', date: '2025-01-05T12:00', odometer: 1500, volume: 12, cost: 24, full: false, notes: '', createdAt: '2025-01-05T12:00:00.000Z' },
        ],
      }],
    };
    const result = applyCsvImport(incoming, current(), 'merge');
    expect(result.addedVehicles).toBe(0);
    expect(result.mergedVehicles).toBe(1);
    const panda = result.data.vehicles.find(v => v.name === 'Panda')!;
    expect(panda.id).toBe('car1'); // conserva l'id locale
    expect(panda.refuels).toHaveLength(3);
    expect(panda.refuels.find(x => x.id === 'r1')!.volume).toBe(41); // il record del file prevale
    expect(panda.refuels.find(x => x.id === 'r9')!.odometer).toBe(1500);
    expect(result.data.vehicles.find(v => v.name === 'Moto')!.refuels).toHaveLength(1); // gli altri veicoli intatti
  });

  test('reimport dello stesso CSV è idempotente (nessun duplicato)', () => {
    const csv = buildHistoryCsv(data(), { unitSystem: 'metric' });
    const first = parseCsvImport(csv)!;
    const incoming = { version: 1 as const, activeVehicleId: null, vehicles: first.vehicles! };
    const once = applyCsvImport(incoming, current(), 'merge');
    const twice = applyCsvImport(incoming, once.data, 'merge');
    expect(once.data.vehicles.find(v => v.name === 'Panda')!.refuels).toHaveLength(2);
    expect(twice.data.vehicles.find(v => v.name === 'Panda')!.refuels).toHaveLength(2);
  });

  test('confitto odometri: unione annullata e stato originale intatto', () => {
    const incoming = {
      version: 1 as const, activeVehicleId: null,
      vehicles: [{
        id: 'ext1', name: 'Panda', createdAt: '2025-01-01T12:00:00.000Z',
        refuels: [{ id: 'rx', date: '2025-01-10T12:00', odometer: 500, volume: 5, cost: 10, full: false, notes: '', createdAt: '2025-01-10T12:00:00.000Z' }],
      }],
    };
    const before = current();
    expect(() => applyCsvImport(incoming, before, 'merge')).toThrow();
    expect(before).toEqual(data());
  });

  test('overwrite sostituisce tutto e seleziona il primo veicolo', () => {
    const incoming = {
      version: 1 as const, activeVehicleId: null,
      vehicles: [{
        id: 'z', name: 'Nuova', createdAt: '2025-01-01T12:00:00.000Z',
        refuels: [r('z1', 1, 10, 5)],
      }],
    };
    const result = applyCsvImport(incoming, current(), 'overwrite');
    expect(result.data.vehicles).toHaveLength(1);
    expect(result.data.activeVehicleId).toBe('z');
  });

  test('JSON e CSV convivenza: il backup JSON resta importabile', () => {
    const parsed = parseBackupFile(JSON.stringify(buildBackup(data(), { unitSystem: 'metric' })));
    expect(parsed.ok).toBe(true);
  });
});

describe('CSV/TSV: export', () => {
  test('TSV: tab, decimali con punto, virgolette solo dove servono', () => {
    const tsv = buildHistoryTsv(data(), { unitSystem: 'metric' });
    const lines = tsv.trimEnd().split('\n');
    expect(lines[0]).toBe('Veicolo\tData e ora\tOdometro (km)\tVolume (L)\tSpesa (€)\tSerbatoio pieno\tNote\tID veicolo\tID rifornimento\tPrezzo (€/L)');
    const pandaFirst = lines[1].split('\t');
    expect(pandaFirst[0]).toBe('Panda');
    expect(pandaFirst[2]).toBe('1000');
    expect(pandaFirst[3]).toBe('40.00');
    expect(pandaFirst[9]).toBe('2.000');
    // nota semplice senza virgolette
    const pandaSecond = lines[2].split('\t');
    expect(pandaSecond[6]).toBe('autostrada');
  });

  test('CSV: colonna prezzo aggiunta in coda, formato compatibile invariato', () => {
    const csv = buildHistoryCsv(data(), { unitSystem: 'metric' });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.split('\r\n')[0]).toContain('Prezzo (€/L)');
    expect(csv).toContain('"1000"');
    expect(csv).toContain('"40,00"');
    expect(csv).toContain('"80,00"');
  });

  test('TSV imperial: etichette mpg/gal/$', () => {
    const tsv = buildHistoryTsv(data(), { unitSystem: 'imperial' });
    expect(tsv).toContain('Odometro (mi)');
    expect(tsv).toContain('Volume (gal)');
    expect(tsv).toContain('Spesa ($)');
  });
});
