"use client";

import { useEffect, useMemo, useState } from 'react';
import type { VehiclesData } from '@/lib/fuel/types';
import { backupReminderDue, dataFingerprint, DAY, loadBackupReminder, REMINDER_KEY } from '@/lib/fuel/backup-reminder';

// Montato dopo il caricamento dell'archivio: nessun accesso allo storage durante SSR.
export function BackupReminder({ data, onExport }: {
  data: VehiclesData; onExport: () => void;
}) {
  const [state, setState] = useState(loadBackupReminder);
  const [now, setNow] = useState(Date.now);
  const fingerprint = useMemo(() => dataFingerprint(data), [data]);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => {
    // La notifica è emessa solo dopo l'avvio riuscito del download JSON.
    const exported = () => setState(loadBackupReminder());
    window.addEventListener('fuellog:backup', exported);
    return () => window.removeEventListener('fuellog:backup', exported);
  }, []);
  const due = data.vehicles.some(vehicle => vehicle.refuels.length > 0) && backupReminderDue(state, fingerprint, now);
  if (!due) return null;
  return <aside className="panel" aria-label="Promemoria backup">
    <h2>Conserva una copia dello storico</h2>
    <p style={{margin: '10px 0'}}>I dati sono su questo dispositivo. {state.lastBackupAt ? 'Sono passati almeno 30 giorni dall’ultimo backup e lo storico è cambiato.' : 'Non risulta ancora un backup JSON.'} Salva il file in una cartella a tua scelta, anche senza internet.</p>
    <div className="btn-row">
      <button type="button" className="btn btn-primary" onClick={onExport}>Esporta backup JSON</button>
      <button type="button" className="btn btn-secondary" onClick={() => {
        const next = {...state, snoozedUntil: Date.now() + 7 * DAY};
        setState(next);
        try { localStorage.setItem(REMINDER_KEY, JSON.stringify(next)); } catch { /* resta valido per questa sessione */ }
      }}>Ricordamelo tra 7 giorni</button>
    </div>
    <p className="text-dim" style={{marginTop: 10}}>Promemoria solo nell’app, senza notifiche esterne. Il browser potrebbe chiederti dove salvare: completa il salvataggio del file.</p>
  </aside>;
}
