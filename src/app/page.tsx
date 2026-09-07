"use client";

/**
 * FuelLog — Registro rifornimenti offline-first.
 *
 * - Multi-veicolo con registro e statistiche isolati (localStorage)
 * - Unità Metrica (km, L, €) / Imperiale (mi, gal, $) con etichette dinamiche
 * - Media totale ponderata tra pieni, con parziali inclusi
 * - Esportazione/Importazione JSON, zero backend, zero telemetria
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppSettings, Refuel, VehiclesData, Vehicle } from "@/lib/fuel/types";
import { emptyVehiclesData, sortRefuels } from "@/lib/fuel/types";
import { computeStats } from "@/lib/fuel/calc";
import { setDataStore, setSettingsStore, useFuelStore } from "@/lib/fuel/store";
import { purgeLegacyLocalStorage } from "@/lib/fuel/persistence";
import {
  applyImport,
  createRefuel,
  createVehicle,
  downloadBackup,
  parseBackupFile,
} from "@/lib/fuel/storage";
import { fmtDateShort, unitLabels } from "@/lib/fuel/format";
import { downloadHistoryCsv } from "@/lib/fuel/csv";
import { dataFingerprint, REMINDER_KEY } from "@/lib/fuel/backup-reminder";
import { BackupReminder } from "@/components/fuellog/backup-reminder";
import { ConsumptionChart } from "@/components/fuellog/consumption-chart";
import { Dashboard } from "@/components/fuellog/dashboard";
import { RefuelForm, type FormValue } from "@/components/fuellog/refuel-form";
import { RefuelList } from "@/components/fuellog/refuel-list";
import { Modal } from "@/components/fuellog/modal";
import { VehiclesModal } from "@/components/fuellog/vehicles-modal";
import { DataModal } from "@/components/fuellog/data-modal";
import { ImportPreviewView, type ImportPreview } from "@/components/fuellog/import-preview";
import { ConfirmView } from "@/components/fuellog/confirm-view";
import { ToastStack, useToasts } from "@/components/fuellog/toast";
import {
  CarIcon,
  DatabaseIcon,
  FuelIcon,
  GaugeIcon,
  InfoIcon,
  ListIcon,
  PencilIcon,
  PlusIcon,
} from "@/components/fuellog/icons";

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export default function FuelLogApp() {
  const { data, settings, hydrated } = useFuelStore();
  const setData = setDataStore;
  const setSettings = setSettingsStore;

  const [vehiclesOpen, setVehiclesOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const [editingRefuel, setEditingRefuel] = useState<Refuel | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const importPayload = useRef<{ data: VehiclesData; settings: AppSettings } | null>(null);

  const toast = useToasts();
  const formRef = useRef<HTMLDivElement>(null);

  /* ---------- Service Worker (funzionamento offline) ---------- */
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline: la registrazione verrà ritentata al prossimo avvio */
      });
    }
  }, []);

  /* ---------- Notifica migrazione localStorage → IndexedDB ---------- */
  useEffect(() => {
    const onMigrated = () =>
      toast.show("Dati migrati da localStorage al database locale IndexedDB.", "info");
    window.addEventListener("fuellog:migrated", onMigrated);
    return () => window.removeEventListener("fuellog:migrated", onMigrated);
  }, [toast.show]);

  /* ---------- Selezione veicolo attivo (derivata, senza side-effect) ---------- */
  const activeVehicle: Vehicle | null = useMemo(() => {
    return (
      data.vehicles.find((v) => v.id === data.activeVehicleId) ?? data.vehicles[0] ?? null
    );
  }, [data]);

  const stats = useMemo(
    () => (activeVehicle ? computeStats(activeVehicle.refuels, settings.unitSystem) : null),
    [activeVehicle, settings.unitSystem]
  );

  const sortedRefuels = useMemo(
    () => (activeVehicle ? sortRefuels(activeVehicle.refuels) : []),
    [activeVehicle]
  );
  const baseId =
    stats && stats.cycleBaseIndex >= 0 ? sortedRefuels[stats.cycleBaseIndex]?.id ?? null : null;

  /* ---------- Mutazioni veicoli ---------- */
  const addVehicle = useCallback(
    (name: string) => {
      const vehicle = createVehicle(name);
      setData({ ...data, vehicles: [...data.vehicles, vehicle], activeVehicleId: vehicle.id });
      toast.show(`Veicolo "${vehicle.name}" creato.`, "success");
    },
    [data, setData, toast]
  );

  const renameVehicle = useCallback(
    (id: string, name: string) => {
      setData({
        ...data,
        vehicles: data.vehicles.map((v) => (v.id === id ? { ...v, name } : v)),
      });
      toast.show("Veicolo rinominato.", "success");
    },
    [data, setData, toast]
  );

  const selectVehicle = useCallback(
    (id: string) => {
      setEditingRefuel(null);
      if (data.activeVehicleId !== id) setData({ ...data, activeVehicleId: id });
    },
    [data, setData]
  );

  const requestDeleteVehicle = useCallback(
    (vehicle: Vehicle) => {
      setConfirm({
        title: `Eliminare "${vehicle.name}"?`,
        message: `Verranno eliminati anche i suoi ${vehicle.refuels.length} rifornimenti. Le statistiche degli altri veicoli non cambiano. Operazione non reversibile.`,
        confirmLabel: "Elimina veicolo",
        onConfirm: () => {
          setEditingRefuel(null);
          const vehicles = data.vehicles.filter((v) => v.id !== vehicle.id);
          setData({
            ...data,
            vehicles,
            activeVehicleId:
              data.activeVehicleId === vehicle.id ? vehicles[0]?.id ?? null : data.activeVehicleId,
          });
          toast.show(`Veicolo "${vehicle.name}" eliminato.`, "success");
        },
      });
    },
    [data, setData, toast]
  );

  /* ---------- Mutazioni rifornimenti ---------- */
  const submitRefuel = useCallback(
    (value: FormValue) => {
      if (!activeVehicle) return;
      if (editingRefuel) {
        const id = editingRefuel.id;
        setData({
          ...data,
          vehicles: data.vehicles.map((v) =>
            v.id === activeVehicle.id
              ? {
                  ...v,
                  refuels: v.refuels.map((r) =>
                    r.id === id
                      ? {
                          ...r,
                          date: value.date,
                          odometer: value.odometer,
                          volume: value.volume,
                          cost: value.cost,
                          full: value.full,
                          notes: value.notes,
                        }
                      : r
                  ),
                }
              : v
          ),
        });
        setEditingRefuel(null);
        toast.show("Rifornimento aggiornato: statistiche ricalcolate.", "success");
      } else {
        setData({
          ...data,
          vehicles: data.vehicles.map((v) =>
            v.id === activeVehicle.id
              ? { ...v, refuels: [...v.refuels, createRefuel(value)] }
              : v
          ),
        });
        toast.show(
          value.full ? "Pieno registrato: media totale ricalcolata." : "Rifornimento registrato.",
          "success"
        );
      }
    },
    [activeVehicle, data, editingRefuel, setData, toast]
  );

  const requestDeleteRefuel = useCallback(
    (refuel: Refuel) => {
      if (!activeVehicle) return;
      setConfirm({
        title: "Eliminare il rifornimento?",
        message: `Rifornimento del ${fmtDateShort(refuel.date)} (${refuel.volume} ${unitLabels(settings.unitSystem).volume}, ${refuel.cost} ${unitLabels(settings.unitSystem).currency}). Le statistiche del veicolo verranno ricalcolate da zero.`,
        confirmLabel: "Elimina",
        onConfirm: () => {
          setEditingRefuel((e) => (e?.id === refuel.id ? null : e));
          setData({
            ...data,
            vehicles: data.vehicles.map((v) =>
              v.id === activeVehicle.id
                ? { ...v, refuels: v.refuels.filter((r) => r.id !== refuel.id) }
                : v
            ),
          });
          toast.show("Rifornimento eliminato: statistiche ricalcolate.", "success");
        },
      });
    },
    [activeVehicle, data, setData, settings.unitSystem, toast]
  );

  /* ---------- Unità di misura ---------- */
  const toggleUnit = useCallback(
    (unit: AppSettings["unitSystem"]) => {
      if (settings.unitSystem !== unit) setSettings({ unitSystem: unit });
      toast.show(
        unit === "metric"
          ? "Sistema metrico: km, litri, €."
          : "Sistema imperiale: miglia, galloni, $.",
        "info"
      );
    },
    [setSettings, settings.unitSystem, toast]
  );

  /* ---------- Esporta / Importa / Reset ---------- */
  const exportData = useCallback(() => {
    const ok = downloadBackup(data, settings);
    if (ok) {
      try {
        localStorage.setItem(REMINDER_KEY, JSON.stringify({lastBackupAt: Date.now(), snoozedUntil: 0, fingerprint: dataFingerprint(data)}));
      } catch { /* Le esportazioni funzionano anche se lo storage non è disponibile. */ }
      window.dispatchEvent(new Event("fuellog:backup"));
    }
    toast.show(
      ok ? "Backup JSON scaricato." : "Impossibile creare il file di backup.",
      ok ? "success" : "error"
    );
  }, [data, settings, toast]);

  const copyDataToClipboard = useCallback(async () => {
    try {
      const { buildBackup } = await import('@/lib/fuel/storage');
      const backup = buildBackup(data, settings);
      await navigator.clipboard.writeText(JSON.stringify(backup, null, 2));
      try {
        localStorage.setItem(REMINDER_KEY, JSON.stringify({lastBackupAt: Date.now(), snoozedUntil: 0, fingerprint: dataFingerprint(data)}));
      } catch { /* ignore */ }
      window.dispatchEvent(new Event("fuellog:backup"));
      toast.show("Backup copiato negli appunti!", "success");
    } catch (e) {
      toast.show("Errore nella copia degli appunti.", "error");
    }
  }, [data, settings, toast]);

  const importFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const result = parseBackupFile(text);
        if (!result.ok || !result.data || !result.settings) {
          toast.show(result.error ?? "File non valido.", "error");
          return;
        }
        importPayload.current = { data: result.data, settings: result.settings };
        setImportPreview({
          fileName: file.name,
          vehicles: result.report?.vehicles ?? result.data.vehicles.length,
          refuels: result.report?.refuels ?? 0,
          skipped: result.report?.skipped ?? 0,
          unitSystem: result.settings.unitSystem,
        });
        setDataOpen(false);
      } catch {
        toast.show("Errore durante la lettura del file.", "error");
      }
    },
    [toast]
  );

  const applyImportMode = useCallback(
    (mode: "overwrite" | "merge") => {
      const payload = importPayload.current;
      if (!payload) return;
      if (mode === "merge" && payload.settings.unitSystem !== settings.unitSystem && data.vehicles.length > 0) {
        toast.show("Impossibile unire archivi con unità diverse. Usa un backup con le stesse unità oppure sostituisci i dati.", "error");
        return;
      }
      let imported;
      try {
        imported = applyImport(
        payload.data,
        data,
        mode
        );
      } catch (error) {
        toast.show(error instanceof Error ? error.message : "Importazione non riuscita.", "error");
        return;
      }
      const { data: resultData, addedVehicles, mergedVehicles } = imported;
      setEditingRefuel(null);
      setData(resultData);
      if (mode === "overwrite" || data.vehicles.length === 0) setSettings(payload.settings);
      importPayload.current = null;
      setImportPreview(null);
      toast.show(
        mode === "overwrite"
          ? `Dati sostituiti: ${resultData.vehicles.length} veicoli importati.`
          : `Unione completata: ${addedVehicles} nuovi veicoli, ${mergedVehicles} fusi.`,
        "success"
      );
    },
    [data, settings.unitSystem, toast]
  );

  const resetAll = useCallback(() => {
    setEditingRefuel(null);
    setData(emptyVehiclesData());
    // Rimuove anche le chiavi localStorage legacy (snapshot pre-migrazione)
    purgeLegacyLocalStorage();
    toast.show("Tutti i dati sono stati cancellati.", "success");
  }, [toast]);

  /* ---------- Render ---------- */
  if (!hydrated) {
    return (
      <div className="splash">
        <div className="splash-inner">
          <span className="brand-logo" style={{ width: 52, height: 52, borderRadius: 14 }}>
            <FuelIcon width={28} height={28} />
          </span>
          <span className="spinner" />
          <span>FUELLOG</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-row">
          <div className="brand">
            <span className="brand-logo">
              <FuelIcon width={20} height={20} />
            </span>
            <div>
              <div className="brand-name">FuelLog</div>
              <div className="brand-sub">Registro rifornimenti</div>
            </div>
          </div>
          <div
            className="segmented"
            role="group"
            aria-label="Sistema di unità di misura"
          >
            <button
              type="button"
              aria-pressed={settings.unitSystem === "metric"}
              onClick={() => toggleUnit("metric")}
            >
              Metrico
            </button>
            <button
              type="button"
              aria-pressed={settings.unitSystem === "imperial"}
              onClick={() => toggleUnit("imperial")}
            >
              Imperiale
            </button>
          </div>
        </div>

        <div className="vehicle-bar">
          <div style={{ position: "relative", flex: "1 1 auto", minWidth: 0 }}>
            <span className="vehicle-select-icon" aria-hidden="true">
              <CarIcon width={17} height={17} />
            </span>
            <select
              className="vehicle-select"
              value={activeVehicle?.id ?? ""}
              onChange={(e) => selectVehicle(e.target.value)}
              aria-label="Veicolo attivo"
              disabled={data.vehicles.length === 0}
            >
              {data.vehicles.length === 0 ? <option value="">Nessun veicolo</option> : null}
              {data.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setVehiclesOpen(true)}
            aria-label="Aggiungi veicolo / Gestisci veicoli"
            title="Aggiungi veicolo"
          >
            <PlusIcon width={20} height={20} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setDataOpen(true)}
            aria-label="Dati e backup"
            title="Dati e backup"
          >
            <DatabaseIcon width={19} height={19} />
          </button>
        </div>
      </header>

      <main className="app-main">
        <BackupReminder data={data} onExport={exportData} />
        <section aria-label="Cruscotto">
          <div className="section-title" style={{ marginBottom: 10 }}>
            <GaugeIcon width={14} height={14} />
            Cruscotto
          </div>
          <Dashboard vehicle={activeVehicle} stats={stats} unit={settings.unitSystem} />
          {activeVehicle && <div style={{marginTop: 12}}><ConsumptionChart key={activeVehicle.id} refuels={activeVehicle.refuels} unit={settings.unitSystem} /></div>}
          {!activeVehicle ? (
            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ marginTop: 10 }}
              onClick={() => setVehiclesOpen(true)}
            >
              <PlusIcon width={19} height={19} />
              Crea il primo veicolo
            </button>
          ) : null}
        </section>

        {activeVehicle ? (
          <>
            <section ref={formRef} aria-label="Inserimento rifornimento" style={{ scrollMarginTop: 150 }}>
              <div className="section-title" style={{ marginBottom: 10 }}>
                <PencilIcon width={14} height={14} />
                {editingRefuel ? "Modifica" : "Registra"}
              </div>
              <RefuelForm
                key={`${activeVehicle.id}:${editingRefuel?.id ?? "new"}`}
                vehicle={activeVehicle}
                unit={settings.unitSystem}
                editing={editingRefuel}
                onSubmit={submitRefuel}
                onCancelEdit={() => setEditingRefuel(null)}
                onError={(m) => toast.show(m, "error")}
              />
            </section>

            {activeVehicle.refuels.length > 0 ? (
              <section aria-label="Cronologia rifornimenti">
                <div className="section-title" style={{ marginBottom: 10 }}>
                  <ListIcon width={14} height={14} />
                  Cronologia · {activeVehicle.refuels.length}
                </div>
                <RefuelList
                  refuels={activeVehicle.refuels}
                  unit={settings.unitSystem}
                  baseId={baseId}
                  editingId={editingRefuel?.id ?? null}
                  onEdit={(r) => {
                    setEditingRefuel(r);
                    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  onDelete={requestDeleteRefuel}
                />
              </section>
            ) : null}
          </>
        ) : null}
      </main>

      <footer className="app-footer">
        <div className="footer-brand">
          FuelLog · dati solo su questo dispositivo
          <br />
          offline · nessuna telemetria
        </div>
        <div className="footer-actions">
          <button type="button" className="footer-btn" onClick={() => setVehiclesOpen(true)}>
            <CarIcon width={14} height={14} />
            Veicoli
          </button>
          <button type="button" className="footer-btn" onClick={() => setDataOpen(true)}>
            <DatabaseIcon width={14} height={14} />
            Importa / Esporta
          </button>
          <button type="button" className="footer-btn" onClick={() => setInfoOpen(true)}>
            <InfoIcon width={14} height={14} />
            Info
          </button>
        </div>
      </footer>

      {/* ---- Modale veicoli ---- */}
      <Modal
        open={vehiclesOpen}
        onClose={() => setVehiclesOpen(false)}
        title="Veicoli"
        icon={<CarIcon width={19} height={19} />}
      >
        <VehiclesModal
          onClose={() => setVehiclesOpen(false)}
          vehicles={data.vehicles}
          activeVehicleId={activeVehicle?.id ?? null}
          unit={settings.unitSystem}
          onAdd={addVehicle}
          onRename={renameVehicle}
          onSelect={(id) => {
            selectVehicle(id);
            setVehiclesOpen(false);
          }}
          onDelete={requestDeleteVehicle}
        />
      </Modal>

      {/* ---- Modale dati ---- */}
      <DataModal
        open={dataOpen}
        onClose={() => setDataOpen(false)}
        data={data}
        settings={settings}
        onExport={exportData}
        onCopyJSON={copyDataToClipboard}
        onExportCsv={() => {
          const ok = downloadHistoryCsv(data, settings);
          toast.show(ok ? "Esportazione CSV avviata." : "Impossibile esportare il CSV.", ok ? "success" : "error");
        }}
        onImportFile={importFile}
        onResetAll={resetAll}
      />

      {/* ---- Modale anteprima import ---- */}
      <Modal
        open={importPreview !== null}
        onClose={() => {
          importPayload.current = null;
          setImportPreview(null);
        }}
        title="Importa backup"
        icon={<DatabaseIcon width={19} height={19} />}
      >
        {importPreview ? (
          <ImportPreviewView
            preview={importPreview}
            onChoose={applyImportMode}
            onCancel={() => {
              importPayload.current = null;
              setImportPreview(null);
            }}
          />
        ) : null}
      </Modal>

      {/* ---- Modale info ---- */}
      <Modal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="Come funziona"
        icon={<InfoIcon width={19} height={19} />}
      >
        <div className="info-block">
          <h3>Motore di calcolo</h3>
          <p>
            La media totale usa la distanza tra il primo e l’ultimo pieno e tutti i litri
            aggiunti dopo il primo pieno, incluso quello finale e i parziali intermedi.
            Si calcola dividendo la distanza totale per i litri totali (km/l o mpg),
            oppure litri × 100 / distanza (l/100km). Non è una media delle singole medie.
            Il costo per distanza usa le spese degli stessi rifornimenti.
            Un nuovo pieno aggiorna la media senza azzerarla. I parziali successivi restano
            in attesa del prossimo pieno; prima di due pieni la media non è disponibile.
            Spesa e percorrenza totali comprendono invece tutto lo storico.
          </p>
        </div>
        <div className="info-block">
          <h3>Unità di misura</h3>
          <p>
            I dati registrati sono <strong>interpretati</strong> con il sistema attualmente attivo:
            passando da Metrico a Imperiale, odometri e volumi esistenti vengono letti come miglia e
            galloni (e le formule cambiano di conseguenza). Usa un sistema per veicolo per evitare
            incongruenze.
          </p>
        </div>
        <div className="info-block">
          <h3>Validazione</h3>
          <p>
            Non è possibile salvare un rifornimento con odometro inferiore a quelli già registrati
            (la sequenza cronologica deve avere valori non decrescenti). A ogni modifica o
            cancellazione le statistiche vengono ricalcolate da zero.
          </p>
        </div>
        <div className="info-block">
          <h3>Archivio dati</h3>
          <p>
            I dati sono salvati nel database locale <code>IndexedDB</code> del dispositivo: più
            capiente e affidabile di <code>localStorage</code> (da cui vengono migrati
            automaticamente), e accessibile sia nel browser sia dentro la WebView di un APK. Il
            layer di archiviazione è isolato: in futuro è possibile passare a SQLite nativo
            (Capacitor) senza modificare interfaccia e calcoli.
          </p>
        </div>
        <div className="info-block">
          <h3>Installazione (PWA → APK)</h3>
          <p>
            L&apos;app è una PWA autonoma: dopo la prima apertura funziona offline. Per generare un
            APK Android pubblicala su un host statico (es. pagine GitHub) e usa{" "}
            <code>PWABuilder</code>, oppure incapsula la build con <code>Capacitor</code>: in
            entrambi i casi IndexedDB persiste nel filesystem dell&apos;app. Nessun servizio
            esterno viene contattato in esecuzione.
          </p>
        </div>
      </Modal>

      {/* ---- Modale conferma ---- */}
      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Conferma"
        icon={<InfoIcon width={19} height={19} />}
      >
        {confirm ? (
          <ConfirmView
            danger
            title={confirm.title}
            message={confirm.message}
            confirmLabel={confirm.confirmLabel}
            onConfirm={() => {
              confirm.onConfirm();
              setConfirm(null);
            }}
            onCancel={() => setConfirm(null)}
          />
        ) : null}
      </Modal>

      <ToastStack stack={toast.stack} />
    </div>
  );
}
