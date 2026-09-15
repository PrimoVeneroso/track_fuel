"use client";

/**
 * Anteprima importazione: mostra il contenuto del file (JSON, CSV o TSV)
 * e fa scegliere tra "Sovrascrivi tutto" e "Unisci ai dati esistenti".
 */

import { fmtInt } from "@/lib/fuel/format";

export interface ImportPreview {
  fileName: string;
  vehicles: number;
  refuels: number;
  skipped: number;
  unitSystem: "metric" | "imperial";
  /** "json" (backup con unità nel file) oppure "csv" (unità = quelle attive nell'app) */
  source?: "json" | "csv";
  delimiter?: string;
  /** unità attive nell'app al momento dell'import (per il avviso di cambio unità) */
  currentUnit?: "metric" | "imperial";
}

const DELIMITER_SYMBOL: Record<string, string> = { ";": "punto e virgola (;)", "\t": "tab", ",": "virgola (,)", "|": "pipe (|)" };

interface ImportPreviewProps {
  preview: ImportPreview;
  onChoose: (mode: "overwrite" | "merge") => void;
  onCancel: () => void;
}

export function ImportPreviewView({ preview, onChoose, onCancel }: ImportPreviewProps) {
  const isCsv = preview.source === "csv";
  const unitMismatch = !isCsv && preview.currentUnit !== undefined && preview.currentUnit !== preview.unitSystem;
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
            <span>Formato</span>
            <strong>{isCsv ? "CSV/TSV" : "Backup JSON"}</strong>
          </span>
          {isCsv && preview.delimiter ? (
            <span className="row">
              <span>Separatore</span>
              <strong>{DELIMITER_SYMBOL[preview.delimiter] ?? preview.delimiter}</strong>
            </span>
          ) : null}
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
            <span>{isCsv ? "Unità di lettura" : "Unità nel file"}</span>
            <strong>{preview.unitSystem === "metric" ? "Metrica" : "Imperiale"}</strong>
          </span>
        </div>
        {isCsv ? (
          <p className="text-dim" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 8 }}>
            I valori del file sono interpretati con le unità indicate sopra (quelle attive nell'app):
            un file metrico importato con l&apos;app in unità imperiali produrrebbe valori incoerenti.
          </p>
        ) : null}
        {unitMismatch ? (
          <p style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 8, color: "var(--red, #ff5f5f)" }}>
            ⚠ Attenzione: le unità del file ({preview.unitSystem === "metric" ? "metriche" : "imperiali"})
            differiscono da quelle attive nell&apos;app. Con &quot;Sovrascrivi&quot; l&apos;app adotterà
            le unità del file e tutti i valori verranno ri-interpretati di conseguenza.
          </p>
        ) : null}
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
            {isCsv
              ? "I veicoli vengono uniti per nome (senza distinzione tra maiuscole e minuscole): i rifornimenti con lo stesso ID vengono aggiornati, gli altri aggiunti, i record identici non si duplicano."
              : "I veicoli con lo stesso identificativo vengono fusi: i rifornimenti sono uniti senza duplicati (i record del file prevalgono su quelli locali con lo stesso id)."}
          </p>
        </div>
      </div>

      <button type="button" className="btn btn-secondary btn-block" onClick={onCancel}>
        Annulla importazione
      </button>
    </>
  );
}
