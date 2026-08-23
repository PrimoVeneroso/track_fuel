"use client";

/**
 * Modulo inserimento/modifica rifornimento.
 * Tastiera numerica (inputmode="decimal"), etichette dinamiche
 * in base all'unità di misura, validazione con messaggi inline.
 */

import { useState } from "react";
import type { Refuel, UnitSystem, Vehicle } from "@/lib/fuel/types";
import { sortRefuels } from "@/lib/fuel/types";
import { fmt, nowDatetimeLocalValue, unitLabels } from "@/lib/fuel/format";
import { MAX_NOTES_LENGTH, validateRefuel, type RefuelDraft } from "@/lib/fuel/validation";
import { AlertIcon, CheckIcon, FuelIcon, PencilIcon, XIcon } from "./icons";

export interface FormValue {
  date: string;
  odometer: number;
  volume: number;
  cost: number;
  full: boolean;
  notes: string;
}

interface RefuelFormProps {
  vehicle: Vehicle | null;
  unit: UnitSystem;
  editing: Refuel | null;
  onSubmit: (value: FormValue) => void;
  onCancelEdit: () => void;
  onError: (message: string) => void;
}

const emptyDraft = (): RefuelDraft => ({
  date: nowDatetimeLocalValue(),
  odometer: "",
  volume: "",
  cost: "",
  full: true,
  notes: "",
});

const draftFromRefuel = (r: Refuel): RefuelDraft => ({
  date: r.date.slice(0, 16),
  odometer: String(r.odometer),
  volume: String(r.volume),
  cost: String(r.cost),
  full: r.full,
  notes: r.notes,
});

export function RefuelForm({ vehicle, unit, editing, onSubmit, onCancelEdit, onError }: RefuelFormProps) {
  const L = unitLabels(unit);
  // Stato inizializzato dal valore in modifica; il reset avviene per chiave
  // ("key" assegnato dal genitore) quando cambia veicolo o rifornimento in modifica.
  const [draft, setDraft] = useState<RefuelDraft>(() =>
    editing ? draftFromRefuel(editing) : emptyDraft()
  );
  const [error, setError] = useState<string | null>(null);

  const lastRefuel = vehicle
    ? sortRefuels(vehicle.refuels)[vehicle.refuels.length - 1] ?? null
    : null;

  const set = <K extends keyof RefuelDraft>(key: K, value: RefuelDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicle) {
      onError("Prima crea o seleziona un veicolo.");
      return;
    }
    const result = validateRefuel(draft, vehicle.refuels, editing?.id ?? null, {
      distance: L.distance,
    });
    if (!result.ok) {
      setError(result.error);
      onError(result.error);
      return;
    }
    onSubmit({
      date: result.value.date,
      odometer: result.value.odometer,
      volume: result.value.volume,
      cost: result.value.cost,
      full: result.value.full,
      notes: result.value.notes,
    });
    if (!editing) {
      setDraft({ ...emptyDraft(), full: draft.full });
      setError(null);
    }
  };

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate aria-label="Modulo rifornimento">
      <div className="panel-head">
        <h2>
          {editing ? <PencilIcon width={18} height={18} /> : <FuelIcon width={18} height={18} />}
          {editing ? "Modifica rifornimento" : "Nuovo rifornimento"}
        </h2>
        {editing ? (
          <button type="button" className="btn-ghost-sm" onClick={onCancelEdit}>
            Annulla modifica
          </button>
        ) : null}
      </div>

      <div className="field-grid">
        <div className="field field-wide">
          <label htmlFor="rf-date">
            Data e ora
            <span className="lbl-hint">predefinita: adesso</span>
          </label>
          <input
            id="rf-date"
            className="input"
            type="datetime-local"
            inputMode="numeric"
            value={draft.date}
            max="9999-12-31T23:59"
            onChange={(e) => set("date", e.target.value)}
            required
          />
        </div>

        <div className="field field-wide">
          <label htmlFor="rf-odo">
            {unit === "metric" ? "Chilometraggio totale" : "Contamiglia totale"}
            <span className="lbl-hint">
              {lastRefuel
                ? `ultimo: ${fmt(lastRefuel.odometer, 0)} ${L.distance}`
                : `in ${L.distance}`}
            </span>
          </label>
          <input
            id="rf-odo"
            className="input"
            type="text"
            inputMode="decimal"
            placeholder={unit === "metric" ? "es. 128450" : "es. 79800"}
            value={draft.odometer}
            onChange={(e) => set("odometer", e.target.value)}
            autoComplete="off"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="rf-vol">
            {L.volumeLong}
            <span className="lbl-hint">{L.volume}</span>
          </label>
          <input
            id="rf-vol"
            className="input"
            type="text"
            inputMode="decimal"
            placeholder={unit === "metric" ? "es. 32,5" : "es. 8,6"}
            value={draft.volume}
            onChange={(e) => set("volume", e.target.value)}
            autoComplete="off"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="rf-cost">
            Spesa totale
            <span className="lbl-hint">{L.currency}</span>
          </label>
          <input
            id="rf-cost"
            className="input"
            type="text"
            inputMode="decimal"
            placeholder={unit === "metric" ? "es. 58,90" : "es. 34,20"}
            value={draft.cost}
            onChange={(e) => set("cost", e.target.value)}
            autoComplete="off"
            required
          />
        </div>

        <button
          type="button"
          className="check-row field-wide"
          data-checked={draft.full}
          role="checkbox"
          aria-checked={draft.full}
          onClick={() => set("full", !draft.full)}
          style={{ gridColumn: "1 / -1" }}
        >
          <span className="check-box" aria-hidden="true">
            <CheckIcon width={15} height={15} strokeWidth={3.2} />
          </span>
          <span className="check-text">
            <span className="check-title">Serbatoio pieno</span>
            <span className="check-desc">
              {editing?.id && lastRefuel && editing.id === lastRefuel.id
                ? "Riempi fino all'orlo: azzererà il ciclo di calcolo"
                : "Spunta per azzerare il ciclo: questo rifornimento diventa la nuova base"}
            </span>
          </span>
        </button>

        <div className="field field-wide">
          <label htmlFor="rf-notes">
            Note <span className="lbl-hint">opzionale · max {MAX_NOTES_LENGTH}</span>
          </label>
          <textarea
            id="rf-notes"
            className="textarea"
            rows={2}
            placeholder="es. autostrada, gomme nuove, sconto..."
            value={draft.notes}
            maxLength={MAX_NOTES_LENGTH}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          <AlertIcon width={16} height={16} />
          {error}
        </p>
      ) : null}

      <div className="btn-row">
        {editing ? (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                onCancelEdit();
              }}
            >
              <XIcon width={17} height={17} />
              Annulla
            </button>
            <button type="submit" className="btn btn-primary">
              <CheckIcon width={18} height={18} />
              Salva modifiche
            </button>
          </>
        ) : (
          <button type="submit" className="btn btn-primary btn-block">
            <FuelIcon width={19} height={19} />
            Registra rifornimento
          </button>
        )}
      </div>
    </form>
  );
}
