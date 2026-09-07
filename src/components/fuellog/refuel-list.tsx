"use client";

/**
 * Lista cronologica rifornimenti (dal più recente), con pulsanti
 * Modifica ed Elimina per ciascun elemento.
 * Nota XSS: note e nomi sono renderizzati come testo React (equivale
 * a textContent), mai come HTML.
 */

import type { Refuel, UnitSystem } from "@/lib/fuel/types";
import { sortRefuels } from "@/lib/fuel/types";
import { fmt, fmtDateShort, fmtTime, unitLabels } from "@/lib/fuel/format";
import { FuelIcon, ListIcon, PencilIcon, RotateIcon, TrashIcon } from "./icons";

interface RefuelListProps {
  refuels: Refuel[];
  unit: UnitSystem;
  /** id del rifornimento base del ciclo corrente (primo o ultimo "pieno") */
  baseId: string | null;
  editingId: string | null;
  onEdit: (refuel: Refuel) => void;
  onDelete: (refuel: Refuel) => void;
}

export function RefuelList({ refuels, unit, baseId, editingId, onEdit, onDelete }: RefuelListProps) {
  const L = unitLabels(unit);

  if (refuels.length === 0) {
    return (
      <div className="empty">
        <ListIcon width={34} height={34} />
        <h3>Nessun rifornimento</h3>
        <p>
          Usa il modulo qui sopra per registrare il primo rifornimento di questo veicolo. Il primo
          pieno fissa la base del calcolo.
        </p>
      </div>
    );
  }

  const sorted = sortRefuels(refuels);
  const reversed = [...sorted].reverse(); // dal più recente

  return (
    <div className="refuel-list" role="list" aria-label="Cronologia rifornimenti">
      {reversed.map((r) => {
        const isBase = r.id === baseId;
        const isEditing = r.id === editingId;
        return (
          <article
            key={r.id}
            className="refuel-item"
            role="listitem"
            style={isEditing ? { borderColor: "var(--accent-border)", background: "var(--surface-2)" } : undefined}
          >
            <div className="refuel-top">
              <span className="refuel-date">
                {fmtDateShort(r.date)}
                <span>{fmtTime(r.date)}</span>
              </span>
              {r.full ? <span className="badge-full">PIENO</span> : null}
            </div>

            <dl className="refuel-metrics">
              <div className="metric">
                <dt>{unit === "metric" ? "Odometro" : "Contamiglia"}</dt>
                <dd>
                  {fmt(r.odometer, 0)} {L.distance}
                </dd>
              </div>
              <div className="metric">
                <dt>Volume</dt>
                <dd>
                  {fmt(r.volume, 2)} {L.volume}
                </dd>
              </div>
              <div className="metric">
                <dt>Spesa</dt>
                <dd>
                  {fmt(r.cost, 2)} {L.currency}
                </dd>
              </div>
            </dl>

            {r.notes ? <p className="refuel-notes">{r.notes}</p> : null}

            {isBase ? (
              <p className="refuel-base-note">
                <RotateIcon width={13} height={13} />
                Ultimo pieno: riferimento per il prossimo intervallo. La media totale resta conservata.
              </p>
            ) : null}

            <div className="refuel-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onEdit(r)}
                aria-label={`Modifica rifornimento del ${fmtDateShort(r.date)}`}
              >
                <PencilIcon width={15} height={15} />
                Modifica
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => onDelete(r)}
                aria-label={`Elimina rifornimento del ${fmtDateShort(r.date)}`}
              >
                <TrashIcon width={15} height={15} />
                Elimina
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
