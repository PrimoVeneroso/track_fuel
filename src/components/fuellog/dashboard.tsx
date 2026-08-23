"use client";

/**
 * Cruscotto statistiche: le etichette riflettono l'unità attiva.
 * Consumo medio (km/l | mpg), secondario (l/100km, solo metrico),
 * costo per unità distanza, spesa totale, percorrenza totale.
 */

import type { UnitSystem, Vehicle, VehicleStats } from "@/lib/fuel/types";
import { fmt, fmtDateShort, unitLabels } from "@/lib/fuel/format";
import { CoinsIcon, GaugeIcon, RotateIcon, RouteIcon, WalletIcon } from "./icons";

interface DashboardProps {
  vehicle: Vehicle | null;
  stats: VehicleStats | null;
  unit: UnitSystem;
}

export function Dashboard({ vehicle, stats, unit }: DashboardProps) {
  const L = unitLabels(unit);

  if (!vehicle) {
    return (
      <div className="empty">
        <RouteIcon width={34} height={34} />
        <h3>Nessun veicolo</h3>
        <p>
          Crea il primo veicolo per iniziare a registrare i rifornimenti. Ogni veicolo ha un
          registro e delle statistiche isolati.
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="empty">
        <GaugeIcon width={34} height={34} />
        <h3>Registro vuoto</h3>
        <p>
          Registra il primo rifornimento: fissa distanza e volume iniziali e non entra nel calcolo
          del consumo (serbatoio riempito da vuoto).
        </p>
      </div>
    );
  }

  const lastRefuel = [...vehicle.refuels].sort((a, b) =>
    a.date === b.date ? (a.createdAt < b.createdAt ? -1 : 1) : a.date < b.date ? -1 : 1
  )[stats.count - 1];

  return (
    <section aria-label="Cruscotto statistiche" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="dash-grid">
        <div className="stat-card hero">
          <span className="stat-label">
            <GaugeIcon width={14} height={14} />
            Consumo medio
          </span>
          <span className="stat-value">
            {stats.hasConsumption ? fmt(stats.primaryConsumption, 2) : "—"}
            <span className="stat-unit">{L.consumptionPrimary}</span>
          </span>
          <span className="stat-sub">
            {stats.hasConsumption
              ? `Ciclo corrente · ${stats.cycleCount} ${stats.cycleCount === 1 ? "rifornimento" : "rifornimenti"} · ${fmt(stats.cycleVolume, 1)} ${L.volume}`
              : stats.cycleCount === 0
                ? "Nuovo ciclo iniziato: in attesa del primo rifornimento parziale"
                : "Servono distanza e volume per calcolare il consumo"}
          </span>
        </div>

        {L.consumptionSecondary ? (
          <div className="stat-card">
            <span className="stat-label">Consumo secondario</span>
            <span className="stat-value" style={{ fontSize: 22 }}>
              {stats.secondaryConsumption !== null ? fmt(stats.secondaryConsumption, 2) : "—"}
              <span className="stat-unit">{L.consumptionSecondary}</span>
            </span>
          </div>
        ) : null}

        <div className="stat-card">
          <span className="stat-label">
            <CoinsIcon width={14} height={14} />
            Costo / {L.distance}
          </span>
          <span className="stat-value" style={{ fontSize: 22 }}>
            {stats.costPerDistance !== null ? fmt(stats.costPerDistance, 3) : "—"}
            <span className="stat-unit">
              {L.currency}/{L.distance}
            </span>
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            <WalletIcon width={14} height={14} />
            Spesa totale
          </span>
          <span className="stat-value" style={{ fontSize: 22 }}>
            {fmt(stats.totalCost, 2)}
            <span className="stat-unit">{L.currency}</span>
          </span>
          <span className="stat-sub">{stats.count} rifornimenti</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            <RouteIcon width={14} height={14} />
            Percorrenza totale
          </span>
          <span className="stat-value" style={{ fontSize: 22 }}>
            {fmt(stats.totalDistance, 0)}
            <span className="stat-unit">{L.distance}</span>
          </span>
          {lastRefuel ? (
            <span className="stat-sub">
              Ultimo: {fmt(lastRefuel.odometer, 0)} {L.distance}
            </span>
          ) : null}
        </div>
      </div>

      {stats.cycleIsReset && stats.cycleBaseDate ? (
        <p className="cycle-hint">
          <RotateIcon width={15} height={15} />
          <span>
            Ciclo azzerato al rifornimento con serbatoio pieno del {fmtDateShort(stats.cycleBaseDate)}:
            da quella base ripartono consumo e costi medi.
          </span>
        </p>
      ) : null}
    </section>
  );
}
