/// <reference types="bun-types" />
import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';

let platform = 'android';
const save = mock(async (_options: { filename: string; content: string; mimeType: string }) => ({ status: 'saved' as 'saved' | 'cancelled' }));
const { createFileExporter } = await import('../../src/lib/fuel/download');
const triggerFileDownloadOrShare = createFileExporter({ getPlatform: () => platform, save });
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
afterAll(() => {
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else Reflect.deleteProperty(globalThis, 'navigator');
  mock.restore();
});
beforeEach(() => {
  platform = 'android';
  save.mockReset();
  save.mockResolvedValue({ status: 'saved' });
});

describe('Esportazione file', () => {
  test('Android passa il JSON UTF-8 al selettore nativo e attende la scrittura', async () => {
    const content = JSON.stringify({ note: 'Città, € e benzina', vehicles: [] });
    let finish!: (value: { status: 'saved' }) => void;
    save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let completed = false;
    const operation = triggerFileDownloadOrShare(new Blob([content], {type: 'application/json'}), 'backup.json');
    void operation.then(() => { completed = true; });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(completed).toBe(false);
    expect(save).toHaveBeenCalledWith({ filename: 'backup.json', content, mimeType: 'application/json' });
    finish({ status: 'saved' });
    expect(await operation).toBe('saved');
  });
  test('Android annullato o fallito non risulta salvato', async () => {
    save.mockResolvedValueOnce({ status: 'cancelled' });
    expect(await triggerFileDownloadOrShare(new Blob(['{}']), 'backup.json')).toBe('cancelled');
    save.mockRejectedValueOnce(new Error('File non scrivibile'));
    expect(await triggerFileDownloadOrShare(new Blob(['{}']), 'backup.json')).toBe('failed');
  });
  test('CSV usa MIME valido e conserva BOM, accenti e righe', async () => {
    const content = '\uFEFF"Città";"12,5"\r\n';
    await triggerFileDownloadOrShare(new Blob([content], {type: 'text/csv;charset=utf-8'}), 'storico.csv');
    expect(save).toHaveBeenCalledWith({ filename: 'storico.csv', content, mimeType: 'text/csv' });
  });
  test('browser attende la condivisione e riconosce annullamento', async () => {
    platform = 'web';
    const share = mock(async () => {});
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { canShare: () => true, share } });
    expect(await triggerFileDownloadOrShare(new Blob(['{}']), 'backup.json')).toBe('started');
    expect(save).not.toHaveBeenCalled();
    share.mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'));
    expect(await triggerFileDownloadOrShare(new Blob(['{}']), 'backup.json')).toBe('cancelled');
  });
});
