"use client";

/**
 * Modale "Dati": esportazione/importazione JSON, reset totale,
 * informazioni sul motore di calcolo e sulla privacy.
 */

import { useRef, useState } from "react";
import type { AppSettings, VehiclesData } from "@/lib/fuel/types";
import { fmtInt } from "@/lib/fuel/format";
import { DatabaseIcon, DownloadIcon, LockIcon, RotateIcon, UploadIcon } from "./icons";
import { Modal } from "./modal";
import { ConfirmView } from "./confirm-view";

interface DataModalProps {
  open: boolean;
  onClose: () => void;
  data: VehiclesData;
  settings: AppSettings;
  onExport: () => void;
  onExportCsv: () => void;
  onCopyJSON: () => void;
  onImportFile: (file: File) => void;
  onResetAll: () => void;
}

export function DataModal({ open, onClose, data, settings, onExport, onExportCsv, onCopyJSON, onImportFile, onResetAll }: DataModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const totalRefuels = data.vehicles.reduce((s, v) => s + v.refuels.length, 0);

  return (
    <Modal
      open={open}
      onClose={() => {
        setConfirmReset(false);
        onClose();
      }}
      title="Dati e backup"
      icon={<DatabaseIcon width={19} height={19} />}
    >
      {confirmReset ? (
        <ConfirmView
          danger
          title="Eliminare tutti i dati?"
          message={`Verranno cancellati ${fmtInt(data.vehicles.length)} veicoli e ${fmtInt(totalRefuels)} rifornimenti da questo dispositivo. L'operazione non è reversibile: esporta prima un backup se intendi conservare i dati.`}
          confirmLabel="Elimina tutto"
          onConfirm={() => {
            setConfirmReset(false);
            onResetAll();
          }}
          onCancel={() => setConfirmReset(false)}
        />
      ) : (
        <>
          <div className="info-block">
            <h3>
              <DownloadIcon width={15} height={15} />
              Esportazione
            </h3>
            <p>
              Salva una copia completa di tutti i dati (incluse le impostazioni come
              unità {settings.unitSystem === "metric" ? "metrica" : "imperiale"}).
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, minWidth: '200px' }}
                onClick={onExport}
                disabled={data.vehicles.length === 0}
              >
                <DownloadIcon width={18} height={18} />
                Esporta backup JSON
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, minWidth: '200px' }}
                onClick={onCopyJSON}
                disabled={data.vehicles.length === 0}
              >
                📋 Copia JSON
              </button>
            </div>
            <button type="button" className="btn btn-secondary btn-block" style={{marginTop: 10}} onClick={onExportCsv} disabled={totalRefuels === 0}>
              <DownloadIcon width={18} height={18} />
              Esporta storico CSV (Excel)
            </button>
            <p style={{marginTop: 10}}>Il CSV contiene tutti i rifornimenti ed è adatto a Excel e LibreOffice. Per ripristinare l’app usa il backup JSON. Entrambi si creano offline.</p>
          </div>

          <div className="info-block">
            <h3>
              <UploadIcon width={15} height={15} />
              Importazione
            </h3>
            <p>
              Carica o incolla un JSON di backup <code>fuellog-backup-*.json</code>: potrai scegliere se
              <strong> sovrascrivere</strong> i dati locali o <strong>unirli</strong> (i veicoli con
              lo stesso id vengono fusi).
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="File di backup JSON da importare"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportFile(file);
                e.target.value = "";
              }}
            />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, minWidth: '200px' }}
                onClick={() => fileRef.current?.click()}
              >
                <UploadIcon width={18} height={18} />
                Importa da file JSON
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, minWidth: '200px' }}
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (!text || !text.includes('vehicles')) {
                      alert('Gli appunti non sembrano contenere un backup JSON valido.');
                      return;
                    }
                    const file = new File([text], 'appunti-backup.json', { type: 'application/json' });
                    onImportFile(file);
                  } catch (e) {
                    alert('Impossibile leggere dagli appunti. Prova a usare il caricamento da file.');
                  }
                }}
              >
                📋 Incolla JSON
              </button>
            </div>
          </div>

          <div className="info-block">
            <h3>
              <RotateIcon width={15} height={15} />
              Azzeramento
            </h3>
            <p>Elimina veicoli e rifornimenti da questo dispositivo e ripristina lo stato iniziale.</p>
            <button
              type="button"
              className="btn btn-danger btn-block"
              onClick={() => setConfirmReset(true)}
              disabled={data.vehicles.length === 0}
            >
              <RotateIcon width={18} height={18} />
              Cancella tutti i dati
            </button>
          </div>

          <div className="info-block">
            <h3>
              <LockIcon width={15} height={15} />
              Privacy e offline
            </h3>
            <p>
              Tutti i dati risiedono nel database locale <code>IndexedDB</code> di questo
              dispositivo (i vecchi dati <code>localStorage</code> vengono migrati automaticamente
              al primo avvio e rimossi solo con l&apos;azzeramento esplicito). Nessuna telemetria,
              nessun server, nessuna richiesta a cloud o CDN: l&apos;app funziona completamente
              offline.
            </p>
          </div>
        </>
      )}
    </Modal>
  );
}

export type { ImportPreview } from "./import-preview";
