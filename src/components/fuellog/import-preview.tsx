"use client";

/**
 * Anteprima importazione: mostra il contenuto del file e fa scegliere
 * tra "Sovrascrivi tutto" e "Unisci ai dati esistenti".
 */

import { fmtInt } from "@/lib/fuel/format";

export interface ImportPreview {
  fileName: string;
  vehicles: number;
  refuels: number;
  skipped: number;
  unitSystem: "metric" | "imperial";
}

interface ImportPreviewProps {
  preview: ImportPreview;
  onChoose: (mode: "overwrite" | "merge") => void;
  onCancel: () => void;
}

export function ImportPreviewView({ preview, onChoose, onCancel }: ImportPreviewProps) {
  return (
    <>
      <div className="info-block">
        <h3>File caricato</h3>
        <div className="import-report">
          <span className="row">
            <span>File</span>
            <strong style={{ maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {preview.fileName}
            </strong>
          </span>
          <span className="row">
            <span>Veicoli validi</span>
            <strong>{fmtInt(preview.vehicles)}</strong>
          </span>
          <span className="row">
            <span>Rifornimenti</span>
            <strong>{fmtInt(preview.refuels)}</strong>
          </span>
          {preview.skipped > 0 ? (
            <span className="row">
              <span>Record scartati (non validi)</span>
              <strong>{fmtInt(preview.skipped)}</strong>
            </span>
          ) : null}
          <span className="row">
            <span>Unità nel file</span>
            <strong>{preview.unitSystem === "metric" ? "Metrica" : "Imperiale"}</strong>
          </span>
        </div>
      </div>

      <div className="info-block">
        <h3>Come importare?</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <button type="button" className="btn btn-danger btn-block" onClick={() => onChoose("overwrite")}>
            Sovrascrivi tutto
          </button>
          <p className="text-dim" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: -2 }}>
            Sostituisce integralmente i dati attuali con quelli del file.
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => onChoose("merge")}>
            Unisci ai dati esistenti
          </button>
          <p className="text-dim" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: -2 }}>
            I veicoli con lo stesso identificativo vengono fusi: i rifornimenti sono uniti senza
            duplicati (i record del file prevalgono su quelli locali con lo stesso id).
          </p>
        </div>
      </div>

      <button type="button" className="btn btn-secondary btn-block" onClick={onCancel}>
        Annulla importazione
      </button>
    </>
  );
}
