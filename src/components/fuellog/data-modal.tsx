"use client";

/**
 * Modale "Dati": esportazione JSON/CSV/TSV, importazione JSON/CSV/TSV,
 * reset totale, informazioni sul motore di calcolo e sulla privacy.
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
  onExportTsv: () => void;
  onCopyJSON: () => void;
  onImportFile: (file: File) => void;
  onResetAll: () => void;
  /** messaggi di errore coerenti con il resto dell'app (toast) */
  onError: (message: string) => void;
}

export function DataModal({ open, onClose, data, settings, onExport, onExportCsv, onExportTsv, onCopyJSON, onImportFile, onResetAll, onError }: DataModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const totalRefuels = data.vehicles.reduce((s, v) => s + v.refuels.length, 0);

  const pasteJson = async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      onError("Impossibile leggere dagli appunti. Usa il caricamento da file.");
      return;
    }
    if (!text.trim()) {
      onError("Gli appunti sono vuoti: copia prima il backup JSON.");
      return;
    }
    const file = new File([text], "appunti-backup.json", { type: "application/json" });
    onImportFile(file);
  };

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
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 10 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, minWidth: '200px' }} onClick={onExportCsv} disabled={totalRefuels === 0}>
                <DownloadIcon width={18} height={18} />
                Esporta storico CSV (Excel)
              </button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, minWidth: '200px' }} onClick={onExportTsv} disabled={totalRefuels === 0}>
                <DownloadIcon width={18} height={18} />
                Esporta storico TSV
              </button>
            </div>
            <p style={{marginTop: 10}}>
              CSV/TSV contengono tutti i rifornimenti (con prezzo per unità) e si aprono in Excel,
              LibreOffice o in altri programmi. Per ripristinare l&apos;app usa il backup JSON.
              Il CSV usa separatori e decimali italiani per Excel; il TSV usa tab e decimali con
              punto per l&apos;uso tecnico. Entrambi si creano offline.
            </p>
          </div>

          <div className="info-block">
            <h3>
              <UploadIcon width={15} height={15} />
              Importazione
            </h3>
            <p>
              Carica un backup JSON (<code>fuellog-backup-*.json</code>) oppure un file
              <strong> CSV/TSV</strong> (esportato da questo programma o creato in Excel) con le
              colonne <em>Veicolo, Data e ora, Odometro, Volume, Spesa</em> (facoltative:
              Serbatoio pieno, Note, ID). Potrai scegliere se <strong>sovrascrivere</strong> i dati
              locali o <strong>unirli</strong>.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.csv,.tsv,application/json,text/csv,text/tab-separated-values,.txt"
              className="sr-only"
              aria-label="File da importare (JSON, CSV o TSV)"
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
                Importa file JSON, CSV o TSV
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, minWidth: '200px' }}
                onClick={pasteJson}
              >
                📋 Incolla JSON
              </button>
            </div>
            <p style={{marginTop: 10}}>
              Nei file CSV/TSV i valori sono interpretati con le unità attualmente attive
              ({settings.unitSystem === "metric" ? "metriche" : "imperiali"}): il file non contiene
              informazioni sulle unità.
            </p>
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
