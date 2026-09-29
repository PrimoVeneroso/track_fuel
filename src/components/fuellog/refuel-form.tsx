"use client";

/**
 * Modulo inserimento/modifica rifornimento.
 * Tastiera numerica (inputmode="decimal"), etichette dinamiche
 * in base all'unità di misura, validazione con messaggi inline.
 */

import { useRef, useState } from "react";
import type { Refuel, UnitSystem, Vehicle } from "@/lib/fuel/types";
import { sortRefuels } from "@/lib/fuel/types";
import { fmt, nowDatetimeLocalValue, unitLabels } from "@/lib/fuel/format";
import { MAX_NOTES_LENGTH, parseDecimal, validateRefuel, type RefuelDraft } from "@/lib/fuel/validation";
import { chooseAnchorAndDerived, deriveValue, type NumField } from "@/lib/fuel/recalc";
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

  // Stessa semantica della validazione al submit (fonte unica in validation.ts)
  const parseNum = (s: string) => parseDecimal(s) ?? NaN;

  /* ------------------------------------------------------------------ */
  /* Ricalcolo dinamico — opzione A "Smart Dependency".                 */
  /* I tre campi sono vincolati da  spesa = litri × prezzo.             */
  /* Quando l'utente modifica un campo, ricalcoliamo SOLO il terzo      */
  /* campo, usando come riferimento (ancora) l'altro campo che          */
  /* l'utente ha toccato per ultimo. Il campo in corso di modifica e    */
  /* l'ancora non vengono MAI sovrascritti: correggere un valore        */
  /* digitato male non produce più conflitti di sovrascrittura.        */
  /* ------------------------------------------------------------------ */
  const touchOrder = useRef<Record<NumField, number>>({ volume: 0, cost: 0, price: 0 });
  const touchTick = useRef(0);

  const markTouched = (f: NumField) => {
    touchTick.current += 1;
    touchOrder.current[f] = touchTick.current;
  };

  const resetTouch = () => {
    touchTick.current = 0;
    touchOrder.current = { volume: 0, cost: 0, price: 0 };
  };

  const fieldValue = (f: NumField): string =>
    f === "price" ? price : f === "volume" ? draft.volume : draft.cost;

  const setFieldValue = (f: NumField, s: string) => {
    if (f === "price") setPrice(s);
    else if (f === "volume") set("volume", s);
    else set("cost", s);
  };

  const fmtNum = (n: number, digits: number) => n.toFixed(digits).replace(".", ",");

  const recalc = (edited: NumField, editedValue: number) => {
    const isValid = (f: NumField) => {
      const n = parseNum(fieldValue(f));
      return Number.isFinite(n) && n > 0;
    };
    const { anchor, derived } = chooseAnchorAndDerived(edited, touchOrder.current, isValid);
    // Valori correnti: il campo modificato usa il valore appena digitato
    // (lo stato React si aggiorna in modo asincrono, quindi draft/price
    // nella chiusura non lo rifletterebbero ancora).
    const val = (f: NumField) => (f === edited ? editedValue : parseNum(fieldValue(f)));
    const res = deriveValue(derived, {
      volume: val("volume"),
      cost: val("cost"),
      price: val("price"),
    });
    if (!res) return;
    // Non riscrivere se il campo derivato è già coerente: evita ritocchi
    // e riformattazioni inutili (es. "50" → "50,00") a ogni tasto.
    const cur = parseNum(fieldValue(derived));
    if (cur !== null && Math.abs(cur - res.value) < 1e-9) return;
    setFieldValue(derived, fmtNum(res.value, res.digits));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    set("volume", val);
    markTouched("volume");
    recalc("volume", parseNum(val));
  };

  const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    set("cost", val);
    markTouched("cost");
    recalc("cost", parseNum(val));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPrice(val);
    markTouched("price");
    recalc("price", parseNum(val));
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
      resetTouch();
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
