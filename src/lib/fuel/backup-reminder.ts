import type { VehiclesData } from './types';

export interface BackupReminderState {
  lastBackupAt: number;
  snoozedUntil: number;
  fingerprint: string;
}
export const REMINDER_KEY = 'fuellog_backup_reminder';
export const DAY = 24 * 60 * 60 * 1000;

export function dataFingerprint(data: VehiclesData): string {
  // Solo contenuto dell'archivio: cambiare veicolo attivo non richiede un backup.
  const text = JSON.stringify(data.vehicles);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `${text.length}:${hash >>> 0}`;
}

export function backupReminderDue(state: BackupReminderState, fingerprint: string, now: number): boolean {
  return fingerprint !== state.fingerprint && now >= state.snoozedUntil &&
    (state.lastBackupAt === 0 || now - state.lastBackupAt >= 30 * DAY);
}

export function loadBackupReminder(): BackupReminderState {
  const empty = {lastBackupAt: 0, snoozedUntil: 0, fingerprint: ''};
  try {
    const raw = JSON.parse(localStorage.getItem(REMINDER_KEY) ?? 'null');
    if (!raw || !Number.isFinite(raw.lastBackupAt) || !Number.isFinite(raw.snoozedUntil) || typeof raw.fingerprint !== 'string') return empty;
    return raw;
  } catch { return empty; }
}
