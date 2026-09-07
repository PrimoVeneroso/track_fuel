import type { AppSettings, VehiclesData } from './types';
import { sortRefuels } from './types';
import { unitLabels } from './format';
import { triggerFileDownloadOrShare, type ExportResult } from './download';

// Separatore e decimali per Excel italiano; virgolette per note e nomi liberi.
function cell(value: string | number): string {
  const text = typeof value === 'number' ? String(value).replace('.', ',') : value;
  const safe = typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildHistoryCsv(data: VehiclesData, settings: AppSettings): string {
  const labels = unitLabels(settings.unitSystem);
  const rows: (string | number)[][] = [[
    'Veicolo', 'Data e ora', `Odometro (${labels.distance})`, `Volume (${labels.volume})`,
    `Spesa (${labels.currency})`, 'Serbatoio pieno', 'Note', 'ID veicolo', 'ID rifornimento',
  ]];
  for (const vehicle of data.vehicles) {
    for (const refuel of sortRefuels(vehicle.refuels)) {
      rows.push([vehicle.name, refuel.date.replace('T', ' '), refuel.odometer,
        refuel.volume, refuel.cost, refuel.full ? 'Sì' : 'No', refuel.notes, vehicle.id, refuel.id]);
    }
  }
  return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n') + '\r\n';
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
