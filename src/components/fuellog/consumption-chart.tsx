"use client";

import { useMemo, useState } from 'react';
import type { Refuel, UnitSystem } from '@/lib/fuel/types';
import { consumptionHistory } from '@/lib/fuel/history';
import { fmt, fmtDateShort, unitLabels } from '@/lib/fuel/format';

export function ConsumptionChart({ refuels, unit }: { refuels: Refuel[]; unit: UnitSystem }) {
  const points = useMemo(() => consumptionHistory(refuels), [refuels]);
  const [selected, setSelected] = useState<string | null>(null);
  const labels = unitLabels(unit);
  const active = points.find(point => point.id === selected) ?? points.at(-1);
  const maximum = Math.max(1, ...points.flatMap(point => [point.consumption ?? 0, point.cumulative])) * 1.1;
  const x = (index: number) => points.length === 1 ? 300 : 55 + index * 510 / (points.length - 1);
  const y = (value: number) => 190 - value / maximum * 160;
  return (
    <section className="panel" aria-label="Andamento dei consumi stimati">
      <div className="panel-head"><h2>Andamento dei consumi stimati</h2></div>
      {points.length === 0 ? <p>Il grafico apparirà dopo due rifornimenti con distanza percorsa tra loro.</p> : <>
        <p className="text-dim">Rifornimenti in ordine cronologico · {labels.consumptionPrimary}. Stime basate sul carburante aggiunto, inclusi i parziali. Nessun reset ai pieni.</p>
        <svg viewBox="0 0 600 235" role="img" aria-label="Media totale e consumi dei singoli intervalli tra rifornimenti" style={{width: '100%', height: 'auto'}}>
          {[0, 0.5, 1].map(fraction => <g key={fraction}>
            <line x1="55" x2="565" y1={y(maximum * fraction)} y2={y(maximum * fraction)} stroke="currentColor" opacity="0.2" />
            <text x="45" y={y(maximum * fraction) + 4} textAnchor="end" fill="currentColor" fontSize="12">{fmt(maximum * fraction, 1)}</text>
          </g>)}
          <polyline points={points.map((point, index) => `${x(index)},${y(point.cumulative)}`).join(' ')} fill="none" stroke="#4ade80" strokeWidth="3" />
          {points.map((point, index) => <g key={point.id}>
            {point.consumption !== null && <rect x={x(index) - 4} y={y(point.consumption) - 4} width="8" height="8" fill="#60a5fa"><title>{fmtDateShort(point.date)}: intervallo {fmt(point.consumption)} {labels.consumptionPrimary}</title></rect>}
            <circle cx={x(index)} cy={y(point.cumulative)} r="4" fill="#4ade80"><title>{fmtDateShort(point.date)}: media totale {fmt(point.cumulative)} {labels.consumptionPrimary}</title></circle>
          </g>)}
          <text x="55" y="218" fill="currentColor" fontSize="12">{fmtDateShort(points[0].date)}</text>
          {points.length > 1 && <text x="565" y="218" textAnchor="end" fill="currentColor" fontSize="12">{fmtDateShort(points[points.length - 1].date)}</text>}
        </svg>
        <p><span style={{color: '#4ade80'}}>● Media totale</span> · <span style={{color: '#60a5fa'}}>■ Singolo intervallo</span></p>
        <label htmlFor="chart-refuel">Dettaglio del rifornimento</label>
        <select id="chart-refuel" className="input" value={active?.id ?? ''} onChange={event => setSelected(event.target.value)}>
          {points.map(point => <option key={point.id} value={point.id}>{fmtDateShort(point.date)} · {point.date.slice(11, 16)}</option>)}
        </select>
        {active && <p aria-live="polite" style={{marginTop: 10}}>
          Intervallo: {fmt(active.distance)} {labels.distance} / {fmt(active.volume)} {labels.volume} = {fmt(active.consumption)} {labels.consumptionPrimary}.
          {' '}Media totale: {fmt(active.cumulative)} {labels.consumptionPrimary}.
        </p>}
      </>}
    </section>
  );
}
