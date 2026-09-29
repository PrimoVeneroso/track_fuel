/**
 * FuelLog — Ricalcolo dinamico Prezzo/L · Spesa Totale · Litri.
 *
 * Opzione A "Smart Dependency": i tre campi sono vincolati da
 *   Spesa Totale = Litri × Prezzo/L
 * Quando l'utente modifica un campo, ricalcoliamo SOLO il terzo campo,
 * usando come riferimento (ancora) l'altro campo che l'utente ha toccato
 * per ultimo. Il campo in corso di modifica e l'ancora non vengono mai
 * sovrascritti: così correggere un valore digitato male non genera più
 * conflitti di sovrascrittura.
 *
 * Logica pura (nessun React): il componente la chiama a ogni change e la
 * test copre qui, in modo deterministico, il comportamento "no-overwrite".
 */

export type NumField = "volume" | "cost" | "price";
export const NUM_FIELDS: readonly NumField[] = ["volume", "cost", "price"];

/**
 * Priorità "a riposo" per scegliere l'ancora quando l'utente non ha ancora
 * toccato (o ha toccato in pari) gli altri campi: litri e prezzo sono le
 * misure dirette, la spesa è il totale calcolato.
 */
const DEFAULT_ANCHOR: Record<NumField, NumField[]> = {
  volume: ["price", "cost"],
  cost: ["volume", "price"],
  price: ["volume", "cost"],
};

/**
 * Decide, dopo la modifica di `edited`, quale campo fare da ancora e quale
 * ricalcolare (il derivato, cioè il terzo).
 *
 *  - Ancora = l'altro campo toccato più di recente dall'utente
 *    (`touched` è un contatore monotono per campo, scritto solo quando
 *    l'utente digita — non quando il campo è riempito in automatico).
 *  - A parità (nessuna storia di input) si usa la priorità a riposo,
 *    preferendo l'ancora che ha un valore valido (`isValid`).
 *
 * Invariante: `anchor` e `derived` sono i due campi diversi da `edited`,
 * quindi il campo modificato non può mai risultare derivato.
 */
export function chooseAnchorAndDerived(
  edited: NumField,
  touched: Record<NumField, number>,
  isValid: (f: NumField) => boolean
): { anchor: NumField; derived: NumField } {
  const others = NUM_FIELDS.filter((f) => f !== edited);
  const [a, b] = others;
  let anchor: NumField;
  if (touched[a] === touched[b]) {
    anchor = DEFAULT_ANCHOR[edited].find(isValid) ?? a;
  } else {
    anchor = touched[a] > touched[b] ? a : b;
  }
  const derived = others.find((f) => f !== anchor)!;
  return { anchor, derived };
}

/**
 * Calcola il valore del campo `derived` a partire dai due campi noti,
 * restituendo anche i decimali con cui formattarlo.
 * Restituisce null se i due campi necessari non sono entrambi > 0.
 */
export function deriveValue(
  derived: NumField,
  values: Record<NumField, number>
): { value: number; digits: number } | null {
  const { volume: v, cost: c, price: p } = values;
  const pos = (n: number) => Number.isFinite(n) && n > 0;
  if (derived === "cost" && pos(v) && pos(p)) return { value: v * p, digits: 2 };
  if (derived === "volume" && pos(c) && pos(p)) return { value: c / p, digits: 2 };
  if (derived === "price" && pos(c) && pos(v)) return { value: c / v, digits: 3 };
  return null;
}
