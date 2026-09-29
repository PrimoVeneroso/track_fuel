/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  chooseAnchorAndDerived,
  deriveValue,
  type NumField,
} from '../../src/lib/fuel/recalc';

const T0 = { volume: 0, cost: 0, price: 0 };
const ALWAYS = () => true;

describe('Ricalcolo dinamico (Smart Dependency)', () => {
  test('il campo modificato non può mai essere quello derivato (invariante no-overwrite)', () => {
    const touched = { volume: 1, cost: 2, price: 3 };
    for (const edited of ['volume', 'cost', 'price'] as NumField[]) {
      const { anchor, derived } = chooseAnchorAndDerived(edited, touched, ALWAYS);
      expect(anchor).not.toBe(edited);
      expect(derived).not.toBe(edited);
      // ancora + derivato = esattamente i due campi restanti
      expect([anchor, derived].sort()).toEqual(
        (['volume', 'cost', 'price'] as NumField[]).filter((f) => f !== edited).sort(),
      );
    }
  });

  test('correzione del prezzo: ancora=litri (toccato prima), si ricalcola solo la spesa', () => {
    // l'utente ha digitato prima i litri, poi il prezzo (la spesa è riempita da noi)
    const touched = { volume: 1, cost: 0, price: 2 };
    const { anchor, derived } = chooseAnchorAndDerived('price', touched, ALWAYS);
    expect(anchor).toBe('volume');
    expect(derived).toBe('cost');
    const res = deriveValue(derived, { volume: 50, cost: 92.95, price: 1.959 });
    expect(res).not.toBeNull();
    expect(res!.digits).toBe(2);
    expect(res!.value).toBeCloseTo(50 * 1.959, 9);
    // i litri (ancora) non vengono mai riscritti
  });

  test('litri e spesa digitati a mano → il prezzo è derivato', () => {
    const touched = { volume: 1, cost: 2, price: 0 };
    const { anchor, derived } = chooseAnchorAndDerived('cost', touched, ALWAYS);
    expect(anchor).toBe('volume'); // tocco più recente rispetto al prezzo
    expect(derived).toBe('price');
    const res = deriveValue('price', { volume: 50, cost: 97.95, price: 0 });
    expect(res).not.toBeNull();
    expect(res!.digits).toBe(3);
    expect(res!.value).toBeCloseTo(97.95 / 50, 9);
  });

  test('a riposo (nessun tocco) vince la priorità: modificare i litri usa il prezzo come ancora', () => {
    // solo il prezzo ha un valore valido
    const isValid = (f: NumField) => f === 'price';
    const { anchor, derived } = chooseAnchorAndDerived('volume', T0, isValid);
    expect(anchor).toBe('price');
    expect(derived).toBe('cost');
  });

  test('a riposo senza valori validi: ancor/derivato restano i due campi restanti', () => {
    const { anchor, derived } = chooseAnchorAndDerived('volume', T0, () => false);
    expect([anchor, derived].sort()).toEqual(['cost', 'price']);
    expect(anchor).not.toBe('volume');
    expect(derived).not.toBe('volume');
  });

  test('pulire un campo (valore non numerico) non ricalcola nulla', () => {
    // editedValue = NaN → uno dei due fattori non è > 0 → null
    expect(deriveValue('cost', { volume: NaN, cost: 0, price: 1.859 })).toBeNull();
    expect(deriveValue('volume', { volume: 0, cost: 92.95, price: NaN })).toBeNull();
    expect(deriveValue('price', { volume: 50, cost: 0, price: NaN })).toBeNull();
  });

  test('deriveValue: le tre formule e i casi null', () => {
    const cost = deriveValue('cost', { volume: 40, cost: 0, price: 1.8 });
    expect(cost).not.toBeNull();
    expect(cost!.value).toBeCloseTo(72, 9);
    expect(cost!.digits).toBe(2);

    const vol = deriveValue('volume', { volume: 0, cost: 72, price: 1.8 });
    expect(vol).not.toBeNull();
    expect(vol!.value).toBeCloseTo(40, 9);
    expect(vol!.digits).toBe(2);

    const price = deriveValue('price', { volume: 40, cost: 72, price: 0 });
    expect(price).not.toBeNull();
    expect(price!.value).toBeCloseTo(1.8, 9);
    expect(price!.digits).toBe(3);

    // fattori mancanti o non positivi → null
    expect(deriveValue('cost', { volume: 0, cost: 0, price: 1.8 })).toBeNull();
    expect(deriveValue('volume', { volume: 0, cost: 0, price: 1.8 })).toBeNull();
    expect(deriveValue('price', { volume: 40, cost: 0, price: 0 })).toBeNull();
  });
});
