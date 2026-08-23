"use client";

/**
 * Modale "Veicoli": aggiunta, selezione, rinomina, eliminazione.
 * Ogni veicolo possiede registro e statistiche isolati.
 */

import { useState } from "react";
import type { Vehicle } from "@/lib/fuel/types";
import { computeStats } from "@/lib/fuel/calc";
import { fmt, unitLabels } from "@/lib/fuel/format";
import { CarIcon, CheckIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from "./icons";

interface VehiclesModalProps {
  onClose: () => void;
  vehicles: Vehicle[];
  activeVehicleId: string | null;
  unit: "metric" | "imperial";
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onSelect: (id: string) => void;
  onDelete: (vehicle: Vehicle) => void;
}

export function VehiclesModal({
  onClose,
  vehicles,
  activeVehicleId,
  unit,
  onAdd,
  onRename,
  onSelect,
  onDelete,
}: VehiclesModalProps) {
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Nota: la modale monta fresca a ogni apertura (il contenitore restituisce
  // null quando chiuso), quindi lo stato è già azzerato.

  const L = unitLabels(unit);

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (name.length === 0) {
      setNameError("Inserisci un nome per il veicolo.");
      return;
    }
    if (name.length > 30) {
      setNameError("Massimo 30 caratteri.");
      return;
    }
    if (vehicles.some((v) => v.name.toLowerCase() === name.toLowerCase())) {
      setNameError("Esiste già un veicolo con questo nome.");
      return;
    }
    onAdd(name);
    setNewName("");
    setNameError(null);
  };

  const submitRename = (id: string) => {
    const name = renameValue.trim();
    if (name.length === 0 || name.length > 30) return;
    onRename(id, name);
    setRenamingId(null);
  };

  return (
    <>
      <div className="modal-body">
        <form className="field" onSubmit={submitAdd} noValidate>
          <label htmlFor="new-vehicle-name">Aggiungi veicolo</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="new-vehicle-name"
              className="input"
              type="text"
              placeholder="es. Panda, Golf, Ducato…"
              value={newName}
              maxLength={30}
              onChange={(e) => {
                setNewName(e.target.value);
                setNameError(null);
              }}
              autoComplete="off"
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ minWidth: 52, minHeight: 48, padding: 0, flex: "none" }}
              aria-label="Aggiungi veicolo"
            >
              <PlusIcon width={19} height={19} />
            </button>
          </div>
          {nameError ? (
            <p className="form-error" role="alert">
              {nameError}
            </p>
          ) : null}
        </form>

        {vehicles.length === 0 ? (
          <div className="empty">
            <CarIcon width={30} height={30} />
            <p>Nessun veicolo registrato.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {vehicles.map((v) => {
              const stats = computeStats(v.refuels, unit);
              const isActive = v.id === activeVehicleId;
              return (
                <div key={v.id} className="vehicle-row" data-active={isActive}>
                  {renamingId === v.id ? (
                    <>
                      <input
                        className="input"
                        style={{ flex: 1, minHeight: 44 }}
                        value={renameValue}
                        maxLength={30}
                        autoFocus
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitRename(v.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        aria-label={`Nuovo nome per ${v.name}`}
                      />
                      <button
                        type="button"
                        className="mini-btn"
                        onClick={() => submitRename(v.id)}
                        aria-label="Conferma rinomina"
                      >
                        <CheckIcon width={16} height={16} />
                      </button>
                      <button
                        type="button"
                        className="mini-btn"
                        onClick={() => setRenamingId(null)}
                        aria-label="Annulla rinomina"
                      >
                        <XIcon width={16} height={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="vehicle-row-info">
                        <span className="vehicle-row-name">{v.name}</span>
                        <span className="vehicle-row-meta">
                          {stats ? `${stats.count} rifornimenti · ${fmt(stats.totalCost, 2)} ${L.currency}` : "Registro vuoto"}
                        </span>
                      </div>
                      {isActive ? <span className="active-pill">ATTIVO</span> : null}
                      <div className="vehicle-row-actions">
                        {!isActive ? (
                          <button
                            type="button"
                            className="mini-btn"
                            onClick={() => onSelect(v.id)}
                            aria-label={`Rendi attivo ${v.name}`}
                            title="Rendi attivo"
                          >
                            <CheckIcon width={16} height={16} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="mini-btn"
                          onClick={() => {
                            setRenamingId(v.id);
                            setRenameValue(v.name);
                          }}
                          aria-label={`Rinomina ${v.name}`}
                        >
                          <PencilIcon width={16} height={16} />
                        </button>
                        <button
                          type="button"
                          className="mini-btn danger"
                          onClick={() => onDelete(v)}
                          aria-label={`Elimina ${v.name}`}
                        >
                          <TrashIcon width={16} height={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Chiudi
        </button>
      </div>
    </>
  );
}
