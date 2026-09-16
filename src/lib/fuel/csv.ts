/**
 * FuelLog — CSV/TSV per l'export dello storico e l'import da Excel.
 *
 * CSV (Excel italiano): BOM, separatore ";", righe \r\n, decimali con virgola,
 *   ogni cella tra virgolette, formule neutralizzate (prefisso ').
 * TSV (uso tecnico):    senza BOM, separatore tab, righe \n, decimali con punto,
 *   virgolette solo quando la cella lo richiede.
 *
 * Import: riconosce CSV/TSV (separatore ; , tab o |), header in italiano o
 * inglese, date "AAAA-MM-GG [HH:MM]", numeri con virgola/punto e migliaia.
 */
import type { AppSettings, Refuel, VehiclesData, Vehicle } from './types';
import { SCHEMA_VERSION, sortRefuels } from './types';
import { firstOdometerConflict } from './calc';
import { unitLabels } from './format';
import { MAX_NAME_LENGTH, MAX_NOTES_LENGTH, uid, validateRefuel, type RefuelDraft } from './validation';
import { triggerFileDownloadOrShare, type ExportResult } from './download';

export type Delimiter = ';' | ',' | '\t' | '|';

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export interface HistoryTableOptions {
  delimiter: Delimiter;
  lineEnding: '\r\n' | '\n';
  bom: boolean;
  /** decimali con virgola (Excel) oppure punto (uso tecnico) */
  decimalComma: boolean;
  /** CSV Excel: tutte le celle tra virgolette; TSV: solo se necessario */
  quoteAll: boolean;
}

const CSV_OPTIONS: HistoryTableOptions = { delimiter: ';', lineEnding: '\r\n', bom: true, decimalComma: true, quoteAll: true };
const TSV_OPTIONS: HistoryTableOptions = { delimiter: '\t', lineEnding: '\n', bom: false, decimalComma: false, quoteAll: false };

function decimal(value: number, decimals: number, comma: boolean): string {
  const s = value.toFixed(decimals);
  return comma ? s.replace('.', ',') : s;
}

/** Numero → testo con il minimo numero di cifre decimali utili. */
function numberToText(value: number, comma: boolean): string {
  let s = value.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
  if (s === '' || s === '-') s = '0';
  return comma ? s.replace('.', ',') : s;
}

/** Cella CSV Excel: sempre virgolata, decimali con virgola, formule neutralizzate. */
function csvCell(value: string | number): string {
  const text = typeof value === 'number' ? numberToText(value, true) : value;
  const safe = typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Cella TSV: virgolette solo se contiene tab, virgolette o a capo;
 *  formule neutralizzate come nel CSV (sicuro anche se aperto in Excel). */
function tsvCell(value: string): string {
  const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
  if (safe.includes('\t') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildHistoryTable(data: VehiclesData, settings: AppSettings, options: HistoryTableOptions): string {
  const labels = unitLabels(settings.unitSystem);
  const header = [
    'Veicolo', 'Data e ora', `Odometro (${labels.distance})`, `Volume (${labels.volume})`,
    `Spesa (${labels.currency})`, 'Serbatoio pieno', 'Note', 'ID veicolo', 'ID rifornimento',
    `Prezzo (${labels.currency}/${labels.volume})`,
  ];
  const rows: string[][] = [header];
  for (const vehicle of data.vehicles) {
    for (const refuel of sortRefuels(vehicle.refuels)) {
      rows.push([
        vehicle.name,
        refuel.date.replace('T', ' '),
        numberToText(refuel.odometer, options.decimalComma),
        decimal(refuel.volume, 2, options.decimalComma),
        decimal(refuel.cost, 2, options.decimalComma),
        refuel.full ? 'Sì' : 'No',
        refuel.notes,
        vehicle.id,
        refuel.id,
        refuel.volume > 0 ? decimal(refuel.cost / refuel.volume, 3, options.decimalComma) : '',
      ]);
    }
  }
  const sep = options.delimiter;
  const body = rows
    .map(row => row.map(value => (options.quoteAll ? csvCell(value) : tsvCell(value))).join(sep))
    .join(options.lineEnding) + options.lineEnding;
  return (options.bom ? '\uFEFF' : '') + body;
}

export function buildHistoryCsv(data: VehiclesData, settings: AppSettings): string {
  return buildHistoryTable(data, settings, CSV_OPTIONS);
}

export function buildHistoryTsv(data: VehiclesData, settings: AppSettings): string {
  return buildHistoryTable(data, settings, TSV_OPTIONS);
}

export async function downloadHistoryCsv(data: VehiclesData, settings: AppSettings): Promise<ExportResult> {
  try {
    const blob = new Blob([buildHistoryCsv(data, settings)], { type: 'text/csv;charset=utf-8' });
    const filename = `fuellog-storico-${new Date().toISOString().slice(0, 10)}.csv`;
    return await triggerFileDownloadOrShare(blob, filename);
  } catch {
    return 'failed';
  }
}

export async function downloadHistoryTsv(data: VehiclesData, settings: AppSettings): Promise<ExportResult> {
  try {
    const blob = new Blob([buildHistoryTsv(data, settings)], { type: 'text/tab-separated-values;charset=utf-8' });
    const filename = `fuellog-storico-${new Date().toISOString().slice(0, 10)}.tsv`;
    return await triggerFileDownloadOrShare(blob, filename);
  } catch {
    return 'failed';
  }
}

/* ------------------------------------------------------------------ */
/* Parsing (delimited → righe)                                         */
/* ------------------------------------------------------------------ */

function detectDelimiter(line: string): Delimiter {
  const candidates: Delimiter[] = [';', '\t', ',', '|'];
  let best: Delimiter = ';';
  let bestCount = -1;
  for (const d of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

function firstNonEmptyLine(text: string): string {
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() !== '') return line;
  }
  return '';
}

/** Parser RFC-4180 semplificato: virgolette, virgolette doppie, a capo nelle
 *  celle. `lines` riporta la riga fisica (1-based) d'inizio di ogni record,
 *  utile per i messaggi di errore. */
export function parseDelimitedRows(text: string, delimiter: Delimiter): { rows: string[][]; lines: number[] } {
  const rows: string[][] = [];
  const lines: number[] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let currentLine = 1;
  let rowStartLine = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        field += '\n';
        currentLine++;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      lines.push(rowStartLine);
      row = [];
      currentLine++;
      rowStartLine = currentLine;
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
    lines.push(rowStartLine);
  }
  // righe vuote in coda
  while (rows.length > 0 && rows[rows.length - 1].every(cell => cell.trim() === '')) {
    rows.pop();
    lines.pop();
  }
  return { rows, lines };
}

/* ------------------------------------------------------------------ */
/* Import CSV/TSV                                                      */
/* ------------------------------------------------------------------ */

export interface CsvImportReport {
  vehicles: number;
  refuels: number;
  delimiter: Delimiter;
}

export interface CsvImportResult {
  ok: boolean;
  /** errore strutturale (file vuoto, header mancante, colonne assenti) */
  error?: string;
  /** errori per riga (il file non viene importato finché ce ne sono) */
  errors?: string[];
  vehicles?: Vehicle[];
  report?: CsvImportReport;
}

type Field = 'vehicle' | 'date' | 'odometer' | 'volume' | 'cost' | 'full' | 'notes' | 'vehicleId' | 'refuelId';

const HEADER_ALIASES: Record<string, Field> = {
  veicolo: 'vehicle',
  vehicle: 'vehicle',
  auto: 'vehicle',
  data: 'date',
  'data e ora': 'date',
  'data rifornimento': 'date',
  date: 'date',
  odometro: 'odometer',
  odometer: 'odometer',
  contachilometri: 'odometer',
  contamiglia: 'odometer',
  chilometraggio: 'odometer',
  volume: 'volume',
  litri: 'volume',
  galloni: 'volume',
  litres: 'volume',
  spesa: 'cost',
  'spesa totale': 'cost',
  cost: 'cost',
  'serbatoio pieno': 'full',
  pieno: 'full',
  full: 'full',
  note: 'notes',
  notes: 'notes',
  'id veicolo': 'vehicleId',
  'id rifornimento': 'refuelId',
};

const REQUIRED_FIELDS: Field[] = ['vehicle', 'date', 'odometer', 'volume', 'cost'];

function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/^'+/, '')
    .trim()
    .toLowerCase()
    // rimuove il suffisso tra parentesi: "Volume (L)" → "volume"
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
}

/** Rimuove il prefisso anti-formula (') solo quando precede un carattere di
 *  formula (=, +, @, -), così le note che iniziano davvero con ' sono intatte. */
function stripFormulaPrefix(raw: string): string {
  return raw.replace(/^'(?=[\s]*[=+@-])/, '').trim();
}

/** "12,5", "12.5", "1.234,56", "1,234.56" → numero. */
export function parseDecimalFlexible(raw: string): number | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  let s = t.replace(/\s+/g, '');

  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf('.') > s.lastIndexOf(',')) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(/\./g, '').replace(',', '.');
    }
  } else if (s.includes(',')) {
    if ((s.match(/,/g) || []).length > 1) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  } else if (s.includes('.')) {
    if ((s.match(/\./g) || []).length > 1) {
      s = s.replace(/\./g, '');
    }
  }

  if (s === '' || !/^-?\d*\.?\d*$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "AAAA-MM-GG", "AAAA-MM-GG HH:MM", "AAAA-MM-GGTHH:MM[:SS]" → "YYYY-MM-DDTHH:mm". */
export function parseDateCell(raw: string): string | null {
  const t = stripFormulaPrefix(raw);
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?)?$/);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  const time = hh !== undefined ? `${hh}:${mm}` : '00:00';
  const probe = new Date(`${y}-${mo}-${d}T${time}`);
  if (probe.getFullYear() !== Number(y) || probe.getMonth() + 1 !== Number(mo) || probe.getDate() !== Number(d)) return null;
  return `${y}-${mo}-${d}T${time}`;
}

function parseFullCell(raw: string): boolean | null {
  const t = stripFormulaPrefix(raw).toLowerCase();
  if (t === '' || t === 'no' || t === 'n' || t === 'false' || t === '0' || t === 'f') return false;
  if (t === 'si' || t === 'sì' || t === 's' || t === 'yes' || t === 'y' || t === 'true' || t === '1' || t === 't' || t === 'x') return true;
  return null;
}

export function parseCsvImport(text: string): CsvImportResult {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delimiter = detectDelimiter(firstNonEmptyLine(text));
  const parsed = parseDelimitedRows(text, delimiter);
  if (parsed.rows.length === 0) return { ok: false, error: 'File vuoto o non leggibile.' };

  // Header: prima riga non vuota (tolera righe vuote in testa)
  const headerAt = parsed.rows.findIndex(row => row.some(cell => cell.trim() !== ''));
  if (headerAt === -1) return { ok: false, error: 'File vuoto o non leggibile.' };
  const rows = parsed.rows.slice(headerAt);
  const lines = parsed.lines.slice(headerAt);

  // Header
  const headerRow = rows[0];
  const fields: (Field | null)[] = headerRow.map(cell => HEADER_ALIASES[normalizeHeader(cell)] ?? null);
  const missing = REQUIRED_FIELDS.filter(f => !fields.includes(f));
  if (missing.length > 0) {
    const names: Record<Field, string> = {
      vehicle: 'Veicolo', date: 'Data', odometer: 'Odometro', volume: 'Volume',
      cost: 'Spesa', full: 'Serbatoio pieno', notes: 'Note', vehicleId: 'ID veicolo', refuelId: 'ID rifornimento',
    };
    return { ok: false, error: `Colonne mancanti: ${missing.map(f => names[f]).join(', ')}.` };
  }

  interface RowDraft {
    line: number;
    vehicleName: string;
    vehicleId?: string;
    refuelId?: string;
    draft: RefuelDraft;
  }
  const drafts: RowDraft[] = [];
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.every(c => c.trim() === '')) continue;
    const get = (f: Field): string => {
      const idx = fields.indexOf(f);
      return idx === -1 ? '' : (cells[idx] ?? '').trim();
    };
    const line = lines[i];

    const vehicleName = stripFormulaPrefix(get('vehicle'));
    if (!vehicleName) {
      errors.push(`Riga ${line}: nome veicolo mancante.`);
      continue;
    }
    if (vehicleName.length > MAX_NAME_LENGTH) {
      errors.push(`Riga ${line}: nome veicolo troppo lungo (max ${MAX_NAME_LENGTH}).`);
      continue;
    }
    const date = parseDateCell(get('date'));
    if (!date) {
      errors.push(`Riga ${line}: data non valida (usa AAAA-MM-GG oppure AAAA-MM-GG HH:MM).`);
      continue;
    }
    const odometer = parseDecimalFlexible(get('odometer'));
    if (odometer === null) {
      errors.push(`Riga ${line}: odometro non è un numero valido.`);
      continue;
    }
    const volume = parseDecimalFlexible(get('volume'));
    if (volume === null) {
      errors.push(`Riga ${line}: volume non è un numero valido.`);
      continue;
    }
    const cost = parseDecimalFlexible(get('cost'));
    if (cost === null) {
      errors.push(`Riga ${line}: spesa non è un numero valido.`);
      continue;
    }
    const fullRaw = get('full');
    const fullParsed = fullRaw === '' ? false : parseFullCell(fullRaw);
    if (fullParsed === null) {
      errors.push(`Riga ${line}: valore non riconosciuto per "Serbatoio pieno" (usa Sì/No).`);
      continue;
    }
    const notes = stripFormulaPrefix(get('notes')).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, MAX_NOTES_LENGTH);

    drafts.push({
      line,
      vehicleName,
      vehicleId: get('vehicleId') || undefined,
      refuelId: get('refuelId') || undefined,
      draft: { date, odometer: String(odometer), volume: String(volume), cost: String(cost), full: fullParsed, notes },
    });
  }

  if (drafts.length === 0) {
    return {
      ok: false,
      error: 'Nessun rifornimento valido trovato nel file.',
      // le righe esistono ma sono tutte da correggere: mostra gli errori specifici
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // Raggruppa per veicolo (nome, senza distinzione maiuscole/minuscole)
  const vehicleIndex = new Map<string, { name: string; id?: string; rows: RowDraft[] }>();
  for (const d of drafts) {
    const key = d.vehicleName.toLowerCase();
    let entry = vehicleIndex.get(key);
    if (!entry) {
      entry = { name: d.vehicleName, id: d.vehicleId, rows: [] };
      vehicleIndex.set(key, entry);
    }
    if (d.vehicleId && entry.id && d.vehicleId !== entry.id) {
      errors.push(`Riga ${d.line}: ID veicolo incoerente per "${d.vehicleName}".`);
    }
    entry.rows.push(d);
  }

  // Convalida per veicolo (in ordine di riga): numeri, date, monotonia odometro
  const seenRefuelIds = new Set<string>();
  const vehicles: Vehicle[] = [];
  for (const entry of vehicleIndex.values()) {
    const refuels: Refuel[] = [];
    const base = Date.now();
    for (const d of entry.rows) {
      if (d.refuelId) {
        if (seenRefuelIds.has(d.refuelId)) {
          errors.push(`Riga ${d.line}: ID rifornimento duplicato (${d.refuelId}).`);
          continue;
        }
        seenRefuelIds.add(d.refuelId);
      }
      const result = validateRefuel(d.draft, refuels, null, { distance: 'km/mi' });
      if (!result.ok) {
        errors.push(`Riga ${d.line} (${entry.name}): ${result.error}`);
        continue;
      }
      refuels.push({
        id: d.refuelId && d.refuelId.length <= 64 ? d.refuelId : uid(),
        date: result.value.date,
        odometer: result.value.odometer,
        volume: result.value.volume,
        cost: result.value.cost,
        full: result.value.full,
        notes: result.value.notes,
        createdAt: new Date(base + refuels.length).toISOString(),
      });
    }
    if (refuels.length === 0) continue;
    vehicles.push({
      id: entry.id && entry.id.length <= 64 ? entry.id : uid(),
      name: entry.name,
      createdAt: new Date().toISOString(),
      refuels,
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  if (vehicles.length === 0) return { ok: false, error: 'Nessun veicolo valido trovato nel file.' };

  return {
    ok: true,
    vehicles,
    report: {
      vehicles: vehicles.length,
      refuels: vehicles.reduce((s, v) => s + v.refuels.length, 0),
      delimiter,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Applicazione dell'import CSV                                        */
/* ------------------------------------------------------------------ */

export interface CsvApplyResult {
  data: VehiclesData;
  addedVehicles: number;
  mergedVehicles: number;
}

/** "overwrite" sostituisce tutto; "merge" unisce per nome veicolo
 *  (i rifornimenti con lo stesso id vengono sostituiti, gli altri aggiunti;
 *  i record identici per data+odometro+volume+spesa non si duplicano). */
export function applyCsvImport(
  incoming: VehiclesData,
  current: VehiclesData,
  mode: 'overwrite' | 'merge'
): CsvApplyResult {
  if (mode === 'overwrite') {
    return {
      data: { version: SCHEMA_VERSION, activeVehicleId: incoming.vehicles[0]?.id ?? null, vehicles: incoming.vehicles },
      addedVehicles: incoming.vehicles.length,
      mergedVehicles: 0,
    };
  }
  const norm = (s: string) => s.trim().toLowerCase();
  const result: Vehicle[] = current.vehicles.map(v => ({ ...v, refuels: [...v.refuels] }));
  let added = 0;
  let merged = 0;
  for (const inc of incoming.vehicles) {
    const idx = result.findIndex(v => norm(v.name) === norm(inc.name));
    if (idx === -1) {
      result.push({ ...inc, refuels: [...inc.refuels] });
      added++;
      continue;
    }
    const local = result[idx];
    const byId = new Map(local.refuels.map(r => [r.id, r]));
    for (const r of inc.refuels) byId.set(r.id, r);
    const unique = [...byId.values()].filter(
      (r, i, arr) => arr.findIndex(x => x.date === r.date && x.odometer === r.odometer && x.volume === r.volume && x.cost === r.cost) === i
    );
    result[idx] = { ...local, refuels: unique };
    merged++;
  }
  for (const vehicle of result) {
    if (firstOdometerConflict(sortRefuels(vehicle.refuels)) !== -1) {
      throw new Error(`Unione annullata: odometri non coerenti per ${vehicle.name}.`);
    }
  }
  const ids = new Set(result.map(v => v.id));
  const activeVehicleId =
    current.activeVehicleId && ids.has(current.activeVehicleId)
      ? current.activeVehicleId
      : result[0]?.id ?? null;
  return { data: { version: SCHEMA_VERSION, activeVehicleId, vehicles: result }, addedVehicles: added, mergedVehicles: merged };
}
