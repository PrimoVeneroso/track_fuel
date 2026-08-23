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
import type { ImportPreview } from "./import-preview";

interface DataModalProps {
  open: boolean;
  onClose: () => void;
  data: VehiclesData;
  settings: AppSettings;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onResetAll: () => void;
}

export function DataModal({ open, onClose, data, settings, onExport, onImportFile, onResetAll }: DataModalProps) {
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
              Scarica tutti i veicoli, i rifornimenti e le impostazioni in un singolo file JSON
              locale ({fmtInt(data.vehicles.length)} veicoli · {fmtInt(totalRefuels)} rifornimenti ·
              unità {settings.unitSystem === "metric" ? "metrica" : "imperiale"}).
            </p>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={onExport}
              disabled={data.vehicles.length === 0}
            >
              <DownloadIcon width={18} height={18} />
              Esporta backup JSON
            </button>
          </div>

          <div className="info-block">
            <h3>
              <UploadIcon width={15} height={15} />
              Importazione
            </h3>
            <p>
              Carica un file di backup <code>fuellog-backup-*.json</code>: potrai scegliere se
              <strong> sovrascrivere</strong> i dati locali o <strong>unirli</strong> (i veicoli con
              lo stesso nome/id vengono fusi).
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
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => fileRef.current?.click()}
            >
              <UploadIcon width={18} height={18} />
              Importa da file JSON
            </button>
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
              Tutti i dati restano nel <code>localStorage</code> di questo dispositivo
              (<code>vehicles_data</code>, <code>app_settings</code>). Nessuna telemetria, nessun
              server, nessuna richiesta a cloud o CDN: l&apos;app funziona completamente offline.
            </p>
          </div>
        </>
      )}
    </Modal>
  );
}

export type { ImportPreview };
