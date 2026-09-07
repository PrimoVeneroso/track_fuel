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
  full: false,
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

  const [price, setPrice] = useState<string>(() =>
    editing && editing.volume > 0 ? (editing.cost / editing.volume).toFixed(3).replace('.', ',') : ""
  );

  const parseNum = (s: string) => {
    if (!s) return NaN;
    return parseFloat(s.replace(',', '.'));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    set("volume", val);
    const v = parseNum(val);
    const c = parseNum(draft.cost);
    const p = parseNum(price);
    
    if (!isNaN(v) && v > 0 && !isNaN(c) && c > 0) {
      setPrice((c / v).toFixed(3).replace('.', ','));
    } else if (!isNaN(v) && v > 0 && !isNaN(p) && p > 0) {
      set("cost", (v * p).toFixed(2).replace('.', ','));
    }
  };

  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    set("cost", val);
    const c = parseNum(val);
    const v = parseNum(draft.volume);
    const p = parseNum(price);
    
    if (!isNaN(c) && c > 0 && !isNaN(p) && p > 0 && isNaN(v)) {
      set("volume", (c / p).toFixed(2).replace('.', ','));
    } else if (!isNaN(c) && c > 0 && !isNaN(v) && v > 0) {
      setPrice((c / v).toFixed(3).replace('.', ','));
    } else if (!isNaN(c) && c > 0 && !isNaN(p) && p > 0) {
      // Se abbiamo tutti e tre, l'utente sta aggiornando la spesa, ricalcoliamo i litri per coerenza
      set("volume", (c / p).toFixed(2).replace('.', ','));
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPrice(val);
    const p = parseNum(val);
    const c = parseNum(draft.cost);
    const v = parseNum(draft.volume);

    if (!isNaN(p) && p > 0 && !isNaN(c) && c > 0) {
      set("volume", (c / p).toFixed(2).replace('.', ','));
    } else if (!isNaN(p) && p > 0 && !isNaN(v) && v > 0) {
      set("cost", (v * p).toFixed(2).replace('.', ','));
    }
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
      setDraft(emptyDraft());
      setPrice("");
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
          <label htmlFor="rf-price">
            Prezzo al {unit === "metric" ? "litro" : "gallone"}
            <span className="lbl-hint">{L.currency}/{L.volume}</span>
          </label>
          <input
            id="rf-price"
            className="input"
            type="text"
            inputMode="decimal"
            placeholder={unit === "metric" ? "es. 1,859" : "es. 3,50"}
            value={price}
            onChange={handlePriceChange}
            autoComplete="off"
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
            onChange={handleVolumeChange}
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
            onChange={handleCostChange}
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
              Spunta se hai riempito il serbatoio. La media si aggiorna comunque e non si azzera.
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
